import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";
import { isBotRequest } from "@/app/lib/bot-detect";

const VALID_EVENTS = ["page_view", "profile_impression", "filter_used", "quiz_step", "quiz_complete", "recruit_page_view", "therapist_explain_click", "matching_click", "match_saved"] as const;
type EventType = (typeof VALID_EVENTS)[number];

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 120) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // בוטים שמריצים JS (סורקי SEO, בוטים של AI, headless) נרשמו כאן כסשנים
  // וכחשיפות אמיתיות - ב-8/8/2026 סורק אחד ייצר יום שלם של "תנועה". מוחזר
  // ok כדי לא לאותת על החסימה; פשוט לא נרשם כלום. (שינוי מדידה, 12/8/2026.)
  if (isBotRequest(req)) {
    return NextResponse.json({ ok: true, bot: true });
  }

  try {
    const body = await req.json();
    const { event_type, source, therapist_id, session_id, metadata } = body ?? {};

    if (!VALID_EVENTS.includes(event_type as EventType)) {
      return NextResponse.json({ ok: false, error: "Invalid event_type" }, { status: 400 });
    }

    const safeTherapistId = typeof therapist_id === "string" && therapist_id.length > 0 ? therapist_id : null;
    const safeSessionId = typeof session_id === "string" && session_id.length > 0 && session_id.length <= 128 ? session_id : null;
    const safeSource = typeof source === "string" ? source : null;
    const safeMetadata = typeof metadata === "object" && metadata !== null ? metadata : {};

    // Dedup impressions: skip if same (therapist_id, session_id) in last 5 min
    if (event_type === "profile_impression" && safeTherapistId && safeSessionId) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data: recent } = await supabaseAdmin
        .from("analytics_events")
        .select("id")
        .eq("event_type", "profile_impression")
        .eq("therapist_id", safeTherapistId)
        .eq("session_id", safeSessionId)
        .gte("created_at", fiveMinAgo)
        .limit(1)
        .maybeSingle();
      if (recent) {
        return NextResponse.json({ ok: true, deduped: true });
      }
    }

    // A swallowed insert error here silently drops events — a DB CHECK
    // constraint that lags behind VALID_EVENTS rejected matching_click /
    // therapist_explain_click for 2 days with zero trace. Log + surface it.
    const { error } = await supabaseAdmin.from("analytics_events").insert({
      event_type,
      source: safeSource,
      therapist_id: safeTherapistId,
      session_id: safeSessionId,
      metadata: safeMetadata,
      ...sanitizeAttribution(body),
    });
    if (error) {
      console.error("analytics_events insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
