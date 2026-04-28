import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSubscriptionPayment } from "@/app/lib/morning";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const {
      data: { user },
    } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${auth}` } } }
    ).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { data: therapist } = await supabase
      .from("therapists")
      .select("id, full_name, email, status")
      .eq("user_id", user.id)
      .single();

    if (!therapist) {
      return NextResponse.json({ error: "therapist not found" }, { status: 404 });
    }

    if (therapist.status === "paying") {
      return NextResponse.json({ error: "already subscribed" }, { status: 400 });
    }

    const existing = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("therapist_id", therapist.id)
      .eq("status", "active")
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json({ error: "active subscription exists" }, { status: 400 });
    }

    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        payment_type: "subscription",
        reference_id: therapist.id,
        amount: 120,
        status: "pending",
        metadata: { therapist_name: therapist.full_name, email: therapist.email },
      })
      .select("id")
      .single();

    if (paymentErr || !payment) {
      return NextResponse.json({ error: "failed to create payment record" }, { status: 500 });
    }

    const result = await createSubscriptionPayment({
      therapistId: therapist.id,
      therapistName: therapist.full_name,
      therapistEmail: therapist.email || user.email || "",
      paymentId: payment.id,
    });

    if (result.errorCode !== 0 || !result.url) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return NextResponse.json({ error: "payment provider error" }, { status: 502 });
    }

    return NextResponse.json({ url: result.url, paymentId: payment.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-subscription error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
