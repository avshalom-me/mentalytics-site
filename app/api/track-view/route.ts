import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  isValidRegion,
  isValidIssue,
  isValidAgeBand,
  isValidGender,
} from "@/app/lib/stats-categories";
import { sanitizeAttribution, isValidChannel } from "@/app/lib/attribution";
import { isBotRequest } from "@/app/lib/bot-detect";

// "match_card"   = impression in the match-results list
// "match"        = entry into the full profile page coming from match results
// "directory"    = entry into the full profile page from the directory
const VALID_SOURCES = ["match", "match_card", "directory"] as const;
type Source = (typeof VALID_SOURCES)[number];

// Simple in-memory rate limiter: max 60 views per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

function clampScore(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// Free-text match context (treatment label / specific finding) — not enum-
// validated because the label set lives in the quiz code, but clamped and
// stripped of markup characters. k-anon (3+ identical values) at display time
// makes junk injections invisible anyway.
const BLOCKED_CONTEXT_CHARS = ["<", ">", "&", '"', "'", "`", String.fromCharCode(92)];
function cleanContextText(x: unknown, max: number): string | null {
  if (typeof x !== "string") return null;
  const t = Array.from(x)
    .filter((ch) => !BLOCKED_CONTEXT_CHARS.includes(ch))
    .join("")
    .trim()
    .slice(0, max);
  return t.length > 0 ? t : null;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // סורק שמריץ JS נרשם כאן כצפיות פרופיל אמיתיות (8/8/2026: 462 צפיות על 143
  // מטפלים ביום). זיהוי לפי UA בזמן הבקשה - ראו app/lib/bot-detect.ts.
  if (isBotRequest(req)) {
    return NextResponse.json({ ok: true, bot: true });
  }

  try {
    const body = await req.json();
    const { therapist_id, source, viewer_region, viewer_issue, viewer_age_band, viewer_gender, match_score, session_id } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
    }
    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";

    // Anonymous enum validation — invalid values become null, not 400
    const safeRegion = isValidRegion(viewer_region) ? viewer_region : null;
    const safeIssue = isValidIssue(viewer_issue) ? viewer_issue : null;
    const safeAgeBand = isValidAgeBand(viewer_age_band) ? viewer_age_band : null;
    const safeGender = isValidGender(viewer_gender) ? viewer_gender : null;
    const safeScore = safeSource === "directory" ? null : clampScore(match_score);
    // Match-flow-only context: which treatment recommendation (and which
    // specific quiz finding) led this visitor to the profile.
    const safeTreatment = safeSource === "directory" ? null : cleanContextText(body?.viewer_treatment, 80);
    const safeSymptom = safeSource === "directory" ? null : cleanContextText(body?.viewer_symptom, 160);
    const safeSessionId = typeof session_id === "string" && session_id.length > 0 && session_id.length <= 128
      ? session_id
      : null;

    // Dedup: skip insert if same (therapist_id, session_id, source) viewed in last 30 minutes.
    // Including source lets us count both a match-card view and a full-profile entry separately.
    if (safeSessionId) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("therapist_profile_views")
        .select("id")
        .eq("therapist_id", therapist_id)
        .eq("session_id", safeSessionId)
        .eq("source", safeSource)
        .gte("viewed_at", thirtyMinAgo)
        .limit(1)
        .maybeSingle();
      if (recent) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    const attribution = sanitizeAttribution(body);
    // Same server-side safety net as track-click: the client's stored utm can
    // be lost mid-session (gclid-only re-landing, blocked storage). When the
    // campaign tag is missing but this session's analytics events carry one,
    // restore it — only if its channel doesn't contradict the incoming one.
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
    // is our own domain (or empty) once the visitor navigates internally, so
    // without this every conversion event would record null and the backlink
    // report would show visits but never contacts. Take it from the earliest
    // event of this session that carried one.
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

    await supabaseAdmin
      .from("therapist_profile_views")
      .insert({
        therapist_id,
        source: safeSource,
        viewer_region: safeRegion,
        viewer_issue: safeIssue,
        viewer_age_band: safeAgeBand,
        viewer_gender: safeGender,
        viewer_treatment: safeTreatment,
        viewer_symptom: safeSymptom,
        match_score: safeScore,
        session_id: safeSessionId,
        ...attribution,
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
