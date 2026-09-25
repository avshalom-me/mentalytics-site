// מתי מותר לסוכן לסגור פנייה בלי מענה בלי לשאול אותך.
//
// spam ו-system נסגרים כמו קודם. בכל שאר הקטגוריות - כלומר כשהמודל עצמו
// קבע שמדובר באדם - סגירה שקטה מותרת רק לסגירה מנומסת שלא מבקשת כלום.
// אחרת הפנייה נכנסת לתור גם אם המודל חשב שאין צורך, כי המחיר של פנייה
// שנעלמת גדול בהרבה מהמחיר של טיוטה מיותרת שנמחקת בלחיצה.
//
// קובץ נפרד ובלי תלות בשרת, כדי שהכללים ייבדקו ישירות (inbox-triage.test.ts).

import { stripQuoted } from "./email-quote";

const COURTESY_WORDS = /(תודה|thanks|thank you|מעולה|סבבה|קיבלתי|בסדר גמור|אוקיי)/i;
// בקשה שנעטפה בנימוס היא עדיין בקשה: "אבקש ש... תודה" נסגר
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

// ── אותה פנייה משתי כתובות ────────────────────────────────────────────────
//
// 22/9/26 מטפלת שלחה את אותה בקשת ביטול מכתובת הסטודיו ומהכתובת האישית,
// בהפרש של 90 שניות. הסוכן קישר הודעות רק לפי כתובת השולח, אז אחרי שענית
// על אחת השנייה נשארה בתור.
//
// הסכנה ההפוכה גדולה יותר: לאחד שני אנשים שונים. שני מטפלים שעונים "תודה
// רבה" לאותה התראה אוטומטית שלנו כותבים כמעט אותו טקסט, באותו נושא, באותו
// יום - וסגירה אוטומטית של אחד מהם היא לקוח שנעלם. לכן דמיון בנוסח לבד לא
// מספיק: צריך ראיה שמדובר באותו אדם, או טקסט ארוך וכמעט זהה.

export type InquiryLike = {
  id: string;
  from_email: string;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  sender_therapist_id?: string | null;
};

const SAME_INQUIRY_WINDOW_MS = 72 * 3_600_000;
// "טקסט ארוך" = לפחות 15 מילים בכל צד. תשובה קצרה ("תודה, קיבלתי") דומה
// לתשובה קצרה של כל אדם אחר, ולא מלמדת כלום על זהות.
const MIN_WORDS_FOR_TEXT_MATCH = 15;
const TEXT_MATCH_JACCARD = 0.75;

function normSubject(s: string | null): string {
  return (s ?? "")
    .replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function wordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}@.]+/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const w of a) if (b.has(w)) common++;
  return common / (a.size + b.size - common);
}

/**
 * אותה פנייה שהגיעה משתי כתובות שונות. text הוא מה שנכתב עכשיו בכל אחת
 * (בלי ציטוט): ציטוט של אותה התראה שלנו מופיע אצל כל מי שענה עליה.
 */
export function isSameInquiry(a: InquiryLike, b: InquiryLike): boolean {
  if (a.id === b.id) return false;
  const emailA = a.from_email.toLowerCase();
  const emailB = b.from_email.toLowerCase();
  // אותה כתובת כבר מטופלת במנגנון "הפונה כתב/ה שוב" (superseded).
  if (emailA === emailB) return false;
  const gap = Math.abs(new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
  if (!(gap <= SAME_INQUIRY_WINDOW_MS)) return false;

  const ta = stripQuoted(a.body_text ?? "");
  const tb = stripQuoted(b.body_text ?? "");
  // ראיה חזקה: אחת ההודעות מזכירה את הכתובת של השנייה ("על חשבון X").
  if (ta.toLowerCase().includes(emailB) || tb.toLowerCase().includes(emailA)) return true;

  const sameSubject = normSubject(a.subject) !== "" && normSubject(a.subject) === normSubject(b.subject);
  if (!sameSubject) return false;
  // ראיה חזקה: שתי הכתובות זוהו כאותה רשומת מטפל.
  if (a.sender_therapist_id && a.sender_therapist_id === b.sender_therapist_id) return true;

  const wa = wordSet(ta);
  const wb = wordSet(tb);
  if (wa.size < MIN_WORDS_FOR_TEXT_MATCH || wb.size < MIN_WORDS_FOR_TEXT_MATCH) return false;
  return jaccard(wa, wb) >= TEXT_MATCH_JACCARD;
}
