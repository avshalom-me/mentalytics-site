import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";

// Creates an anonymous saved-match permalink (see match_tokens migration):
// stores the matched therapist list + the ORIGINAL attribution, so a return
// visit — days later, any device — restores campaign credit. No PII.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const body = await req.json();
    const ids: unknown = body?.therapist_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20) {
      return NextResponse.json({ ok: false, error: "bad therapist_ids" }, { status: 400 });
    }
    const therapistIds = ids.filter((x): x is string => typeof x === "string" && UUID_RE.test(x));
    if (therapistIds.length === 0) {
      return NextResponse.json({ ok: false, error: "bad therapist_ids" }, { status: 400 });
    }

    const quizType = body?.quiz_type === "kids" ? "kids" : "adults";
    const sessionId =
      typeof body?.session_id === "string" && body.session_id.length > 0 && body.session_id.length <= 128
        ? body.session_id
        : null;
    const treatmentLabel =
      typeof body?.treatment_label === "string" && body.treatment_label.length > 0
        ? body.treatment_label.slice(0, 120)
        : null;
    const attr = sanitizeAttribution(body);

    const token = randomBytes(8).toString("base64url"); // 11 url-safe chars

    const { error } = await supabaseAdmin.from("match_tokens").insert({
      token,
      quiz_type: quizType,
      therapist_ids: therapistIds,
      treatment_label: treatmentLabel,
      session_id: sessionId,
      channel: attr.channel,
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
    });
    if (error) {
      console.error("match_tokens insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true, token });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
