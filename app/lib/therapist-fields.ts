// מקור האמת היחיד לשדות שמותר לעדכן בפרופיל מטפל. משמש גם את העריכה העצמית
// (therapist-profile PATCH) וגם את עריכת המרכז מהפורטל (center-portal), כדי
// שהרשימות לא יסטו זו מזו: שדה שמתווסף כאן ניתן לעריכה משני המסלולים, וה-
// allowlist נשאר שער האבטחה שחוסם כתיבה ל-status / admin_approved /
// promotion_source וכל שדה רגיש אחר.
export const THERAPIST_EDIT_FIELDS = [
  "full_name", "phone", "bio", "gender", "online",
  "therapist_types", "training_areas", "assessment_types",
  "couples_modalities", "cogfun_age_groups",
  "regions", "cultural_prefs", "arrangements", "age_groups", "languages",
  "style_q1", "style_q2", "activity_level",
  "education", "experience",
  "license_number", "publication_links", "price",
  "accepting_new_patients",
] as const;

// הפורטל מנהל פרופילים שאין להם חשבון מטפל, ולכן מנהל המרכז קובע גם את מייל
// הקשר. מטפל עצמאי אינו יכול לשנות את המייל שלו - הוא קשור לחשבון ה-Auth שלו,
// ולכן הוא נעדר מ-THERAPIST_EDIT_FIELDS ומתווסף רק כאן.
export const CENTER_THERAPIST_EDIT_FIELDS = ["email", ...THERAPIST_EDIT_FIELDS] as const;

// סניטציה לקישורי פרסומים - חובה בכל נתיב כתיבה (עצמי / פורטל מרכז / מילוי
// בהזמנה): http/https בלבד (חוסם javascript: וכו'), מחרוזות בלבד, דה-דופ,
// עד 10. הערכים מרונדרים כעוגנים אמיתיים בעמוד הפרופיל הציבורי.
export function sanitizePublicationLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const s = v.trim().slice(0, 300);
    if (!/^https?:\/\//i.test(s)) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}
