import { getAttribution, PAID_MEDIUMS, STORAGE_KEY, CAPTURED_AT_KEY, ATTRIBUTION_TTL_MS } from "./attribution";

// מבקר ממומן: מי שהגיע מקמפיין בתשלום (גוגל, מטא, טיקטוק, טאבולה) בביקור
// הזה, או שהייחוס השמור שלו מה-30 הימים האחרונים הוא ממומן. הבעלים החליט
// 16/9/26 שמטפלים חינמיים לא מקבלים כלום מתנועה ממומנת: הם לא מוצגים
// ברשימות ולא נכנסים כגיבוי לתוצאות השאלון. רק מי שהגיע בעצמו (אורגני,
// ישיר) רואה גם אותם. הרקע: בשבוע שלפני ההחלטה 9 מתוך 29 הפניות שהגיעו
// מהמודעות נחתו אצל חינמיים, כמעט כולן דרך כרטיס בעמוד אזור.
//
// איך זה עובד בלי להפוך עמודי SEO סטטיים (revalidate) לדינמיים: כל כרטיס
// נושא data-tier="free" או "promoted"; סקריפט קצר בראש ה-body, לפני הציור
// הראשון, מסמן <html class="mnt-paid"> לפי פרמטרי ה-URL או הייחוס השמור;
// ו-CSS ב-globals.css מסתיר את החינמיים. ה-HTML זהה לכולם - גוגל, גולש
// אורגני ומי שאין לו ייחוס רואים את העמוד המלא. אין הבהוב: ההחלטה נופלת
// לפני שהעמוד מצויר, לא אחרי ההידרציה.
//
// שני מקומות לא עוברים דרך ה-CSS: /lp (עמוד נחיתה ממומן מטבעו) מסנן בשרת,
// ו-/api/match מקבל paidVisitor מהלקוח ולא מפעיל את הגיבוי החינמי.

export const PAID_VISITOR_CLASS = "mnt-paid";

/** האם מגע ייחוס (ערוץ + מדיום) הוא ממומן. טהור - נבדק ביחידה. */
export function isPaidTouch(
  a: { channel?: string | null; utm_medium?: string | null } | null | undefined,
): boolean {
  if (!a) return false;
  if (typeof a.channel === "string" && a.channel.endsWith("_paid")) return true;
  const med = (a.utm_medium ?? "").trim().toLowerCase();
  return med.length > 0 && PAID_MEDIUMS.has(med);
}

/** בדפדפן בלבד: האם המבקר הנוכחי ממומן. בשרת תמיד false. */
export function isPaidVisitor(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.classList.contains(PAID_VISITOR_CLASS)) return true;
  return isPaidTouch(getAttribution());
}

/**
 * סקציה שכל הכרטיסים בה חינמיים מקבלת data-paid-hide, כדי שגם הכותרת
 * והפסקה שלה ייעלמו למבקר ממומן ולא יישארו מעל רשת ריקה.
 */
export function paidHideAttr(rows: ReadonlyArray<{ free?: boolean }>): { "data-paid-hide"?: "" } {
  return rows.length > 0 && rows.every((r) => r.free === true) ? { "data-paid-hide": "" } : {};
}

/**
 * הסקריפט שרץ ראשון ב-body. משכפל בכוונה רק את השאלה "ממומן או לא" מתוך
 * deriveChannel שב-attribution.ts (מזהי קליק של גוגל וטאבולה, מדיום ממומן,
 * מקור טאבולה), ואחר כך את הייחוס השמור עם אותו TTL. אין לו תלות במודולים
 * כי הוא חייב לרוץ לפני כל קוד של Next.
 */
export function paidVisitorBootScript(): string {
  const mediums = JSON.stringify([...PAID_MEDIUMS]);
  return (
    "(function(){try{" +
    `var P=${mediums};` +
    'var q=new URLSearchParams(location.search);' +
    'var m=(q.get("utm_medium")||"").trim().toLowerCase();' +
    'var s=(q.get("utm_source")||"").trim().toLowerCase();' +
    'var paid=q.has("gclid")||q.has("gbraid")||q.has("wbraid")||q.has("tblci")||P.indexOf(m)>=0||s==="taboola";' +
    `if(!paid){var raw=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});` +
    `if(raw){var a=JSON.parse(raw);var at=Number(a[${JSON.stringify(CAPTURED_AT_KEY)}]);` +
    `if(at&&Date.now()-at<=${ATTRIBUTION_TTL_MS}){var c=String(a.channel||"");var am=String(a.utm_medium||"").trim().toLowerCase();` +
    "paid=/_paid$/.test(c)||P.indexOf(am)>=0;}}}" +
    `if(paid){document.documentElement.classList.add(${JSON.stringify(PAID_VISITOR_CLASS)});}` +
    "}catch(e){}})();"
  );
}
