// "חזרה לרשימה" בעמוד מטפל: לאן מותר לחזור לפי ?ret=. רק נתיבים פנימיים של
// רשימות - אף פעם לא כתובת חיצונית או נתיב שרירותי (הפניה פתוחה).
//
// רשימות מאגר: /therapists/... ו-/centers/...
// רשימה שמורה מההתאמה: /match/<token> (נוסף 18/9/26). עד אז ret כזה נזרק,
// ומי שחזר לרשימה ששמר בוואטסאפ ולחץ "חזרה" מהפרופיל הגיע למאגר הכללי.

const LISTING_RE = /^\/(therapists|centers)\/[^/]/;
const SAVED_MATCH_RE = /^\/match\/[A-Za-z0-9_-]{6,32}$/;

/** הנתיב אם הוא רשימה פנימית מותרת, אחרת null. */
export function safeReturnPath(ret: unknown): string | null {
  if (typeof ret !== "string" || ret.startsWith("//") || ret.includes("..")) return null;
  if (SAVED_MATCH_RE.test(ret)) return ret;
  if (LISTING_RE.test(ret)) return ret;
  return null;
}

/** האם זה קישור לרשימה שמורה מההתאמה. */
export function isSavedMatchPath(ret: unknown): ret is string {
  return typeof ret === "string" && SAVED_MATCH_RE.test(ret);
}
