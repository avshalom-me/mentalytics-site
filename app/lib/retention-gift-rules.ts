// "הארכה במתנה - שימור": הכללים, בלי שרת ובלי Sumit, כדי שאפשר לבדוק אותם
// ושהאדמין והשרת יחליטו לפי אותו קוד בדיוק.
//
// המתנה = דחיית תאריך החיוב הבא של הוראת הקבע הקיימת בכמה חודשים. הקידום
// ממשיך כרגיל, הכרטיס לא מחויב בתקופה, ובסופה Sumit ממשיכה לחייב מעצמה.

export const RETENTION_GIFT_DEFAULT_MONTHS = 2;
export const RETENTION_GIFT_MONTH_OPTIONS = [1, 2, 3] as const;
/** כמה ימים לפני חזרת החיוב יוצא מייל התזכורת. חייב להתאים לנוסח שני המיילים. */
export const RETENTION_GIFT_REMINDER_DAYS = 7;

/** היום לפי שעון ישראל, YYYY-MM-DD - אותו לוח שנה ש-Sumit מחייב לפיו. */
export function israelDay(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/**
 * מוסיף חודשים לתאריך YYYY-MM-DD, על לוח השנה ולא על שעון: 31 בינואר + חודש
 * = 28 (או 29) בפברואר, לא 3 במרץ. חיוב שנדחה חייב לנחות באותו יום בחודש
 * שהלקוח מכיר, או ביום האחרון של החודש כשאין יום כזה.
 */
export function addMonthsToDay(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/**
 * רגע בזמן שמייצג יום קלנדרי בישראל, לשמירה בעמודת timestamptz.
 *
 * 10:00 UTC הוא צהרי היום בישראל גם בשעון קיץ (+3) וגם בשעון חורף (+2), ולכן
 * אותו תאריך נקרא חזרה בכל אחד מהם. קיבוע של "+03:00" נראה תמים באוקטובר
 * ושובר בדצמבר: חצות +03:00 היא 23:00 של היום הקודם בשעון חורף, והאדמין
 * הציג "חיוב הבא: 14.12" למתנה שמסתיימת ב-15.12 (נתפס בבדיקה, 13/10/2026).
 */
export function israelDayToIso(day: string): string {
  return `${day.slice(0, 10)}T10:00:00.000Z`;
}

/** מספר הימים מ-a עד b (שניהם YYYY-MM-DD). שלילי כש-b לפני a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function monthsLabel(months: number): string {
  if (months === 1) return "חודש";
  if (months === 2) return "חודשיים";
  return `${months} חודשים`;
}

/** המתנה עדיין בתוקף: החיוב טרם חזר. */
export function retentionGiftActive(until: string | null | undefined, today: string = israelDay()): boolean {
  return !!until && String(until).slice(0, 10) > today;
}

export type RetentionGiftFacts = {
  therapist: { status: string | null; promotion_source: string | null } | null;
  subscription: {
    status: string | null;
    morning_token_id: string | null;
    retention_gift_until: string | null;
  } | null;
  /** מצב ההוראה הרשומה ב-Sumit, או null כשלא נמצאה שם. */
  order: { status: number; nextBilling: string | null } | null;
  /** כמה הוראות של הלקוח עוד יכולות לחייב (כולל הרשומה). */
  liveOrderCount: number;
  months: number;
  today: string;
};

/**
 * הסיבה שאי אפשר לתת את המתנה, או null כשאפשר.
 *
 * כל סעיף כאן הוא מצב שבו דחיית החיוב הייתה יוצרת מצב לא ברור: מטפל שלא
 * משלם בעצמו, הוראה שאינה במצב תקין, או שתי הוראות שרק אחת מהן הייתה נדחית
 * (והשנייה ממשיכה לחייב בזמן שהלקוח קיבל מייל "חודשיים בלי חיוב").
 */
export function retentionGiftBlocker(f: RetentionGiftFacts): string | null {
  if (!(RETENTION_GIFT_MONTH_OPTIONS as readonly number[]).includes(f.months)) {
    return "מספר החודשים אינו תקין.";
  }
  if (!f.therapist) return "המטפל/ת לא נמצא/ה.";
  if (f.therapist.status !== "paying" || f.therapist.promotion_source !== "paid") {
    return "המתנה הזו מיועדת רק למטפל/ת שמשלם/ת בעצמו/ה בהוראת קבע פעילה. מי שמקודם/ת במתנה, בניסיון או דרך מרכז אינו/ה מחויב/ת, ואין מה לדחות.";
  }
  if (!f.subscription || f.subscription.status !== "active") {
    return "לא נמצא מנוי פעיל במערכת.";
  }
  if (!/^\d+$/.test(f.subscription.morning_token_id ?? "")) {
    return "למנוי אין מזהה הוראת קבע ב-Sumit, ולכן אי אפשר לדחות את החיוב.";
  }
  if (retentionGiftActive(f.subscription.retention_gift_until, f.today)) {
    return `כבר ניתנה מתנת שימור שבתוקף עד ${String(f.subscription.retention_gift_until).slice(0, 10)}. אפשר לתת מתנה נוספת אחרי שהחיוב יחזור.`;
  }
  if (!f.order) return "הוראת הקבע הרשומה לא נמצאה ב-Sumit.";
  if (f.order.status !== 0) {
    // 12 = טרם חויבה לראשונה (חלון מתנה של מסלול ההזמנה); 3/11/14 = חיוב
    // שנכשל ונמצא בניסיון חוזר. באף אחד מהם "דחיית החיוב הבא" אינה פעולה
    // מוגדרת היטב, ולכן לא נוגעים.
    return `הוראת הקבע ב-Sumit אינה במצב פעיל רגיל (סטטוס ${f.order.status}). יש לברר את מצבה לפני שנותנים מתנה.`;
  }
  if (f.liveOrderCount > 1) {
    return "ללקוח יש יותר מהוראת קבע חיה אחת ב-Sumit. יש לסגור קודם את הכפילות, אחרת ההוראה השנייה תמשיך לחייב בתקופת המתנה.";
  }
  if (!f.order.nextBilling) return "ל-Sumit אין תאריך חיוב הבא להוראה הזו.";
  if (f.order.nextBilling <= f.today) {
    // ביום החיוב עצמו לא ברור אם הריצה של Sumit כבר עברה. מחר התאריך כבר
    // יהיה החודש הבא, והדחייה תהיה חד-משמעית.
    return "החיוב הבא מתוזמן להיום. כדי לא להתנגש בריצת החיוב של Sumit, יש לתת את המתנה מחר.";
  }
  return null;
}
