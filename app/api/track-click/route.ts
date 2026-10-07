import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution, isValidChannel } from "@/app/lib/attribution";
import { isBotRequest } from "@/app/lib/bot-detect";
import { readClickSignals } from "@/app/lib/click-signals";

// 6/10/2026: one visitor tapped "call" on a profile 14 times in 34 seconds and each
// tap became a row, so one person read as fourteen inquiries on the therapist's own
// dashboard and in every admin count. A repeat of the same button by the same visit
// within this window is skipped. The first tap is always kept, so a therapist with
// any contact still has one (the refund guarantee only asks "none, or at least one").
// Two minutes covers the whole burst and still counts a second attempt after a real
// pause. Rows from before 7/10/2026 are raw and were not changed.
const CLICK_DEDUPE_SECONDS = 120;

const VALID_TYPES = ["whatsapp", "phone", "email", "site_message"] as const;
// Surfaces a contact can be initiated from. "profile" was allowed by the DB
// CHECK constraint from the start but was missing here, so profile-page
// whatsapp/phone clicks were silently coerced to "directory" below and became
// indistinguishable from directory-card clicks. Keep this list in sync with
// therapist_contact_clicks_source_check.
const VALID_SOURCES = ["match", "directory", "profile"] as const;
type ClickType = (typeof VALID_TYPES)[number];
type Source = (typeof VALID_SOURCES)[number];

// Simple in-memory rate limiter: max 30 clicks per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  // עקביות עם track/track-view: לחיצת קשר של בוט היא ליד מזויף - שלא ייספר
  // לא במשפך ולא בערבות ההחזר של מטפלים משלמים.
  if (isBotRequest(req)) {
    return NextResponse.json({ ok: true, bot: true });
  }

  try {
    const body = await req.json();
    const { therapist_id, click_type, source, session_id } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(click_type as ClickType)) {
      return NextResponse.json({ ok: false, error: "Invalid click_type" }, { status: 400 });
    }
    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";
    // Same session key the views/impressions carry — lets a click be joined to
    // the visitor's funnel (e.g. card-click with no profile view).
    const safeSessionId =
      typeof session_id === "string" && session_id.length > 0 && session_id.length <= 128 ? session_id : null;

    const attribution = sanitizeAttribution(body);
    // Server-side safety net: the client's stored utm can be lost mid-session
    // (seen live 16/7: a gclid-only re-landing overwrote the stored g-online
    // tag with nulls, so 3 paid contacts vanished from the campaign funnel).
    // When the campaign tag is missing but this session's own analytics events
    // carry one, restore it from the latest tagged event — only if its channel
    // doesn't contradict the one the click arrived with.
    if (!attribution.utm_campaign && safeSessionId) {
      const { data: tagged } = await supabaseAdmin
        .from("analytics_events")
        .select("channel, utm_source, utm_medium, utm_campaign")
        .eq("session_id", safeSessionId)
        .not("utm_campaign", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tagged && (!attribution.channel || tagged.channel === attribution.channel)) {
        attribution.utm_campaign = tagged.utm_campaign;
        attribution.utm_source = attribution.utm_source ?? tagged.utm_source;
        attribution.utm_medium = attribution.utm_medium ?? tagged.utm_medium;
        if (!attribution.channel && isValidChannel(tagged.channel)) attribution.channel = tagged.channel;
      }
    }

    // The referring host only exists on the LANDING event - document.referrer
    // becomes our own domain once the visitor navigates internally, so without
    // this every contact click would record null and the backlink report would
    // show visits but never conversions. Take it from the earliest event of
    // this session that carried one.
    if (!attribution.referrer_host && safeSessionId) {
      const { data: landed } = await supabaseAdmin
        .from("analytics_events")
        .select("referrer_host")
        .eq("session_id", safeSessionId)
        .not("referrer_host", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (landed?.referrer_host) attribution.referrer_host = landed.referrer_host;
    }

    // Who clicked: the device from the request's User-Agent, and whether the browser
    // says it is automation-controlled. Stored with the click so the next burst can
    // be told apart (a person on a desktop whose tel: link did nothing, or a tool).
    const { device, automated } = readClickSignals(body, req.headers.get("user-agent"));

    // The skip-and-insert is one database function, not a select followed by an
    // insert here: a burst can put two requests there within microseconds of each
    // other (6/10: two rows 66 microseconds apart), and both would pass a plain check.
    const { data: recorded, error } = await supabaseAdmin.rpc("record_contact_click", {
      p_therapist_id: therapist_id,
      p_click_type: click_type,
      p_source: safeSource,
      p_session_id: safeSessionId,
      p_channel: attribution.channel,
      p_utm_source: attribution.utm_source,
      p_utm_medium: attribution.utm_medium,
      p_utm_campaign: attribution.utm_campaign,
      p_referrer_host: attribution.referrer_host,
      p_device: device,
      p_automated: automated,
      p_window_seconds: CLICK_DEDUPE_SECONDS,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...(recorded === false ? { deduped: true } : {}) });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
