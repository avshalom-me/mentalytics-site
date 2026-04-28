import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chargeToken } from "@/app/lib/morning";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from("subscriptions")
    .select("id, therapist_id, morning_token_id")
    .eq("status", "active")
    .not("morning_token_id", "is", null)
    .lte("current_period_end", now);

  if (!due || due.length === 0) {
    return NextResponse.json({ charged: 0 });
  }

  let charged = 0;
  let failed = 0;

  for (const sub of due) {
    const { data: therapist } = await supabase
      .from("therapists")
      .select("full_name, email")
      .eq("id", sub.therapist_id)
      .single();

    if (!therapist) continue;

    const { data: payment } = await supabase
      .from("payments")
      .insert({
        payment_type: "subscription_renewal",
        reference_id: sub.therapist_id,
        amount: 120,
        status: "pending",
      })
      .select("id")
      .single();

    if (!payment) continue;

    try {
      await chargeToken(sub.morning_token_id!, {
        therapistName: therapist.full_name,
        therapistEmail: therapist.email || "",
        paymentId: payment.id,
        therapistId: sub.therapist_id,
      });

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await supabase
        .from("subscriptions")
        .update({
          current_period_start: now,
          current_period_end: periodEnd.toISOString(),
          updated_at: now,
        })
        .eq("id", sub.id);

      await supabase.from("payments").update({ status: "completed" }).eq("id", payment.id);
      charged++;
    } catch (err) {
      console.error(`Failed to charge subscription ${sub.id}:`, err);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      await supabase
        .from("subscriptions")
        .update({ status: "past_due", updated_at: now })
        .eq("id", sub.id);
      failed++;
    }
  }

  return NextResponse.json({ charged, failed, total: due.length });
}
