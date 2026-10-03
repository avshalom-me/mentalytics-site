// חילוץ בחירות החיפוש מטקסט חופשי של הורה - בכללים מקומיים, בדפדפן.
//
// הרעיון של הבעלים (3/10/2026): הורה שנכנס ישירות לעמוד המורים כותב במילים
// שלו איזה מורה הוא מחפש, איפה, ומה יש ברקע. הפאנל (GPT, Gemini, Kimi) הסכים
// שהטקסט לא יהיה מקור האמת: הוא רק ממלא את הבחירות הקצרות, וההורה רואה מה
// זוהה ומתקן לפני החיפוש.
//
// שלושה כללים שלא לשנות בלי החלטה:
//   1. הטקסט לא יוצא מהדפדפן. הוא לא נשלח לשרת, לא נשמר ולא עובר למודל שפה
//      (אותו כלל כמו ב-explain-recommendation). הורים כותבים שם של ילד.
//   2. אין ניחוש שקט: מה שלא זוהה נשאר ריק, ומה שזוהה מוצג לאישור.
//   3. המודול טהור ובלי תלות בדפדפן, כדי שאפשר יהיה לבדוק אותו.

import { CITY_TO_REGION } from "@/app/lib/regions";
import {
  TEACHER_LANGUAGES,
  subjectLabel,
  gradeGroupLabel,
  type TeacherGradeGroup,
  type TeacherSubject,
} from "@/app/lib/teacher-options";
import { defaultNeedForSubject, needLabel, sanitizeNeeds, type TeacherNeed } from "@/app/lib/teacher-needs";

export type ParsedTeacherQuery = {
  subject: TeacherSubject | null;
  /** true = הוראה מתקנת, false = מורה פרטי/ת, null = לא נאמר. */
  remedial: boolean | null;
  gradeGroup: TeacherGradeGroup | null;
  city: string | null;
  region: string | null;
  online: boolean;
  needs: TeacherNeed[];
  /** שפת הוראה שאינה עברית, אם נכתבה. */
  language: string | null;
};

const HEB = "א-ת";

/** מרכאות וגרשיים מכל הסוגים הופכים ל-" אחד, והניקוד יורד. */
function unify(text: string): string {
  return text
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[\u05F4\u201C\u201D\u201E]/g, "\u0022")
    .replace(/[\u05F3\u2018\u2019\u0060\u00B4]/g, "\u0027")
    .replace(/[\u05BE\u2010-\u2015]/g, "-")
    .replace(/קריית/g, "קרית")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** בלי מרכאות וגרשים בכלל: "כיתה ג׳" ו-"י״ב" נקראים כמו "כיתה ג" ו-"יב". */
function strip(text: string): string {
  return text.replace(/[\u0022\u0027]/g, "");
}

/**
 * האם הביטוי מופיע בלי שלילה לפניו. "אין לו בעיות קשב" אינו קושי קשב; בלי
 * הבדיקה הזו כל הורה שמרגיע ("בלי קשיי קריאה") היה מקבל את ההפך.
 */
function mentioned(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 22), m.index);
    if (!/(?:^|\s)(?:אין|בלי|ללא|לא)(?:\s+\S+){0,2}\s*$/.test(before)) return true;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return false;
}

function firstIndex(text: string, pattern: RegExp): number {
  const m = pattern.exec(text);
  return m ? m.index : -1;
}

// ── תחום ────────────────────────────────────────────────────────────────────

const SUBJECT_PATTERNS: readonly [TeacherSubject, RegExp][] = [
  ["math", /מתמטיקה|מתימטיקה|חשבון|אלגברה|גיאומטריה|גאומטריה|שברים/],
  ["english", /אנגלית|אינגליש|english/],
  ["reading_writing", /קריאה|לקרוא|כתיבה|לכתוב|שגיאות כתיב|הבנת הנקרא/],
  ["hebrew", /לשון|מורה לעברית|שיעורי עברית|עברית לבגרות/],
  ["learning_strategies", /אסטרטגיות למידה|מיומנויות למידה|כישורי למידה|שיעורי בית|הכנה למבחנים/],
];

function findSubject(text: string): TeacherSubject | null {
  const found = SUBJECT_PATTERNS.map(([key, re]) => ({ key, at: firstIndex(text, re) })).filter((s) => s.at >= 0);
  if (found.length === 0) return null;
  // "קריאה באנגלית" היא בקשה למורה לאנגלית, גם כשהקריאה נזכרה קודם.
  if (found.some((s) => s.key === "english")) return "english";
  return found.sort((a, b) => a.at - b.at)[0].key;
}

// ── שכבת גיל ────────────────────────────────────────────────────────────────

const GRADE_LETTERS: Record<string, TeacherGradeGroup> = {
  א: "ag", ב: "ag", ג: "ag", ד: "dv", ה: "dv", ו: "dv", ז: "zh", ח: "zh", ט: "tyb", י: "tyb", יא: "tyb", יב: "tyb",
};
const AGE_WORDS: Record<string, number> = { שש: 6, שבע: 7, שמונה: 8, תשע: 9, עשר: 10 };

function groupOfGradeNumber(n: number): TeacherGradeGroup | null {
  if (n >= 1 && n <= 3) return "ag";
  if (n >= 4 && n <= 6) return "dv";
  if (n === 7 || n === 8) return "zh";
  if (n >= 9 && n <= 12) return "tyb";
  return null;
}

function findGradeGroup(plain: string): TeacherGradeGroup | null {
  const letter = new RegExp(`כי?ת(?:ות|[הת])\\s*(יב|יא|[א-י])(?![${HEB}])`).exec(plain);
  if (letter) return GRADE_LETTERS[letter[1]] ?? null;
  const digit = /כי?ת(?:ות|[הת])\s*(\d{1,2})/.exec(plain);
  if (digit) return groupOfGradeNumber(Number(digit[1]));
  if (/תיכון|בגרות|יחידות|חטיבה עליונה|יחל(?![א-ת])/.test(plain)) return "tyb";
  if (/חטיבת ביניים|חטיבה/.test(plain)) return "zh";
  // גיל: הערכה בלבד (כיתה א בגיל 6-7), וההורה רואה את התוצאה ומתקן.
  const age = /(?:^|\s)(?:בן|בת|בגיל|גיל)\s+(\d{1,2}|שש|שבע|שמונה|תשע|עשר)(?![\dא-ת])/.exec(plain);
  if (age) {
    const years = AGE_WORDS[age[1]] ?? Number(age[1]);
    if (years >= 6 && years <= 8) return "ag";
    if (years >= 9 && years <= 11) return "dv";
    if (years === 12 || years === 13) return "zh";
    if (years >= 14 && years <= 18) return "tyb";
  }
  return null;
}

// ── מקום ────────────────────────────────────────────────────────────────────

/** קיצורים וכתיבים נפוצים. נבדקים על הטקסט שעוד יש בו מרכאות. */
const CITY_ALIASES: readonly [RegExp, string][] = [
  [/ת"א|תל-אביב/, "תל אביב"],
  [/פ"ת|פתח תקוה|פתח-תקווה/, "פתח תקווה"],
  [/ראשל"צ/, "ראשון לציון"],
  [/ב"ש|באר-שבע/, "באר שבע"],
  [/כפ"ס|כפר-סבא/, "כפר סבא"],
  [/רמה"ש/, "רמת השרון"],
  [/הוד"ש/, "הוד השרון"],
  [/פרדס חנה|כרכור/, "פרדס חנה-כרכור"],
  [/צורן/, "קדימה-צורן"],
  [/מעלות/, "מעלות-תרשיחא"],
  [/זכרון יעקב/, "זיכרון יעקב"],
  [/קרית טבעון|טבעון/, "קריית טבעון"],
];

/** שמות יישובים שהם גם שמות פרטיים: נחשבים רק עם אות מקום לפניהם ("באריאל"). */
const NAME_LIKE_CITIES = new Set(["אריאל", "בנימין", "אלעד", "שלומי", "שוהם"]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

const CITIES_LONGEST_FIRST = Object.keys(CITY_TO_REGION).sort((a, b) => b.length - a.length);

function findCity(quoted: string): string | null {
  for (const [re, city] of CITY_ALIASES) {
    if (re.test(quoted) && CITY_TO_REGION[city]) return city;
  }
  const plain = strip(quoted);
  for (const city of CITIES_LONGEST_FIRST) {
    const name = escapeRe(city.replace(/קריית/g, "קרית"));
    const prefix = NAME_LIKE_CITIES.has(city) ? "[במ]" : "[בלמ]?";
    if (new RegExp(`(?:^|[^${HEB}])${prefix}${name}(?![${HEB}])`).test(plain)) return city;
  }
  return null;
}

/** אזור שנכתב בשמו, כשלא נכתבה עיר. "השרון" לבדו אינו מכריע בין צפון לדרום, ולכן אינו כאן. */
const REGION_PATTERNS: readonly [RegExp, string][] = [
  [/דרום השרון/, "דרום השרון"],
  [/צפון השרון/, "צפון השרון"],
  [/גוש דן/, "גוש דן"],
  [/קריות/, "חיפה והקריות"],
  [/עמק יזרעאל/, "עמק יזרעאל ונצרת"],
  [/שפלה/, "השפלה והמרכז"],
  [/נגב/, "נגב ואילת"],
  [/שומרון/, "יהודה ושומרון"],
  [/גליל/, "גליל וצפון"],
];

function findRegion(plain: string): string | null {
  for (const [re, region] of REGION_PATTERNS) if (re.test(plain)) return region;
  return null;
}

// ── הקשיים שברקע ────────────────────────────────────────────────────────────

const NEED_PATTERNS: readonly [TeacherNeed, RegExp][] = [
  ["literacy", /דיסלקציה|דיסלקסיה|דיסלקטי|דיסגרפיה|קשיי קריאה|קושי בקריאה|מתקש\S* בקריאה|מתקש\S* לקרוא|קשיי כתיבה|קושי בכתיבה|שגיאות כתיב|לקות קריאה/],
  ["language", /שפתי|קושי בשפה|קשיי שפה|לקות שפה|קלינאית תקשורת|קלינאות תקשורת|אוצר מילים/],
  ["numeracy", /דיסקלקוליה|דיסקלקולי|לקות חשבון|קשיי חשבון|קושי בחשבון/],
  ["attention", /קשב|ריכוז|(?:^|[^a-z])adhd(?![a-z])|(?:^|[^a-z])add(?![a-z])|היפראקטיב|ריטלין|קונצרטה/],
  ["executive", /התארגנות|ארגון הזמן|ניהול זמן|תכנון|פונקציות ניהוליות|דחיינות/],
  ["avoidance", /תסכול|מתוסכל|הימנעות|נמנע|חוסר ביטחון|חסר\S* ביטחון|ביטחון עצמי|חרדת בחינות|חרדת מבחנים|מסרב\S* ללמוד|שונא\S* ללמוד/],
];

const GENERIC_LD = /לקות למידה|לקויות למידה|לקוי\S* למידה/;

// ── הכול יחד ────────────────────────────────────────────────────────────────

export function parseTeacherQuery(text: string): ParsedTeacherQuery {
  const quoted = unify(text ?? "");
  const plain = strip(quoted);
  const empty: ParsedTeacherQuery = { subject: null, remedial: null, gradeGroup: null, city: null, region: null, online: false, needs: [], language: null };
  if (!plain) return empty;

  const needs = new Set<TeacherNeed>();
  for (const [key, re] of NEED_PATTERNS) if (mentioned(plain, re)) needs.add(key);

  let subject = findSubject(plain);
  // "לקות למידה" בלי פירוט: הקושי הסביר לפי התחום, כדי שמורה עם הכשרה
  // מתאימה יעלה ראשון. ההורה רואה את התגית ויכול להסיר אותה.
  if (needs.size === 0 && mentioned(plain, GENERIC_LD)) needs.add(defaultNeedForSubject(subject));
  // אבחנה בלי תחום מרמזת על התחום: דיסלקסיה - קריאה וכתיבה, דיסקלקוליה - חשבון.
  if (!subject) {
    if (needs.has("numeracy")) subject = "math";
    else if (needs.has("literacy")) subject = "reading_writing";
  }

  const remedial = /הוראה מתקנת|הוראה מותאמת|מורה מתקנת|מתקנת/.test(plain)
    ? true
    : /מורה פרטי|מורים פרטיים|שיעור פרטי|שיעורים פרטיים|תגבור/.test(plain)
      ? false
      : null;

  const city = findCity(quoted);
  const region = city ? (CITY_TO_REGION[city] ?? null) : findRegion(plain);
  const online = mentioned(plain, /אונליין|און ליין|און-ליין|online|זום|zoom|מרחוק/);
  const language =
    TEACHER_LANGUAGES.filter((l) => l !== "עברית" && l !== "אנגלית").find((l) => new RegExp(`(?:ב|דובר\\S* )${l}`).test(plain)) ?? null;

  return { subject, remedial, gradeGroup: findGradeGroup(plain), city, region, online, needs: sanitizeNeeds([...needs]), language };
}

/** מה זוהה, במילים - התגיות שההורה רואה מעל הטופס. ריק = לא זוהה דבר. */
export function describeParsedQuery(p: ParsedTeacherQuery): string[] {
  const out: string[] = [];
  if (p.remedial === true) out.push("הוראה מתקנת");
  if (p.remedial === false) out.push("מורה פרטי/ת");
  if (p.subject) out.push(subjectLabel(p.subject));
  if (p.gradeGroup) out.push(gradeGroupLabel(p.gradeGroup));
  if (p.city) out.push(p.city);
  else if (p.region) out.push(p.region);
  if (p.online) out.push("אונליין");
  for (const n of p.needs) out.push(needLabel(n, true));
  if (p.language) out.push(`שיעורים ב${p.language}`);
  return out;
}
