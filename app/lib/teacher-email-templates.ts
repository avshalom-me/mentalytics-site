// הנוסח של מיילי ענף המורים - טהור (בלי שליחה, בלי מסד), כדי שאפשר יהיה
// לבדוק אותו ולהציג אותו בתצוגה מקדימה באדמין בדיוק כפי שהוא נשלח.
//
// מה הבעלים אישר ב-2/10/2026:
//   • המורים לא משלמים כלום בהתחלה ולא מתבקשים לשלם.
//   • ביום ה-85 - מייל להרשמה (trialEnding), בסגנון התזכורת האחרונה לנרשמים
//     ("מייל שיווקי טוב כמו שעשינו"): עובדות, מה מקבלים, כפתור אחד.
//   • ביום האחרון - מייל נוסף (trialLastDay), ולמחרת ארכיון.
//
// שני המיילים מבטיחים דברים שנאכפים בקוד (app/lib/teacher-trial.ts):
//   1. "ביום האחרון נשלח תזכורת אחת נוספת, ואחריה לא יישלחו הודעות נוספות" -
//      יש בדיוק שתי תבניות, וכל אחת נחתמת פעם אחת.
//   2. "הפרופיל יעבור לארכיון... אפשר להפעיל אותו מחדש מאותו קישור" - הארכיון
//      הפיך, והרשמה לתשלום מחזירה את הפרופיל למאגר.
// לכן אין לשנות כאן ניסוח בלי לשנות את ההתנהגות, ולהפך.
//
// הטון: עובדתי. בלי סופרלטיבים ובלי לשון שכנוע; המספרים של המורה עצמו/ה
// (כשיש כאלה) הם הטיעון. בלי מקף ארוך.

import { TEACHER_PRICE_GROSS, TEACHER_TRIAL_DAYS, teacherLinkUrl } from "./teacher-options";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** תאריך בעברית, לפי השעון בישראל (השרת רץ ב-UTC). */
export function hebDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" });
}

const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;color:#1a4a5c;">${html}</p>`;
const small = (html: string) => `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;text-align:center;">${html}</p>`;
const cta = (href: string, label: string) =>
  `<div style="text-align:center;margin:6px 0 20px;">
        <a href="${href}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:50px;">${label}</a>
      </div>`;

/** אותה מעטפת של שאר המיילים באתר: לוגו, כרטיס, חתימה ופרטי קשר. */
function shell(greeting: string, bodyHtml: string): string {
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:21px;margin:0 0 16px;">${greeting}</h1>
      ${bodyHtml}
      ${p("צוות טיפול חכם")}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;
}

const hello = (name: string) => (name.trim() ? `שלום ${esc(name.trim())},` : "שלום,");

export type EmailTeacher = { full_name: string; edit_token: string };
export type TrialStats = { impressions: number; contacts: number };

// ── המייל של יום 85 ──────────────────────────────────────────────────────────

export function trialEndingSubject(trialEndsAt: string): string {
  return `תקופת הניסיון שלך במענה הלימודי מסתיימת ב-${hebDate(trialEndsAt)}`;
}

/** שורת המספרים. בלי פניות - רק הופעות; בלי הופעות - השורה לא מופיעה בכלל. */
function statsLine(stats: TrialStats): string {
  const times = stats.impressions === 1 ? "פעם אחת" : `${stats.impressions} פעמים`;
  if (stats.contacts > 0) {
    const clicked = stats.contacts === 1 ? "הורה אחד לחץ" : `${stats.contacts} הורים לחצו`;
    const and = stats.contacts === 1 ? "ו" : "ו-";
    return stats.impressions > 0
      ? p(`עד היום הוא הוצג ${times} להורים, ${and}${clicked} כדי ליצור איתך קשר, בוואטסאפ או בטלפון.`)
      : p(`עד היום ${clicked} כדי ליצור איתך קשר, בוואטסאפ או בטלפון.`);
  }
  if (stats.impressions > 0) {
    return p(`עד היום הוא הוצג ${times} להורים שחיפשו מורה בתחומים ובאזור שלך.`);
  }
  return "";
}

export function trialEndingHtml(t: EmailTeacher & { trial_ends_at: string }, stats: TrialStats): string {
  const date = hebDate(t.trial_ends_at);
  return shell(
    hello(t.full_name),
    // בלי "לפני שלושה חודשים": אותו מייל יוצא גם אחרי הארכת ניסיון או חזרה
    // מהארכיון, ושם המשפט הזה פשוט לא נכון.
    `${p(`הפרופיל שלך במענה הלימודי של טיפול חכם מוצג להורים מאז שאושר, בלי תשלום. תקופת הניסיון מסתיימת ב-<strong>${date}</strong>.`)}
      ${statsLine(stats)}
      ${p("ההורים שמגיעים אליך דרכנו מילאו קודם שאלון מקיף על ילדם, והשאלון זיהה קושי לימודי ממוקד בתחום שאת/ה מלמד/ת. כשהורה פונה, כבר ברור מה הקושי, באיזו כיתה ובאיזה אזור.")}
      ${p(`כדי להמשיך להופיע במאגר אחרי ${date}:`)}
      <ul style="margin:0 0 16px;padding:0 20px 0 0;font-size:15px;color:#1a4a5c;">
        <li style="margin:0 0 8px;"><strong>${TEACHER_PRICE_GROSS} ש"ח לחודש, כולל מע"מ.</strong> חשבונית נשלחת במייל בכל חיוב.</li>
        <li style="margin:0 0 8px;"><strong>ללא התחייבות.</strong> ביטול בכל עת, בהודעת מייל.</li>
        <li style="margin:0;"><strong>החיוב הראשון ב-${date}</strong>, בסוף תקופת הניסיון. עד אז לא נגבה דבר.</li>
      </ul>
      ${cta(teacherLinkUrl(t.edit_token, "pay"), "להמשך ההופעה במאגר ←")}
      ${small("הקישור אישי ומוביל ישירות לעמוד ההרשמה. פרטי הכרטיס נשמרים אצל ספק הסליקה ולא עוברים דרכנו.")}
      ${p(`אם ההרשמה לא תושלם עד ${date}, הפרופיל יעבור לארכיון ולא יוצג להורים. שום דבר לא נמחק: אפשר להפעיל אותו מחדש בכל עת, מאותו קישור.`)}
      ${p("<strong>ביום האחרון נשלח תזכורת אחת נוספת, ואחריה לא יישלחו הודעות נוספות בנושא.</strong>")}`,
  );
}

// ── המייל של היום האחרון ─────────────────────────────────────────────────────

export const TRIAL_LAST_DAY_SUBJECT = "היום האחרון של תקופת הניסיון במענה הלימודי";

export function trialLastDayHtml(t: EmailTeacher): string {
  return shell(
    hello(t.full_name),
    `${p("היום מסתיימת תקופת הניסיון שלך במענה הלימודי של טיפול חכם.")}
      ${p(`כדי להמשיך להופיע להורים: <strong>${TEACHER_PRICE_GROSS} ש"ח לחודש, כולל מע"מ</strong>. ללא התחייבות, ביטול בכל עת בהודעת מייל.`)}
      ${cta(teacherLinkUrl(t.edit_token, "pay"), "להמשך ההופעה במאגר ←")}
      ${p("אם ההרשמה לא תושלם היום, הפרופיל יעבור מחר לארכיון ולא יוצג להורים. הפרטים נשמרים, ואפשר להפעיל אותו מחדש בכל עת, מאותו קישור.")}
      ${p("<strong>זו ההודעה האחרונה מאיתנו בנושא.</strong>")}`,
  );
}

// ── מיילים שהם תגובה לפעולה של המורה ─────────────────────────────────────────

export const SIGNUP_RECEIVED_SUBJECT = "ההרשמה למענה הלימודי נקלטה | טיפול חכם";
export function signupReceivedHtml(t: EmailTeacher): string {
  return shell(
    hello(t.full_name),
    `${p("קיבלנו את הפרטים שלך למענה הלימודי של טיפול חכם. בימים הקרובים נאמת את ההכשרה מול התעודה שצירפת, ונעדכן במייל כשהפרופיל יאושר ויתחיל להופיע להורים.")}
      ${p("זה הקישור האישי שלך לעדכון הפרופיל ולצפייה בנתונים. הוא מחליף סיסמה, ולכן כדאי לשמור את המייל הזה:")}
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל שלי ←")}
      ${p(`מרגע האישור: ${TEACHER_TRIAL_DAYS} יום ללא תשלום וללא כרטיס אשראי. לקראת סוף התקופה נשלח מייל עם אפשרות להמשיך ב-${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות.`)}`,
  );
}

export const PERSONAL_LINK_SUBJECT = "הקישור האישי שלך למענה הלימודי | טיפול חכם";
export function personalLinkHtml(t: EmailTeacher): string {
  return shell(
    hello(t.full_name),
    `${p("ביקשת את הקישור האישי לפרופיל שלך במענה הלימודי של טיפול חכם:")}
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל שלי ←")}
      ${small("אם לא ביקשת את הקישור, אפשר להתעלם מהמייל הזה.")}`,
  );
}

export const APPROVED_SUBJECT = "הפרופיל שלך במענה הלימודי אושר | טיפול חכם";
export function approvedHtml(t: EmailTeacher & { trial_ends_at: string }): string {
  return shell(
    hello(t.full_name),
    `${p("אימתנו את ההכשרה, והפרופיל שלך מוצג מעכשיו להורים שהשאלון של טיפול חכם זיהה אצל ילדם קושי לימודי בתחומים שבחרת.")}
      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0 0 6px;font-weight:bold;color:#0F5468;">תקופת הניסיון</p>
        <p style="margin:0;font-size:15px;">עד <strong>${hebDate(t.trial_ends_at)}</strong>, ללא תשלום וללא כרטיס אשראי. לקראת סוף התקופה נשלח מייל עם אפשרות להמשיך ב-${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות.</p>
      </div>
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל ולנתונים שלי ←")}
      ${p("ההורים פונים ישירות אליך, בוואטסאפ או בטלפון. כדאי להשיב בתוך שעות ספורות: הורה שפנה ולא נענה ממשיך בדרך כלל למורה הבא.")}`,
  );
}

export const REJECTED_SUBJECT = "לגבי ההרשמה למענה הלימודי | טיפול חכם";
export function rejectedHtml(t: { full_name: string }, reason: string | null): string {
  return shell(
    hello(t.full_name),
    `${p(`תודה שנרשמת למענה הלימודי. בשלב זה לא נוכל לכלול את הפרופיל במאגר.${reason ? ` הסיבה: ${esc(reason.replace(/[.\s]+$/, ""))}.` : ""}`)}
      ${p("אם יש בידך תעודה או אישור הכשרה שלא צורפו, אפשר להשיב למייל הזה ונבחן שוב.")}`,
  );
}

export const PAYMENT_CONFIRMED_SUBJECT = "ההרשמה למענה הלימודי הושלמה | טיפול חכם";
/** firstChargeOn: YYYY-MM-DD. */
export function paymentConfirmedHtml(t: EmailTeacher, firstChargeOn: string): string {
  return shell(
    hello(t.full_name),
    `${p(`ההרשמה הושלמה והוראת הקבע נפתחה. החיוב הראשון: <strong>${hebDate(`${firstChargeOn}T12:00:00Z`)}</strong>, ${TEACHER_PRICE_GROSS} ש"ח כולל מע"מ, וכך בכל חודש. חשבונית נשלחת במייל בכל חיוב.`)}
      ${p("ביטול בכל עת, בהודעת מייל ל-admin@getmentalytics.com.")}
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל ולנתונים שלי ←")}`,
  );
}

// ── תצוגה מקדימה באדמין ──────────────────────────────────────────────────────

export const TEACHER_EMAIL_PREVIEWS = [
  { key: "trial_ending", label: "יום 85 - המייל להרשמה" },
  { key: "trial_ending_no_contacts", label: "יום 85 - למורה בלי פניות" },
  { key: "trial_last_day", label: "היום האחרון" },
  { key: "signup_received", label: "קליטת ההרשמה" },
  { key: "approved", label: "אישור הפרופיל (נשלח מהאדמין)" },
  { key: "payment_confirmed", label: "אישור ההרשמה לתשלום" },
  { key: "personal_link", label: "שליחת הקישור האישי" },
] as const;

/** המייל כפי שהוא נשלח, עם מורה לדוגמה. null = מפתח לא מוכר. */
export function teacherEmailPreview(key: string, trialEndsAt: string): { subject: string; html: string } | null {
  const t = { full_name: "דנה לוי", edit_token: "PREVIEW-TOKEN", trial_ends_at: trialEndsAt };
  switch (key) {
    case "trial_ending":
      return { subject: trialEndingSubject(trialEndsAt), html: trialEndingHtml(t, { impressions: 46, contacts: 7 }) };
    case "trial_ending_no_contacts":
      return { subject: trialEndingSubject(trialEndsAt), html: trialEndingHtml(t, { impressions: 0, contacts: 0 }) };
    case "trial_last_day":
      return { subject: TRIAL_LAST_DAY_SUBJECT, html: trialLastDayHtml(t) };
    case "signup_received":
      return { subject: SIGNUP_RECEIVED_SUBJECT, html: signupReceivedHtml(t) };
    case "approved":
      return { subject: APPROVED_SUBJECT, html: approvedHtml(t) };
    case "payment_confirmed":
      return { subject: PAYMENT_CONFIRMED_SUBJECT, html: paymentConfirmedHtml(t, trialEndsAt.slice(0, 10)) };
    case "personal_link":
      return { subject: PERSONAL_LINK_SUBJECT, html: personalLinkHtml(t) };
    default:
      return null;
  }
}
