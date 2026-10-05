// קידום מתנה למרכז ועצירת מנוי - ההגדרות המשותפות לשרת, לקרון ולמסך האדמין.
// נקי מתלויות שרת (גם client).
//
// שני מצבים שנוספו ב-5/10/2026, בבקשת הבעלים, כדי שלמרכז יהיה מה שכבר יש למטפל:
//
//   קידום מתנה   status='active' + gift_granted_at מלא. המרכז באוויר בדיוק כמו
//                מרכז משלם (התאמות, עמוד ציבורי, פורטל), בלי הוראת קבע ובלי
//                חיוב. gift_until = מתי המתנה נגמרת; ריק = בלי תאריך סיום.
//                בסוף התקופה הקרון היומי עוצר את המרכז (סיבה: gift_ended).
//
//   מנוי שנעצר   status='cancelled'. המרכז לא באוויר, וכל מה שהוזן נשמר:
//                הפרופילים, העמוד הציבורי, חשבון הפורטל והתמחור. cancel_reason
//                אומר למה. משם אפשר לתת קידום מתנה או לפתוח את ההצעה מחדש
//                לתשלום (חזרה לטיוטה).
//
// לא להתבלבל עם gift_months: אלה חודשי המתנה שבהצעה בתשלום - המרכז מזין כרטיס
// והחיוב הראשון נדחה. קידום מתנה הוא בלי כרטיס בכלל.

export type CenterGiftState = {
  status: string;
  gift_granted_at?: string | null;
  gift_until?: string | null;
};

export const CENTER_GIFT_MAX_MONTHS = 12;

/** מרכז פעיל בקידום מתנה: באוויר, בלי הוראת קבע ובלי חיוב. */
export function isCenterOnGift(c: CenterGiftState): boolean {
  return c.status === "active" && !!c.gift_granted_at;
}

/**
 * תאריך הסיום של מתנה בת N חודשים שמתחילה ב-from. היום בחודש נשמר, ואם אין
 * כזה בחודש היעד (31 באוגוסט + חודש) נעצרים ביום האחרון שלו במקום לגלוש
 * לחודש שאחריו.
 */
export function giftUntilFromMonths(months: number, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString();
}

/**
 * ימים שנותרו עד סוף המתנה, מעוגלים למעלה (מתנה שנגמרת מחר בבוקר = יום אחד).
 * null כשהמרכז לא בקידום מתנה או שלמתנה אין תאריך סיום. 0 או פחות = התקופה
 * עברה והקרון הבא יעצור את המרכז.
 */
export function giftDaysLeft(c: CenterGiftState, now: number = Date.now()): number | null {
  if (!isCenterOnGift(c) || !c.gift_until) return null;
  const end = new Date(c.gift_until).getTime();
  if (isNaN(end)) return null;
  return Math.ceil((end - now) / 86_400_000);
}

/** למה מנוי המרכז נעצר. נשמר ב-cancel_reason. */
export type CenterStopReason = "admin" | "sumit" | "gift_ended";

const STOP_REASON_LABELS: Record<CenterStopReason, string> = {
  admin: "נעצר מהאדמין",
  sumit: "הוראת הקבע בוטלה ב-Sumit",
  gift_ended: "תקופת המתנה הסתיימה",
};

/** תווית לסיבת העצירה; null למרכז שנעצר לפני שהסיבה נשמרה, או לערך לא מוכר. */
export function stopReasonLabel(reason: string | null | undefined): string | null {
  return reason && reason in STOP_REASON_LABELS ? STOP_REASON_LABELS[reason as CenterStopReason] : null;
}
