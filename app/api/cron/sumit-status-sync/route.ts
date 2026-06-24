import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { listRecurringForCustomer, cancelSubscription, updateRecurringPrice, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import { sendPromotionEndedEmail, PromotionEndedReason } from "@/app/lib/therapist-emails";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const ALERT_TO = (
  process.env.WEEKLY_REPORT_TO ??
  "admin@getmentalytics.com,avshalom@getmentalytics.com,omer@getmentalytics.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Loud admin alert for a standing order that is still charging at Sumit but
// should not be — and that we failed to auto-cancel. Best-effort: an email
// failure must never abort the sync.
async function alertAdminOrphan(
  therapistId: string,
  recurringItemId: string,
  detail: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: "טיפול חכם <noreply@mentalytics.co.il>",
      to: ALERT_TO,
      subject: "⚠️ הוראת קבע פעילה ב-Sumit שאמורה להיות מבוטלת",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
        <p>הסנכרון היומי זיהה הוראת קבע ש<strong>פעילה ב-Sumit וממשיכה לחייב</strong>, אך מסומנת כמבוטלת במערכת — והביטול האוטומטי נכשל.</p>
        <p><strong>מטפל (therapist_id):</strong> ${therapistId}<br/>
        <strong>מזהה הוראת קבע ב-Sumit:</strong> ${recurringItemId}<br/>
        <strong>פרטי הכשל:</strong> ${detail}</p>
        <p>יש לבטל ידנית ב-Sumit: סליקת אשראי → הוראות קבע → חפש לפי המזהה → ביטול.</p>
      </div>`,
    });
  } catch (e) {
    console.error("alertAdminOrphan: failed to send admin email:", e);
  }
}

function verifyCron(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Hourly sync that does two things:
//
// 1. For every paid subscription, check Sumit's standing-order status. If
//    Sumit has cancelled / suspended / let it expire (almost always due to
//    repeated failed charges), demote the therapist locally and notify by
//    email.
//
// 2. For every manual or trial promotion with promoted_until in the past,
//    demote and notify. This is how time-limited gifts auto-clean up.
//
// Sumit does not push payment-event webhooks (only CRM card-view triggers).
// Polling at hourly resolution caps the "free-after-cancel" window at ~60
// minutes, which is acceptable for the size of a chargeback we'd see.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 503 });
  }
  if (!verifyCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let checked = 0;
  let demoted = 0;
  let errors = 0;
  let stillActive = 0;
  let trialsExpired = 0;
  let orphansFound = 0;
  let orphansCancelled = 0;
  let orphanAlerts = 0;
  let promosReverted = 0;

  // -------- (1) Sumit subscription state for paid therapists --------
  const { data: paidTherapists } = await supabase
    .from("therapists")
    .select("id, full_name, email")
    .eq("status", "paying")
    .eq("promotion_source", "paid");

  for (const t of paidTherapists ?? []) {
    checked++;
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: t.id,
        includeInactive: true,
      });

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, morning_token_id")
        .eq("therapist_id", t.id)
        .eq("status", "active")
        .maybeSingle();

      const target = sub?.morning_token_id
        ? items.find((i) => String(i.ID) === sub.morning_token_id)
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];

      if (!target || target.Status !== 0) {
        // Either nothing matches at Sumit, or what's there is not active.
        // Demote locally and email the therapist.
        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
        await supabase
          .from("therapists")
          .update({
            status: "approved",
            manually_promoted: false,
            promotion_source: null,
            promoted_since: null,
            promoted_until: null,
          })
          .eq("id", t.id);

        await writeAudit(supabase, {
          therapistId: t.id,
          actorType: "sumit",
          action: "status_change:paying->approved",
          before: { status: "paying", promotion_source: "paid" },
          after: { status: "approved", promotion_source: null },
          reason: target ? `sumit_status=${target.Status}` : "no_active_recurring_at_sumit",
        });

        if (t.email) {
          await sendPromotionEndedEmail({
            to: t.email,
            name: t.full_name ?? "",
            reason: "payment_failed" as PromotionEndedReason,
          });
        }
        demoted++;
      } else {
        stillActive++;
        if (sub && target.Date_NextBilling) {
          await supabase
            .from("subscriptions")
            .update({
              current_period_end: new Date(target.Date_NextBilling).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
        }
      }
    } catch (err) {
      errors++;
      console.error(`Sumit sync failed for therapist ${t.id}:`, err);
    }
  }

  // -------- (2) Expired manual / trial promotions --------
  const nowIso = new Date().toISOString();
  const { data: expiredTrials } = await supabase
    .from("therapists")
    .select("id, full_name, email, promotion_source")
    .in("promotion_source", ["trial", "manual"])
    .not("promoted_until", "is", null)
    .lte("promoted_until", nowIso);

  for (const t of expiredTrials ?? []) {
    try {
      await supabase
        .from("therapists")
        .update({
          status: "approved",
          manually_promoted: false,
          promotion_source: null,
          promoted_since: null,
          promoted_until: null,
        })
        .eq("id", t.id);

      await writeAudit(supabase, {
        therapistId: t.id,
        actorType: "cron",
        action: "status_change:paying->approved",
        before: { status: "paying", promotion_source: t.promotion_source },
        after: { status: "approved", promotion_source: null },
        reason: "trial_or_manual_expired",
      });

      if (t.email) {
        await sendPromotionEndedEmail({
          to: t.email,
          name: t.full_name ?? "",
          reason: "trial_expired",
        });
      }
      trialsExpired++;
    } catch (err) {
      errors++;
      console.error(`Trial expiry failed for therapist ${t.id}:`, err);
    }
  }

  // -------- (3) Orphaned standing orders (billing-leak guard) --------
  // A standing order can stay ACTIVE at Sumit while we believe it's cancelled
  // locally — e.g. a cancel that failed at Sumit but was recorded locally, or
  // a promote-over-paying that only updated the DB. Passes (1) and (2) only
  // look at therapists who are *currently* paid-active, so they can never
  // catch this class — the leak charges the card every month, invisibly.
  // Here we sweep every locally-cancelled subscription that still carries a
  // Sumit recurring id, verify it against Sumit, and if it's still active we
  // cancel it for real (bringing Sumit in line with the recorded intent) and
  // alert the admin if that cancel fails.
  const { data: cancelledSubs } = await supabase
    .from("subscriptions")
    .select("id, therapist_id, morning_token_id")
    .eq("status", "cancelled")
    .not("morning_token_id", "is", null);

  for (const sub of cancelledSubs ?? []) {
    const recurringId = sub.morning_token_id as string | null;
    if (!recurringId) continue;
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: sub.therapist_id,
        includeInactive: true,
      });
      const target = items.find((i) => String(i.ID) === recurringId);
      // Genuinely inactive at Sumit (or gone) — local and remote agree, fine.
      if (!target || target.Status !== 0) continue;

      // Active at Sumit but cancelled locally → billing leak. Reconcile.
      orphansFound++;
      try {
        await cancelSubscription({
          recurringItemId: parseInt(recurringId, 10),
          customerExternalId: sub.therapist_id,
        });
        orphansCancelled++;
        await writeAudit(supabase, {
          therapistId: sub.therapist_id,
          actorType: "sumit",
          action: "sumit_orphan_cancelled",
          before: { sumit_recurring: recurringId, sumit_status: "active", local_status: "cancelled" },
          after: { sumit_status: "cancelled" },
          reason: "orphaned_active_standing_order_reconciled",
        });
      } catch (cancelErr) {
        orphanAlerts++;
        const message = cancelErr instanceof Error ? cancelErr.message : "unknown error";
        console.error(
          `Orphan standing order ${recurringId} for therapist ${sub.therapist_id}: auto-cancel failed:`,
          message
        );
        await writeAudit(supabase, {
          therapistId: sub.therapist_id,
          actorType: "sumit",
          action: "sumit_orphan_detected",
          before: { sumit_recurring: recurringId, sumit_status: "active", local_status: "cancelled" },
          after: null,
          reason: `auto_cancel_failed: ${message}`,
        });
        await alertAdminOrphan(sub.therapist_id, recurringId, message);
      }
    } catch (err) {
      errors++;
      console.error(`Orphan sweep failed for therapist ${sub.therapist_id}:`, err);
    }
  }

  // -------- (4) Early-bird promo price reverts --------
  // Subscriptions created at the promo price carry a promo_reverts_at date
  // (set a few days before the 4th charge). Once that date passes, update the
  // standing order's UnitPrice back to the regular price at Sumit so the next
  // charge is full price, then clear the flag. updateRecurringPrice verifies
  // the change took effect; on failure we leave promo_reverts_at set so the
  // next run retries (the therapist stays at the promo price meanwhile — a
  // safe direction to fail).
  const { data: promoSubs } = await supabase
    .from("subscriptions")
    .select("id, therapist_id, morning_token_id, promo_reverts_at")
    .eq("status", "active")
    .not("promo_reverts_at", "is", null)
    .lte("promo_reverts_at", nowIso);

  for (const sub of promoSubs ?? []) {
    const recurringId = sub.morning_token_id as string | null;
    if (!recurringId) {
      // No Sumit recurring id → can't update the price programmatically.
      errors++;
      console.error(
        `Promo revert: therapist ${sub.therapist_id} has promo_reverts_at but no morning_token_id; cannot update price at Sumit.`
      );
      continue;
    }
    try {
      await updateRecurringPrice({
        recurringItemId: parseInt(recurringId, 10),
        customerExternalId: sub.therapist_id,
        unitPrice: SUBSCRIPTION_BASE_PRICE,
      });
      await supabase
        .from("subscriptions")
        .update({
          amount: SUBSCRIPTION_BASE_PRICE,
          promo_reverts_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      await writeAudit(supabase, {
        therapistId: sub.therapist_id,
        actorType: "cron",
        action: "promo_price_reverted",
        before: { promo_reverts_at: sub.promo_reverts_at },
        after: { amount: SUBSCRIPTION_BASE_PRICE },
        reason: "early_bird_promo_ended",
      });
      promosReverted++;
    } catch (err) {
      errors++;
      console.error(`Promo revert failed for therapist ${sub.therapist_id}:`, err);
    }
  }

  return NextResponse.json({
    checked,
    stillActive,
    demoted,
    trialsExpired,
    orphansFound,
    orphansCancelled,
    orphanAlerts,
    promosReverted,
    errors,
  });
}
