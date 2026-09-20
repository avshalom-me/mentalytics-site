// מתי מותר לסוכן לסגור פנייה בלי מענה בלי לשאול אותך.
//
// spam ו-system נסגרים כמו קודם. בכל שאר הקטגוריות - כלומר כשהמודל עצמו
// קבע שמדובר באדם - סגירה שקטה מותרת רק לסגירה מנומסת שלא מבקשת כלום.
// אחרת הפנייה נכנסת לתור גם אם המודל חשב שאין צורך, כי המחיר של פנייה
// שנעלמת גדול בהרבה מהמחיר של טיוטה מיותרת שנמחקת בלחיצה.
//
// קובץ נפרד ובלי תלות בשרת, כדי שהכללים ייבדקו ישירות (inbox-triage.test.ts).

const COURTESY_WORDS = /(תודה|thanks|thank you|מעולה|סבבה|קיבלתי|בסדר גמור|אוקיי)/i;
// בקשה שנעטפה בנימוס היא עדיין בקשה: "אבקש ליצור עמי קשר ... תודה" נסגר
// בטעות כ"תודה" עד שהבדיקה תפסה את זה.
const REQUEST_WORDS =
  /(אבקש|מבקש|מבקשת|בקשה|אפשר|תוכל|תוכלו|נא |צריך|צריכה|רוצה|מעוניין|מעוניינת|מתי|איך|כמה|למה|לתאם|לקבוע|לעדכן|לבטל|לבדוק|תבדק|תחזר|תתקשר|תשלח|שלחו|please|can you|could you|when|how much)/i;
const MAX_COURTESY_LEN = 80;

/** "תודה רבה" בסוף שרשור: אין מה לענות. לעומת "תודה, אפשר מחר?" - יש. */
export function isCourtesyClosing(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length === 0 || t.length > MAX_COURTESY_LEN) return false;
  if (t.includes("?")) return false; // שאלה מחכה לתשובה
  if (/\d/.test(t)) return false; // טלפון או מספר = בקשה, לא סגירה
  if (REQUEST_WORDS.test(t)) return false;
  return COURTESY_WORDS.test(t);
}

/** text הוא מה שנכתב עכשיו (בלי הציטוט), לא גוף המייל המלא. */
export function mayAutoIgnore(category: string, text: string): boolean {
  return category === "spam" || category === "system" || isCourtesyClosing(text);
}
