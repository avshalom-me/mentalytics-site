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
 * המתג שפותח את הדלת לגוגל.
 *
 *   false - העמודים חיים בכתובת שלהם, אבל noindex (מטא וכותרת HTTP) ומחוץ
 *           ל-sitemap.
 *   true  - /learning ו-/learning/join נפתחים לאינדוקס ונכנסים ל-sitemap.
 *
 * דלוק מ-3/10/2026: הבעלים אישר את הלוגו והסכים לפתוח את הדלת לגוגל, גם כשעוד
 * אין מורים במאגר (העמוד מציג אז הודעה במקום טופס החיפוש).
 *
 * שלושה מקומות קוראים אותו: learningRobots (המטא של שני העמודים),
 * next.config.ts (כותרת X-Robots-Tag) ו-app/sitemap.ts. לא לפתוח או לסגור אחד
 * מהם ביד. הקישור ב-footer תלוי בו וגם בתאריך - ראו learningFooterLinkLive.
 */
export const LEARNING_DOOR_PUBLIC = true;

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

/**
 * היום שממנו ה-footer של האתר מקשר לדלת (שעון ישראל).
 *
 * הקישור הוא שינוי בקישורים הפנימיים של כל עמוד באתר, ועד 20/10/2026 בערך
 * הם קפואים: נמדדת ההשפעה של שינויי הקישורים מ-24/9, וקישור נוסף בכל עמוד
 * היה נכנס למדידה. הבעלים הסכים (3/10/2026): לפתוח לגוגל עכשיו, ואת הקישור
 * להוסיף ב-20/10. תאריך ולא מתג, כדי שאיש לא יצטרך לזכור.
 */
export const LEARNING_FOOTER_LINK_FROM = "2026-10-20";

/**
 * האם ה-footer מקשר לדלת. נקרא בשרת (app/layout.tsx) ועובר ל-footer כ-prop,
 * ולא מחושב בדפדפן: עמוד שנבנה לפני התאריך ונצפה אחריו היה מקבל HTML בלי
 * הקישור ורכיב לקוח שמצייר אותו, כלומר hydration mismatch. בעמוד סטטי הקישור
 * מופיע עם הבנייה הראשונה שאחרי התאריך (פריסה או ריענון ISR).
 */
export function learningFooterLinkLive(now: Date = new Date()): boolean {
  return LEARNING_DOOR_PUBLIC && now.getTime() >= Date.parse(`${LEARNING_FOOTER_LINK_FROM}T00:00:00+03:00`);
}
