// "הקשיים שברקע" - מה שההורה מציין בחיפוש מורה, ומה ששאלון הילדים כבר יודע.
//
// המפתחות הם מפתחות TEACHER_EXPERTISE בכוונה: מה שמורה מצהיר/ה עליו בטופס
// ומה שהורה מבקש הם אותה רשימה, ולכן ההתאמה היא השוואת מפתחות ולא טבלת
// תרגום. הניסוח כאן הוא של ההורה ("קשב וריכוז"), ושם של המורה.
//
// מודול איזומורפי וטהור: הדלת הציבורית, מסך החיפוש בשאלון וה-API קוראים אותו.

import { TEACHER_EXPERTISE_KEYS, type TeacherExpertise, type TeacherSubject } from "@/app/lib/teacher-options";

export type TeacherNeed = TeacherExpertise;

export const TEACHER_NEEDS: readonly { key: TeacherNeed; label: string; short: string }[] = [
  { key: "literacy", label: "קושי מתמשך בקריאה או בכתיבה, כולל דיסלקסיה ודיסגרפיה", short: "קריאה וכתיבה" },
  { key: "language", label: "קושי שפתי: שפה, אוצר מילים או הבעה", short: "קושי שפתי" },
  { key: "numeracy", label: "קושי מתמשך בחשבון, כולל דיסקלקוליה", short: "חשבון" },
  { key: "attention", label: "קשב וריכוז", short: "קשב וריכוז" },
  { key: "executive", label: "התארגנות, תכנון וניהול משימות", short: "התארגנות" },
  { key: "avoidance", label: "הימנעות, תסכול או חוסר ביטחון סביב למידה", short: "הימנעות ותסכול" },
];

export function needLabel(key: string, short = false): string {
  const n = TEACHER_NEEDS.find((x) => x.key === key);
  return n ? (short ? n.short : n.label) : key;
}

/** רק מפתחות מוכרים, בלי כפילויות, בסדר הרשימה. כל קלט מבחוץ עובר כאן. */
export function sanitizeNeeds(value: unknown): TeacherNeed[] {
  if (!Array.isArray(value)) return [];
  const given = new Set(value.filter((v): v is string => typeof v === "string"));
  return TEACHER_EXPERTISE_KEYS.filter((k) => given.has(k));
}

/** כשנכתב "לקות למידה" בלי פירוט: הקושי שסביר שמדובר בו, לפי התחום שמחפשים. */
export function defaultNeedForSubject(subject: TeacherSubject | null): TeacherNeed {
  return subject === "math" ? "numeracy" : "literacy";
}

// ── מה ששאלון הילדים כבר יודע ───────────────────────────────────────────────
//
// הבעלים (3/10/2026): בלי אף שאלה נוספת בשאלון, אבל אם השאלון כבר זיהה משהו
// (לקות, קשב, רקע שפתי) - המורה עם הניסיון המתאים מופיע/ה ראשון/ה. לכן
// הקשיים נגזרים כאן ממה שכבר קיים: שורות הדוח שהשרת החזיר, ושלוש תשובות
// רקע שהדוח אינו מצטט.
//
// בכוונה לא בתוך kids-score.server.ts: הקובץ ההוא נכנס לחותמת גרסת השאלון
// (next.config.ts), ושינוי בו היה מפצל את הנתונים המחקריים לגרסה חדשה בלי
// שהשאלון עצמו השתנה. הבדיקה teacher-needs.test.ts מריצה את מנוע הניקוד
// האמיתי, כך שניסוח שישתנה שם יפיל אותה ולא ייעלם בשקט.
//
// חרדה ומצב רוח כלליים אינם כאן: הם עניין לטיפול, לא לבחירת מורה.

type ReportBox = { txt?: string | null };
type KidsReport = Partial<Record<"emotional" | "academic", ReportBox[] | null>> | null | undefined;

/** סימני הרקע השפתי בשאלון הקריאה (התפתחות שפה, חריזה וצליל פותח, אוצר מילים, דיבור). */
const LANGUAGE_HISTORY: Record<"ag" | "dv", readonly string[]> = {
  ag: ["ag_h1", "ag_h4", "ag_h5", "ag_h6"],
  dv: ["dv_h1", "dv_h4", "dv_h5"],
};
/** "האם עבר אבחון/טיפול קלינאית תקשורת?" */
const SPEECH_THERAPY: Record<"ag" | "dv", string> = { ag: "ag_read_speech", dv: "dv_read_speech" };

/** המפתחות שנקראים ישירות מהתשובות - לבדיקת הסחיפה מול מסך השאלון. */
export const KIDS_ANSWER_KEYS_READ: readonly string[] = [
  ...LANGUAGE_HISTORY.ag,
  ...LANGUAGE_HISTORY.dv,
  SPEECH_THERAPY.ag,
  SPEECH_THERAPY.dv,
  "zh_math",
  "tyb_math",
];

export function needsFromKidsReport(
  answers: Record<string, unknown> | null | undefined,
  report: KidsReport,
  gradeGroup: string | null | undefined,
): TeacherNeed[] {
  const A = answers ?? {};
  const text = (boxes: ReportBox[] | null | undefined) => (boxes ?? []).map((b) => b.txt ?? "").join("\n");
  const academic = text(report?.academic);
  // שאלון הקשב של כיתות ב-ו מופיע תחת החלק הרגשי (Q9), ולכן קוראים גם אותו.
  const both = `${academic}\n${text(report?.emotional)}`;
  const out = new Set<TeacherNeed>();

  if (/סימנים לקשיי ריכוז וקשב|היפראקטיביות\/אימפולסיביות/.test(both)) out.add("attention");
  if (/פונקציות הניהוליות/.test(both)) out.add("executive");

  // בלי ממצא לימודי בדוח אין מה לגזור: תשובות ישנות של חלק שההורה ביטל
  // נשארות באובייקט התשובות, והדוח הוא מה שקובע מה נמצא בפועל.
  if (!academic) return sanitizeNeeds([...out]);

  const reading = /סימנים לקשיי קריאה/.test(academic);
  if (reading || /סימנים לקשיים ברבי מלל|סימנים לקשיי כתב יד/.test(academic)) out.add("literacy");
  if (/קשיים רגשיים מול למידה/.test(academic)) out.add("avoidance");
  // חשבון: רק כשהקושי אינו קל (המדרגות 5% ו-10%), או כשהוא חלק משילוב קשיים.
  if (/נמצאו קשיים משמעותיים בחשבון|נמצאו קשיים בחשבון|בירור קשיי החשבון/.test(academic)) out.add("numeracy");
  if ((gradeGroup === "zh" || gradeGroup === "tyb") && /סימנים לקשיים במתמטיקה/.test(academic) && A[`${gradeGroup}_math`] === "10%") {
    out.add("numeracy");
  }
  if (reading && (gradeGroup === "ag" || gradeGroup === "dv")) {
    const history = LANGUAGE_HISTORY[gradeGroup].some((k) => A[k] === "כן");
    if (history || A[SPEECH_THERAPY[gradeGroup]] === "כן") out.add("language");
  }
  return sanitizeNeeds([...out]);
}
