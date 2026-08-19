import "server-only";
import { alertRecipients } from "./alert-recipients";

// מתג ביטחון: אף מייל אוטומטי לא יוצא לצד שלישי.
//
// החלטת המשתמש (19/8/2026), אחרי שקרון "center-nudges" שלח למרכז משלם
// "הפרופיל שלכם מלא ב-0%" בלי שאיש אישר: מלבד חשבוניות ומלבד מיילים
// שנשלחים ידנית מהאדמין (או מטיוטה שסוכן הכין), אין שליחה אוטומטית לאף
// אחד. מיילים תפעוליים אלינו (דוחות, התראות) מותרים כרגיל.
//
// למה שכבה מרכזית ולא הערה בכל קרון: הכשל הקודם היה שכל קרון פירסר לבד
// את תנאי השליחה, וכך אחד מהם נשאר בלי שום תנאי. כאן ההיתר הוא ברירת
// מחדל שלילית - מסלול חדש שישכח לקרוא לפונקציה הזו עדיין ייחסם ברגע
// שיעבור דרך sendIfAutomationAllowed.

const INTERNAL_DOMAINS = ["getmentalytics.com"];
const INTERNAL_ADDRESSES = ["avshalom84@gmail.com"];

/** האם הנמען הוא אנחנו (ולכן מותר לשלוח אליו אוטומטית - דוחות ובדיקות). */
export function isInternalRecipient(to: string): boolean {
  const addr = to.trim().toLowerCase();
  if (!addr) return false;
  if (INTERNAL_ADDRESSES.includes(addr)) return true;
  if (INTERNAL_DOMAINS.some((d) => addr.endsWith(`@${d}`))) return true;
  return alertRecipients().some((r) => r.trim().toLowerCase() === addr);
}

export type AutomationBlock = { allowed: false; reason: string };
export type AutomationPass = { allowed: true };

/**
 * שער יחיד לכל שליחה אוטומטית (קרון) לנמען חיצוני.
 * מחזיר allowed:false לכל מי שאינו אנחנו - הקורא מדלג ומדווח.
 */
export function automatedSendAllowed(to: string | null | undefined): AutomationPass | AutomationBlock {
  const addr = (to ?? "").trim();
  if (!addr) return { allowed: false, reason: "אין כתובת" };
  if (isInternalRecipient(addr)) return { allowed: true };
  return {
    allowed: false,
    reason: "שליחה אוטומטית לנמענים חיצוניים מושבתת (החלטת 19/8/2026)",
  };
}

/** הודעה אחידה לתשובת הקרון, כדי שהריצה תסביר את עצמה בלוג. */
export const AUTOMATION_BLOCKED_NOTE =
  "שליחה אוטומטית לנמענים חיצוניים מושבתת. הריצה מחזירה את הרשימה בלבד, לשליחה ידנית מהאדמין.";
