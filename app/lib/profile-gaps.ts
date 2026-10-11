// Rule-based profile gaps - the certain, concrete ones (no photo, short bio,
// too few treatment areas...). Pure on purpose: the retention review engine
// (retention-review.ts) and the onboarding feedback (profile-feedback.ts) both
// read it, and the engine must stay importable from a test without a model or
// a database behind it.

export type ProfileForFeedback = {
  full_name?: string | null;
  bio?: string | null;
  profile_photo_path?: string | null;
  training_areas?: string[] | null;
  therapist_types?: string[] | null;
  regions?: string[] | null;
  education?: string | null;
  experience?: string | null;
  languages?: string[] | null;
};

export const BIO_MIN = 80;

export type ProfileGapKey = "photo" | "bio" | "areas" | "education" | "experience" | "regions";

export type ProfileGap = { key: ProfileGapKey; text: string };

// Concrete, rule-based gaps. Each entry is a short Hebrew phrase describing
// what's missing and why it matters - used both as the AI's input and as the
// no-AI fallback text. Order is by impact (photo and bio first).
export function detectProfileGapsDetailed(t: ProfileForFeedback): ProfileGap[] {
  const gaps: ProfileGap[] = [];

  if (!t.profile_photo_path) {
    gaps.push({ key: "photo", text: "אין תמונת פרופיל - תמונה מקצועית היא מהגורמים החזקים ביותר לאמון ולפנייה ראשונית." });
  }
  if (!t.bio || t.bio.trim().length < BIO_MIN) {
    gaps.push({ key: "bio", text: "הביוגרפיה קצרה או חסרה - תיאור אישי של הגישה הטיפולית שלך מגדיל משמעותית את מספר הפניות." });
  }
  if ((t.training_areas?.length ?? 0) <= 2) {
    gaps.push({ key: "areas", text: "מעט תחומי טיפול מסומנים - הוספת תחומים שאת/ה מתמחה בהם תרחיב את החשיפה במערכת ההתאמה ובמאגר." });
  }
  if (!t.education || t.education.trim().length < 10) {
    gaps.push({ key: "education", text: "חסרים פרטי השכלה והכשרה - מטופלים בודקים רקע מקצועי לפני שהם פונים." });
  }
  if (!t.experience || t.experience.trim().length < 10) {
    gaps.push({ key: "experience", text: "חסר תיאור ניסיון מקצועי - שנות ניסיון ומסגרות עבודה מחזקות אמון." });
  }
  if ((t.regions?.length ?? 0) === 0) {
    gaps.push({ key: "regions", text: "לא סומנו אזורי פעילות - בלי אזור קשה למטופלים למצוא אותך בחיפוש לפי מיקום." });
  }

  return gaps;
}

export function detectProfileGaps(t: ProfileForFeedback): string[] {
  return detectProfileGapsDetailed(t).map((g) => g.text);
}
