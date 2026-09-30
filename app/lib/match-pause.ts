// ההקפאה השקטה מתוצאות השאלון (therapists.match_paused_until): מי מותר
// להקפיא, ומתי אסור. מודול טהור - עמוד האדמין מחליט לפיו אילו כפתורים
// להציג והשרת אוכף לפיו, כך שהשניים לא יכולים להיפרד.
//
// מה ההקפאה עושה (/api/match): המטפל/ת לא מופיע/ה בתוצאות השאלון עד
// התאריך. במאגר, בעמודי העיר ובפרופיל - כרגיל. שום דגל ציבורי לא משתנה,
// לא נשלחת שום הודעה, והיא פגה מעצמה.
//
// מי מותר: מקודמי מתנה (trial/manual) מאז 10/8/26, ומשלמים פרטיים (paid)
// מאז 30/9/26 בהחלטת הבעלים. למשלם/ת תנאי אחד: לא בתוך חלון ערבות הפניות
// כשעוד לא הגיעה אליו/ה אף פנייה (guaranteePauseBlock) - שם ההקפאה עלולה
// להפוך לזכאות להחזר מלא.
//
// מי בחוץ, ולמה:
// - center: המרכז משלם על החשיפה של המטפלים שלו, והמספרים שלהם מוצגים
//   למרכז ובדף השיחה - שם ההקפאה הייתה נראית כחולשה של המרכז.
// - gift_trial: מסלול ההזמנה לפני החיוב הראשון. בחודשים האלה המטפל/ת
//   מחליט/ה אם להישאר, והקפאה הייתה מכריעה את ההחלטה במקומו/ה.
// - מי שאינו/ה מקודם/ת: ממילא לא בתוצאות השאלון.
//
// שחרור (days=0) מותר תמיד, לכל אחד/ת, כדי שהקפאה לא תיתקע אם המסלול
// השתנה בזמן שהיא פעילה.

export const PAUSABLE_PROMOTION_SOURCES = ["trial", "manual", "paid"] as const;

type PauseSubject = { status: string | null; promotion_source: string | null };

export function canPauseFromMatching(t: PauseSubject): boolean {
  return (
    t.status === "paying" &&
    (PAUSABLE_PROMOTION_SOURCES as readonly string[]).includes(t.promotion_source ?? "")
  );
}

/** למה אי אפשר להקפיא לפי המסלול, או null כשמותר. בלי בדיקת הערבות - היא דורשת את המסד. */
export function pauseSourceBlock(t: PauseSubject): string | null {
  if (canPauseFromMatching(t)) return null;
  if (t.status === "paying" && t.promotion_source === "center") {
    return "מטפלי מרכז לא מוקפאים מכאן: המרכז משלם על החשיפה שלהם, והירידה הייתה נראית בנתוני המרכז ובדף השיחה.";
  }
  if (t.status === "paying" && t.promotion_source === "gift_trial") {
    return "מסלול ההזמנה לפני החיוב הראשון לא מוקפא: אלה בדיוק החודשים שבהם המטפל/ת מחליט/ה אם להישאר.";
  }
  return "המטפל/ת לא מקודם/ת כרגע, ולכן ממילא לא מופיע/ה בתוצאות השאלון.";
}

/** מצב חלון ערבות הפניות של משלם/ת פרטי/ת (guarantee.ts → guaranteeStateFor). */
export type GuaranteeState = {
  open: boolean;
  windowEnd: string;
  /** פניות בתוך החלון. null כשהחלון כבר נסגר ולא נספרו. */
  contacts: number | null;
};

function ilDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

/**
 * מה סוכן השירות (inbox-agent) מקבל כשהפונה מוקפא/ת כרגע.
 *
 * העובדה עצמה לא נכנסת לפרומפט בכלל - מה שהמודל לא יודע הוא לא יכול לכתוב
 * בטיוטה. המודל מקבל רק הוראה ניטרלית שלא חושפת דבר: לא לטעון כלום על
 * הופעה בשאלון ולהשאיר חור גלוי במקום הסבר. את ההקפאה עצמה רואה רק
 * האדמין, בהערה שליד הטיוטה. null כשאין הקפאה פעילה.
 */
export function inboxPauseContext(
  pausedUntil: string | null | undefined,
  now: Date = new Date(),
): { promptLine: string; adminNote: string } | null {
  if (!pausedUntil || new Date(pausedUntil).getTime() <= now.getTime()) return null;
  return {
    promptLine:
      "אל תכתוב בטיוטה שום טענה על הופעה או אי-הופעה בתוצאות השאלון, ואל תסביר שינוי במספר הפניות. " +
      "אם הפונה שואל/ת על כך - כתוב במקום ההסבר [להשלים: תשובה על החשיפה].",
    adminNote: `❄️ מוקפא/ת מההתאמות עד ${ilDate(pausedUntil)} בהחלטה שלנו, והמטפל/ת לא יודע/ת. לא לציין הקפאה בתשובה.`,
  };
}

/**
 * הערבות: החזר מלא אם לא הגיעה אף פנייה תוך GUARANTEE_DAYS מתחילת המנוי.
 * פנייה אחת מספיקה כדי שהערבות תתמלא, ואחרי סוף החלון היא לא רלוונטית -
 * כך שהסיכון היחיד הוא חלון פתוח בלי אף פנייה. בדיוק שם הקפאה הייתה
 * מדכאת את מה שנמכר ויוצרת את עילת ההחזר.
 */
export function guaranteePauseBlock(g: GuaranteeState | null): string | null {
  if (!g || !g.open || (g.contacts ?? 0) > 0) return null;
  const until = ilDate(g.windowEnd);
  return (
    `אי אפשר להקפיא כרגע: המטפל/ת בתוך חלון ערבות הפניות (עד ${until}) ועוד לא הגיעה אליו/ה אף פנייה. ` +
    `הקפאה עכשיו עלולה לזכות בהחזר מלא. אפשר להקפיא אחרי הפנייה הראשונה, או אחרי ${until}.`
  );
}
