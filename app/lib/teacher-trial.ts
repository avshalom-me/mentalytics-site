// תקופת הניסיון של מורה - הכללים, כפונקציות טהורות (בלי מסד ובלי רשת), כדי
// שאפשר יהיה לבדוק אותם בלי להריץ קרון ובלי לשלוח מייל.
//
// המודל שהבעלים אישר (2/10/2026):
//   • 90 יום מהאישור - בלי תשלום, בלי כרטיס, ובלי שום בקשת תשלום בדרך.
//   • ביום ה-85 - מייל אחד להרשמה (60 ש"ח לחודש כולל מע"מ).
//   • ביום האחרון - מייל נוסף.
//   • למחרת - מי שלא נרשם/ה עובר/ת לארכיון ויוצא/ת מהמאגר (הפיך).
//
// שני המיילים מבטיחים בדיוק את זה ("ביום האחרון נשלח תזכורת אחת נוספת",
// "זו ההודעה האחרונה"), ולכן הסדר נאכף כאן: אין ארכיון לפני המייל של היום
// האחרון, ואין מייל שלישי. כל הימים נספרים לפי התאריך בישראל, והניסיון
// נגמר בסוף היום (23:59:59 שעון ישראל), כדי ש"היום האחרון" במייל יהיה נכון
// גם למורה שאושר/ה בשעה מוקדמת.

import { TEACHER_PAY_EMAIL_DAY, TEACHER_TRIAL_DAYS } from "./teacher-options";

const TZ = "Asia/Jerusalem";

/** התאריך בישראל, YYYY-MM-DD. */
export function israelDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** כמה ימים מ-from עד to (שלילי כש-to לפני from). */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** הרגע 23:59:59 בשעון ישראל של התאריך הנתון (שעון חורף או קיץ, לפי התאריך). */
export function israelEndOfDay(dateStr: string): Date {
  for (const offset of ["+03:00", "+02:00"]) {
    const d = new Date(`${dateStr}T23:59:59${offset}`);
    const hhmm = d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
    if (israelDate(d) === dateStr && hhmm === "23:59") return d;
  }
  return new Date(`${dateStr}T23:59:59+02:00`);
}

/** סוף הניסיון למורה שאושר/ה עכשיו: סוף היום ה-90 בישראל. */
export function trialEndFor(approvedAt: Date = new Date()): Date {
  return israelEndOfDay(addDays(israelDate(approvedAt), TEACHER_TRIAL_DAYS));
}

/** הארכה ב-N ימים מסוף הניסיון (או מהיום, אם כבר נגמר). תמיד סוף יום. */
export function extendedTrialEnd(currentEnd: string | null, days: number, now: Date = new Date()): Date {
  const today = israelDate(now);
  const currentDate = currentEnd ? israelDate(new Date(currentEnd)) : null;
  const base = currentDate && currentDate > today ? currentDate : today;
  return israelEndOfDay(addDays(base, days));
}

/** כמה ימים נשארו בניסיון, לפי התאריך בישראל. 0 = היום האחרון; שלילי = נגמר. */
export function trialDaysLeft(trialEndsAt: string, now: Date = new Date()): number {
  return daysBetween(israelDate(now), israelDate(new Date(trialEndsAt)));
}

/** כמה ימים לפני הסוף יוצא המייל הראשון (90 - 85 = 5). */
export const PAY_EMAIL_DAYS_BEFORE_END = TEACHER_TRIAL_DAYS - TEACHER_PAY_EMAIL_DAY;

/**
 * באיזה שלב של הניסיון המורה:
 *   free     - עוד לא הגיע יום 85; לא מבקשים כלום
 *   closing  - מיום 85 ועד היום שלפני האחרון; ההרשמה לתשלום פתוחה
 *   last_day - היום האחרון
 *   ended    - הניסיון נגמר
 */
export type TrialPhase = "free" | "closing" | "last_day" | "ended";
export function trialPhase(trialEndsAt: string | null, now: Date = new Date()): TrialPhase | null {
  if (!trialEndsAt) return null;
  const left = trialDaysLeft(trialEndsAt, now);
  if (left < 0) return "ended";
  if (left === 0) return "last_day";
  if (left <= PAY_EMAIL_DAYS_BEFORE_END) return "closing";
  return "free";
}

// ── מה הקרון עושה היום ───────────────────────────────────────────────────────

export type TrialRow = {
  id: string;
  listing_state: string;
  trial_ends_at: string | null;
  trial_ending_notified_at: string | null;
  trial_last_day_notified_at: string | null;
  /** הוראת קבע פעילה - מי שכבר נרשם/ה לא מקבל/ת מיילים ולא עובר/ת לארכיון. */
  hasActiveSubscription: boolean;
};

export type TrialAction =
  /** יום 85: המייל להרשמה. */
  | { kind: "pay_email"; id: string }
  /** היום האחרון: המייל הנוסף. moveEndToToday = הקרון פספס את היום האחרון, ולכן
   *  הסוף נדחה להיום כדי שהמייל יגיד אמת והארכיון יבוא רק אחריו. */
  | { kind: "last_day_email"; id: string; moveEndToToday: boolean }
  /** למחרת: ארכיון. withoutLastDayEmail = המייל לא יצא שלושה ימים רצופים. */
  | { kind: "archive"; id: string; withoutLastDayEmail: boolean };

/** כמה ימים מנסים שוב לשלוח את מייל היום האחרון לפני שמעבירים לארכיון בלעדיו. */
const LAST_DAY_EMAIL_RETRY_DAYS = 2;

export function planTrialActions(rows: TrialRow[], now: Date = new Date()): TrialAction[] {
  const out: TrialAction[] = [];
  for (const r of rows) {
    if (r.listing_state !== "trial" || !r.trial_ends_at || r.hasActiveSubscription) continue;
    const left = trialDaysLeft(r.trial_ends_at, now);
    if (left > PAY_EMAIL_DAYS_BEFORE_END) continue;
    if (left >= 1) {
      if (!r.trial_ending_notified_at) out.push({ kind: "pay_email", id: r.id });
      continue;
    }
    if (left === 0) {
      if (!r.trial_last_day_notified_at) out.push({ kind: "last_day_email", id: r.id, moveEndToToday: false });
      continue;
    }
    // הניסיון נגמר
    if (r.trial_last_day_notified_at) out.push({ kind: "archive", id: r.id, withoutLastDayEmail: false });
    else if (-left <= LAST_DAY_EMAIL_RETRY_DAYS) out.push({ kind: "last_day_email", id: r.id, moveEndToToday: true });
    else out.push({ kind: "archive", id: r.id, withoutLastDayEmail: true });
  }
  return out;
}

// ── אימות הוראת הקבע מול Sumit ───────────────────────────────────────────────

function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

/** כמה ימים אחרי יום החיוב בודקים - Sumit מנסה שוב כמה פעמים לפני שהוא מבטל. */
const SUMIT_CHECK_DAYS_AFTER_CHARGE = 3;

/**
 * האם הגיע הזמן לאמת את הוראת הקבע של המורה מול Sumit.
 *
 * פעם אחת אחרי כל חיוב חודשי, ולא כל יום: כל בדיקה היא קריאת API מהמכסה
 * (כ-17 קריאות ביום כבר נצרכות על המטפלים), ומנוי של 60 ש"ח לא מצדיק
 * שלושים קריאות בחודש. חיוב שנכשל מתגלה תוך שלושה ימים מיום החיוב.
 */
export function sumitCheckDue(firstChargeOn: string | null, verifiedAt: string | null, now: Date = new Date()): boolean {
  const today = israelDate(now);
  if (!firstChargeOn) {
    return !verifiedAt || daysBetween(israelDate(new Date(verifiedAt)), today) >= 30;
  }
  let due: string | null = null;
  for (let k = 0; k < 600; k++) {
    const checkDay = addDays(addMonths(firstChargeOn, k), SUMIT_CHECK_DAYS_AFTER_CHARGE);
    if (checkDay > today) break;
    due = checkDay;
  }
  if (!due) return false;
  return !verifiedAt || israelDate(new Date(verifiedAt)) < due;
}
