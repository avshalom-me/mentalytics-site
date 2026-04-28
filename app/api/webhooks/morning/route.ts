import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Morning webhook received:", JSON.stringify(body));

    let custom: Record<string, string> = {};
    try {
      custom = typeof body.custom === "string" ? JSON.parse(body.custom) : body.custom || {};
    } catch {
      console.error("Failed to parse custom field:", body.custom);
    }

    const paymentId = custom.paymentId;
    if (!paymentId) {
      console.error("Webhook missing paymentId in custom field");
      return NextResponse.json({ ok: true });
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("id, payment_type, reference_id, status")
      .eq("id", paymentId)
      .single();

    if (!payment) {
      console.error("Payment not found:", paymentId);
      return NextResponse.json({ ok: true });
    }

    if (payment.status === "completed") {
      return NextResponse.json({ ok: true });
    }

    const documentId = body.id || body.documentId || "";

    await supabase
      .from("payments")
      .update({
        status: "completed",
        morning_document_id: documentId,
      })
      .eq("id", paymentId);

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
    .update({ status: "paying", manually_promoted: false })
    .eq("id", therapistId);

  console.log(`Subscription activated for therapist ${therapistId}`);
}

async function handleQuizPayment(referenceId: string, custom: Record<string, string>) {
  const fp = custom.fingerprint || referenceId.replace("fp:", "");
  const ip = custom.ip || "";
  const quizType = custom.quizType || "adults";

  const identifiers = [`fp:${fp}`];
  if (ip && ip !== "unknown") identifiers.push(ip);

  for (const id of identifiers) {
    const { data } = await supabase
      .from("quiz_usage")
      .select("count")
      .eq("ip", id)
      .eq("quiz_type", quizType)
      .maybeSingle();

    if (data) {
      await supabase
        .from("quiz_usage")
        .update({ count: Math.max(data.count - 1, 0), updated_at: new Date().toISOString() })
        .eq("ip", id)
        .eq("quiz_type", quizType);
    }
  }

  console.log(`Quiz payment processed for ${fp}, quizType=${quizType}`);
}
