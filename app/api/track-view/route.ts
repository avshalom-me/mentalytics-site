import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  isValidRegion,
  isValidIssue,
  isValidAgeBand,
  isValidGender,
} from "@/app/lib/stats-categories";
import { sanitizeAttribution, isValidChannel } from "@/app/lib/attribution";

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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
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

    await supabaseAdmin
      .from("therapist_profile_views")
      .insert({
        therapist_id,
        source: safeSource,
        viewer_region: safeRegion,
        viewer_issue: safeIssue,
        viewer_age_band: safeAgeBand,
        viewer_gender: safeGender,
        match_score: safeScore,
        session_id: safeSessionId,
        ...attribution,
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
