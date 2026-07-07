import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { Resend } from "resend";
import { listRecurringForCustomer, cancelSubscription, updateRecurringPrice, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";
import { writeAudit } from "@/app/lib/audit";
import { sendPromotionEndedEmail, PromotionEndedReason } from "@/app/lib/therapist-emails";
import { demoteCenterTherapists } from "@/app/lib/center-promotion";

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
  let softMisses = 0;
  let trialsExpired = 0;

  // Consecutive ambiguous "not found at Sumit" reads required before we demote.
  // A single transient empty/partial list must not tear down a paying customer.
  const MISS_THRESHOLD = 2;
  let orphansFound = 0;
  let orphansCancelled = 0;
  let orphanAlerts = 0;
  let promosReverted = 0;

  // -------- (1) Sumit subscription state for paid therapists --------
  const { data: paidTherapists } = await supabase
    .from("therapists")
    .select("id, full_name, email, admin_approved")
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
        .select("id, morning_token_id, sync_miss_count")
        .eq("therapist_id", t.id)
        .eq("status", "active")
        .maybeSingle();

      const target = sub?.morning_token_id
        ? items.find((i) => String(i.ID) === sub.morning_token_id)
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];

      if (target && target.Status === 0) {
        // Active at Sumit — healthy. Clear any accumulated miss streak.
        stillActive++;
        if (sub) {
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (target.Date_NextBilling) {
            patch.current_period_end = new Date(target.Date_NextBilling).toISOString();
          }
          if ((sub.sync_miss_count ?? 0) > 0) patch.sync_miss_count = 0;
          await supabase.from("subscriptions").update(patch).eq("id", sub.id);
        }
        continue;
      }

      // Not active. Distinguish two cases:
      //  - `target` present with Status != 0: Sumit AUTHORITATIVELY reports the
      //    standing order cancelled/suspended/expired. Trust it and demote now.
      //  - `!target`: the item wasn't in the returned list. This is AMBIGUOUS —
      //    a transient empty/partial Sumit read looks identical to a real
      //    cancel here, and demoting on a single miss has torn down genuinely
      //    paying customers (whose still-active order the orphan sweep then
      //    cancels for real). Require MISS_THRESHOLD consecutive misses first.
      const authoritativeCancel = !!target;
      if (!authoritativeCancel && sub) {
        const misses = (sub.sync_miss_count ?? 0) + 1;
        if (misses < MISS_THRESHOLD) {
          await supabase
            .from("subscriptions")
            .update({ sync_miss_count: misses, updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          softMisses++;
          console.warn(
            `Sumit sync: no recurring item found for therapist ${t.id} ` +
              `(miss ${misses}/${MISS_THRESHOLD}); deferring demotion to a later run.`
          );
          continue;
        }
      }

      // Authoritative cancel, or the ambiguous miss streak reached threshold.
      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      }
      // A therapist who paid before ever being admin-approved (the approval
      // queue is independent of payment) must fall back to "pending", not
      // "approved" — writing "approved" here listed an unreviewed profile as
      // "מאושר-חינמי" while it still sat in the approval queue.
      const demotedStatus = t.admin_approved ? "approved" : "pending";
      await supabase
        .from("therapists")
        .update({
          status: demotedStatus,
          manually_promoted: false,
          promotion_source: null,
          promoted_since: null,
          promoted_until: null,
        })
        .eq("id", t.id);

      await writeAudit(supabase, {
        therapistId: t.id,
        actorType: "sumit",
        action: `status_change:paying->${demotedStatus}`,
        before: { status: "paying", promotion_source: "paid" },
        after: { status: demotedStatus, promotion_source: null },
        reason: authoritativeCancel
          ? `sumit_status=${target!.Status}`
          : `no_active_recurring_at_sumit_after_${MISS_THRESHOLD}_misses`,
      });

      if (t.email) {
        await sendPromotionEndedEmail({
          to: t.email,
          name: t.full_name ?? "",
          reason: "payment_failed" as PromotionEndedReason,
        });
      }
      demoted++;
    } catch (err) {
      errors++;
      console.error(`Sumit sync failed for therapist ${t.id}:`, err);
    }
  }

  // -------- (2) Expired manual / trial promotions --------
  const nowIso = new Date().toISOString();
  const { data: expiredTrials } = await supabase
    .from("therapists")
    .select("id, full_name, email, promotion_source, admin_approved")
    .in("promotion_source", ["trial", "manual"])
    .not("promoted_until", "is", null)
    .lte("promoted_until", nowIso);

  for (const t of expiredTrials ?? []) {
    try {
      // Same rule as pass (1): only admin-approved therapists land on
      // "approved"; the rest go back to the approval queue as "pending".
      const demotedStatus = t.admin_approved ? "approved" : "pending";
      await supabase
        .from("therapists")
        .update({
          status: demotedStatus,
          manually_promoted: false,
          promotion_source: null,
          promoted_since: null,
          promoted_until: null,
        })
        .eq("id", t.id);

      await writeAudit(supabase, {
        therapistId: t.id,
        actorType: "cron",
        action: `status_change:paying->${demotedStatus}`,
        before: { status: "paying", promotion_source: t.promotion_source },
        after: { status: demotedStatus, promotion_source: null },
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
  // Cooling window: skip subscriptions cancelled/touched within the last hour so
  // a sub that pass (1) just marked cancelled can't be swept — and its real
  // Sumit order cancelled — in the same run. A genuine orphan is still caught on
  // the next run; the billing-leak guard tolerates that small delay.
  const orphanCoolingIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: cancelledSubs } = await supabase
    .from("subscriptions")
    .select("id, therapist_id, morning_token_id")
    .eq("status", "cancelled")
    .not("morning_token_id", "is", null)
    .lt("updated_at", orphanCoolingIso);

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

  // -------- (5) Center standing orders --------
  // מרכז טיפולי משלם בהוראת קבע משלו (`center:<id>`), ומטפליו מקודמים דרך
  // promotion_source='center'. אם Sumit ביטל את ההוראה (כרטיס נדחה שוב ושוב)
  // — בלי הסעיף הזה המרכז נשאר "active" ומטפליו ממשיכים לקבל הפניות בחינם,
  // עד שאדמין לוחץ ידנית "סטטוס מ-Sumit". כמו בסעיף (1): מורידים רק כש-Sumit
  // מחזיר סטטוס לא-פעיל מפורשות; פריט שלא נמצא = קריאה עמומה, מדלגים ומנסים
  // בריצה הבאה (מספר המרכזים קטן, העיכוב זניח).
  let centersChecked = 0;
  let centersCancelled = 0;
  let centerTherapistsDemoted = 0;
  const { data: activeCenters } = await supabase
    .from("therapy_center_accounts")
    .select("id, name, sumit_recurring_id")
    .eq("status", "active")
    .not("sumit_recurring_id", "is", null);

  for (const c of activeCenters ?? []) {
    centersChecked++;
    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: `center:${c.id}`,
        includeInactive: true,
      });
      const ours = items.find((i) => Number(i.ID) === Number(c.sumit_recurring_id));
      if (!ours || ours.Status === 0) continue; // פעיל, או קריאה עמומה — לא נוגעים.

      await supabase
        .from("therapy_center_accounts")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", c.id)
        .eq("status", "active"); // מרוץ מול פעולת אדמין מקבילה
      centersCancelled++;

      centerTherapistsDemoted += await demoteCenterTherapists(
        { centerId: c.id as string },
        "center standing order cancelled at Sumit (cron sync)",
      );

      // התראה לאדמין — ביטול מנוי מרכז הוא אירוע עסקי שדורש מעקב אנושי.
      try {
        await resend.emails.send({
          from: "טיפול חכם <noreply@mentalytics.co.il>",
          to: ALERT_TO,
          subject: `⚠️ מנוי המרכז "${c.name}" בוטל ב-Sumit`,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
            <p>הסנכרון היומי זיהה שהוראת הקבע של המרכז <strong>${String(c.name).replace(/</g, "&lt;")}</strong> אינה פעילה יותר ב-Sumit (ככל הנראה חיובים שנכשלו).</p>
            <p>המרכז סומן כמבוטל ומטפליו הוסרו ממערכת ההתאמות. מומלץ ליצור קשר עם המרכז לעדכון אמצעי תשלום ולחדש את המנוי.</p>
            <p><strong>center_id:</strong> ${c.id}<br/><strong>מזהה הוראת קבע:</strong> ${c.sumit_recurring_id}</p>
          </div>`,
        });
      } catch (mailErr) {
        console.error("center cancel alert email failed:", mailErr);
      }
    } catch (err) {
      errors++;
      console.error(`Center sync failed for center ${c.id}:`, err);
    }
  }

  return NextResponse.json({
    checked,
    stillActive,
    softMisses,
    demoted,
    trialsExpired,
    orphansFound,
    orphansCancelled,
    orphanAlerts,
    promosReverted,
    centersChecked,
    centersCancelled,
    centerTherapistsDemoted,
    errors,
  });
}
