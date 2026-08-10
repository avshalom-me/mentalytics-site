import { NextRequest, NextResponse } from "next/server";
import { sendCancellationFeedbackEmail } from "@/app/lib/therapist-emails";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Known cancellation reasons — the form sends these exact strings. Validating
// against the allow-list keeps the public endpoint from being used to inject
// arbitrary content into the admin email.
// "מצאתי מספיק מטופלים" נוסף 10/8/26: זו עזיבה מהצלחה, ובלעדיה היא נפלה
// תחת "אחר" ונקראה בנתונים כמו כישלון של המוצר.
const ALLOWED_REASONS = [
  "המחיר",
  "מעט פניות",
  "מצאתי מספיק מטופלים",
  "לא התאים לי כרגע",
  "חוויית השימוש באתר",
  "אחר",
];

export async function POST(req: NextRequest) {
  // Also sends mail on every call, so it shares the Resend allowance the
  // contact form is gated for. Cancellation feedback is submitted once.
  const gate = rateLimit("therapist-feedback", clientIp(req), 3, 60 * 60_000);
  if (!gate.ok) {
    return tooManyRequests(gate.retryAfterSeconds, "נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.");
  }

  let body: { name?: unknown; email?: unknown; reasons?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const reasons = Array.isArray(body.reasons)
    ? body.reasons.filter((r): r is string => typeof r === "string" && ALLOWED_REASONS.includes(r))
    : [];

  if (reasons.length === 0 && !message) {
    return NextResponse.json({ ok: false, error: "empty feedback" }, { status: 400 });
  }

  // נשמר לפני השליחה: המייל לאדמין עלול להיכשל (מכסה/רשת), והמשוב עצמו הוא
  // הנכס - בלעדיו אי אפשר לענות על "מה הסיבה הנפוצה לעזיבה" לאורך זמן.
  // כשל בשמירה לא מפיל את הבקשה: עדיף משוב שנשלח ולא נשמר מאשר משוב שאבד.
  try {
    const { data: t } = email
      ? await supabaseAdmin.from("therapists").select("id").ilike("email", email).maybeSingle()
      : { data: null };
    const { error: insErr } = await supabaseAdmin.from("therapist_cancellation_feedback").insert({
      therapist_id: t?.id ?? null,
      name: name || null,
      email: email || null,
      reasons,
      message: message || null,
    });
    if (insErr) console.error("therapist-feedback: insert failed:", insErr.message);
  } catch (e) {
    console.error("therapist-feedback: insert threw:", e);
  }

  const sent = await sendCancellationFeedbackEmail({ name, email, reasons, message });
  if (!sent.ok) {
    return NextResponse.json({ ok: false, error: sent.error || "send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
