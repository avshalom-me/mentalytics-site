import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSubscription, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import { sendTherapistWelcomeEmail } from "@/app/lib/therapist-emails";
import { sanitizeClickIds } from "@/app/lib/attribution";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Best-effort rate limit. In-memory, so cold starts reset it — that's a
// known limitation (F4). Pairs with the in-DB pending-payment check below
// to make double-charging hard even when this cache is empty.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

// Names go on the customer record and the invoice. Strip everything that
// isn't a letter (Hebrew or Latin), space, hyphen, apostrophe, or dot.
// Defends against accidental control chars and any latent XSS surface in
// downstream renderers (e.g. PDF generators upstream at Sumit).
function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\s'.\-]/gu, "").trim().slice(0, 80);
}

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
      .select(
        "id, full_name, email, status, bio, profile_photo_path, training_areas, therapist_types, regions, education, experience, languages"
      )
      .eq("user_id", user.id)
      .single();

    if (!therapist) {
      return NextResponse.json({ error: "therapist not found" }, { status: 404 });
    }

    if (therapist.status === "paying") {
      return NextResponse.json({ error: "already subscribed" }, { status: 400 });
    }

    if (!checkRateLimit(therapist.id)) {
      return NextResponse.json({ error: "too many requests" }, { status: 429 });
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

    // Race-condition guard: if there is already a pending payment for this
    // therapist created in the last 60 seconds, the user probably double-
    // submitted. Refuse the second attempt instead of opening a parallel
    // charge against Sumit.
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    const { data: pending } = await supabase
      .from("payments")
      .select("id")
      .eq("payment_type", "subscription")
      .eq("reference_id", therapist.id)
      .eq("status", "pending")
      .gte("created_at", sixtySecondsAgo)
      .maybeSingle();

    if (pending) {
      return NextResponse.json({ error: "payment in progress" }, { status: 409 });
    }

    let body: {
      singleUseToken?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      gclid?: string;
      gbraid?: string;
      wbraid?: string;
      fbclid?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const cleanFirst = sanitizeName(typeof body.firstName === "string" ? body.firstName : "");
    const cleanLast = sanitizeName(typeof body.lastName === "string" ? body.lastName : "");
    const cleanPhone = typeof body.phone === "string" ? body.phone.trim() : "";
    const cleanEmail = typeof body.email === "string" ? body.email.trim() : "";
    const singleUseToken =
      typeof body.singleUseToken === "string" ? body.singleUseToken.trim() : "";

    if (!cleanFirst || !cleanLast || !cleanPhone || !cleanEmail || !singleUseToken) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    if (cleanPhone.length > 30 || cleanEmail.length > 200) {
      return NextResponse.json({ error: "invalid customer details" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }

    const clientName = `${cleanFirst} ${cleanLast}`;
    const clientEmail = cleanEmail || therapist.email || user.email || "";

    // Raw ad click ids captured at landing — persisted so a completed payment
    // can be uploaded to Google Ads / Meta with exact click attribution.
    const clickIds = sanitizeClickIds(body);

    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        payment_type: "subscription",
        reference_id: therapist.id,
        amount: SUBSCRIPTION_BASE_PRICE,
        status: "pending",
        metadata: { therapist_name: clientName, email: clientEmail, phone: cleanPhone },
        gclid: clickIds.gclid,
        gbraid: clickIds.gbraid,
        wbraid: clickIds.wbraid,
        fbclid: clickIds.fbclid,
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

    // Sumit's recurring-item id is stored in subscriptions.morning_token_id
    // (legacy column name retained to avoid a rename migration).
    const sumitRecurringId = (result.RecurringItemID ?? null) as number | null;
    const sumitDocumentId = (result.DocumentID ?? null) as number | null;

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
        manually_promoted: false, // legacy column, kept in sync
        promotion_source: "paid",
        promoted_since: now.toISOString(),
        promoted_until: null, // paid subscriptions don't auto-expire
      })
      .eq("id", therapist.id);

    await supabase
      .from("payments")
      .update({
        status: "completed",
        morning_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
      })
      .eq("id", payment.id);

    await writeAudit(supabase, {
      therapistId: therapist.id,
      actorType: "self",
      action: `status_change:${therapist.status ?? "null"}->paying`,
      before: { status: therapist.status, promotion_source: null },
      after: { status: "paying", promotion_source: "paid" },
      reason: "subscription_created",
    });

    // Single audit line, no sensitive ids beyond our own payment row.
    console.log(`Subscription completed: payment=${payment.id}`);

    // Welcome email (confirmation + profile feedback + article invite).
    // Best-effort — a mail failure must never fail a completed payment.
    try {
      const welcomeTo = therapist.email || clientEmail;
      if (welcomeTo) {
        await sendTherapistWelcomeEmail({ to: welcomeTo, tier: "paid", therapist });
      }
    } catch (mailErr) {
      console.error(
        "create-subscription: welcome email failed:",
        mailErr instanceof Error ? mailErr.message : mailErr
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-subscription error:", message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
