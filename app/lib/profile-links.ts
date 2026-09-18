// אילו קישורים מתוך "קישורים לפרסומים שכתבת" (therapists.publication_links)
// מוצגים בעמוד הפרופיל הציבורי.
//
// החלטת הבעלים מ-18/9/26: מטפל חינמי לא מוציא מאיתנו שום קישור החוצה - לא
// לאתר שלו וגם לא למאמר. גרסה ראשונה באותו יום השאירה לחינמיים קישורים
// לפרסומים לפי רשימת דומיינים, והתברר שהרשימה לא יכולה לדעת מה מאחורי
// הכתובת: hebpsy, למשל, הוא גם פלטפורמת מאמרים וגם אינדקס מטפלים עם דף אישי
// ופרטי קשר. במקום לנחש, חינמי מקבל אפס קישורים חיצוניים.
//
// למה לא נשאר אפילו קישור לפרסום אקדמי: קישור יוצא לא מקדם את האתר שלנו
// בגוגל (גוגל אמרה במפורש שהוא לא גורם דירוג), ואזכור בלי קישור לא שווה
// יותר. קישור *פנימי* לאתר שלנו, לעומת זאת, כן עוזר לנו - ולכן מאמר שמטפל
// חינמי כתב אצלנו ממשיך להופיע.
//
// הכלל: מטפל שמשלם (status='paying', כולל מתנה ומטפלי מרכזים) - כל הקישורים.
// מטפל חינמי - רק קישורים לאתר שלנו. הקישורים עצמם נשארים במסד הנתונים
// וחוזרים להופיע ברגע שהמטפל עובר למסלול בתשלום.

const OWN_HOSTS = ["mentalytics.co.il"] as const;

/** שם המארח בלי www, באותיות קטנות; null לכתובת לא תקינה או לא http(s). */
function hostOf(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** האם הקישור מוביל לאתר שלנו (קישור פנימי). */
export function isOwnSiteLink(url: string): boolean {
  const host = hostOf(url);
  return host !== null && (OWN_HOSTS as readonly string[]).includes(host);
}

/**
 * הקישורים שעמוד הפרופיל מציג. isPaying = status 'paying' (משלם, מתנה או
 * מטפל של מרכז משלם). כתובות לא תקינות לא מוצגות לאף אחד.
 */
export function visibleProfileLinks(links: string[] | null | undefined, isPaying: boolean): string[] {
  const clean = (links ?? [])
    .map((l) => (typeof l === "string" ? l.trim() : ""))
    .filter((l) => hostOf(l) !== null);
  return isPaying ? clean : clean.filter(isOwnSiteLink);
}
