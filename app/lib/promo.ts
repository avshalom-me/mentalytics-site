// Promoted-plan pricing + the early-bird promotion.
//
// This module is intentionally free of secrets / server-only code so it can be
// imported from client components, API routes, and cron jobs alike - one source
// of truth for the prices and the promo window.
//
// Early-bird promo: therapists who subscribe on or before the signup deadline
// (end of day, Israel time) pay SUBSCRIPTION_PROMO_PRICE for the first
// SUBSCRIPTION_PROMO_MONTHS billing cycles. After that the standing order
// reverts automatically to SUBSCRIPTION_REGULAR_PRICE - handled server-side by
// the daily Sumit sync cron, which calls /billing/recurring/update.
//
// The opening window originally ran through 2026-07-01; it was extended by one
// more week, to 2026-07-09 (end of day Israel). Once the deadline passes,
// isPromoActive() flips to false and the whole site + billing revert to the
// regular price for new subscribers automatically - no further code change.

const VAT_RATE = 0.18;

export const SUBSCRIPTION_REGULAR_PRICE = 140;
export const SUBSCRIPTION_PROMO_PRICE = 90;
export const SUBSCRIPTION_PROMO_MONTHS = 3;

export const SUBSCRIPTION_REGULAR_TOTAL = +(SUBSCRIPTION_REGULAR_PRICE * (1 + VAT_RATE)).toFixed(2); // 165.20
export const SUBSCRIPTION_PROMO_TOTAL = +(SUBSCRIPTION_PROMO_PRICE * (1 + VAT_RATE)).toFixed(2); // 106.20

// 2026-07-09 23:59:59 Israel (UTC+3 in July) → 20:59:59Z.
// (One-week extension of the original 2026-07-01 opening window.)
export const PROMO_SIGNUP_DEADLINE_ISO = "2026-07-09T20:59:59.999Z";

export function isPromoActive(at: Date = new Date()): boolean {
  return at.getTime() <= Date.parse(PROMO_SIGNUP_DEADLINE_ISO);
}

// When a promo subscription should revert to the regular price: a few days
// before the 4th monthly charge (i.e. after 3 charges at the promo price),
// giving the daily cron a safe window to apply the update before Sumit bills.
export function promoRevertDate(signupAt: Date = new Date()): Date {
  const d = new Date(signupAt);
  d.setMonth(d.getMonth() + SUBSCRIPTION_PROMO_MONTHS);
  d.setDate(d.getDate() - 3);
  return d;
}

// ── מבצע שדרוג מסיום תקופת מתנה ──────────────────────────────────────────
// הצעה *אישית* (לא חלון גלובלי כמו ה-early-bird): מטפל שתקופת המתנה שלו
// מסתיימת מקבל מייל עם סיכום התקופה והצעה לשדרג במחיר מוזל לחודשיים
// הראשונים, ואז המחיר הרגיל. הזכאות נשמרת על שורת המטפל
// (therapists.upgrade_offer_until) ונבדקת ב-checkout, כדי שההצעה לא תדלוף
// למי שלא קיבל אותה - ולא תישאר פתוחה לנצח.
export const TRIAL_UPGRADE_PRICE = 60;
export const TRIAL_UPGRADE_MONTHS = 2;
export const TRIAL_UPGRADE_TOTAL = +(TRIAL_UPGRADE_PRICE * (1 + VAT_RATE)).toFixed(2); // 70.80
// כמה ימים ההצעה תקפה מרגע שליחת המייל (3 לפני הסיום + חלון חסד אחרי).
export const TRIAL_UPGRADE_OFFER_DAYS = 10;

/**
 * כמה שאלונים אפשר למלא בחינם מאותו דפדפן, לפני התשלום.
 *
 * יושב כאן ולא ב-usage.ts כי usage.ts הוא `server-only`, והמספר הזה מופיע גם
 * בטקסט שהמשתמש קורא (מסך התשלום ושאלות ותשובות בדף הבית). כשהוא היה מוגדר
 * בשני מקומות, העלאת המכסה מ-5 ל-8 השאירה את המסכים מבטיחים 5 - בדיוק סוג
 * הפער שמייצר פנייה של "כתוב אחד וקורה אחר".
 *
 * 5 → 8 (2/9/2026): המונה אינו מתאפס לעולם, ולכן "חמש פעמים" הוא חמש פעמים
 * בכל חייו של הדפדפן. הורה שבודק שני ילדים, או מי שחוזר אחרי חודש, מיצה אותן
 * בלי לחשוב שהוא צורך מכסה.
 */
export const MAX_FREE_QUIZZES = 8;

/** ההצעה האישית פעילה עבור המטפל/ת הזה/ו כרגע? */
export function trialUpgradeActive(upgradeOfferUntil: string | null | undefined, at: Date = new Date()): boolean {
  if (!upgradeOfferUntil) return false;
  return at.getTime() <= Date.parse(upgradeOfferUntil);
}

/** מתי הוראת הקבע חוזרת למחיר המלא - כמה ימים לפני החיוב ה-3. */
export function trialUpgradeRevertDate(signupAt: Date = new Date()): Date {
  const d = new Date(signupAt);
  d.setMonth(d.getMonth() + TRIAL_UPGRADE_MONTHS);
  d.setDate(d.getDate() - 3);
  return d;
}
