import { normalizeAccessCode } from "@/app/lib/schools-crm";

// קישור התנסות לשאלון היועצות: /school?access=ABCD-2345. הקוד הוא קוד גישה רגיל
// של רישיון (למשל רישיון ניסיון לחודש), והשער מקליד אותו בשביל מי שפתחה את
// הקישור, כך שאפשר לשלוח קישור אחד להרבה יועצות במקום קוד שמקלידים ביד. בלי
// רישיון בתוקף אין מה שהקישור פותח: הקוד נבדק בשרת בדיוק כמו קוד שהוקלד.

export const ACCESS_PARAM = "access";

/** הקוד שבקישור, מנורמל, או null אם אין פרמטר או שהוא אינו בצורת קוד. */
export function accessCodeFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get(ACCESS_PARAM);
  return raw ? normalizeAccessCode(raw) : null;
}

/**
 * הכתובת בלי הקוד, לשימוש ב-history.replaceState: הקוד לא נשאר בשורת הכתובת, בהיסטוריה
 * של הדפדפן או בכתובת שמועתקת הלאה, ויתר הפרמטרים וה-hash נשמרים.
 */
export function withoutAccessParam(pathname: string, search: string, hash: string): string {
  const p = new URLSearchParams(search);
  p.delete(ACCESS_PARAM);
  const q = p.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash}`;
}
