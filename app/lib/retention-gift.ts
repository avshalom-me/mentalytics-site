import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";
import { writeAudit } from "./audit";
import { logEmail } from "./email-log";
import { automatedSendAllowed } from "./automated-email-guard";
import { operationalMailTarget } from "./therapist-recipient";
import {
  deferRecurringNextBilling,
  getSavedPaymentMethod,
  listRecurringForCustomer,
  sumitDay,
  SUMIT_RECURRING_ENDED_STATUSES,
} from "./sumit";
import {
  addMonthsToDay,
  daysBetween,
  israelDay,
  israelDayToIso,
  retentionGiftBlocker,
  RETENTION_GIFT_REMINDER_DAYS,
} from "./retention-gift-rules";
import {
  buildRetentionGiftEndingEmail,
  buildRetentionGiftGrantedEmail,
  RETENTION_GIFT_ENDING_TEMPLATE,
  RETENTION_GIFT_GRANTED_TEMPLATE,
  type RetentionGiftMail,
} from "./retention-gift-emails";

// ─────────────────────────────────────────────────────────────────────────────
// "הארכה במתנה - שימור" - הצד של השרת.
//
// שלושה מסלולים:
//   planRetentionGift       קריאה בלבד: האם אפשר, ומה בדיוק יקרה (לחלון באדמין)
//   grantRetentionGift      דוחה את החיוב ב-Sumit, רושם אצלנו, ושולח מייל אם התבקש
//   runRetentionGiftReminder  הקרון: מייל שבוע לפני שהחיוב חוזר
//
// מה *לא* קורה כאן, בכוונה: שום דבר לא מבטל ולא יוצר הוראת קבע, והקידום של
// המטפל לא משתנה. המתנה היא רק תאריך חיוב שזז. לכן גם אין "סיום מתנה" שצריך
// לרוץ - Sumit מחייבת בתאריך החדש, והסנכרון היומי רואה חיוב רגיל.
// ─────────────────────────────────────────────────────────────────────────────

const FROM = "טיפול חכם <noreply@mentalytics.co.il>";

type SubRow = {
  id: string;
  status: string | null;
  morning_token_id: string | null;
  amount: number | null;
  promo_reverts_at: string | null;
  retention_gift_until: string | null;
};

export type RetentionGiftPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      therapistId: string;
      name: string;
      email: string | null;
      months: number;
      amount: number;
      recurringItemId: number;
      subscriptionId: string;
      /** תאריך החיוב הבא היום, לפני המתנה. */
      currentNextBilling: string;
      /** תאריך החיוב הבא אחרי המתנה = סוף המתנה. */
      newNextBilling: string;
      promoRevertsAt: string | null;
      /** אזהרות שאינן חוסמות (כרטיס שיפוג לפני חזרת החיוב וכד'). */
      warnings: string[];
    };

export async function planRetentionGift(therapistId: string, months: number): Promise<RetentionGiftPlan> {
  const [{ data: therapist }, { data: sub }] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, full_name, email, status, promotion_source")
      .eq("id", therapistId)
      .maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("id, status, morning_token_id, amount, promo_reverts_at, retention_gift_until")
      .eq("therapist_id", therapistId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const s = (sub as SubRow | null) ?? null;
  const today = israelDay();

  // הבדיקות שאינן דורשות את Sumit רצות קודם, כדי לא לבזבז קריאת API (מכסה)
  // על מטפל שממילא אינו זכאי.
  const early = retentionGiftBlocker({
    therapist: therapist ?? null,
    subscription: s,
    order: { status: 0, nextBilling: "9999-12-31" },
    liveOrderCount: 1,
    months,
    today,
  });
  if (early) return { ok: false, reason: early };

  const recurringItemId = Number(s!.morning_token_id);
  const items = await listRecurringForCustomer({ externalIdentifier: therapistId, includeInactive: true });
  const item = items.find((i) => Number(i.ID) === recurringItemId) ?? null;
  const live = items.filter((i) => !SUMIT_RECURRING_ENDED_STATUSES.includes(Number(i.Status)));

  const blocker = retentionGiftBlocker({
    therapist: therapist ?? null,
    subscription: s,
    order: item ? { status: Number(item.Status), nextBilling: sumitDay(item.Date_NextBilling) } : null,
    liveOrderCount: live.length,
    months,
    today,
  });
  if (blocker) return { ok: false, reason: blocker };

  const currentNextBilling = sumitDay(item!.Date_NextBilling)!;
  const newNextBilling = addMonthsToDay(currentNextBilling, months);

  const warnings: string[] = [];
  try {
    const card = await getSavedPaymentMethod(therapistId, new Date(`${newNextBilling}T12:00:00Z`));
    if (!card) warnings.push("לא נמצא כרטיס שמור אצל הלקוח ב-Sumit. כדאי לברר לפני שהחיוב חוזר.");
    else if (card.expired) {
      warnings.push(
        `הכרטיס השמור (${card.lastDigits ?? "ללא ספרות"}) יפוג לפני ${newNextBilling}, והחיוב שיחזור צפוי להידחות. כדאי לבקש מהמטפל/ת לעדכן כרטיס.`
      );
    }
  } catch (e) {
    // בדיקת הכרטיס היא אזהרה בלבד; כשל בה לא חוסם את המתנה.
    console.warn("planRetentionGift: saved-card check failed:", e instanceof Error ? e.message : e);
  }

  return {
    ok: true,
    therapistId,
    name: ((therapist!.full_name as string | null) ?? "").trim(),
    email: (therapist!.email as string | null) ?? null,
    months,
    amount: Number(s!.amount) || 0,
    recurringItemId,
    subscriptionId: s!.id,
    currentNextBilling,
    newNextBilling,
    promoRevertsAt: s!.promo_reverts_at,
    warnings,
  };
}

async function sendRetentionMail(opts: {
  to: string;
  therapistId: string;
  template: string;
  sentBy: "admin" | "cron";
  mail: RetentionGiftMail;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "resend not configured" };
  const log = (error?: string) =>
    void logEmail({
      recipient: opts.to,
      recipientType: "therapist",
      entityId: opts.therapistId,
      subject: opts.mail.subject,
      template: opts.template,
      sentBy: opts.sentBy,
      status: error ? "failed" : "sent",
      error,
    });
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: FROM,
      to: opts.to,
      replyTo: "admin@getmentalytics.com",
      subject: opts.mail.subject,
      html: opts.mail.html,
      text: opts.mail.text,
    });
    if (error) {
      const msg = String((error as { message?: string }).message ?? error);
      log(msg);
      return { ok: false, error: msg };
    }
    log();
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    log(msg);
    return { ok: false, error: msg };
  }
}

export type RetentionGiftGrant = {
  ok: true;
  months: number;
  previousNextBilling: string;
  nextBilling: string;
  email: { requested: boolean; sent: boolean; to?: string; error?: string };
  warnings: string[];
};

export async function grantRetentionGift(opts: {
  therapistId: string;
  months: number;
  sendEmail: boolean;
}): Promise<RetentionGiftGrant | { ok: false; reason: string }> {
  // מתכננים מחדש ברגע הביצוע: בין פתיחת החלון ללחיצה יכול היה לצאת חיוב.
  const plan = await planRetentionGift(opts.therapistId, opts.months);
  if (!plan.ok) return plan;

  // (1) Sumit קודם. אם זה נכשל, שום דבר אצלנו לא השתנה והלקוח לא קיבל מייל.
  let moved: { previousNextBilling: string; nextBilling: string };
  try {
    moved = await deferRecurringNextBilling({
      recurringItemId: plan.recurringItemId,
      customerExternalId: plan.therapistId,
      nextPaymentDate: plan.newNextBilling,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`grantRetentionGift: Sumit defer failed for ${plan.therapistId}:`, msg);
    return { ok: false, reason: `דחיית החיוב ב-Sumit נכשלה, ולא בוצע שום שינוי. (${msg})` };
  }

  // (2) הרישום אצלנו. מחיר מבצע שאמור לחזור למחיר המלא נדחה באותו מספר
  // חודשים: בלי זה המטפל היה "מפסיד" חודשי מבצע שהמתנה אכלה, והמחיר היה
  // עולה באמצע תקופת המתנה במקום אחרי מספר החיובים שהובטח.
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    retention_gift_granted_at: now,
    retention_gift_until: moved.nextBilling,
    retention_gift_prev_billing: moved.previousNextBilling,
    retention_gift_months: plan.months,
    retention_gift_reminded_at: null,
    current_period_end: israelDayToIso(moved.nextBilling),
    updated_at: now,
  };
  let promoShiftedTo: string | null = null;
  if (plan.promoRevertsAt) {
    // אותה שעה ביום, כמה חודשים אחר כך - על התאריך ב-UTC, כפי שהעמודה נכתבת.
    const original = new Date(plan.promoRevertsAt).toISOString();
    promoShiftedTo = `${addMonthsToDay(original.slice(0, 10), plan.months)}${original.slice(10)}`;
    patch.promo_reverts_at = promoShiftedTo;
  }
  const { error: dbErr } = await supabaseAdmin.from("subscriptions").update(patch).eq("id", plan.subscriptionId);
  if (dbErr) {
    // Sumit כבר נדחה ואצלנו לא נרשם. מחזירים את התאריך, כדי שלא תישאר מתנה
    // שאף אחד לא יודע עליה (בלי תזכורת, ועם דוח תקציב שסופר הכנסה שלא תגיע).
    let restored = false;
    try {
      await deferRecurringNextBilling({
        recurringItemId: plan.recurringItemId,
        customerExternalId: plan.therapistId,
        nextPaymentDate: moved.previousNextBilling,
        allowEarlier: true,
      });
      restored = true;
    } catch (e) {
      console.error(`grantRetentionGift: restore after DB failure failed for ${plan.therapistId}:`, e);
    }
    return {
      ok: false,
      reason: restored
        ? `הרישום במערכת נכשל (${dbErr.message}), והחיוב ב-Sumit הוחזר לתאריך המקורי. לא בוצע שינוי.`
        : `הרישום במערכת נכשל (${dbErr.message}), וגם החזרת התאריך ב-Sumit נכשלה: החיוב שם נדחה ל-${moved.nextBilling}. יש לתקן ידנית.`,
    };
  }

  await writeAudit(supabaseAdmin, {
    therapistId: plan.therapistId,
    actorType: "admin",
    action: "retention_gift_granted",
    before: { next_billing: moved.previousNextBilling, promo_reverts_at: plan.promoRevertsAt },
    after: {
      next_billing: moved.nextBilling,
      months: plan.months,
      sumit_recurring: String(plan.recurringItemId),
      promo_reverts_at: promoShiftedTo,
    },
    reason: "retention gift: next charge deferred, promotion unchanged",
  });

  // (3) המייל, רק אם האדמין ביקש. כשל בשליחה לא מבטל את המתנה - היא כבר
  // בתוקף ב-Sumit - אלא חוזר לאדמין כדי שיעדכן את המטפל בעצמו.
  const email: RetentionGiftGrant["email"] = { requested: opts.sendEmail, sent: false };
  if (opts.sendEmail) {
    const target = await operationalMailTarget(plan.therapistId);
    if (!target.to) {
      email.error = "לא נמצאה כתובת מייל למטפל/ת";
    } else {
      email.to = target.to;
      const r = await sendRetentionMail({
        to: target.to,
        therapistId: plan.therapistId,
        template: RETENTION_GIFT_GRANTED_TEMPLATE,
        sentBy: "admin",
        mail: buildRetentionGiftGrantedEmail({
          name: plan.name,
          months: plan.months,
          chargeDate: moved.nextBilling,
          amount: plan.amount,
        }),
      });
      email.sent = r.ok;
      if (!r.ok) email.error = r.error;
    }
  }

  return {
    ok: true,
    months: plan.months,
    previousNextBilling: moved.previousNextBilling,
    nextBilling: moved.nextBilling,
    email,
    warnings: plan.warnings,
  };
}

// ── הקרון: מייל שבוע לפני שהחיוב חוזר ───────────────────────────────────────

export type RetentionReminderTarget = {
  subscriptionId: string;
  therapistId: string;
  chargeDate: string;
  amount: number;
  months: number;
};

export type RetentionReminderRun = {
  ok: boolean;
  previewOnly: boolean;
  targets: RetentionReminderTarget[];
  sent: number;
  /** מתנות שהתאריך הרשום אצלנו כבר לא תואם את מה שהסנכרון קרא מ-Sumit. */
  mismatched: { therapistId: string; ours: string; sumit: string | null }[];
  error?: string;
};

export async function runRetentionGiftReminder(opts: { send?: boolean } = {}): Promise<RetentionReminderRun> {
  const send = opts.send === true;
  const run: RetentionReminderRun = { ok: true, previewOnly: !send, targets: [], sent: 0, mismatched: [] };
  try {
    const today = israelDay();
    // חלון ולא שוויון מדויק, מאותה סיבה כמו בתזכורת של מסלול ההזמנה: יום אחד
    // שהקרון לא רץ לא יכול להשאיר לקוח בלי המייל שהובטח לו. החותמת שומרת
    // על פעם אחת בלבד.
    const horizon = new Date(`${today}T12:00:00Z`);
    horizon.setUTCDate(horizon.getUTCDate() + RETENTION_GIFT_REMINDER_DAYS);
    const until = horizon.toISOString().slice(0, 10);

    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, therapist_id, amount, current_period_end, retention_gift_until, retention_gift_months")
      .eq("status", "active")
      .gt("retention_gift_until", today)
      .lte("retention_gift_until", until)
      .is("retention_gift_reminded_at", null);
    if (error) throw new Error(error.message);
    const rows = subs ?? [];
    if (rows.length === 0) return run;

    // רק מי שעדיין משלם בעצמו. מי שבוטל או הורד בינתיים כבר לא יחויב, ומייל
    // "החיוב חוזר ב-..." אליו היה פשוט שגוי.
    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name")
      .in("id", rows.map((r) => r.therapist_id))
      .eq("status", "paying")
      .eq("promotion_source", "paid");
    const byId = new Map((therapists ?? []).map((t) => [t.id as string, t]));

    for (const r of rows) {
      const t = byId.get(r.therapist_id as string);
      if (!t) continue;
      const chargeDate = String(r.retention_gift_until).slice(0, 10);
      // הסנכרון היומי כותב ל-current_period_end את תאריך החיוב הבא ש-Sumit
      // מדווחת. אם הוא כבר לא התאריך של המתנה (מישהו שינה את ההוראה ידנית),
      // לא שולחים מייל עם תאריך שאולי אינו נכון - מדווחים אלינו.
      const sumitSays = r.current_period_end ? israelDay(new Date(r.current_period_end as string)) : null;
      if (!sumitSays || Math.abs(daysBetween(sumitSays, chargeDate)) > 1) {
        run.mismatched.push({ therapistId: r.therapist_id as string, ours: chargeDate, sumit: sumitSays });
        continue;
      }
      const target: RetentionReminderTarget = {
        subscriptionId: r.id as string,
        therapistId: r.therapist_id as string,
        chargeDate,
        amount: Number(r.amount) || 0,
        months: Number(r.retention_gift_months) || 2,
      };
      run.targets.push(target);
      if (!send) continue;

      const mailTarget = await operationalMailTarget(target.therapistId);
      if (!mailTarget.to) continue;
      // תבנית מאושרת: המייל הזה הובטח במפורש במייל המתנה ("שבוע לפני סיום
      // המתנה נשלח אליך מייל תזכורת"), והבעלים ביקש אותו כחלק מהפיצ'ר (13/10/2026).
      if (!automatedSendAllowed(mailTarget.to, RETENTION_GIFT_ENDING_TEMPLATE).allowed) continue;

      const res = await sendRetentionMail({
        to: mailTarget.to,
        therapistId: target.therapistId,
        template: RETENTION_GIFT_ENDING_TEMPLATE,
        sentBy: "cron",
        mail: buildRetentionGiftEndingEmail({
          name: ((t.full_name as string | null) ?? "").trim(),
          months: target.months,
          chargeDate: target.chargeDate,
          amount: target.amount,
        }),
      });
      if (res.ok) {
        run.sent++;
        // החותמת רק אחרי שליחה מוצלחת: כישלון חוזר בריצה הבאה ולא נעלם.
        await supabaseAdmin
          .from("subscriptions")
          .update({ retention_gift_reminded_at: new Date().toISOString() })
          .eq("id", target.subscriptionId);
      } else {
        console.error(`retention gift reminder failed for ${target.therapistId}: ${res.error}`);
      }
    }
  } catch (e) {
    run.ok = false;
    run.error = e instanceof Error ? e.message : String(e);
  }
  return run;
}
