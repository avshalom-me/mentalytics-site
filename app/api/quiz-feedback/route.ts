import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";

// Anonymous post-quiz feedback ("משהו לא ברור או לא הסתדר?") from the results
// screen. Lands in crm_leads so it shows up in the admin leads screen next to
// every other inbound message; contact details are optional by design — the
// point is to hear why people stop, not to capture a lead.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";
    if (!message) {
      return NextResponse.json({ ok: false, error: "הודעה ריקה" }, { status: 400 });
    }
    const contact = typeof body?.contact === "string" ? body.contact.trim().slice(0, 200) : "";
    const quizType = body?.quiz_type === "kids" ? "kids" : "adults";

    const { error } = await supabaseAdmin.from("crm_leads").insert({
      lead_type: "general",
      name: `משוב שאלון (${quizType === "kids" ? "ילדים" : "מבוגרים"})`,
      contact: contact || "אנונימי",
      message,
      source: "quiz_feedback",
      ...sanitizeAttribution(body),
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
