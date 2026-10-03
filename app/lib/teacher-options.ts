// אוצר המילים של ענף המורים המקצועיים ("מענה לימודי").
//
// מודול איזומורפי בכוונה (בלי server-only ובלי סודות): טפסי ההרשמה והעריכה,
// כרטיסי התוצאה בשאלון הילדים, מנוע ההתאמה למורים ועמוד האדמין קוראים
// את אותן רשימות, כך שערך שנוסף כאן מופיע בכל מקום בבת אחת.
//
// למה טבלה נפרדת ולא שורות בטבלת המטפלים: כל משטח ציבורי של האתר (המאגר,
// ה-sitemap, עמודי הערים, /en, מנוע ההתאמה של המבוגרים, דוחות האזור) קורא
// את therapists ישירות, ושורת מורה הייתה מודלפת לכולם. טבלה נפרדת סוגרת את
// זה מבנית: מורה מופיע רק במקום שקורא teachers במפורש - תוצאות שאלון
// הילדים ועמודי /learning.

export const TEACHER_SUBJECTS = [
  { key: "reading_writing", label: "קריאה וכתיבה", short: "קריאה" },
  { key: "math", label: "חשבון ומתמטיקה", short: "מתמטיקה" },
  { key: "english", label: "אנגלית", short: "אנגלית" },
  { key: "hebrew", label: "עברית ולשון", short: "עברית" },
  { key: "learning_strategies", label: "אסטרטגיות למידה והתארגנות", short: "אסטרטגיות למידה" },
] as const;
export type TeacherSubject = (typeof TEACHER_SUBJECTS)[number]["key"];
export const TEACHER_SUBJECT_KEYS = TEACHER_SUBJECTS.map((s) => s.key) as TeacherSubject[];

/** אותן קבוצות גיל לימודיות שמנוע הניקוד של שאלון הילדים מסתעף לפיהן (acadGg). */
export const TEACHER_GRADE_GROUPS = [
  { key: "ag", label: "כיתות א׳-ג׳" },
  { key: "dv", label: "כיתות ד׳-ו׳" },
  { key: "zh", label: "כיתות ז׳-ח׳" },
  { key: "tyb", label: "כיתות ט׳-י״ב" },
] as const;
export type TeacherGradeGroup = (typeof TEACHER_GRADE_GROUPS)[number]["key"];
export const TEACHER_GRADE_KEYS = TEACHER_GRADE_GROUPS.map((g) => g.key) as TeacherGradeGroup[];

/**
 * ההכשרה המוצהרת. אין רישוי ממלכתי להוראה מתקנת, ולכן זו הצהרה שהאדמין
 * מאמת מול התעודה שהועלתה. `remedialOk` = מספיקה לרישום כמורה להוראה
 * מתקנת (ולא רק לתגבור): תעודת מומחה/ית מתוכנית אקדמית, חינוך מיוחד,
 * או תואר שני בלקויות למידה. השאר נרשמים כמורים פרטיים לתגבור.
 */
export const TEACHER_QUALIFICATIONS = [
  { key: "remedial_cert", label: "תעודת מומחה/ית להוראה מתקנת (מותאמת) מתוכנית אקדמית", remedialOk: true },
  { key: "special_ed_degree", label: "תואר בחינוך מיוחד", remedialOk: true },
  { key: "ld_masters", label: "תואר שני בלקויות למידה", remedialOk: true },
  { key: "teaching_cert", label: "תעודת הוראה בתחום הדעת", remedialOk: false },
  { key: "subject_degree", label: "תואר אקדמי בתחום הדעת (ללא תעודת הוראה)", remedialOk: false },
  { key: "student", label: "סטודנט/ית להוראה או לתחום הדעת", remedialOk: false },
  { key: "other", label: "אחר", remedialOk: false },
] as const;
export type TeacherQualification = (typeof TEACHER_QUALIFICATIONS)[number]["key"];
export const TEACHER_QUALIFICATION_KEYS = TEACHER_QUALIFICATIONS.map((q) => q.key) as TeacherQualification[];

export function qualificationAllowsRemedial(key: string | null | undefined): boolean {
  return TEACHER_QUALIFICATIONS.some((q) => q.key === key && q.remedialOk);
}

/**
 * מחזור החיים של רישום מורה. "listing" ולא "status" בכוונה, כדי שלא
 * יתבלבל עם status של המטפלים (pending/approved/paying) שיש לו משמעות
 * אחרת בכל שאילתה באתר.
 *
 *   pending  - נרשם/ה, ממתין/ה לאימות ההכשרה באדמין
 *   trial    - אושר/ה; מופיע/ה בתוצאות; תקופת הניסיון רצה עד trial_ends_at
 *   paying   - הוראת קבע פעילה (או סימון ידני של האדמין); מופיע/ה
 *   archived - תקופת הניסיון נגמרה בלי הרשמה לתשלום; בארכיון, לא מופיע/ה.
 *              הפיך: הרשמה לתשלום מהקישור האישי מחזירה למאגר.
 *   rejected - לא אושר/ה
 *
 * הקפאה ידנית אינה מצב אלא תאריך (paused_until), כמו אצל המטפלים: היא
 * פגה מעצמה, והמצב שמתחתיה נשמר.
 */
export const TEACHER_LISTING_STATES = [
  { key: "pending", label: "ממתין/ה לאישור", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "trial", label: "בתקופת ניסיון", cls: "bg-blue-50 border-blue-200 text-blue-800" },
  { key: "paying", label: "משלם/ת", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { key: "archived", label: "בארכיון", cls: "bg-stone-100 border-stone-200 text-stone-600" },
  { key: "rejected", label: "נדחה/תה", cls: "bg-red-50 border-red-200 text-red-700" },
] as const;
export type TeacherListingState = (typeof TEACHER_LISTING_STATES)[number]["key"];

/** המצבים שבהם מורה מוצג/ת להורים. כל שאילתה ש"מי מוצג" תלוי בה קוראת מכאן. */
export const TEACHER_LISTED_STATES: readonly TeacherListingState[] = ["trial", "paying"];

/**
 * הוראת קבע פעילה ב-Sumit: יש מזהה, והיא לא בוטלה. מקום אחד לכלל הזה - הקרון,
 * האדמין, הפרופיל וההרשמה לתשלום שואלים כולם את אותה שאלה, ותשובה שונה באחד
 * מהם פירושה מורה משלם/ת שעובר/ת לארכיון, או חיוב כפול.
 */
export function hasActiveStandingOrder(t: { sumit_recurring_id?: unknown; sumit_cancelled_at?: unknown }): boolean {
  return !!t.sumit_recurring_id && !t.sumit_cancelled_at;
}

/** שפות ההוראה שאפשר לבחור - בטופס המורה ובחיפוש של ההורה. */
export const TEACHER_LANGUAGES = ["עברית", "אנגלית", "ערבית", "רוסית", "צרפתית", "ספרדית", "אמהרית"] as const;

// ── שלוש הרובריקות להתאמה מדויקת ────────────────────────────────────────────
//
// אושרו ע"י הבעלים ב-3/10/2026, לפני שהתחיל גיוס המורים: מה שמורה לא הצהיר/ה
// עליו, שום חיפוש לא יוכל למצוא אחר כך. שלושתן נאספות בטופס ומוצגות להורים.
// מנוע ההתאמה עדיין לא מדרג לפיהן - זו החלטה נפרדת של הבעלים.

/**
 * ניסיון ממוקד עם מאפייני למידה. הצהרה עצמית של המורה ולא הכשרה שאומתה מול
 * תעודה, ולכן היא מוצגת להורים כ"ניסיון מוצהר". ההגבלה לשלושה היא ההגנה מפני
 * סימון של הכול: מי שמסמן/ת הכול לא אומר/ת דבר.
 *
 * המפתחות שונים בכוונה ממפתחות התחומים (literacy ולא reading_writing), כדי
 * ששני המערכים לא יתבלבלו בשאילתה או בסינון.
 */
export const TEACHER_EXPERTISE = [
  { key: "literacy", label: "קשיי קריאה וכתיבה מתמשכים, כולל דיסלקסיה ודיסגרפיה", short: "קשיי קריאה וכתיבה" },
  { key: "language", label: "קשיי שפה שמשפיעים על קריאה, הבנה או הבעה", short: "קשיי שפה" },
  { key: "numeracy", label: "קשיים מתמשכים בחשבון, כולל דיסקלקוליה", short: "קשיי חשבון" },
  { key: "attention", label: "קשיי קשב וריכוז בזמן למידה", short: "קשב וריכוז" },
  { key: "executive", label: "קשיי התארגנות, תכנון וניהול משימות", short: "התארגנות ותכנון" },
  { key: "avoidance", label: "הימנעות, תסכול וחוסר ביטחון סביב למידה", short: "הימנעות ותסכול" },
] as const;
export type TeacherExpertise = (typeof TEACHER_EXPERTISE)[number]["key"];
export const TEACHER_EXPERTISE_KEYS = TEACHER_EXPERTISE.map((e) => e.key) as TeacherExpertise[];
export const TEACHER_EXPERTISE_MAX = 3;

/**
 * מוקדי ההוראה בתוך כל תחום. "קריאה וכתיבה" ו"מתמטיקה" רחבים מדי בשביל הורה
 * שמחפש רכישת קריאה לכיתה א׳ או חמש יחידות. המפתח נושא את קידומת התחום, כך
 * שמוקד נשאר שייך לתחום שלו גם כשהוא לבדו במערך.
 */
export const TEACHER_FOCUSES: Record<TeacherSubject, readonly { key: string; label: string }[]> = {
  reading_writing: [
    { key: "rw_acquisition", label: "רכישת קריאה" },
    { key: "rw_fluency", label: "שטף ודיוק בקריאה" },
    { key: "rw_comprehension", label: "הבנת הנקרא" },
    { key: "rw_spelling", label: "כתיב" },
    { key: "rw_writing", label: "הבעה בכתב" },
  ],
  math: [
    { key: "math_basics", label: "יסודות החשבון" },
    { key: "math_middle", label: "מתמטיקה בחטיבת הביניים" },
    { key: "math_3u", label: "תיכון, 3 יחידות" },
    { key: "math_4u", label: "תיכון, 4 יחידות" },
    { key: "math_5u", label: "תיכון, 5 יחידות" },
  ],
  english: [
    { key: "en_reading", label: "רכישת קריאה באנגלית" },
    { key: "en_vocab_grammar", label: "אוצר מילים ודקדוק" },
    { key: "en_3u", label: "תיכון, 3 יחידות" },
    { key: "en_4u", label: "תיכון, 4 יחידות" },
    { key: "en_5u", label: "תיכון, 5 יחידות" },
  ],
  hebrew: [
    { key: "he_comprehension", label: "הבנת הנקרא" },
    { key: "he_writing", label: "הבעה בכתב" },
    { key: "he_bagrut", label: "לשון לבגרות" },
  ],
  learning_strategies: [
    { key: "ls_organization", label: "התארגנות ושיעורי בית" },
    { key: "ls_exams", label: "הכנה למבחנים" },
    { key: "ls_texts", label: "קריאה וסיכום של טקסטים" },
  ],
};

/** איפה מתקיים השיעור. כאן מקור האמת לאונליין; העמודה online נגזרת ממנו. */
export const TEACHER_LESSON_SETTINGS = [
  { key: "student_home", label: "בבית התלמיד" },
  { key: "teacher_place", label: "אצל המורה" },
  { key: "online", label: "אונליין" },
] as const;
export type TeacherLessonSetting = (typeof TEACHER_LESSON_SETTINGS)[number]["key"];
export const TEACHER_LESSON_SETTING_KEYS = TEACHER_LESSON_SETTINGS.map((s) => s.key) as TeacherLessonSetting[];

export type TeacherExtras = { expertise: string[]; focuses: string[]; lesson_settings: string[] };

/** רק ערכים מוכרים, בלי כפילויות, ובסדר הרשימה שבקוד ולא בסדר הלחיצות. */
function knownStrings(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  const given = new Set(value.filter((v): v is string => typeof v === "string"));
  return allowed.filter((k) => given.has(k));
}

/** המוקדים שמותרים למי שמלמד/ת את התחומים האלה, בסדר התחומים. */
export function focusKeysFor(subjects: readonly string[]): string[] {
  return TEACHER_SUBJECT_KEYS.filter((s) => subjects.includes(s)).flatMap((s) => TEACHER_FOCUSES[s].map((f) => f.key));
}

/**
 * מנקה את שלוש הרובריקות לפני שמירה: רק מפתחות מוכרים, לכל היותר שלושה
 * מאפייני למידה, ומוקדים רק של תחומים שהמורה מלמד/ת (מוקד של תחום שהוסר
 * נושר איתו). מקום אחד, כדי שההרשמה והעריכה לא יסחפו זו מזו.
 */
export function sanitizeTeacherExtras(
  input: { expertise?: unknown; focuses?: unknown; lesson_settings?: unknown },
  subjects: readonly string[],
): TeacherExtras {
  return {
    expertise: knownStrings(input.expertise, TEACHER_EXPERTISE_KEYS).slice(0, TEACHER_EXPERTISE_MAX),
    focuses: knownStrings(input.focuses, focusKeysFor(subjects)),
    lesson_settings: knownStrings(input.lesson_settings, TEACHER_LESSON_SETTING_KEYS),
  };
}

/** שיעור פנים אל פנים - אצל המורה או בבית התלמיד. מחייב לפחות עיר אחת. */
export function teachesInPerson(settings: readonly string[]): boolean {
  return settings.includes("student_home") || settings.includes("teacher_place");
}

// ── המודל המסחרי ────────────────────────────────────────────────────────────
//
// החלטת הבעלים (2/10/2026): 90 ימי ניסיון מהאישור, בלי תשלום, בלי התחייבות
// ובלי כרטיס אשראי - ובלי שום בקשת תשלום בדרך. ביום ה-85 יוצא מייל להרשמה
// (60 ש"ח לחודש כולל מע"מ), ביום האחרון מייל נוסף, ולמחרת מי שלא נרשם/ה
// עובר/ת לארכיון ויוצא/ת מהמאגר. הלוגיקה עצמה ב-teacher-trial.ts.
//
// המחיר כאן הוא *ברוטו* - שונה מכל שאר המחירים בקוד, שהם לפני מע"מ. הסיבה:
// 60 כולל מע"מ אינו מספר שלם לפני מע"מ (50.85 במע"מ של 18%), וטבלאות המטפלים
// מחזיקות amount שלם. לכן ענף המורים לא כותב ל-payments/subscriptions, ו-Sumit
// מקבל את המחיר עם VATIncluded:true.
export const TEACHER_TRIAL_DAYS = 90;
/** היום בתוך הניסיון שבו יוצא המייל הראשון להרשמה. */
export const TEACHER_PAY_EMAIL_DAY = 85;
export const TEACHER_PRICE_GROSS = 60;

// ── מפתחות ההמלצה בשאלון הילדים ──────────────────────────────────────────
//
// המפתח הוא מה שמנוע הניקוד → המפענח (kids-recommendations) → כפתור החיפוש
// מעבירים הלאה. הוא נושא את התחום ואת סוג המורה, כדי שהחיפוש ידע לסנן
// בלי טבלת תרגום נוספת. הטקסט בעברית כי כך כל המפתחות בקוד הזה.
export const TEACHER_REFERRAL_KEYS = {
  remedialMath: "הוראה מתקנת - חשבון",
  remedialReading: "הוראה מתקנת - קריאה וכתיבה",
  remedialGeneric: "הוראה מתקנת",
  tutorMath: "מורה פרטי - מתמטיקה",
  tutorEnglish: "מורה פרטי - אנגלית",
} as const;

export type TeacherSearch = {
  subject: TeacherSubject | null;
  /** true = נדרש/ת מורה להוראה מתקנת; false = גם מורה פרטי/ת לתגבור מתאים/ה. */
  remedial: boolean;
  label: string;
};

/** מה החיפוש מבקש, לפי מפתח ההמלצה. מפתח לא מוכר = חיפוש כללי (כל המורים). */
export function teacherSearchFromKey(key: string): TeacherSearch {
  switch (key) {
    case TEACHER_REFERRAL_KEYS.remedialMath:
      return { subject: "math", remedial: true, label: "מורה להוראה מתקנת בחשבון" };
    case TEACHER_REFERRAL_KEYS.remedialReading:
      return { subject: "reading_writing", remedial: true, label: "מורה להוראה מתקנת בקריאה וכתיבה" };
    case TEACHER_REFERRAL_KEYS.remedialGeneric:
      return { subject: null, remedial: true, label: "מורה להוראה מתקנת" };
    case TEACHER_REFERRAL_KEYS.tutorMath:
      return { subject: "math", remedial: false, label: "מורה פרטי/ת למתמטיקה" };
    case TEACHER_REFERRAL_KEYS.tutorEnglish:
      return { subject: "english", remedial: false, label: "מורה פרטי/ת לאנגלית" };
    default:
      return { subject: null, remedial: false, label: "מורה מקצועי/ת" };
  }
}

/**
 * הכותרת של חיפוש שאינו נשען על מפתח המלצה: החיפוש הישיר בדלת "לימוד חכם",
 * שבו ההורה בוחר תחום וסוג מורה בעצמו.
 */
export function teacherSearchLabel(subject: TeacherSubject | null, remedial: boolean): string {
  const label = TEACHER_SUBJECTS.find((s) => s.key === subject)?.label;
  if (remedial) return label ? `מורה להוראה מתקנת ב${label}` : "מורה להוראה מתקנת";
  return label ? `מורה פרטי/ת ל${label}` : "מורה";
}

export function isRemedialTeacherKey(key: string): boolean {
  return teacherSearchFromKey(key).remedial;
}

export function subjectLabel(key: string): string {
  return TEACHER_SUBJECTS.find((s) => s.key === key)?.label ?? key;
}
export function gradeGroupLabel(key: string): string {
  return TEACHER_GRADE_GROUPS.find((g) => g.key === key)?.label ?? key;
}
export function qualificationLabel(key: string | null | undefined): string {
  return TEACHER_QUALIFICATIONS.find((q) => q.key === key)?.label ?? (key || "");
}
export function listingStateLabel(key: string): string {
  return TEACHER_LISTING_STATES.find((s) => s.key === key)?.label ?? key;
}
export function expertiseLabel(key: string, short = false): string {
  const e = TEACHER_EXPERTISE.find((x) => x.key === key);
  return e ? (short ? e.short : e.label) : key;
}
export function lessonSettingLabel(key: string): string {
  return TEACHER_LESSON_SETTINGS.find((s) => s.key === key)?.label ?? key;
}

/**
 * המוקדים של מורה, מקובצים לפי תחום ובסדר התחומים; תחום בלי מוקדים לא חוזר.
 * כך מוצג "קריאה וכתיבה: רכישת קריאה, כתיב" ולא רשימה שטוחה, שבה "הבנת הנקרא"
 * של עברית ושל קריאה נראים אותו דבר.
 */
export function focusesBySubject(
  subjects: readonly string[],
  focuses: readonly string[],
): { subject: TeacherSubject; label: string; focuses: string[] }[] {
  return TEACHER_SUBJECTS.filter((s) => subjects.includes(s.key))
    .map((s) => ({
      subject: s.key,
      label: s.label,
      focuses: TEACHER_FOCUSES[s.key].filter((f) => focuses.includes(f.key)).map((f) => f.label),
    }))
    .filter((g) => g.focuses.length > 0);
}

/**
 * "איפה מתקיים השיעור" במילים. שורה בלי הרובריקה (lesson_settings ריק) נופלת
 * חזרה למה שהיה ידוע קודם - ערים ואונליין - כדי שלא תוצג כמי שאינו/ה מלמד/ת
 * בשום מקום.
 */
export function lessonSettingsText(t: {
  lesson_settings?: readonly string[] | null;
  online?: boolean | null;
  regions?: readonly string[] | null;
}): string {
  const settings = TEACHER_LESSON_SETTING_KEYS.filter((k) => (t.lesson_settings ?? []).includes(k));
  if (settings.length > 0) return settings.map(lessonSettingLabel).join(", ");
  const legacy = [(t.regions ?? []).length > 0 ? "פנים אל פנים" : "", t.online ? "אונליין" : ""].filter(Boolean);
  return legacy.join(", ");
}

/**
 * הקישור האישי של מורה, כפי שהוא נשלח במייל ומועתק מהאדמין. הכתובת הזו
 * לא מציגה עמוד: היא שמה עוגייה ומפנה לפרופיל (או להרשמה לתשלום).
 * ראו app/learning/k/[token]/route.ts.
 */
export function teacherLinkUrl(token: string, to?: "pay"): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
  return `${site}/learning/k/${encodeURIComponent(token)}${to ? `?to=${to}` : ""}`;
}

/** עמוד הפרופיל של מורה. תחת /learning, מחוץ לכל ניווט של האתר ובלי אינדוקס. */
export function teacherPath(slug: string): string {
  return `/learning/t/${encodeURIComponent(slug)}`;
}
