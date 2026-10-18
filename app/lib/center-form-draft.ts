// טיוטה מקומית לטופס הפרופיל בפורטל המרכז (/centers/dashboard/therapists/[id]).
//
// 18/10/2026: מנהלת מרכז חדש מילאה את "צעד חיוני" (סוגי טיפול, גילאים, שפות,
// אזורים), לחצה שמירה, ומה שמילאה נעלם. אף שמירה לא הגיעה למסד. הטופס החזיק
// הכול רק בזיכרון של העמוד: יציאה ממנו (גם דרך הקישורים לעורך העמוד הציבורי
// שבתוכו), רענון, חיבור שפג או תשובה שלא נקראה - והכול אבד. מכאן: כל שינוי
// נשמר גם בדפדפן עד שהשמירה בשרת מצליחה, וכישלון מוסבר בעברית.

const DRAFT_PREFIX = "center-profile-draft:";
const DRAFT_MAX_AGE_MS = 30 * 86_400_000;

export function centerFormDraftKey(id: string): string {
  return `${DRAFT_PREFIX}${id}`;
}

/** מפענח טיוטה שמורה. null כשאין, כשהיא פגומה או ישנה מ-30 יום. */
export function parseFormDraft<T>(raw: string | null, now: number): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { savedAt?: unknown; form?: unknown };
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > DRAFT_MAX_AGE_MS) return null;
    if (!parsed.form || typeof parsed.form !== "object") return null;
    return parsed.form as T;
  } catch {
    return null;
  }
}

// localStorage יכול להיזרק (חלון פרטי, אחסון חסום) - הטיוטה היא רשת ביטחון,
// ולכן כישלון בה אף פעם לא עוצר את הטופס.
export function readFormDraft<T>(key: string): T | null {
  try {
    return parseFormDraft<T>(window.localStorage.getItem(key), Date.now());
  } catch {
    return null;
  }
}

export function writeFormDraft(key: string, form: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), form }));
  } catch {
    /* אין אחסון - ממשיכים בלי טיוטה */
  }
}

export function clearFormDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* אין אחסון */
  }
}

/** הודעה בעברית לשמירה שנכשלה, לפי קוד התשובה והשגיאה מהשרת (אם הייתה). */
export function centerFormSaveErrorMessage(status: number, serverError?: unknown): string {
  const kept = "מה שמילאת שמור בדפדפן הזה.";
  if (status === 401) {
    return `החיבור לחשבון פג. ${kept} התחברו מחדש, חזרו לעמוד הזה ולחצו שוב על שמירה.`;
  }
  if (status === 429) {
    return `היו יותר מדי ניסיונות ברגע אחד. ${kept} חכו דקה ונסו שוב.`;
  }
  if (typeof serverError === "string" && /[֐-׿]/.test(serverError)) {
    return `${serverError} (${kept})`;
  }
  return `השמירה לא הצליחה (שגיאה ${status}). ${kept} אפשר לנסות שוב, ואם זה חוזר - לכתוב לנו: admin@getmentalytics.com`;
}

export const CENTER_FORM_SAVE_NETWORK_MESSAGE =
  "השמירה לא הגיעה לשרת - כדאי לבדוק את החיבור לאינטרנט ולנסות שוב. מה שמילאת שמור בדפדפן הזה.";
