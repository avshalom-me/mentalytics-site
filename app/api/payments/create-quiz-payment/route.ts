import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createQuizPayment } from "@/app/lib/morning";

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

export async function POST(req: NextRequest) {
  try {
    const { fp, quizType } = await req.json();

    if (!fp || !quizType) {
      return NextResponse.json({ error: "missing fp or quizType" }, { status: 400 });
    }

    const ip = getIp(req);

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        payment_type: "quiz",
        reference_id: `fp:${fp}`,
        amount: 30,
        status: "pending",
        metadata: { ip, quizType, fingerprint: fp },
      })
      .select("id")
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "failed to create payment record" }, { status: 500 });
    }

    const result = await createQuizPayment({
      fingerprint: fp,
      ip,
      quizType,
      paymentId: payment.id,
    });

    if (result.errorCode !== 0 || !result.url) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return NextResponse.json({ error: "payment provider error" }, { status: 502 });
    }

    return NextResponse.json({ url: result.url, paymentId: payment.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-quiz-payment error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
