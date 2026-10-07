// מה אנחנו יודעים על מי שלחץ על כפתור קשר, מעבר לכך שהוא לחץ.
//
// ב-6/10/2026 גולש אחד לחץ 14 פעמים על "חיוג" בפרופיל של מטפלת, בתוך 34 שניות.
// אי אפשר היה להכריע אם זה אדם שלחץ שוב ושוב על קישור שלא הגיב או כלי אוטומטי,
// כי לא נשמר שום דבר על הדפדפן: סינון הבוטים (bot-detect.ts) בודק את ה-User-Agent
// ברגע הבקשה ולא משאיר זכר. שתי העמודות שנוספו ללחיצה, device ו-automated, נועדו
// לענות על זה בפעם הבאה, ולמדוד כמה מלחיצות החיוג נעשות מהמחשב - שם קישור tel:
// לרוב לא עושה כלום, וזו ההשערה שהסבירה את המקרה.
//
// הקובץ משמש גם את הדפדפן (clickSignals) וגם את השרת (readClickSignals).

export type DeviceClass = "mobile" | "tablet" | "desktop";

/**
 * נייד, טאבלט או מחשב לפי ה-User-Agent. עיגול גס בכוונה, וה-UA עצמו לא נשמר.
 *
 * אנדרואיד בלי "Mobile" הוא טאבלט (כך כרום מסמן): טלפון תמיד נושא את המילה.
 * iPad שמבקש אתר למחשב (iPadOS 13 ומעלה) מציג UA של Mac, ואין בשום כותרת דרך
 * להבדיל - הוא ייספר כמחשב. טעות ידועה וקטנה, לא כזו שמצדיקה לשמור את ה-UA המלא.
 */
export function deviceClass(userAgent: string | null | undefined): DeviceClass | null {
  const ua = (userAgent ?? "").trim();
  if (!ua) return null;
  if (/ipad|tablet|kindle|silk\/|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    return "tablet";
  }
  if (/mobi|iphone|ipod|windows phone|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/**
 * מה הדפדפן מצהיר על עצמו: האם הוא נשלט בידי כלי אוטומציה (navigator.webdriver,
 * ש-Selenium, Playwright ו-Puppeteer מדליקים גם כשה-User-Agent נראה רגיל).
 * נשלח עם כל לחיצה ונשמר ב-automated. true הוא ראיה חזקה לאוטומציה; false אינו
 * הוכחה לאדם, כי כלי שמסתיר את הדגל עובר.
 */
export function clickSignals(): { automation: boolean } {
  try {
    return { automation: typeof navigator !== "undefined" && navigator.webdriver === true };
  } catch {
    return { automation: false };
  }
}

/**
 * מה שהשרת רושם עם לחיצה: המכשיר, ממה ש-User-Agent של הבקשה אומר, והדגל שהלקוח
 * דיווח. automated ריק (null) כשהלקוח לא דיווח כלל - דף ישן שנשאר במטמון של
 * הגולש - כדי להבדיל בין "דווח שלא" ל"לא דווח". רק boolean אמיתי נחשב דיווח:
 * המחרוזת "true" או המספר 1 אינם הלקוח שלנו.
 */
export function readClickSignals(
  body: unknown,
  userAgent: string | null | undefined,
): { device: DeviceClass | null; automated: boolean | null } {
  const flag = (body as { automation?: unknown } | null | undefined)?.automation;
  return {
    device: deviceClass(userAgent),
    automated: typeof flag === "boolean" ? flag : null,
  };
}
