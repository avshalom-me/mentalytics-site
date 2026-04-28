import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySecret(req: NextRequest): boolean {
  const expected = process.env.MORNING_WEBHOOK_SECRET;
  if (!expected) return true;
  const provided = req.nextUrl.searchParams.get("secret") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
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
