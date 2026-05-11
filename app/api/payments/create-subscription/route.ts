import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSubscription, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Flow:
// 1. Frontend collects customer details + tokenizes the card directly with
//    Sumit's Vault API (using the public key), producing a SingleUseToken.
// 2. Frontend POSTs everything here with Authorization: Bearer <supabase jwt>.
// 3. We validate, ensure no active subscription exists, then call Sumit's
//    /billing/recurring/charge which charges the token AND creates the
//    standing order in one shot. Sumit handles future monthly charges on
//    their servers.
// 4. On success we mark the therapist paying and store Sumit's customer id
//    + recurring item id for later cancel/status-sync calls.

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

    let body: {
      singleUseToken?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const cleanFirst = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const cleanLast = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const cleanPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const cleanEmail = typeof body.email === "string" ? body.email.trim() : "";
    const singleUseToken =
      typeof body.singleUseToken === "string" ? body.singleUseToken.trim() : "";

    if (!cleanFirst || !cleanLast || !cleanPhone || !cleanEmail || !singleUseToken) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    if (
      cleanFirst.length > 80 ||
      cleanLast.length > 80 ||
      cleanPhone.length > 30 ||
      cleanEmail.length > 200
    ) {
      return NextResponse.json({ error: "invalid customer details" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const clientName = `${cleanFirst} ${cleanLast}`;
    const clientEmail = cleanEmail || therapist.email || user.email || "";

    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        payment_type: "subscription",
        reference_id: therapist.id,
        amount: SUBSCRIPTION_BASE_PRICE,
        status: "pending",
        metadata: { therapist_name: clientName, email: clientEmail, phone: cleanPhone },
      })
      .select("id")
      .single();

    if (paymentErr || !payment) {
      return NextResponse.json({ error: "failed to create payment record" }, { status: 500 });
    }

    let result;
    try {
      result = await createSubscription({
        therapistId: therapist.id,
        therapistName: clientName,
        therapistEmail: clientEmail,
        therapistPhone: cleanPhone,
        singleUseToken,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error("Sumit createSubscription failed:", message);
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return NextResponse.json({ error: "payment provider error" }, { status: 502 });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Sumit returns the customer + recurring item ids; store the recurring
    // id in morning_token_id (column name kept for now to avoid a migration)
    // so we can call /billing/recurring/cancel later without re-searching.
    const sumitRecurringId = (result.RecurringItemID ?? null) as number | null;
    const sumitDocumentId = (result.DocumentID ?? null) as number | null;
    const sumitCustomerId = (result.CustomerID ?? null) as number | null;

    await supabase
      .from("subscriptions")
      .upsert(
        {
          therapist_id: therapist.id,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          morning_token_id: sumitRecurringId ? String(sumitRecurringId) : null,
          updated_at: now.toISOString(),
        },
        { onConflict: "therapist_id" }
      );

    await supabase
      .from("therapists")
      .update({
        status: "paying",
        manually_promoted: false,
        promoted_since: now.toISOString(),
      })
      .eq("id", therapist.id);

    await supabase
      .from("payments")
      .update({
        status: "completed",
        morning_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
      })
      .eq("id", payment.id);

    console.log(
      `Subscription created for therapist ${therapist.id} | sumitCustomer=${sumitCustomerId} | recurring=${sumitRecurringId} | doc=${sumitDocumentId}`
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-subscription error:", message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
