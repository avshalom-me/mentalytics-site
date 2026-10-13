// כרטיס מורה כפי שהוא מוצג להורים: מהמנוע (TeacherMatch) אל המסך.
//
// מודול איזומורפי (בלי server-only): /api/match-teachers בונה איתו את התשובה
// לחיפוש מתוך השאלון, ומאגר המורים (/learning/teachers) בונה איתו את הכרטיסים
// בדפדפן, אחרי סינון. מקום אחד, כדי שכרטיס של אותו מורה יאמר אותו דבר בשניהם.

import type { TeacherMatch, TeacherRow } from "./teacher-match";
import {
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
  qualificationNeedsCertificate,
  expertiseLabel,
  lessonSettingsText,
} from "./teacher-options";

/** שורת מורה כפי שמאגר המורים מקבל אותה מהשרת: העמודות הציבוריות וכתובת התמונה. */
export type DirectoryTeacher = TeacherRow & { photo_url: string | null };

export type TeacherCard = {
  id: string;
  full_name: string;
  gender: string | null;
  slug: string | null;
  photo_url: string | null;
  bio: string | null;
  phone: string | null;
  regions: string[];
  online: boolean;
  remedial: boolean;
  subject_labels: string[];
  grade_labels: string[];
  qualification_label: string;
  /**
   * התעודה נבדקה. נכון רק למי שהכשרתו מחייבת תעודה (הוראה מתקנת, חינוך
   * מיוחד, תואר שני בלקויות למידה): אלה מאושרים רק אחרי שהתעודה נבדקה. אצל
   * מורה פרטי/ת ההכשרה היא לפי הצהרה, והכרטיס אינו נושא את התג.
   * (החלטת הבעלים, 13/10/2026.)
   */
  certificate_checked: boolean;
  /** ניסיון מוצהר עם מאפייני למידה, בתוויות קצרות. לפי המורה, לא מאומת. */
  expertise_labels: string[];
  /** מתוך הניסיון המוצהר: מה שמתאים לקשיים שצוינו בחיפוש. */
  need_labels?: string[];
  /** איפה מתקיים השיעור, במילים: "בבית התלמיד, אונליין". */
  lesson_text: string;
  experience_years: number | null;
  price_text: string | null;
  match_score: number;
  in_requested_area: boolean;
  /** הסיבות שהמנוע חישב: "באזור שלכם", "אזור סמוך", "אונליין" ועוד. */
  match_reasons: string[];
};

/** photoUrl מחושב בשרת (teacherPhotoUrl), כי הוא נשען על נתיב הקובץ בבאקט. */
export function teacherCard(m: TeacherMatch, photoUrl: string | null): TeacherCard {
  const t = m.teacher;
  return {
    id: t.id,
    full_name: t.full_name,
    gender: t.gender,
    slug: t.slug,
    photo_url: photoUrl,
    bio: t.bio,
    phone: t.phone,
    regions: t.regions,
    online: t.online,
    remedial: t.remedial,
    subject_labels: t.subjects.map(subjectLabel),
    grade_labels: t.grade_groups.map(gradeGroupLabel),
    qualification_label: qualificationLabel(t.qualification),
    certificate_checked: qualificationNeedsCertificate(t.qualification),
    // ניסיון מוצהר (לא מאומת) ומקום השיעור - מוצגים בכרטיס. need_labels הם
    // מתוכו: מה שמתאים לקשיים שצוינו בחיפוש, ולכן קידם את המורה בסדר.
    expertise_labels: (t.expertise ?? []).map((k) => expertiseLabel(k, true)),
    need_labels: m.needsMatched.map((k) => expertiseLabel(k, true)),
    lesson_text: lessonSettingsText(t),
    experience_years: t.experience_years,
    price_text: t.price_text,
    match_score: m.score,
    in_requested_area: m.inRequestedArea,
    match_reasons: m.reasons,
  };
}
