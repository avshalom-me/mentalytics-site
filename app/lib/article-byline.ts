// מי כתב מאמר קהילה, ומה מציגים ממנו בכרטיס קצר. מודול טהור.
//
// author_name נוסף ב-10/7/26 לחתימת מערכת ("צוות טיפול חכם") על מאמר שמשויך
// לפרופיל של מטפל/ת רק לשם שלמות הנתונים: מאמר כזה לא נחשב של המטפל/ת. אבל
// בפועל השדה מולא ברוב המאמרים בשם המטפל/ת עצמו/ה - 23 מתוך 30 המאושרים
// ב-30/9/26 - והפרופיל קרא כל author_name כחתימת מערכת. כך המאמרים האלה
// נעלמו מ"מאמרים מאת" של מי שכתב/ה אותם.
//
// הכלל: חתימה היא "בית" רק כשהיא שם של מישהו אחר מהמטפל/ת המשויך/ת. השם של
// המטפל/ת, גם בנוסח אחר - בלי תואר, או בלי תיאור העסק שאחרי השם ("קרול יונס
// פנחס" מול "קרול יונס פנחס- פסיכותרפיה בחריש") - הוא עדיין המאמר שלו/ה.

// תארים שנכתבים לפני השם, אחרי הסרת גרשיים ומירכאות.
const TITLES = new Set(["דר", "פרופ", "פרופסור", "Dr", "Prof"]);

function nameTokens(s: string): string[] {
  return s
    .replace(/["'`׳״]/g, "")
    .replace(/[-–—,.|/()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !TITLES.has(w));
}

/** true כשהחתימה היא של מישהו אחר מהמטפל/ת המשויך/ת (מאמר מערכת). חתימה ריקה = של המטפל/ת. */
export function isHouseByline(authorName: string | null | undefined, therapistName: string | null | undefined): boolean {
  const author = nameTokens(authorName ?? "");
  if (author.length === 0) return false;
  const therapist = nameTokens(therapistName ?? "");
  if (therapist.length === 0) return true;
  const a = ` ${author.join(" ")} `;
  const t = ` ${therapist.join(" ")} `;
  return !(t.includes(a) || a.includes(t));
}

// סוף משפט: מה שכבר מסתיים באחד מאלה לא מקבל נקודה נוספת.
const ENDS_SENTENCE = /[.!?:;…"״”'׳)]$/;

function plainLine(line: string): string {
  return line
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [טקסט](כתובת) → טקסט
    .replace(/^\s*[-•]\s+/, "") // סימן רשימה
    .replace(/-{3,}/g, " ") // קו מפריד של טבלה
    .replace(/[#*_>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * השורה שמתחת לכותרת בכרטיס מאמר: התקציר, ואם אין - פתיחת המאמר עצמו, בלי
 * סימני העיצוב (כותרות, הדגשות, קישורים, טבלאות) וחתוכה בגבול מילה.
 *
 * פסקאות מחוברות במשפטים: מאמר שנפתח בשורת כותרת בלי נקודה ("להבין את
 * המעגל...") היה נקרא ברצף אחד עם הפסקה שאחריה.
 */
export function articleTeaser(summary: string | null | undefined, body: string | null | undefined, max = 200): string {
  const own = (summary ?? "").trim();
  const source = own || (body ?? "");
  const paragraphs = source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map(plainLine).filter(Boolean).join(" "))
    .filter(Boolean);
  const clean = paragraphs
    .map((p, i) => (i < paragraphs.length - 1 && !ENDS_SENTENCE.test(p) ? `${p}.` : p))
    .join(" ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).trimEnd() + "…";
}
