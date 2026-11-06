// עמודי התחום והעיר של מאגר המורים ("לימוד חכם"), מתוכנית השדרוג (6/11/2026,
// שלבים 3 ו-4): /learning/teachers/subject/<תחום> ו-/learning/teachers/city/<עיר>.
//
// עמוד כזה קיים רק כשיש מאחוריו היצע: עמוד תחום מחמישה מורים מוצגים בתחום,
// עמוד עיר משלושה מורים שמלמדים בעיר (או מורה אחד/ת בעיר וחמישה בעיר ובערים
// הצמודות לה). מתחת לסף הכתובת מפנה למאגר עם הסינון המתאים, כך שאף פעם אין
// עמוד דל באינדקס, וכשהמורה החמישי/ת מאושר/ת העמוד נפתח לבד: הוא נכנס ל-sitemap
// ומופיע ברשימת העמודים במאגר. אותה פונקציה (learningLandings) מחליטה בשלושת
// המקומות, כדי שלא יהיה עמוד ב-sitemap שמפנה הלאה.
//
// הנוסח לפי הכללים בראש app/learning/page.tsx: בלי פרקי זמן קליניים, השאלון
// "מציע כיוון", ומה שנבדק אצל המורים נאמר כמו שהוא.

import { TEACHER_SUBJECTS, type TeacherSubject } from "./teacher-options";
import { CITY_TO_REGION, neighborsOf, regionToSlug } from "./regions";

export const LEARNING_SUBJECT_MIN_TEACHERS = 5;
export const LEARNING_CITY_MIN_TEACHERS = 3;
/** עיר עם מורה אחד/ת לפחות נפתחת גם כשבה ובערים הצמודות לה יש חמישה. */
export const LEARNING_CITY_MIN_WITH_NEIGHBORS = 5;

export type SubjectLanding = {
  subject: TeacherSubject;
  slug: string;
  h1: string;
  /** השורה הקטנה מתחת לכותרת. */
  sub: string;
  title: string;
  description: string;
  intro: string[];
  /** מספר המדריך להורים שמתאים לתחום, אם יש. */
  article?: number;
};

export const SUBJECT_LANDINGS: SubjectLanding[] = [
  {
    subject: "reading_writing",
    slug: "קריאה-וכתיבה",
    h1: "מורים לקריאה וכתיבה",
    sub: "הוראה מתקנת ושיעורים פרטיים, לפי כיתה ואזור",
    title: "מורה לקריאה וכתיבה: הוראה מתקנת ושיעורים פרטיים",
    description: "מורים להוראה מתקנת ומורים פרטיים לקריאה, כתיבה, הבנת הנקרא וכתיב, לפי כיתה ואזור וגם אונליין. אצל מורים להוראה מתקנת התעודה נבדקה.",
    intro: [
      "קושי בקריאה נראה אחרת בכל גיל. בכיתות הנמוכות מדובר לרוב ברכישת הקריאה ובשטף, ובהמשך בהבנת הנקרא, בכתיב ובכתיבה. כל מורה כאן מסמן/ת מה בדיוק הוא/היא מלמד/ת בתוך התחום, ואפשר לסנן לפי כיתה ואזור.",
      "כשהקושי חוזר על עצמו גם אחרי תרגול רגיל, מורה להוראה מתקנת עובד/ת על הדרך שבה הילד לומד. כשחסר חומר, מורה פרטי מספיק לרוב.",
    ],
    article: 3,
  },
  {
    subject: "math",
    slug: "חשבון-ומתמטיקה",
    h1: "מורים לחשבון ומתמטיקה",
    sub: "הוראה מתקנת ושיעורים פרטיים, לפי כיתה ואזור",
    title: "מורה לחשבון ולמתמטיקה: הוראה מתקנת ושיעורים פרטיים",
    description: "מורים להוראה מתקנת בחשבון ומורים פרטיים למתמטיקה, מיסודות החשבון ועד הכנה לבגרות, לפי כיתה ואזור וגם אונליין.",
    intro: [
      "בחשבון הפער נבנה בשכבות: מי שלא ביסס את מושג המספר, את הכפל או את השברים מתקשה בכל מה שנשען עליהם. כל מורה כאן מסמן/ת מה הוא/היא מלמד/ת, מיסודות החשבון ועד הכנה למבחנים ולבגרות.",
      "כשהילד מבין בשיעור ושוכח, או טועה באותו מקום שוב ושוב, כדאי לחפש מורה להוראה מתקנת. כשחסר תרגול לקראת מבחן, מורה פרטי מתאים יותר.",
    ],
    article: 6,
  },
  {
    subject: "english",
    slug: "אנגלית",
    h1: "מורים לאנגלית",
    sub: "שיעורים פרטיים והוראה מתקנת, לפי כיתה ואזור",
    title: "מורה לאנגלית לילדים ולנוער: שיעורים פרטיים והוראה מתקנת",
    description: "מורים פרטיים לאנגלית ומורים להוראה מתקנת באנגלית: קריאה, אוצר מילים, דקדוק והכנה לבגרות, לפי כיתה ואזור וגם אונליין.",
    intro: [
      "באנגלית מורים כאן מלמדים קריאה, אוצר מילים, דקדוק והבעה, ומכינים למבחנים ולבגרות. אפשר לסנן לפי כיתה, אזור ושיעורים אונליין.",
      "ילד שמתקשה בקריאה בעברית עשוי להתקשות גם באנגלית. במקרה כזה כדאי לסמן בין הקשיים את \"קושי מתמשך בקריאה או בכתיבה\", כדי לראות קודם מורים שציינו ניסיון כזה.",
    ],
  },
  {
    subject: "hebrew",
    slug: "עברית-ולשון",
    h1: "מורים לעברית ולשון",
    sub: "הבנת הנקרא, הבעה בכתב ולשון, לפי כיתה ואזור",
    title: "מורה לעברית ולשון: הבנת הנקרא, הבעה ובגרות",
    description: "מורים פרטיים ומורים להוראה מתקנת לעברית: הבנת הנקרא, הבעה בכתב, לשון ודקדוק והכנה לבגרות, לפי כיתה ואזור וגם אונליין.",
    intro: [
      "בעברית מורים כאן עובדים על הבנת הנקרא, על הבעה בכתב ועל לשון ודקדוק, ומכינים לבגרות. אפשר לסנן לפי כיתה, אזור ושיעורים אונליין.",
      "בכיתות הנמוכות הקושי הוא לרוב בקריאה עצמה, ואז עמוד מורים לקריאה וכתיבה מתאים יותר.",
    ],
    article: 3,
  },
  {
    subject: "learning_strategies",
    slug: "אסטרטגיות-למידה",
    h1: "מורים לאסטרטגיות למידה והתארגנות",
    sub: "למידה למבחנים, ארגון זמן וחומר, טקסטים ארוכים",
    title: "מורה לאסטרטגיות למידה והתארגנות לילדים ולנוער",
    description: "מורים לאסטרטגיות למידה: ארגון זמן וחומר, למידה למבחנים וקריאת טקסטים ארוכים, לפי כיתה ואזור וגם אונליין.",
    intro: [
      "אסטרטגיות למידה הן איך לומדים: לתכנן זמן, לארגן חומר, ללמוד למבחן ולקרוא טקסט ארוך. מורים כאן מלמדים אותן לבד או לצד תחום דעת.",
      "כשהקשב הוא חלק מהקושי, ההתארגנות היא רק חלק מהתמונה. השאלון לילדים ולנוער מציע כיוון: הוראה מתקנת, מורה פרטי, אבחון או טיפול.",
    ],
    article: 1,
  },
];

export const subjectLandingBySlug = (slug: string): SubjectLanding | null => {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  return SUBJECT_LANDINGS.find((l) => l.slug === decoded) ?? null;
};
export const subjectLandingPath = (l: Pick<SubjectLanding, "slug">) => `/learning/teachers/subject/${l.slug}`;
export const cityLandingPath = (city: string) => `/learning/teachers/city/${regionToSlug(city)}`;
export const subjectLandingLabel = (s: TeacherSubject) => TEACHER_SUBJECTS.find((x) => x.key === s)?.label ?? s;

/** מה שהחישוב צריך מכל מורה מוצג/ת. */
export type LandingRow = { subjects: string[]; regions: string[] | null; remedial: boolean };

export type OpenSubject = { landing: SubjectLanding; count: number };
export type OpenCity = { city: string; inCity: number; nearby: number };

export function subjectLandingOpen(rows: LandingRow[], subject: TeacherSubject): { open: boolean; count: number } {
  const count = rows.filter((t) => t.subjects.includes(subject)).length;
  return { open: count >= LEARNING_SUBJECT_MIN_TEACHERS, count };
}

export function cityLandingOpen(rows: LandingRow[], city: string): { open: boolean; inCity: number; nearby: number } {
  const area = new Set([city, ...neighborsOf(city)]);
  const inCity = rows.filter((t) => (t.regions ?? []).includes(city)).length;
  const nearby = rows.filter((t) => (t.regions ?? []).some((c) => area.has(c))).length;
  return { open: inCity >= LEARNING_CITY_MIN_TEACHERS || (inCity >= 1 && nearby >= LEARNING_CITY_MIN_WITH_NEIGHBORS), inCity, nearby };
}

/** העמודים הפתוחים כרגע. rows = המורים המוצגים בלבד. */
export function learningLandings(rows: LandingRow[]): { subjects: OpenSubject[]; cities: OpenCity[] } {
  const subjects = SUBJECT_LANDINGS.map((landing) => ({ landing, ...subjectLandingOpen(rows, landing.subject) }))
    .filter((s) => s.open)
    .map(({ landing, count }) => ({ landing, count }));
  const cityNames = [...new Set(rows.flatMap((t) => t.regions ?? []))].filter((c) => c in CITY_TO_REGION);
  const cities = cityNames
    .map((city) => ({ city, ...cityLandingOpen(rows, city) }))
    .filter((c) => c.open)
    .map(({ city, inCity, nearby }) => ({ city, inCity, nearby }))
    .sort((a, b) => b.inCity - a.inCity || a.city.localeCompare(b.city, "he"));
  return { subjects, cities };
}

/** השורות שהחישוב צריך, מתוך המורים שהמאגר כבר טען. */
export const landingRowsOf = (ts: { subjects: string[] | null; regions: string[] | null; remedial: boolean | null }[]): LandingRow[] =>
  ts.map((t) => ({ subjects: t.subjects ?? [], regions: t.regions ?? [], remedial: !!t.remedial }));
