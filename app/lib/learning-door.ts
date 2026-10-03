// "לימוד חכם" - הדלת הציבורית של ענף המורים, תחת /learning.
//
// החלטת הבעלים (3/10/2026), שמחליפה את ההחלטה מ-2/10 ("לא מקושר ולא מאונדקס"):
// דלת נפרדת בתוך הדומיין של טיפול חכם, בשם משלה ועם לוגו דומה, שמתחרה גם על
// חיפושים ישירים בגוגל ולא רק על הורים שמגיעים מהשאלון. מקושרת מהאתר בקישור
// לא בולט, מחוברת לשאלון הילדים כמו קודם, ועומדת גם בפני עצמה.
//
// המודול הזה בלי ייבוא ובלי "@/": גם next.config.ts קורא אותו, והוא נטען שם
// לפני שכינויי הנתיבים קיימים.

/** השם שהורים ומורים רואים. שם האתר בגוגל נשאר "טיפול חכם" (אותו דומיין). */
export const LEARNING_BRAND = "לימוד חכם";

/**
 * המתג היחיד שפותח את הדלת.
 *
 *   false - העמודים חיים בכתובת שלהם, אבל noindex (מטא וכותרת HTTP), מחוץ
 *           ל-sitemap ובלי קישור מה-footer. כך הבעלים רואה את העמוד האמיתי
 *           לפני שגוגל רואה אותו.
 *   true  - /learning ו-/learning/join נפתחים לאינדוקס, נכנסים ל-sitemap,
 *           וה-footer מקבל קישור אחד.
 *
 * ארבעה מקומות קוראים אותו: learningRobots (המטא של שני העמודים),
 * next.config.ts (כותרת X-Robots-Tag), app/sitemap.ts ו-SiteFooter. לא לפתוח
 * אחד מהם ביד.
 */
export const LEARNING_DOOR_PUBLIC = false;

/**
 * האזורים הפרטיים של ענף המורים. noindex תמיד, גם כשהדלת פתוחה: הפרופיל
 * והתשלום של המורה, הקישור האישי, ועמודי הפרופיל של מורים (עד שיוחלט אחרת -
 * פרופיל בודד הוא עמוד דל, והמאגר עוד קטן).
 */
export const LEARNING_PRIVATE_SEGMENTS = ["me", "pay", "k", "t"] as const;

/** המטא robots של עמודי הדלת (/learning, /learning/join). */
export function learningRobots(): { index: boolean; follow: boolean } {
  return LEARNING_DOOR_PUBLIC ? { index: true, follow: true } : { index: false, follow: false };
}

/** האם הנתיב שייך לאזור "לימוד חכם" - שם הכותרת העליונה של האתר מתחלפת. */
export function isLearningPath(pathname: string | null | undefined): boolean {
  return pathname === "/learning" || (pathname ?? "").startsWith("/learning/");
}
