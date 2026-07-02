import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chargeQuizPayment, QUIZ_BASE_PRICE } from "@/app/lib/sumit";
import { sanitizeClickIds } from "@/app/lib/attribution";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// Persistent per-IP daily cap on card-charge ATTEMPTS. This is the real
// anti-carding control: the short window above is in-memory (resets on cold
// start, per-lambda), and both it and the pending-row idempotency index used to
// be keyed on the client-controlled `fp`, so an attacker could rotate `fp` to
// get a fresh bucket per value and run stolen-card validation at ~₪35 a probe.
// Keyed on IP alone (via the shared quiz_ip_daily counter with a "qcharge:"
// namespace) so fp rotation can't defeat it. Fails OPEN so a counter error
// never blocks a real buyer. Set QUIZ_CHARGE_IP_DAILY_CAP=0 to disable.
const CHARGE_IP_DAILY_CAP = Number(process.env.QUIZ_CHARGE_IP_DAILY_CAP ?? 10);
async function chargeAttemptsUnderCap(ip: string): Promise<boolean> {
  if (CHARGE_IP_DAILY_CAP <= 0 || !ip || ip === "unknown") return true;
  const { data, error } = await supabase.rpc("bump_quiz_ip_daily", {
    p_ip: `qcharge:${ip}`,
  });
  if (error) {
    console.error("create-quiz-payment: charge-cap RPC failed:", error.message);
    return true;
  }
  return typeof data === "number" ? data <= CHARGE_IP_DAILY_CAP : true;
}

// Strip everything that isn't a letter (Hebrew or Latin), space, hyphen,
// apostrophe or dot — defends against control chars and any XSS surface in
// downstream document renderers.
function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\s'.\-]/gu, "").trim().slice(0, 80);
}

// One-off quiz payment via Sumit. The browser has already tokenized the card
// against the Vault API and passes us SingleUseToken — we just charge it.
// Sumit auto-issues the receipt and emails it to the customer.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fp, quizType, firstName, lastName, phone, email, singleUseToken } = body;

    if (!fp || !quizType) {
      return NextResponse.json({ error: "missing fp or quizType" }, { status: 400 });
    }
    if (typeof fp !== "string" || !/^[a-f0-9]{64}$/.test(fp)) {
      return NextResponse.json({ error: "invalid fp" }, { status: 400 });
    }
    if (quizType !== "adults" && quizType !== "kids") {
      return NextResponse.json({ error: "invalid quizType" }, { status: 400 });
    }

    const cleanFirst = sanitizeName(typeof firstName === "string" ? firstName : "");
    const cleanLast = sanitizeName(typeof lastName === "string" ? lastName : "");
    const cleanPhone = typeof phone === "string" ? phone.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    const cleanToken = typeof singleUseToken === "string" ? singleUseToken.trim() : "";

    if (!cleanFirst || !cleanLast || !cleanPhone || !cleanEmail || !cleanToken) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    if (cleanPhone.length > 30 || cleanEmail.length > 200) {
      return NextResponse.json({ error: "invalid customer details" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const ip = getIp(req);
    // Rate-limit on IP alone — NOT ip:fp — so rotating the client-controlled
    // fingerprint can't mint a fresh bucket per value (the carding bypass).
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }
    if (!(await chargeAttemptsUnderCap(ip))) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
    }

    // Expire any stale pending row for this fingerprint (a crashed/abandoned
    // attempt) so it doesn't permanently block new submissions via the
    // payments_pending_unique index. A genuine concurrent double-click leaves a
    // *fresh* pending row, which the index below rejects atomically.
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("payment_type", "quiz")
      .eq("reference_id", `fp:${fp}`)
      .eq("status", "pending")
      .lt("created_at", sixtySecondsAgo);

    // Raw ad click ids captured at landing — persisted so a completed payment
    // can be uploaded to Google Ads / Meta with exact click attribution.
    const clickIds = sanitizeClickIds(body);

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        payment_type: "quiz",
        reference_id: `fp:${fp}`,
        amount: QUIZ_BASE_PRICE,
        status: "pending",
        metadata: { ip, quizType, fingerprint: fp },
        gclid: clickIds.gclid,
        gbraid: clickIds.gbraid,
        wbraid: clickIds.wbraid,
        fbclid: clickIds.fbclid,
      })
      .select("id")
      .single();

    if (error || !payment) {
      // 23505 = unique violation on payments_pending_unique: a concurrent
      // submission for this fingerprint is already mid-charge (double-click).
      if (error?.code === "23505") {
        return NextResponse.json({ error: "payment in progress" }, { status: 409 });
      }
      return NextResponse.json({ error: "failed to create payment record" }, { status: 500 });
    }

    let result;
    try {
      result = await chargeQuizPayment({
        fingerprint: fp,
        singleUseToken: cleanToken,
        customerName: `${cleanFirst} ${cleanLast}`,
        customerEmail: cleanEmail,
        customerPhone: cleanPhone,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("Sumit chargeQuizPayment failed:", message);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return NextResponse.json({ error: "payment provider error" }, { status: 502 });
    }

    const sumitDocumentId = (result.DocumentID ?? null) as number | null;

    await supabase
      .from("payments")
      .update({
        status: "completed",
        morning_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
      })
      .eq("id", payment.id);

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-quiz-payment error:", message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
