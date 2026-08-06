// ניטרול מדידה למכשיר של הצוות. ה-session_id נשמר ב-localStorage בלי תפוגה,
// ולכן דפדפן = מבקר קבוע: בעל האתר שנכנס מגוגל כמה פעמים ביום נספר פעם אחת
// בלבד - אבל הוא כן מזהם את הפילוח (נחיתות, צפיות בפרופילים, אירועי שאלון),
// ובגלישה פרטית הוא נספר כמבקר *חדש* בכל פעם. הדגל כאן מכבה את כל שליחת
// האירועים מהדפדפן הזה. נשמר ב-localStorage באותו origin, ולכן הפעלה מהאדמין
// חלה גם על האתר הציבורי.

const KEY = "mnt_no_track";

export function trackingOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setTrackingOptOut(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* מצב פרטי חסום - אין מה לעשות */
  }
}
