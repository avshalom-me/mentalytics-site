// מנוע ההתאמה למורים - טהור, בלי מסד ובלי רשת, כדי שאפשר יהיה לבדוק אותו.
//
// הרבה יותר פשוט ממנוע המטפלים (11 משקולות, אישיות, גישות): כאן ההתאמה
// המקצועית היא תחום + סוג מורה + שכבת גיל (שלושתם סינון קשה, ולכן מי
// שמופיע/ה מתאים/ה מקצועית במלואו/ה), והמיקום מסודר באותה סכימה
// שההורים כבר מכירים מכרטיסי המטפלים - קודם "באזור שבחרתם", אחר כך
// אזורים סמוכים ואונליין. בתוך קבוצה: מי שמתאים/ה לקשיים שצוינו (needs),
// אחר כך ציון מקצועי, משלמים לפני ניסיון, וסבב יומי כדי שאף מורה לא
// יתקע תמיד אחרון/ה.
//
// הסדר הזה הוא הבטחה לבעלים (3/10/2026): המרחק קודם לכול. ההתאמה לקושי
// משנה את הסדר רק בין מורים מאותה קבוצת אזור, ואף מורה לא נושר/ת בגללה.

import { CITY_TO_REGION, REGION_NEIGHBORS } from "@/app/lib/regions";
import { TEACHER_SUBJECT_KEYS, teacherSearchFromKey, type TeacherGradeGroup, type TeacherSubject } from "@/app/lib/teacher-options";

export type TeacherRow = {
  id: string;
  full_name: string;
  gender: string | null;
  slug: string | null;
  subjects: string[];
  remedial: boolean;
  grade_groups: string[];
  regions: string[];
  online: boolean;
  languages: string[];
  listing_state: string;
  paused_until: string | null;
  bio: string | null;
  phone: string | null;
  price_text: string | null;
  qualification: string | null;
  photo_path: string | null;
  experience_years: number | null;
  /**
   * שלוש הרובריקות מ-3/10/2026 (ראו teacher-options). מוצגות בכרטיס ובפרופיל.
   * expertise משתתף בדירוג כשהחיפוש נושא needs; focuses ו-lesson_settings
   * מוצגים בלבד.
   */
  expertise: string[];
  focuses: string[];
  lesson_settings: string[];
};

export type TeacherMatchInput = {
  subject: TeacherSubject | null;
  remedial: boolean;
  gradeGroup: TeacherGradeGroup | null;
  city: string | null;
  region: string | null;
  onlineRequired: boolean;
  language: string;
  genderPreference: string | null;
  limit: number;
  /**
   * הקשיים שברקע, במפתחות של TEACHER_EXPERTISE: מה שההורה סימן בחיפוש הישיר,
   * או מה ששאלון הילדים כבר זיהה (teacher-needs.ts). העדפה ולא סינון - מורה
   * בלי ניסיון מתאים עדיין מופיע/ה, אחרי מי שיש לו/ה. הקורא מנקה את הרשימה.
   */
  needs?: readonly string[];
};

export type TeacherMatch = {
  teacher: TeacherRow;
  /** ההתאמה המקצועית באחוזים (בלי מרחק), כמו match_score אצל מטפלים. */
  score: number;
  /** דירוג פנימי שכולל מיקום - למיון בלבד. */
  rankScore: number;
  inRequestedArea: boolean;
  reasons: string[];
  /** הקשיים שצוינו ושהמורה הצהיר/ה על ניסיון בהם (מפתחות expertise). */
  needsMatched: string[];
  /** 0-1: כמה מהקשיים שצוינו מכוסים. 0 כשלא צוינו קשיים. למיון ולציון. */
  needCredit: number;
};

const WEIGHTS = {
  subject: 40,
  remedial: 25,
  grade: 20,
  gender: 5,
  needs: 20,
  location: 25,
} as const;

/**
 * כמה קושי אחד מכוסה אצל מורה. הכשרה שאומתה מול תעודה (remedial: הוראה
 * מתקנת, חינוך מיוחד או תואר שני בלקויות למידה) שוקלת יותר מניסיון שהמורה
 * רק הצהיר/ה עליו, ושניהם יחד הם הכיסוי המלא.
 */
const NEED_CREDIT = { verifiedAndDeclared: 1, verified: 0.8, declared: 0.6 } as const;

/**
 * זרע יומי לסבב: אותו סדר לכל ההורים באותו יום, סדר אחר מחר. מונע מצב שבו
 * מורה שנרשם/ה ראשון/ה תמיד מופיע/ה ראשון/ה בין שווים.
 */
function dailyRotation(id: string, day: string): number {
  let h = 0;
  const s = `${day}:${id}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h / 4294967296;
}

export function isTeacherListed(t: Pick<TeacherRow, "listing_state" | "paused_until">, now: Date): boolean {
  if (t.listing_state !== "trial" && t.listing_state !== "paying") return false;
  if (t.paused_until && new Date(t.paused_until).getTime() > now.getTime()) return false;
  return true;
}

function scoreOne(t: TeacherRow, input: TeacherMatchInput): TeacherMatch | null {
  const reasons: string[] = [];
  let earned = 0;
  let possible = 0;

  // שפה: סינון קשה. מורה בלי שפות = עברית.
  const langs = t.languages?.length ? t.languages : ["עברית"];
  if (input.language && !langs.includes(input.language)) return null;

  // תחום: סינון קשה כשנשאל תחום (הורה שחיפש מורה לאנגלית לא רוצה מורה לחשבון).
  if (input.subject) {
    possible += WEIGHTS.subject;
    if (!t.subjects.includes(input.subject)) return null;
    earned += WEIGHTS.subject;
    reasons.push("תחום מתאים");
  }

  // הוראה מתקנת: כשנדרשת - סינון קשה, ונספרת בציון. כשלא נדרשת (תגבור
  // פרטי) היא לא נכנסת לחישוב בכלל: מורה לאנגלית בלי תעודת הוראה מתקנת הוא
  // התאמה מלאה לנער/ה שהקושי שלו/ה באנגלית בלבד, ואין סיבה להציג לו 88%.
  if (input.remedial) {
    possible += WEIGHTS.remedial;
    if (!t.remedial) return null;
    earned += WEIGHTS.remedial;
    reasons.push("הוראה מתקנת");
  }

  // שכבת גיל: סינון קשה כשנשאלה.
  if (input.gradeGroup) {
    possible += WEIGHTS.grade;
    if (!t.grade_groups.includes(input.gradeGroup)) return null;
    earned += WEIGHTS.grade;
    reasons.push("שכבת הגיל מתאימה");
  }

  if (input.genderPreference) {
    possible += WEIGHTS.gender;
    if (t.gender === input.genderPreference) {
      earned += WEIGHTS.gender;
      reasons.push("העדפת מגדר");
    }
  }

  // הקשיים שברקע: העדפה, לא סינון. נכנסים לציון המוצג (מורה בלי ניסיון
  // מתאים לא יוצג כ-100%) וקובעים את הסדר בתוך קבוצת האזור.
  const needs = input.needs ?? [];
  const needsMatched: string[] = [];
  let needCredit = 0;
  if (needs.length > 0) {
    possible += WEIGHTS.needs;
    let covered = 0;
    for (const need of needs) {
      const declared = (t.expertise ?? []).includes(need);
      if (declared) needsMatched.push(need);
      covered += declared && t.remedial ? NEED_CREDIT.verifiedAndDeclared : t.remedial ? NEED_CREDIT.verified : declared ? NEED_CREDIT.declared : 0;
    }
    needCredit = covered / needs.length;
    earned += WEIGHTS.needs * needCredit;
    if (needsMatched.length > 0) reasons.push("ניסיון עם הקושי שצוין");
  }

  // מיקום - אותה סכימה כמו אצל המטפלים: עיר 100%, אותו אזור 85%, אזור סמוך
  // 15%, אונליין 40% (100% כשכל הבקשה היא אונליין). לא נכנס לציון המוצג.
  const locationAsked = !!(input.city || input.region || input.onlineRequired);
  let locationEarned = 0;
  const locationPossible = locationAsked ? WEIGHTS.location : 0;
  if (locationAsked) {
    const requestedRegion = input.city ? (CITY_TO_REGION[input.city] ?? input.region) : input.region;
    const teacherRegions = new Set(t.regions.map((c) => CITY_TO_REGION[c]).filter(Boolean));
    let geo = 0;
    if (input.city && t.regions.includes(input.city)) geo = 1;
    else if (requestedRegion && teacherRegions.has(requestedRegion)) geo = input.city ? 0.85 : 1;
    else if (requestedRegion && (REGION_NEIGHBORS[requestedRegion] ?? []).some((r) => teacherRegions.has(r))) geo = 0.15;
    let online = 0;
    if (t.online) online = input.city || input.region ? 0.4 : 1;
    if (!input.onlineRequired) online = Math.min(online, 0.4);
    const best = Math.max(geo, online);
    if (best === 0) return null; // לא באזור, לא סמוך, לא אונליין
    locationEarned = WEIGHTS.location * best;
    if (geo >= 0.85) reasons.push("באזור שלכם");
    else if (geo > 0) reasons.push("אזור סמוך");
    if (t.online && online >= geo) reasons.push("אונליין");
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : 100;
  const rankScore = possible + locationPossible > 0 ? ((earned + locationEarned) / (possible + locationPossible)) * 100 : 100;
  const inRequestedArea = !locationAsked || locationEarned >= 0.6 * locationPossible;
  return { teacher: t, score, rankScore, inRequestedArea, reasons, needsMatched, needCredit };
}

function commercialRank(state: string): number {
  return state === "paying" ? 0 : state === "trial" ? 1 : 2;
}

export function matchTeachers(rows: TeacherRow[], input: TeacherMatchInput, now: Date = new Date()): TeacherMatch[] {
  const day = now.toISOString().slice(0, 10);
  const scored: TeacherMatch[] = [];
  for (const t of rows) {
    if (!isTeacherListed(t, now)) continue;
    const m = scoreOne(t, input);
    if (m) scored.push(m);
  }
  scored.sort((a, b) => {
    if (a.inRequestedArea !== b.inRequestedArea) return a.inRequestedArea ? -1 : 1;
    // בתוך קבוצת האזור: קודם מי שמכסה יותר מהקשיים שצוינו, ורק אחר כך המרחק
    // המדויק (העיר עצמה מול שאר האזור).
    if (Math.abs(a.needCredit - b.needCredit) > 0.01) return b.needCredit - a.needCredit;
    if (Math.abs(a.rankScore - b.rankScore) > 0.5) return b.rankScore - a.rankScore;
    const c = commercialRank(a.teacher.listing_state) - commercialRank(b.teacher.listing_state);
    if (c !== 0) return c;
    return dailyRotation(a.teacher.id, day) - dailyRotation(b.teacher.id, day);
  });
  return scored.slice(0, Math.max(1, Math.min(input.limit || 10, 20)));
}

/**
 * שער ההיצע: לכל מפתח המלצה - האם יש במאגר לפחות מורה מוצג/ת אחד/ת שמתאים/ה
 * לו (תחום, סוג מורה ושכבת גיל), בלי קשר למיקום ולשפה.
 *
 * כפתור "חיפוש מורה" בדוח של ההורה מופיע רק כשהתשובה חיובית. בלי השער,
 * הכפתור הראשי של הדוח היה מוביל למאגר ריק בכל התקופה שבין העלאת הענף
 * לבין גיוס המורים הראשונים - וההמלצה עצמה (הוראה מתקנת, תגבור) נכונה גם
 * כשאין לנו מורה להציע. עד שיש היצע, הכרטיס מוצג כפנייה נוספת בלי חיפוש,
 * כפי שהוראה מתקנת הוצגה לפני הענף.
 */
/**
 * ההיצע של הדלת הציבורית (/learning): כמה מורים מוצגים כרגע, ובאילו תחומים.
 * החיפוש הישיר מוצג רק כשיש את מי להציג, מאותה סיבה ששער ההיצע קיים בדוח
 * השאלון: טופס חיפוש מעל מאגר ריק הוא דלת שנפתחת לקיר.
 */
export function teacherDoorSupply(
  rows: Pick<TeacherRow, "subjects" | "listing_state" | "paused_until">[],
  now: Date = new Date(),
): { total: number; subjects: TeacherSubject[] } {
  const listed = rows.filter((t) => isTeacherListed(t, now));
  return {
    total: listed.length,
    subjects: TEACHER_SUBJECT_KEYS.filter((s) => listed.some((t) => t.subjects.includes(s))),
  };
}

export function teacherSupplyForKeys(
  rows: Pick<TeacherRow, "subjects" | "remedial" | "grade_groups" | "listing_state" | "paused_until">[],
  keys: string[],
  gradeGroup: TeacherGradeGroup | null,
  now: Date = new Date(),
): Record<string, boolean> {
  const listed = rows.filter((t) => isTeacherListed(t, now));
  const out: Record<string, boolean> = {};
  for (const key of keys) {
    const search = teacherSearchFromKey(key);
    out[key] = listed.some(
      (t) =>
        (!search.subject || t.subjects.includes(search.subject)) &&
        (!search.remedial || t.remedial) &&
        (!gradeGroup || t.grade_groups.includes(gradeGroup)),
    );
  }
  return out;
}
