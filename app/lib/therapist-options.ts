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

// Gender-aware display label for a therapist type. The canonical THERAPIST_TYPES
// values are stored in masculine / slash form; this renders the matching
// gendered label from the therapist's `gender` ("נקבה"/"זכר"). Unknown or empty
// gender falls back to the stored canonical value.
const THERAPIST_TYPE_LABELS_BY_GENDER: Record<string, { m: string; f: string }> = {
  "פסיכולוג קליני":        { m: "פסיכולוג קליני",        f: "פסיכולוגית קלינית" },
  "פסיכולוג חינוכי":       { m: "פסיכולוג חינוכי",       f: "פסיכולוגית חינוכית" },
  "פסיכולוג שיקומי/רפואי": { m: "פסיכולוג שיקומי/רפואי", f: "פסיכולוגית שיקומית/רפואית" },
  "פסיכולוג התפתחותי":     { m: "פסיכולוג התפתחותי",     f: "פסיכולוגית התפתחותית" },
  "פסיכולוג תעסוקתי":      { m: "פסיכולוג תעסוקתי",      f: "פסיכולוגית תעסוקתית" },
  "יועצ/ת חינוכי":         { m: "יועץ חינוכי",           f: "יועצת חינוכית" },
  'עו"ס קליני':            { m: 'עו"ס קליני',            f: 'עו"ס קלינית' },
  "מטפל/ת בהבעה ויצירה":   { m: "מטפל בהבעה ויצירה",     f: "מטפלת בהבעה ויצירה" },
  "מטפל מיני":             { m: "מטפל מיני",             f: "מטפלת מינית" },
  "קרימינולוג קליני":      { m: "קרימינולוג קליני",      f: "קרימינולוגית קלינית" },
  "פיזיותרפיסט/ית":        { m: "פיזיותרפיסט",           f: "פיזיותרפיסטית" },
  "מרפא/ת בעיסוק":         { m: "מרפא בעיסוק",           f: "מרפאה בעיסוק" },
  "קלינאי/ת תקשורת":       { m: "קלינאי תקשורת",         f: "קלינאית תקשורת" },
  "דיאטנ/ית קליני/ת":      { m: "דיאטן קליני",           f: "דיאטנית קלינית" },
};

export function therapistTypeLabel(type: string, gender?: string | null): string {
  const e = THERAPIST_TYPE_LABELS_BY_GENDER[type];
  if (!e) return type;
  if (gender === "נקבה") return e.f;
  if (gender === "זכר") return e.m;
  return type;
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
