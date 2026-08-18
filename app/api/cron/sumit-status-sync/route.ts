import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { Resend } from "resend";
import {
  listRecurringForCustomer,
  cancelSubscription,
  updateRecurringPrice,
  SUBSCRIPTION_BASE_PRICE,
  SUMIT_RECURRING_ACTIVE_STATUSES,
  SUMIT_RECURRING_CANCELLED_STATUS,
  type RecurringItem,
} from "@/app/lib/sumit";
import { VAT_RATE } from "@/app/lib/crm";
import { writeAudit } from "@/app/lib/audit";
import { sendPromotionEndedEmail, PromotionEndedReason } from "@/app/lib/therapist-emails";
import { demoteCenterTherapists } from "@/app/lib/center-promotion";
import { alertRecipients } from "@/app/lib/alert-recipients";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const ALERT_TO = alertRecipients();

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

// Sumit returned a standing-order status we have no rule for. NOT a
// cancellation - see the policy note in pass (1). One alert per therapist per
// week: the underlying condition (a card that keeps failing) can persist for
// days, and a daily repeat would train the admin to ignore it.
async function alertAdminUnknownStatus(
  therapistId: string,
  therapistName: string,
  recurringItemId: string,
  status: number
): Promise<boolean> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("therapist_audit_log")
    .select("id")
    .eq("therapist_id", therapistId)
    .eq("action", "sumit_unknown_status")
    .gte("created_at", weekAgo)
    .limit(1)
    .maybeSingle();

  await writeAudit(supabase, {
    therapistId,
    actorType: "sumit",
    action: "sumit_unknown_status",
    before: null,
    after: { sumit_recurring: recurringItemId, sumit_status: status },
    reason: `unknown Sumit status ${status} - promotion left untouched`,
  });

  if (recent) return false; // כבר התרענו השבוע

  try {
    await resend.emails.send({
      from: "טיפול חכם <noreply@mentalytics.co.il>",
      to: ALERT_TO,
      subject: `🔎 סטטוס Sumit לא מוכר (${status}) אצל ${therapistName || "מטפל/ת"}`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
        <p>הסנכרון היומי מצא להוראת הקבע של <strong>${therapistName.replace(/</g, "&lt;") || "מטפל/ת"}</strong> סטטוס שאיננו מכירים: <strong>${status}</strong>.</p>
        <p><strong>לא בוצע שום שינוי</strong> - הקידום נשאר על כנו והוראת הקבע לא בוטלה. הסטטוסים המוכרים: 0 = פעילה, 12 = מתוזמנת, 1 = בוטלה.</p>
        <p>סטטוס 3, למשל, הוא כשל חיוב זמני ש-Sumit מנסה שוב למחרת - ולרוב הוא נפתר מעצמו. אם הוא נתקע, כדאי לפנות למטפל/ת לעדכון אמצעי תשלום.</p>
        <p><strong>therapist_id:</strong> ${therapistId}<br/><strong>מזהה הוראת קבע:</strong> ${recurringItemId}</p>
        <p style="color:#6B807E;font-size:13px;">התראה נוספת על אותו מטפל תישלח לכל היותר בעוד שבוע.</p>
      </div>`,
    });
    return true;
  } catch (e) {
    console.error("alertAdminUnknownStatus: failed to send admin email:", e);
    return false;
  }
}

// מראה מקומית לחיובים החוזרים של מטפלים. Sumit גובה את החידוש החודשי
// בשרתים שלה ולא שולחת webhook, ולכן בלי זה מטפל שמשלם כל חודש מופיע אצלנו
// כשורת תשלום אחת בלבד - זו של ההרשמה - וכל שקל של חידוש נעדר ממסך הכספים
// ומהדוחות. זה בדיוק התיקון שמסלול המרכזים כבר קיבל; מסלול המטפלים לא.
//
// שתי מלכודות שהמסלול הזה חייב לעקוף:
//  1. החיוב הראשון של הוראת הקבע קורה ב-Date_Start, וב-checkout רגיל הוא כבר
//     נרשם כ-payment_type='subscription'. רישום נוסף שלו היה מכפיל הכנסה.
//     היוצא מן הכלל הוא מסלול ההזמנה (gift-trial), שבו לא זזים כספים בהרשמה
//     ולכן לא נוצרת שורת תשלום כלל - שם דווקא *כן* צריך לרשום אותו.
//  2. created_at חייב להיות תאריך החיוב ולא זמן הריצה, אחרת חיוב של יולי
//     נוחת בחודש הנוכחי וכל דוח חודשי מתעוות.
async function mirrorRenewalCharge(
  therapistId: string,
  item: RecurringItem,
  subAmount: number | null
): Promise<boolean> {
  const prev = item.Date_PreviousBilling ? String(item.Date_PreviousBilling).slice(0, 10) : null;
  const start = item.Date_Start ? String(item.Date_Start).slice(0, 10) : null;
  if (!prev || !start) return false;

  if (prev === start) {
    // החיוב הראשון של ההוראה. רושמים רק אם ה-checkout לא רשם אותו.
    const { data: signup } = await supabase
      .from("payments")
      .select("id")
      .eq("payment_type", "subscription")
      .eq("reference_id", therapistId)
      .eq("status", "completed")
      .limit(1)
      .maybeSingle();
    if (signup) return false;
  }

  // אידמפוטנטיות מול טבלת התשלומים עצמה ולא מול עמודת "חויב לאחרונה":
  // insert שהצליח בזמן שעדכון העמודה נכשל היה מייצר כפילות בריצה הבאה.
  const { data: already } = await supabase
    .from("payments")
    .select("id")
    .eq("payment_type", "subscription_renewal")
    .eq("reference_id", therapistId)
    .eq("metadata->>sumit_billing_date", prev)
    .limit(1)
    .maybeSingle();
  if (already) return false;

  // מה ש-Sumit חייבה בפועל גובר על המחיר השמור אצלנו. UnitPrice ב-Sumit הוא
  // כולל מע"מ (שולחים UnitPrice נטו עם VATIncluded:false, ו-Sumit שומרת ברוטו),
  // בעוד payments.amount הוא נטו ומסוג integer.
  const gross = Number(item.UnitPrice);
  const net =
    Number.isFinite(gross) && gross > 0
      ? Math.round(gross / (1 + VAT_RATE))
      : Number(subAmount) || 0;
  if (net <= 0) {
    console.error(`renewal mirror: no usable amount for therapist ${therapistId} (UnitPrice=${item.UnitPrice})`);
    return false;
  }

  const { error } = await supabase.from("payments").insert({
    payment_type: "subscription_renewal",
    reference_id: therapistId,
    amount: net,
    status: "completed",
    created_at: new Date(String(item.Date_PreviousBilling)).toISOString(),
    metadata: {
      sumit_billing_date: prev,
      sumit_recurring_id: String(item.ID),
      recorded_by: "sumit-status-sync",
    },
  });
  if (error) {
    console.error(`renewal mirror failed (therapist=${therapistId}, date=${prev}):`, error.message);
    return false;
  }
  return true;
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

// Daily sync (vercel.json: 06:45 UTC) that does two things:
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
// Polling once a day caps the "free-after-cancel" window at ~24 hours,
// which is acceptable for the size of a chargeback we'd see.
//
// Sumit API-quota note: every listRecurringForCustomer call below is one
// quota-counted API call per customer per run — there is no bulk endpoint.
// Pass (1) scales with paying therapists (fine: revenue scales with them);
// pass (3) used to scale with ALL-TIME cancelled subscriptions, which only
// ever grows — that unbounded term is what the decay schedule in pass (3)
// now caps.
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
  let orphansConfirmedInactive = 0; // newly stamped as confirmed-dead this run
  let orphansDeferredByDecay = 0; // confirmed-dead items skipped this run
  let promosReverted = 0;
  let renewalsRecorded = 0; // חיובי חידוש של מטפלים ששוקפו לטבלת התשלומים
  let unknownStatuses = 0; // סטטוס Sumit שאיננו מכירים - לא נגענו
  let unknownStatusAlerts = 0; // מתוכם, כמה הפכו למייל לאדמין

  // -------- (1) Sumit subscription state for paid therapists --------
  // 'gift_trial' נכלל לצד 'paid': מטפל שהצטרף במסלול ההזמנה הוא לקוח משלם
  // לכל דבר מרגע החיוב הראשון, ובלי הכללתו כאן הוא היה נשאר מקודם לנצח גם
  // אחרי שיבטל ב-Sumit. הדילוג בזמן חלון המתנה נעשה בתוך הלולאה.
  const { data: paidTherapists } = await supabase
    .from("therapists")
    .select("id, full_name, email, admin_approved, promotion_source")
    .eq("status", "paying")
    .in("promotion_source", ["paid", "gift_trial"]);

  for (const t of paidTherapists ?? []) {
    checked++;
    try {
      // חלון המתנה: הוראת הקבע קיימת ב-Sumit אבל טרם חייבה, ומצבה שם אינו
      // ניתן לשיפוט. בלי הדילוג הזה שתי ריצות היו מורידות את הקידום ומבטלות
      // מנוי תקין יומיים אחרי שהמטפל הצטרף.
      if (t.promotion_source === "gift_trial") {
        const { data: pending } = await supabase
          .from("subscriptions")
          .select("current_period_end")
          .eq("therapist_id", t.id)
          .eq("status", "active")
          .maybeSingle();
        if (pending?.current_period_end && new Date(pending.current_period_end).getTime() > Date.now()) {
          continue;
        }
      }
      const items = await listRecurringForCustomer({
        externalIdentifier: t.id,
        includeInactive: true,
      });

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id, morning_token_id, sync_miss_count, amount")
        .eq("therapist_id", t.id)
        .eq("status", "active")
        .maybeSingle();

      const target = sub?.morning_token_id
        ? items.find((i) => String(i.ID) === sub.morning_token_id)
        : items.sort((a, b) => Number(b.ID) - Number(a.ID))[0];

      if (target && SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(target.Status))) {
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
        if (await mirrorRenewalCharge(t.id, target, sub?.amount ?? null)) renewalsRecorded++;
        continue;
      }

      // ── מדיניות הסטטוסים של Sumit ────────────────────────────────────────
      // 0 = פעילה, 12 = מתוזמנת (חודשי מתנה) — חיות. 1 = בוטלה. כל ערך אחר
      // הוא מצב ביניים שאיננו מכירים, ו**אסור** לקרוא אותו כביטול: ב-16/8/26
      // הוראה חזרה עם Status=3 (כשל חיוב זמני), הקוד הישן קרא לזה "ההוראה
      // מתה", הוריד מטפל משלם מהקידום ולא ביטל דבר ב-Sumit. Sumit ניסתה שוב
      // למחרת, החיוב עבר, ובינתיים המטפל נרשם מחדש - שתי הוראות קבע וחיוב
      // כפול. זו בדיוק המדיניות שמסלול המרכזים כבר עובד לפיה (סעיף 5).
      if (target && Number(target.Status) !== SUMIT_RECURRING_CANCELLED_STATUS) {
        unknownStatuses++;
        console.warn(
          `Sumit sync: unknown status ${target.Status} for therapist ${t.id} ` +
            `(item ${target.ID}) — leaving the promotion untouched.`
        );
        if (await alertAdminUnknownStatus(t.id, t.full_name ?? "", String(target.ID), Number(target.Status))) {
          unknownStatusAlerts++;
        }
        continue;
      }

      // Not active. Distinguish two cases:
      //  - `target` present with Status == 1: Sumit AUTHORITATIVELY reports the
      //    standing order cancelled. Trust it and demote now.
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

  // Decay schedule (API-quota control): the cancelled list only ever grows,
  // and probing Sumit for every dead subscription every single day is an
  // unbounded quota consumer. Once Sumit AUTHORITATIVELY confirms an item
  // inactive (returns it with a non-zero status — a merely-missing item is
  // ambiguous and keeps its daily check), we stamp sumit_confirmed_inactive_at
  // and re-verify on a slowing cadence:
  //   unconfirmed              -> every run (daily)
  //   confirmed < 90 days ago  -> weekly (Sunday runs)
  //   confirmed >= 90 days ago -> monthly (1st-of-month runs)
  // Nothing is ever permanently excluded — a resurrected order (manual
  // reactivation at Sumit, suspended->active) is still caught within a week
  // or a month. Billing is monthly, so that latency almost always means zero
  // wrong charges; and the moment a confirmed item is found ACTIVE the stamp
  // is cleared (back to daily) and the leak path below cancels + alerts.
  const runDate = new Date();
  const monthlySweep = runDate.getUTCDate() === 1;
  const weeklySweep = runDate.getUTCDay() === 0; // Sunday
  const confirmedRecentIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  type OrphanSubRow = {
    id: string;
    therapist_id: string;
    morning_token_id: string | null;
    sumit_confirmed_inactive_at: string | null;
  };
  const orphanQuery = () =>
    supabase
      .from("subscriptions")
      .select("id, therapist_id, morning_token_id, sumit_confirmed_inactive_at")
      .eq("status", "cancelled")
      .not("morning_token_id", "is", null)
      .lt("updated_at", orphanCoolingIso);

  // Unconfirmed items are swept on every run.
  const { data: unconfirmedSubs } = await orphanQuery().is(
    "sumit_confirmed_inactive_at",
    null
  );
  // Confirmed items re-enter the sweep on the weekly/monthly cadence.
  let confirmedDue: OrphanSubRow[] = [];
  if (monthlySweep) {
    const { data } = await orphanQuery().not("sumit_confirmed_inactive_at", "is", null);
    confirmedDue = data ?? [];
  } else if (weeklySweep) {
    // gt on timestamptz is NULL-safe: unstamped rows never match.
    const { data } = await orphanQuery().gt("sumit_confirmed_inactive_at", confirmedRecentIso);
    confirmedDue = data ?? [];
  }
  const cancelledSubs: OrphanSubRow[] = [...(unconfirmedSubs ?? []), ...confirmedDue];

  // Observability: how many confirmed-dead items were NOT probed this run.
  {
    const { count } = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .not("morning_token_id", "is", null)
      .not("sumit_confirmed_inactive_at", "is", null);
    orphansDeferredByDecay = Math.max(0, (count ?? 0) - confirmedDue.length);
  }

  for (const sub of cancelledSubs) {
    const recurringId = sub.morning_token_id as string | null;
    if (!recurringId) continue;

    // A non-numeric id can never match a Sumit recurring item (Sumit ids are
    // numeric; e.g. a legacy Morning-era token) — probing Sumit for it is a
    // guaranteed-wasted call every day. Stamp it once so the decay schedule
    // retires it from the daily sweep without ever hitting the API.
    if (!/^\d+$/.test(recurringId)) {
      if (!sub.sumit_confirmed_inactive_at) {
        await supabase
          .from("subscriptions")
          .update({ sumit_confirmed_inactive_at: new Date().toISOString() })
          .eq("id", sub.id);
        orphansConfirmedInactive++;
      }
      continue;
    }

    try {
      const items = await listRecurringForCustomer({
        externalIdentifier: sub.therapist_id,
        includeInactive: true,
      });
      const target = items.find((i) => String(i.ID) === recurringId);

      if (!target || target.Status !== 0) {
        // Genuinely inactive at Sumit (or gone) — local and remote agree.
        // Stamp the first AUTHORITATIVE confirmation (item present with a
        // non-zero status). A missing item stays unstamped: a transient
        // partial list read is indistinguishable from deletion, so it keeps
        // its daily check until Sumit returns the item explicitly.
        if (target && !sub.sumit_confirmed_inactive_at) {
          await supabase
            .from("subscriptions")
            .update({ sumit_confirmed_inactive_at: new Date().toISOString() })
            .eq("id", sub.id);
          orphansConfirmedInactive++;
        }
        continue;
      }

      // Active at Sumit but cancelled locally → billing leak. Reconcile.
      // A previously-confirmed item showing up ACTIVE has resurrected —
      // clear the stamp so it returns to daily scrutiny until re-confirmed.
      orphansFound++;
      if (sub.sumit_confirmed_inactive_at) {
        await supabase
          .from("subscriptions")
          .update({ sumit_confirmed_inactive_at: null })
          .eq("id", sub.id);
      }
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
  const CENTER_MISS_THRESHOLD = 2; // כמו אצל מטפלים - קריאה עמומה אחת לא מבטלת
  let centersChecked = 0;
  let centersCancelled = 0;
  let centerTherapistsDemoted = 0;
  let centerChargesRecorded = 0;
  let centerOrphansFound = 0;
  const { data: activeCenters } = await supabase
    .from("therapy_center_accounts")
    .select("id, name, sumit_recurring_id, sumit_miss_count, last_billed_on, agreed_monthly_price, billing_track, payer_email")
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

      // (א) מראה מקומית לחיובים החוזרים. ל-Sumit אין webhooks, ולכן בלי זה
      // מרכז שמשלם כל חודש מופיע אצלנו כשורת תשלום אחת לכל היותר - וההכנסה
      // נעלמת מכל דוח. משקפים כל תאריך-חיוב חדש שראינו כשורת payments.
      const prevBilling = ours?.Date_PreviousBilling ? String(ours.Date_PreviousBilling).slice(0, 10) : null;
      if (prevBilling && prevBilling !== c.last_billed_on) {
        const amount = Number(c.agreed_monthly_price) || Number(ours?.UnitPrice) || 0;
        if (amount > 0) {
          const { error: payErr } = await supabase.from("payments").insert({
            payment_type: "center_subscription",
            reference_id: c.id,
            amount,
            status: "completed",
            metadata: {
              center_name: c.name,
              billing_track: c.billing_track,
              sumit_billing_date: prevBilling,
              sumit_recurring_id: String(c.sumit_recurring_id),
              recorded_by: "sumit-status-sync",
              payer_email: c.payer_email,
            },
          });
          if (payErr) {
            console.error(`center billing mirror failed (center=${c.id}, date=${prevBilling}):`, payErr.message);
          } else {
            centerChargesRecorded++;
            await supabase
              .from("therapy_center_accounts")
              .update({ last_billed_on: prevBilling, updated_at: new Date().toISOString() })
              .eq("id", c.id);
          }
        }
      }

      // (ב) סריקת יתומים: הוראת קבע *נוספת* חיה תחת אותו לקוח = חיוב כפול
      // שאף מסלול קיים לא מזהה (הביטול נוגע רק ל-ID הרשום). לא מבטלים
      // אוטומטית - מתריעים, כדי לא לגעת בטעות בהוראה הנכונה.
      const otherLive = items.filter(
        (i) => Number(i.ID) !== Number(c.sumit_recurring_id) && (i.Status === 0 || i.Status === 12),
      );
      if (otherLive.length > 0) {
        centerOrphansFound += otherLive.length;
        console.error(`CENTER ORPHAN: center=${c.id} has ${otherLive.length} extra live Sumit item(s): ${otherLive.map((i) => i.ID).join(", ")}`);
        try {
          await resend.emails.send({
            from: "טיפול חכם <noreply@mentalytics.co.il>",
            to: ALERT_TO,
            subject: `⚠️ הוראת קבע כפולה למרכז "${c.name}"`,
            html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
              <p>למרכז <strong>${String(c.name).replace(/</g, "&lt;")}</strong> יש ב-Sumit יותר מהוראת קבע חיה אחת - כלומר הכרטיס עלול להיות מחויב פעמיים.</p>
              <p><strong>ההוראה הרשומה אצלנו:</strong> ${c.sumit_recurring_id}<br/>
                 <strong>הוראות נוספות חיות:</strong> ${otherLive.map((i) => `${i.ID} (status ${i.Status})`).join(", ")}</p>
              <p>יש לבטל ידנית בממשק Sumit את ההוראות המיותרות. center_id: ${c.id}</p>
            </div>`,
          });
        } catch (mailErr) {
          console.error("center orphan alert email failed:", mailErr);
        }
      }

      // (ג) פריט שלא נמצא = קריאה עמומה. כמו אצל מטפלים - מורידים רק אחרי
      // 2 החמצות רצופות, כדי שהוראה שנמחקה ב-Sumit לא תשאיר שירות חינם לנצח.
      if (!ours) {
        const misses = (Number(c.sumit_miss_count) || 0) + 1;
        if (misses < CENTER_MISS_THRESHOLD) {
          await supabase
            .from("therapy_center_accounts")
            .update({ sumit_miss_count: misses, updated_at: new Date().toISOString() })
            .eq("id", c.id);
          console.warn(`center sync: item ${c.sumit_recurring_id} not found for center ${c.id} (miss ${misses}/${CENTER_MISS_THRESHOLD})`);
          continue;
        }
        console.error(`center sync: item ${c.sumit_recurring_id} missing ${misses}x for center ${c.id} - treating as cancelled`);
      } else if ((Number(c.sumit_miss_count) || 0) > 0) {
        await supabase.from("therapy_center_accounts").update({ sumit_miss_count: 0 }).eq("id", c.id);
      }
      // סטטוסים (נמדדו מול הוראות אמיתיות, ראו SUMIT_RECURRING_ACTIVE_STATUSES):
      // 0=פעילה, 12=מתוזמנת (חודשי מתנה) — חיות, לא נוגעים. 1=בוטלה — מבטלים
      // גם אצלנו. סטטוס אחר/לא מוכר: לא מבטלים אוטומטית (הלקח מ-12: הוראת
      // מתנה נקראה "מבוטלת" והמרכז בוטל בטעות) — רק מתריעים לאדמין לבדוק.
      if (ours && (ours.Status === 0 || ours.Status === 12)) continue;
      if (ours && ours.Status !== 1) {
        console.warn(`center sync: unknown Sumit status ${ours.Status} for center ${c.id} — not touching, alerting admin`);
        try {
          await resend.emails.send({
            from: "טיפול חכם <noreply@mentalytics.co.il>",
            to: ALERT_TO,
            subject: `🔎 סטטוס Sumit לא מוכר (${ours.Status}) למרכז "${c.name}"`,
            html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
              <p>הסנכרון היומי מצא להוראת הקבע של המרכז <strong>${String(c.name).replace(/</g, "&lt;")}</strong> סטטוס לא מוכר: <strong>${ours.Status}</strong>.</p>
              <p>לא בוצע ביטול אוטומטי. מומלץ לבדוק בממשק Sumit (0=פעילה, 12=מתוזמנת/מתנה, 1=מבוטלת).</p>
              <p><strong>center_id:</strong> ${c.id}<br/><strong>מזהה הוראת קבע:</strong> ${c.sumit_recurring_id}</p>
            </div>`,
          });
        } catch (mailErr) {
          console.error("center unknown-status alert email failed:", mailErr);
        }
        continue;
      }

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
    orphansConfirmedInactive,
    orphansDeferredByDecay,
    promosReverted,
    renewalsRecorded,
    unknownStatuses,
    unknownStatusAlerts,
    centersChecked,
    centersCancelled,
    centerTherapistsDemoted,
    centerChargesRecorded,
    centerOrphansFound,
    errors,
  });
}
