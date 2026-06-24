import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSubscription, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";
import { isPromoActive, SUBSCRIPTION_PROMO_PRICE, promoRevertDate } from "@/app/lib/promo";
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

    // Expire any stale pending row for this therapist (a crashed/abandoned
    // attempt) so it doesn't permanently block new submissions via the
    // payments_pending_unique index. A genuine concurrent double-submit leaves
    // a *fresh* pending row, which the index below rejects atomically.
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    await supabase
      .from("payments")
      .update({ status: "failed" })
      .eq("payment_type", "subscription")
      .eq("reference_id", therapist.id)
      .eq("status", "pending")
      .lt("created_at", sixtySecondsAgo);

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

    // Early-bird promo: discounted price for the first cycles for therapists
    // who subscribe before the deadline. The standing order is created at this
    // price; the daily cron reverts it to the regular price after the promo
    // window (see promoRevertDate + sumit-status-sync).
    const promoActive = isPromoActive();
    const unitPrice = promoActive ? SUBSCRIPTION_PROMO_PRICE : SUBSCRIPTION_BASE_PRICE;

    const { data: payment, error: paymentErr } = await supabase
      .from("payments")
      .insert({
        payment_type: "subscription",
        reference_id: therapist.id,
        amount: unitPrice,
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
      // 23505 = unique violation on payments_pending_unique: a concurrent
      // submission for this therapist is already mid-charge (double-click).
      if (paymentErr?.code === "23505") {
        return NextResponse.json({ error: "payment in progress" }, { status: 409 });
      }
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
        unitPrice,
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

    // No recurring id means the standing order cannot be cancelled
    // programmatically later (cancelSubscription needs it). Log loudly with the
    // Sumit document id so an admin can locate/stop it at Sumit if needed — the
    // orphan-sweep cron keys off morning_token_id and can't catch this case.
    if (!sumitRecurringId) {
      console.error(
        `WARNING create-subscription: no Sumit RecurringItemID for therapist=${therapist.id} ` +
          `(morning_token_id=null, uncancellable programmatically). sumitDocumentId=${sumitDocumentId}.`
      );
    }

    // The card is now charged and a standing order exists at Sumit. From here a
    // DB failure must NOT surface as a retryable 500 — that would let the user
    // re-submit and get charged a second time. On failure we log everything
    // needed to reconcile and acknowledge the payment; the daily
    // sumit-status-sync / admin reconcile repairs the local state.
    try {
      await supabase
        .from("subscriptions")
        .upsert(
          {
            therapist_id: therapist.id,
            status: "active",
            amount: unitPrice,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            morning_token_id: sumitRecurringId ? String(sumitRecurringId) : null,
            // When to auto-revert the promo price to the regular price. null for
            // non-promo subscriptions (they're already at the regular price).
            promo_reverts_at: promoActive ? promoRevertDate(now).toISOString() : null,
            updated_at: now.toISOString(),
          },
          { onConflict: "therapist_id" }
        )
        .throwOnError();

      await supabase
        .from("therapists")
        .update({
          status: "paying",
          manually_promoted: false, // legacy column, kept in sync
          promotion_source: "paid",
          promoted_since: now.toISOString(),
          promoted_until: null, // paid subscriptions don't auto-expire
        })
        .eq("id", therapist.id)
        .throwOnError();

      await supabase
        .from("payments")
        .update({
          status: "completed",
          morning_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
        })
        .eq("id", payment.id)
        .throwOnError();

      await writeAudit(supabase, {
        therapistId: therapist.id,
        actorType: "self",
        action: `status_change:${therapist.status ?? "null"}->paying`,
        before: { status: therapist.status, promotion_source: null },
        after: { status: "paying", promotion_source: "paid" },
        reason: "subscription_created",
      });
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : "unknown";
      console.error(
        `CRITICAL create-subscription: charged at Sumit but local DB write failed — ` +
          `payment=${payment.id} therapist=${therapist.id} sumitRecurringId=${sumitRecurringId} ` +
          `sumitDocumentId=${sumitDocumentId} err=${msg}`
      );
      // Acknowledge the payment instead of returning a retryable error.
      return NextResponse.json(
        { success: true, pending: true, paymentId: payment.id, message: "התשלום התקבל; הפעלת המנוי תושלם בקרוב. אם יש בעיה ניצור איתך קשר." },
        { status: 200 }
      );
    }

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

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("create-subscription error:", message);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
