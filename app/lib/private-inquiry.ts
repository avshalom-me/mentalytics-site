// פנייה פרטית: הודעה שגולש שלח למטפל/ת או למרכז דרך טופס האתר.
//
// עד 11/10/2026 השם של הפונה, פרטי הקשר שלו וההודעה נשמרו ב-crm_leads, וכל מסך
// אדמין שקרא את הטבלה הציג אותם: מסך הלידים, ציר הזמן בכרטיס המטפל, "צפייה בתור
// מרכז" ושורה בדוח הבוקר. הבעלים קבע: התוכן שייך לנמען בלבד. הצוות ממשיך לספור
// את הפניות (מתי, למי, מאיזה ערוץ) ולא רואה מה נכתב בהן ולא מי כתב.
//
// שלוש שכבות, כדי שטעות באחת לא תחשוף:
//   1. המסד: התוכן יושב בטבלה נפרדת (private-inquiry-store.ts), ואילוץ על
//      crm_leads מונע משלוש העמודות להתמלא בשורות האלה.
//   2. ה-API: כל שורת ליד שיוצאת לאדמין עוברת דרך withoutPrivateContent.
//   3. המסך: שורה פרטית מוצגת בלי שם, בלי פרטי קשר ובלי הודעה.
//
// הקובץ הזה טהור (בלי מסד), ומשמש גם את השרת וגם את מסכי האדמין.

/** crm_leads.source של הודעה מטופס האתר למטפל/ת או למרכז. */
export const PRIVATE_INQUIRY_SOURCE = "site_message";

/** מה שהאדמין רואה במקום התוכן. */
export const PRIVATE_INQUIRY_NOTICE = "תוכן הפנייה גלוי לנמען בלבד";

export function isPrivateInquiry(lead: { source?: string | null } | null | undefined): boolean {
  return lead?.source === PRIVATE_INQUIRY_SOURCE;
}

/**
 * שורת ליד כפי שמותר לה לצאת לאדמין: בפנייה פרטית שלוש העמודות הרגישות ריקות,
 * גם אם הגיעו מלאות מהמסד (שורה מלפני ההעברה, או קוד עתידי שכתב אותן בטעות).
 * `content_private` מסמן למסך שזו שורה לספירה בלבד. ליד אחר חוזר כמות שהוא.
 */
export function withoutPrivateContent<T extends { source?: string | null }>(
  lead: T,
): T & { content_private: boolean } {
  if (!isPrivateInquiry(lead)) return { ...lead, content_private: false };
  return { ...lead, name: null, contact: null, message: null, content_private: true };
}
