import { genderTitle, publicTypeOverride } from "./gender-text";

export const THERAPIST_TYPES = [
  "פסיכולוג קליני",
  "פסיכולוג חינוכי",
  "פסיכולוג שיקומי/רפואי",
  "פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי",
  // נוספו 18/10/2026 לבקשת הבעלים, בשביל מרכזים עם צוות רפואי. השאלונים עדיין
  // מפנים לפסיכיאטר כהפניה חיצונית (EXTERNAL_PATTERNS ב-kids-recommendations).
  "פסיכיאטר/ית",
  "יועצ/ת חינוכי",
  'עו"ס קליני',
  "מטפל/ת בהבעה ויצירה",
  "מטפל מיני",
  "קרימינולוג קליני",
  "אח/ות מוסמך/ת",
  "פיזיותרפיסט/ית",
  "מרפא/ת בעיסוק",
  "קלינאי/ת תקשורת",
  "דיאטנ/ית קליני/ת",
] as const;

// תווית תצוגה לסוג מטפל. הצורות עצמן חיות ב-gender-text (מקור אמת אחד),
// וכאן נשאר רק כלל התואר הציבורי שמעליהן.
export function therapistTypeLabel(
  type: string,
  gender?: string | null,
  /**
   * כשמסופק - חל כלל התואר הציבורי (הבעה ויצירה + מבוגרים ← פסיכותרפיסט/ית).
   * הכלל עצמו חי ב-gender-text כדי ששתי פונקציות התוויות לא יסטו זו מזו.
   */
  ageGroups?: string[] | null
): string {
  const override = ageGroups !== undefined ? publicTypeOverride(type, gender, ageGroups) : null;
  return override ?? genderTitle(type, gender);
}

export const TRAINING_AREAS = [
  "טיפול דינאמי",
  "CBT",
  "ACT",
  "EMDR",
  "CPT",
  "טיפול דינאמי בטראומה",
  "DBT",
  "הדרכת הורים",
  "טיפול דיאדי",
  "טיפול משפחתי",
  "טיפול בהבעה ויצירה",
  "ריפוי בעיסוק",
  "טיפול תעסוקתי",
  "קבוצה חברתית",
  "טיפול זוגי",
  "טיפול בהתמכרויות",
  "טיפול מיני",
  "טיפול COG-FUN לקשיי קשב וריכוז",
  "נוירופידבק",
  "טיפול בטראומה",
  "פסיכואנליזה",
  "קלינאות תקשורת",
  "טיפול בקשיי תקשורת ASD",
  "טיפול בהפרעות אכילה",
  "טיפול באנקופרזיס",
  // כאן ולא ב-ASSESSMENT_TYPES במכוון (18/10/2026): סוגי האבחון נכנסים
  // אוטומטית גם לכלי היועצות (DIAGNOSIS_KINDS ב-school-tracks), שבו "פסיכיאטר
  // ילדים" כבר קיים וכל סוג מחייב כללי קבילות לפי התוספת הראשונה.
  "חוות דעת פסיכיאטרית לילדים ונוער",
  "חוות דעת פסיכיאטרית למבוגרים",
] as const;

export const COGFUN_AGE_GROUPS = ["ילדים", "בני נוער", "מבוגרים"] as const;

// Para-medical professions - shown in a separate rubric, not the main directory.
export const PARA_MEDICAL_TYPES = [
  "פיזיותרפיסט/ית",
  "מרפא/ת בעיסוק",
  "קלינאי/ת תקשורת",
  "דיאטנ/ית קליני/ת",
] as const;
const PARA_MEDICAL_SET = new Set<string>(PARA_MEDICAL_TYPES);

// Has at least one para-medical profession → appears in the para-medical rubric.
export function isParaMedical(types: string[] | null | undefined): boolean {
  return (types ?? []).some((t) => PARA_MEDICAL_SET.has(t));
}

// Appears in the main directory unless ALL their types are para-medical (so a
// therapist who is both emotional + para-medical shows in both places).
export function isMainListed(types: string[] | null | undefined): boolean {
  const arr = types ?? [];
  return arr.length === 0 || arr.some((t) => !PARA_MEDICAL_SET.has(t));
}

export const THERAPIST_TYPE_TO_TRAINING: Record<string, string> = {
  "מרפא/ת בעיסוק": "ריפוי בעיסוק",
  "קלינאי/ת תקשורת": "קלינאות תקשורת",
};

/**
 * תחום שמחייב תחום נוסף (החלטת הבעלים, 30/10/2026): מי שמטפל/ת "טיפול דינאמי
 * בטראומה" עובד/ת בגישה דינאמית, ולכן מסומן/ת גם "טיפול דינאמי". בלי זה
 * מטפלת שסימנה רק את תחום הטראומה קיבלה 0 מ-25 במומחיות בכל חיפוש של
 * "טיפול דינאמי" (כחמישית משאלוני המבוגרים), וציון של כ-40%.
 * אותו כלל רץ במסד בטריגר (supabase/migrations/20261030_training_area_implies.sql),
 * כך שכל נתיב שמירה מקיים אותו; כאן הוא רק מראה את הסימון בטופס מיד.
 */
export const TRAINING_AREA_IMPLIES: Record<string, string[]> = {
  "טיפול דינאמי בטראומה": ["טיפול דינאמי"],
};

export function withImpliedTrainingAreas(areas: string[]): string[] {
  const out = [...areas];
  for (const area of areas) {
    for (const implied of TRAINING_AREA_IMPLIES[area] ?? []) {
      if (!out.includes(implied)) out.push(implied);
    }
  }
  return out;
}

export const COUPLES_MODALITIES = ["EFT", "דינאמי", "מבני"] as const;

export const PLAY_THERAPY_MODALITIES = [
  "טיפול באומנות",
  "טיפול בתנועה",
  "דרמה תרפיה",
  'טיפול בעזרת בע"ח',
  "טיפול במוזיקה",
  "פסיכודרמה",
] as const;

export const AGE_GROUPS = [
  "גיל הרך",
  "ילדים",
  "נוער",
  "מבוגרים",
  "הגיל השלישי",
] as const;

export const ASSESSMENT_TYPES = [
  "פסיכו-דידקטי",
  "פסיכו-דיאגנוסטי",
  "נוירו-פסיכולוגי",
  "אבחון תעסוקתי",
  "הערכה פסיכולוגית",
  "הערכת בשלות לגן",
  "אבחון קשיי תקשורת ASD",
] as const;

export const CULTURAL_PREFS = [
  "היכרות עם העולם הדתי",
  "היכרות עם העולם החרדי",
  'היכרות עם עולם הלהט"ב',
] as const;

export const LANGUAGES = [
  "עברית",
  "אנגלית",
  "ערבית",
  "רוסית",
  "צרפתית",
  "ספרדית",
  "פורטוגזית",
  "אמהרית",
] as const;

export const ARRANGEMENTS = [
  "קופות החולים",
  "משרד הביטחון",
  "ביטוח לאומי",
  "ביטוחים פרטיים",
] as const;
