import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { fetchDocument } from "@/app/lib/morning";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Morning document.status === 1 means "issued/paid" for type 320 (receipt).
// Reference: https://www.greeninvoice.co.il/api-docs (status enum).
const STATUS_ISSUED = 1;

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.MORNING_WEBHOOK_SECRET;
  if (!expected) return false;
  const provided = req.nextUrl.searchParams.get("secret") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.MORNING_WEBHOOK_SECRET) {
      console.error("Morning webhook: MORNING_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
    }
    if (!verifySecret(req)) {
      console.error("Morning webhook: invalid or missing secret");
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    let custom: Record<string, string> = {};
    try {
      custom = typeof body.custom === "string" ? JSON.parse(body.custom) : body.custom || {};
    } catch {
      console.error("Morning webhook: failed to parse custom field");
    }

    const paymentId = custom.paymentId;
    if (!paymentId) {
      console.error("Morning webhook: missing paymentId in custom field");
      return NextResponse.json({ ok: true });
    }
    console.log(`Morning webhook received for paymentId=${paymentId}, type=${custom.type || "unknown"}`);

    const documentId = body.id || body.documentId || "";
    if (!documentId || typeof documentId !== "string") {
      console.error(`Webhook: missing documentId for paymentId=${paymentId}`);
      return NextResponse.json({ ok: true });
    }

    // Look up our pending payment to know the expected amount.
    const { data: pendingPayment } = await supabase
      .from("payments")
      .select("id, payment_type, reference_id, status, amount")
      .eq("id", paymentId)
      .single();

    if (!pendingPayment) {
      console.error(`Webhook: payment not found id=${paymentId}`);
      return NextResponse.json({ ok: true });
    }

    if (pendingPayment.status === "completed") {
      // Idempotent — already processed.
      return NextResponse.json({ ok: true });
    }

    // Verify the document with Morning's API directly. Without this, anyone
    // who learns the URL secret could forge a webhook and activate accounts.
    let doc;
    try {
      doc = await fetchDocument(documentId);
    } catch (e) {
      console.error(`Webhook: Morning fetchDocument failed for ${documentId}:`, e);
      return NextResponse.json({ error: "verification failed" }, { status: 502 });
    }

    if (doc.status !== STATUS_ISSUED) {
      console.error(`Webhook: document ${documentId} status=${doc.status}, expected ${STATUS_ISSUED}`);
      return NextResponse.json({ ok: true });
    }

    const docAmount = typeof doc.paymentsSum === "number"
      ? doc.paymentsSum
      : typeof doc.amount === "number"
        ? doc.amount
        : null;

    if (docAmount === null || docAmount < pendingPayment.amount) {
      console.error(
        `Webhook: amount mismatch for ${documentId} — doc=${docAmount}, expected=${pendingPayment.amount}`
      );
      return NextResponse.json({ ok: true });
    }

    // Atomic claim: only one webhook can transition pending -> completed.
    const { data: claimed, error: claimErr } = await supabase
      .from("payments")
      .update({ status: "completed", morning_document_id: documentId })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select("id, payment_type, reference_id");

    if (claimErr) {
      console.error("Webhook: failed to claim payment:", claimErr);
      return NextResponse.json({ ok: true });
    }

    if (!claimed || claimed.length === 0) {
      // Already processed by a concurrent webhook — idempotent ack
      return NextResponse.json({ ok: true });
    }

    const payment = claimed[0];

    if (
      payment.payment_type === "subscription" ||
      payment.payment_type === "subscription_renewal"
    ) {
      await handleSubscription(payment.reference_id, custom);
    } else if (payment.payment_type === "quiz") {
      await handleQuizPayment(payment.reference_id, custom);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

async function handleSubscription(therapistId: string, custom: Record<string, string>) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await supabase
    .from("subscriptions")
    .upsert(
      {
        therapist_id: therapistId,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "therapist_id" }
    );

  await supabase
    .from("therapists")
    .update({ status: "paying", manually_promoted: false, promoted_since: new Date().toISOString() })
    .eq("id", therapistId);

  console.log(`Subscription activated for therapist ${therapistId}`);
}

async function handleQuizPayment(referenceId: string, custom: Record<string, string>) {
  // The credit is granted via getPaidCredits() in /api/usage/check, which
  // counts completed quiz payments on this fingerprint and adds them to the
  // limit. We do NOT decrement quiz_usage here — doing so would grant 2 uses
  // per payment (one from the decrement + one from the raised limit).
  const fp = custom.fingerprint || referenceId.replace("fp:", "");
  const quizType = custom.quizType || "adults";
  console.log(`Quiz payment processed for ${fp}, quizType=${quizType}`);
}
