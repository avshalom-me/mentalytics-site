import { genderTitle, publicTypeOverride } from "./gender-text";

export const THERAPIST_TYPES = [
  "פסיכולוג קליני",
  "פסיכולוג חינוכי",
  "פסיכולוג שיקומי/רפואי",
  "פסיכולוג התפתחותי",
  "פסיכולוג תעסוקתי",
  "יועצ/ת חינוכי",
  'עו"ס קליני',
  "מטפל/ת בהבעה ויצירה",
  "מטפל מיני",
  "קרימינולוג קליני",
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
  "טיפול בהפרעות אכילה",
  "טיפול באנקופרזיס",
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
