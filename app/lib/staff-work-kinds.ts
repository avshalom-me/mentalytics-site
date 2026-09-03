// אופי העבודה בכל רישום שעות. מקור אמת אחד, בלי "server-only", כי גם הטופס
// באדמין וגם האימות ב-API חייבים לקרוא בדיוק את אותה רשימה - וגם ה-CHECK
// במסד נגזר ממנה (ראו migration 20260903_staff_work_kinds.sql). ערך חדש כאן
// מחייב גם מיגרציה שמרחיבה את ה-CHECK, אחרת השמירה תיכשל בשקט.
export const WORK_KINDS = [
  "שיווק מרכזים",
  "שירות לקוחות במייל/בסוכן",
  "פגישות",
  "QA",
  "שירות לקוחות מרכזים",
  "אחר",
] as const;

export type WorkKind = (typeof WORK_KINDS)[number];

/**
 * מנקה קלט לרשימת אופי עבודה תקינה, בלי כפילויות ובסדר קבוע.
 * מחזיר null כשאין אף ערך תקין - כך הקורא מבדיל בין "לא נבחר" ל"נבחר משהו".
 */
export function cleanWorkKinds(input: unknown): WorkKind[] | null {
  if (!Array.isArray(input)) return null;
  const valid = WORK_KINDS.filter((k) => input.includes(k));
  return valid.length ? [...valid] : null;
}
