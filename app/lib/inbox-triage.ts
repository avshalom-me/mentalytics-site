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

// ── מייל של מכונה: נסגר בלי לשאול את המודל ────────────────────────────────
//
// התראות חיוב של ספק הסליקה, דוחות DMARC, הודעות no-reply וחשבוניות של ספקים
// נקלטות מהתיבה כמו כל מייל. עד 6/10/2026 מי שסגר אותן היה מודל השפה: הוא סיווג
// אותן כ"מערכת", והן לא הגיעו לתור. כשהמודל לא עונה (ב-5/10/2026 נגמרה היתרה
// אצל הספק) אף אחד לא מסווג, וכל התראת חיוב נשארת בתור ככרטיס פתוח "בלי
// טיוטה", בין הפניות של אנשים.
//
// לכן מה שברור שהוא מכונה נסגר כאן, לפי השולח והנושא, בלי מודל. הכללים נגזרו
// מכל מה שסווג כמערכת או כספאם בתיבה עד היום, והם צרים בכוונה: מייל של אדם
// שנסגר בטעות הוא לקוח שנעלם, ומייל של מכונה שנשאר בתור הוא רק כרטיס מיותר.
// מה שלא מתאים לאף כלל ממשיך למודל כמו קודם.

export type MailLike = {
  from_email: string;
  subject: string | null;
  /** כותרת שמעידה על שליחה אוטומטית (Auto-Submitted / Precedence), אם נקראה מהמייל. */
  auto_header?: string | null;
};

// "no-reply" כחלק שלם מהכתובת: noreply, no-reply, ads-account-noreply,
// noreply-dmarc-support. לא "reply" סתם, ולא שם שבמקרה מכיל את הרצף.
const NO_REPLY_LOCAL = /(^|[._+-])(no-?reply|do-?not-?reply|donotreply)([._+-]|$)/i;
const MACHINE_LOCAL = /^(mailer-daemon|postmaster|dmarc[a-z0-9._-]*|bounces?([._+-].*)?)$/i;
const DMARC_SUBJECT = /^\s*(\[preview\]\s*)?report domain:/i;
// תשובה או העברה של אדם: גם אם השולח נראה כמו מכונה, ההחלטה נשארת למודל.
const REPLY_PREFIX = /^\s*(re|fw|fwd|השב|תשובה|הועבר)\s*:/i;
// ספק הסליקה: הודעות על חיוב, זיכוי ומסמך שהופק. הכתובת c+<מספר> היא הערוץ
// שבו המערכת שלו שולחת מסמכים בשם עסק.
const SUMIT_DOCUMENT_SENDER = /^c\+\d+$/;
const SUMIT_NOTICE_SUBJECT =
  /^\s*(בוצע חיוב עבור|עדכון על (חיוב|זיכוי) שבוצע|קיבלת (חשבונית|קבלה|מסמך)|תזכורת מ|חשבונית מ-SUMIT|לידיעה,)/;
// הודעת מערכת על חשבונית או קבלה, מכל ספק: נוסח בגוף שני סביל שאדם לא פותח בו נושא.
const INVOICE_NOTICE_SUBJECT = /^\s*(נשלח(ה)? אליך|קיבלת) (חשבון|חשבונית|קבלה)/;

/**
 * למה המייל הזה הוא בוודאות של מכונה, או null אם לא ברור (ואז המודל מחליט).
 * הטקסט שחוזר מוצג לאדמין ליד הפנייה שנסגרה.
 */
export function automatedMailReason(mail: MailLike): string | null {
  const auto = (mail.auto_header ?? "").trim();
  if (auto) return `מייל אוטומטי (${auto})`;

  // תווי כיוון בלתי נראים בתחילת הנושא (Gmail בממשק עברי) לא מסתירים "Re:".
  const subject = (mail.subject ?? "").replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
  if (REPLY_PREFIX.test(subject)) return null;

  const email = mail.from_email.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (DMARC_SUBJECT.test(subject)) return "דוח DMARC";
  if (NO_REPLY_LOCAL.test(local)) return "כתובת no-reply";
  if (MACHINE_LOCAL.test(local)) return "כתובת של מערכת דואר";
  if (domain === "sumit.co.il" && (SUMIT_DOCUMENT_SENDER.test(local) || SUMIT_NOTICE_SUBJECT.test(subject))) {
    return "הודעה אוטומטית של Sumit";
  }
  if (INVOICE_NOTICE_SUBJECT.test(subject)) return "הודעה אוטומטית על חשבונית";
  return null;
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
