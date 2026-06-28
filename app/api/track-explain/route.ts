import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  isValidRegion,
  isValidIssue,
  isValidAgeBand,
  isValidGender,
} from "@/app/lib/stats-categories";

// Logs a single "user clicked ✦ למה הוצע לי?" event into analytics_events.
// Anonymous viewer-context fields are validated against the same enum the
// profile-view tracker uses; invalid values become null instead of 400 so
// the client doesn't need to know the taxonomy.

const BodySchema = z.object({
  questionnaire_type: z.enum(["adult", "child"]),
  treatment_key: z.string().min(1).max(200),
  treatment_label: z.string().min(1).max(200),
  domain: z.string().max(200).optional(),
  urgent: z.boolean().optional(),
  session_id: z.string().min(1).max(128).optional(),
  // Anonymous viewer context (sent client-side from the questionnaire answers).
  // Nullable: the client sends null when a field is unknown (e.g. region isn't
  // chosen yet on the results screen). Invalid/null values are nullified below.
  viewer_region: z.string().nullable().optional(),
  viewer_issue: z.string().nullable().optional(),
  viewer_age_band: z.string().nullable().optional(),
  viewer_gender: z.string().nullable().optional(),
});

// In-memory rate limiter: 60 events per IP per minute. Same shape as track-view.
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

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
    const b = parsed.data;

    const metadata = {
      questionnaire_type: b.questionnaire_type,
      treatment_key: b.treatment_key,
      treatment_label: b.treatment_label,
      domain: b.domain ?? null,
      urgent: b.urgent ?? false,
      viewer_region: isValidRegion(b.viewer_region) ? b.viewer_region : null,
      viewer_issue: isValidIssue(b.viewer_issue) ? b.viewer_issue : null,
      viewer_age_band: isValidAgeBand(b.viewer_age_band) ? b.viewer_age_band : null,
      viewer_gender: isValidGender(b.viewer_gender) ? b.viewer_gender : null,
    };

    await supabaseAdmin
      .from("analytics_events")
      .insert({
        event_type: "recommendation_explain_click",
        source: b.questionnaire_type,
        session_id: b.session_id ?? null,
        metadata,
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
