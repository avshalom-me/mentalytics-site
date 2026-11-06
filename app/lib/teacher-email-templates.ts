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

// מ-13/10/2026 המאגר חינם (TEACHER_FREE_LISTING, החלטת הבעלים): שני מיילי
// הניסיון ומייל אישור התשלום אינם נשלחים, ומיילי הקליטה והאישור אינם מזכירים
// תקופת ניסיון או מחיר. הנוסח של מצב הגבייה נשאר כאן, כבוי, יחד עם המנגנון.
// באותו יום הוחלט שתעודה נדרשת ונבדקת רק אצל מורים להוראה מתקנת ולחינוך
// מיוחד, ולכן "נבדוק את התעודה" ו"בדקנו את התעודה" נאמרים רק להם.

import { TEACHER_FREE_LISTING, TEACHER_PRICE_GROSS, TEACHER_TRIAL_DAYS, qualificationLabel, teacherLinkUrl } from "./teacher-options";
import { teacherJoinUrl } from "./teacher-recruitment";

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

/**
 * אותה מעטפת של שאר המיילים באתר: לוגו, כרטיס, חתימה ופרטי קשר. מ-6/11/2026
 * (החלטת הבעלים) הלוגו הוא של "לימוד חכם" והחתימה "צוות לימוד חכם"; שם המוצר
 * בגוף המיילים ("המענה הלימודי") והסיומת "| טיפול חכם" בנושא לא שונו (3/10/2026).
 */
export const TEACHER_EMAIL_SIGNATURE = "צוות לימוד חכם";
/** מתחת לכפתור בכל מייל עם הקישור האישי: הוא מחליף סיסמה (פאנל 6/11/2026, ארבע רגליים). */
const LINK_NOTE = small("הקישור אישי ומחליף סיסמה: כדאי לשמור את המייל, ולא להעביר אותו הלאה.");
function shell(greeting: string, bodyHtml: string, withLinkNote = true): string {
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/limud-chacham-logo.png" width="150" alt="לימוד חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:21px;margin:0 0 16px;">${greeting}</h1>
      ${bodyHtml}
      ${withLinkNote ? LINK_NOTE : ""}
      ${p(TEACHER_EMAIL_SIGNATURE)}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        לימוד חכם, מבית טיפול חכם (Mentalytics)
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

export const SIGNUP_RECEIVED_SUBJECT = "ההרשמה למאגר המורים נקלטה | לימוד חכם";
/** needs_certificate: ההכשרה המוצהרת מחייבת תעודה (qualificationNeedsCertificate). */
export function signupReceivedHtml(t: EmailTeacher & { needs_certificate?: boolean }): string {
  const review = t.needs_certificate
    ? "נבדוק שהתעודה שצירפת תואמת את ההכשרה שסימנת, ונעדכן במייל כשהבדיקה תסתיים. אחרי הבדיקה הפרופיל יקבל את הסימון \"תעודה נבדקה\"."
    : "נבדוק את הפרטים, ונעדכן במייל כשהבדיקה תסתיים.";
  const terms = TEACHER_FREE_LISTING
    ? "ההצטרפות וההופעה במאגר הן כרגע ללא תשלום, ואין צורך בכרטיס אשראי."
    : `מרגע האישור: ${TEACHER_TRIAL_DAYS} יום ללא תשלום וללא כרטיס אשראי. לקראת סוף התקופה נשלח מייל עם אפשרות להמשיך ב-${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות.`;
  return shell(
    hello(t.full_name),
    `${p(`קיבלנו את הפרטים שלך ללימוד חכם, מאגר המורים של טיפול חכם. בימים הקרובים ${review}`)}
      ${p("זה הקישור האישי שלך לעדכון הפרופיל ולמעקב אחרי הצפיות והפניות:")}
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל שלי ←")}
      ${p(terms)}`,
  );
}

export const PERSONAL_LINK_SUBJECT = "הקישור האישי שלך לפרופיל | לימוד חכם";
export function personalLinkHtml(t: EmailTeacher): string {
  return shell(
    hello(t.full_name),
    `${p("ביקשת את הקישור האישי לפרופיל שלך בלימוד חכם:")}
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל שלי ←")}
      ${small("אם לא ביקשת את הקישור, אפשר להתעלם מהמייל הזה, וכדאי לכתוב לנו כדי שנבדוק.")}`,
  );
}

export const APPROVED_SUBJECT = "הפרופיל שלך במאגר אושר | לימוד חכם";
export const APPROVED_CERT_SUBJECT = "התעודה נבדקה והפרופיל שלך אושר | לימוד חכם";
export const approvedSubject = (certificateChecked?: boolean) => (certificateChecked ? APPROVED_CERT_SUBJECT : APPROVED_SUBJECT);
/**
 * trial_ends_at ריק = המאגר חינם, ואין תקופת ניסיון לציין.
 * certificate_checked = ההכשרה מחייבת תעודה והיא נבדקה; רק אז נאמר "בדקנו".
 */
export function approvedHtml(t: EmailTeacher & { trial_ends_at: string | null; certificate_checked?: boolean }): string {
  const opening = t.certificate_checked
    ? "בדקנו את התעודה. הפרופיל שלך נושא עכשיו את הסימון \"תעודה נבדקה\" ומוצג להורים, כולל למי שמחפשים הוראה מתקנת,"
    : "הפרופיל שלך אושר, והוא מוצג מעכשיו להורים שמחפשים מורה";
  // שקיפות: מה ההורים רואים ליד הפרופיל (פאנל 6/11/2026). למורה פרטי/ת גם "לפי הצהרת המורה".
  const shown = t.certificate_checked
    ? "הטלפון והוואטסאפ שציינת מוצגים לכל מי שרואה את הפרופיל, ולהורים נאמר שאיננו בודקים רקע פלילי."
    : "ליד ההכשרה שלך כתוב להורים \"לפי הצהרת המורה\", כי לא ביקשנו תעודה; אם יש לך תעודה בהוראה מתקנת או בחינוך מיוחד, או תואר שני בלקויות למידה, אפשר להוסיף אותה בקישור האישי. הטלפון והוואטסאפ שציינת מוצגים לכל מי שרואה את הפרופיל, ולהורים נאמר שאיננו בודקים רקע פלילי.";
  const box = t.trial_ends_at
    ? `<p style="margin:0 0 6px;font-weight:bold;color:#0F5468;">תקופת הניסיון</p>
        <p style="margin:0;font-size:15px;">עד <strong>${hebDate(t.trial_ends_at)}</strong>, ללא תשלום וללא כרטיס אשראי. לקראת סוף התקופה נשלח מייל עם אפשרות להמשיך ב-${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות.</p>`
    : `<p style="margin:0;font-size:15px;">ההופעה במאגר אינה כרוכה כרגע בתשלום, ואין צורך בכרטיס אשראי.</p>`;
  return shell(
    hello(t.full_name),
    `${p(`${opening} בתחומים ובאזורים שציינת: בתוצאות השאלון לילדים ולנוער של טיפול חכם, ובמאגר המורים של לימוד חכם.`)}
      ${p(shown)}
      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
        ${box}
      </div>
      ${cta(teacherLinkUrl(t.edit_token), "לפרופיל ולנתונים שלי ←")}
      ${p("ההורים פונים ישירות אליך, בוואטסאפ או בטלפון. כדאי להשיב בהקדם, גם בהודעה קצרה על מועד לשיחה.")}`,
  );
}

export const REJECTED_SUBJECT = "לגבי ההרשמה למאגר המורים | לימוד חכם";
export function rejectedHtml(t: { full_name: string }, reason: string | null): string {
  return shell(
    hello(t.full_name),
    `${p(`תודה שנרשמת ללימוד חכם. בשלב זה לא נוכל לכלול את הפרופיל במאגר.${reason ? ` הסיבה: ${esc(reason.replace(/[.\s]+$/, ""))}.` : ""}`)}
      ${p("אם יש בידך תעודה או אישור הכשרה שלא צורפו, אפשר להשיב למייל הזה ונבחן שוב.")}`,
    false,
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

// ── מיילי טיפול בפרופיל (טיוטות שהבעלים שולח מהאדמין) ───────────────────────
// הכללים ב-app/lib/teacher-care.ts (אישור הבעלים 6/11/2026). הטיוטה נשמרת
// כטקסט פשוט (נושא + גוף) כדי שהבעלים יוכל לערוך אותה לפני השליחה; בשליחה
// היא נכנסת לאותה מעטפת של שאר המיילים (plainTextHtml). החתימה "צוות לימוד
// חכם" מגיעה מהמעטפת, ולכן הגוף לא נחתם.

export type CareDraftKind = "certificate_request" | "photo_request" | "profile_completion" | "founding_note";

/** שם התבנית ביומן המיילים (crm_email_log) לכל סוג טיוטה. */
export const CARE_TEMPLATES: Record<CareDraftKind, string> = {
  certificate_request: "teacher_certificate_request",
  photo_request: "teacher_photo_request",
  profile_completion: "teacher_profile_completion",
  founding_note: "teacher_founding_note",
};

/**
 * הקישור לדף ההצטרפות שהמייל למורים הראשונים מבקש להעביר לעמיתים: הקישור
 * של הערוץ "חבר מביא חבר" בעמוד הגיוס, כדי שההרשמות האלה ייספרו שם.
 */
export const TEACHER_REFERRAL_JOIN_URL = teacherJoinUrl({ key: "referral", kind: "community" }, SITE_URL);

/** מייל חופשי מהאדמין למורה ("שלח הודעה"), כמו admin_message אצל המטפלים. */
export const ADMIN_MESSAGE_TEMPLATE = "teacher_admin_message";

export type CareDraftContext = {
  /** לבקשת תעודה: marked = מסומן/ת הוראה מתקנת בלי תעודה; hinted = הטקסט מספר על הוראה מתקנת. */
  mode?: "marked" | "hinted";
  /** להשלמת פרופיל: הפריטים החסרים, כבר מתורגמים לתווית ולנימוק. */
  missing?: { label: string; why: string }[];
};

/** גוף בקשת התעודה, לשני המצבים. משותף לבקשה עצמה ולמייל למורים הראשונים. */
function certificateBody(mode: "marked" | "hinted", qualification: string | null): string {
  if (mode === "hinted") {
    return `בתיאור הפרופיל ציינת הוראה מתקנת, ואילו ההכשרה שסימנת בהרשמה היא "${qualificationLabel(qualification)}", ולכן הפרופיל מופיע להורים כמורה פרטי/ת.

אם יש לך תעודה בהוראה מתקנת או בחינוך מיוחד, או תואר שני בלקויות למידה, אפשר להוסיף אותה בקישור האישי (בחלק "תעודה ותמונה"), ונבדוק אותה בימים הקרובים. אחרי הבדיקה נעדכן את ההכשרה, והפרופיל יקבל את הסימון "תעודה נבדקה" ויופיע גם להורים שמחפשים הוראה מתקנת.

אם אין ברשותך תעודה כזו כרגע, אין צורך לעשות דבר: הפרופיל נשאר כמו שהוא${qualification === "student" ? ", ונעדכן אותו בסיום הלימודים" : ""}. כדי שהורים לא יטעו, עדיף לכתוב בפרופיל "עבודה בגישת הוראה מתקנת" ולא "מורה להוראה מתקנת".`;
  }
  return `בפרופיל שלך במאגר מסומן "הוראה מתקנת", אבל לא צורפה תעודה.

הסימון מוצג להורים רק אחרי שבדקנו תעודה בהוראה מתקנת או בחינוך מיוחד, או תעודת תואר שני בלקויות למידה (תעודה שנקראת "הוראה מותאמת" או "לקויות למידה" מתאימה גם היא). אפשר להוסיף אותה בקישור האישי, בחלק "תעודה ותמונה", ונבדוק אותה בימים הקרובים.

עד אז הפרופיל מופיע להורים כמורה פרטי/ת, בלי הסימון; מה שכתבת בפרופיל נשאר. אם יש לך הכשרה אחרת בתחום, או אם עדיף לך שהפרופיל לא יוצג עד הבדיקה, אפשר להשיב למייל הזה.`;
}

export function careDraft(kind: CareDraftKind, t: { full_name: string; qualification: string | null }, ctx: CareDraftContext): { subject: string; body: string } {
  switch (kind) {
    case "certificate_request":
      return {
        subject: ctx.mode === "hinted" ? "ההכשרה בפרופיל שלך: אפשר להוסיף תעודה | לימוד חכם" : "התעודה להוראה מתקנת חסרה בפרופיל שלך | לימוד חכם",
        body: certificateBody(ctx.mode === "hinted" ? "hinted" : "marked", t.qualification),
      };
    case "photo_request":
      return {
        subject: "תמונה לפרופיל שלך במאגר | לימוד חכם",
        body: `הפרופיל שלך מוצג להורים, אבל בלי תמונה.

הורים נוטים לפנות ביתר ביטחון למורה שהם רואים. תמונת פנים פשוטה, על רקע נקי, מספיקה.

ההוספה מהקישור האישי, בחלק "תעודה ותמונה", בכפתור "הוספת תמונה". אפשר גם להישאר בלי תמונה; הפרופיל נשאר כמו שהוא.`,
      };
    case "profile_completion": {
      const items = (ctx.missing ?? []).map((m) => `• ${m.label}: ${m.why}`).join("\n");
      return {
        subject: "מה עוד כדאי להוסיף לפרופיל שלך | לימוד חכם",
        body: `הפרופיל שלך מוצג להורים. כדי שיהיה להם קל יותר לבחור, כדאי להוסיף:
${items}

ההוספה מהקישור האישי אורכת כמה דקות, והפרופיל מתעדכן אחרי השמירה.`,
      };
    }
    case "founding_note": {
      // מייל אחד למורים הראשונים במאגר (תוכנית השדרוג 6/11/2026, שלב 1: "מייל
      // אישי לארבעת הראשונים"): תודה, מה שעוד חסר (כולל התעודה, אם צריך),
      // בקשה להעביר את דף ההצטרפות לעמיתים, ובקשה למשוב. מחליף אצלם את שאר
      // טיוטות הטיפול, כדי שיקבלו מייל אחד ולא שלושה.
      const parts: string[] = ["הצטרפת למאגר המורים של לימוד חכם בשבועות הראשונים שלו, ורצינו לכתוב לך ולהגיד תודה."];
      if (ctx.mode) parts.push(certificateBody(ctx.mode, t.qualification));
      const missing = ctx.missing ?? [];
      if (missing.length > 0) {
        parts.push(`הורים בוחרים לפי מה שהם רואים בפרופיל. אצלך כדאי להוסיף:
${missing.map((m) => `• ${m.label}: ${m.why}`).join("\n")}

ההוספה מהקישור האישי שבסוף המייל אורכת כמה דקות.`);
      } else if (!ctx.mode) {
        parts.push("הפרופיל שלך מלא: יש בו תמונה, מחיר, תיאור ומוקדי הוראה, וזה מה שהורים בודקים לפני שהם פונים.");
      }
      parts.push(`המאגר עדיין קטן, וכל מורה נוסף מרחיב את מה שהורים מוצאים בו. אם יש לך עמית או עמיתה שמלמדים הוראה מתקנת או שיעורים פרטיים, אפשר לשלוח להם את הקישור לדף ההצטרפות. ההצטרפות כרגע ללא תשלום:
${TEACHER_REFERRAL_JOIN_URL}

כדאי לשלוח רק את הקישור הזה ולא את המייל כולו, כי בסופו נמצא הקישור האישי שלך.`);
      parts.push("ואם משהו בהרשמה או בפרופיל לא היה ברור, או שחסר לך משהו במאגר, אפשר להשיב למייל הזה. אנחנו קוראים כל תשובה.");
      return { subject: "תודה שהצטרפת מהראשונים | לימוד חכם", body: parts.join("\n\n") };
    }
  }
}

/**
 * כתובת https בטקסט הופכת לקישור אמיתי: Outlook לא הופך כתובות לקישורים
 * (REVIEW.md, סעיף 7). מקבל טקסט שכבר עבר esc.
 */
function linkify(escaped: string): string {
  return escaped.replace(/https:\/\/[^\s<]+/g, (url) => {
    const shown = url.replace(/^https:\/\/(www\.)?/, "").replace(/\?.*$/, "");
    return `<a href="${url}" style="color:#0F5468;font-weight:bold;">${shown}</a>`;
  });
}

/**
 * טקסט פשוט (פסקאות מופרדות בשורה ריקה; שורות שמתחילות ב-"• " הן רשימה)
 * בתוך המעטפת הרגילה, עם הקישור האישי בסוף. משמש לטיוטות הטיפול ולהודעה
 * חופשית מהאדמין.
 */
export function plainTextHtml(t: EmailTeacher, bodyText: string, ctaLabel = "לפרופיל שלי ←"): string {
  const blocks = bodyText
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const bullets = lines.filter((l) => l.trim().startsWith("• "));
      if (bullets.length === 0) return p(linkify(esc(block)).replace(/\n/g, "<br/>"));
      const lead = lines.filter((l) => !l.trim().startsWith("• ")).map((l) => linkify(esc(l))).join("<br/>");
      const list = `<ul style="margin:0 0 16px;padding-inline-start:20px;font-size:15px;color:#1a4a5c;">${bullets
        .map((l) => `<li style="margin:0 0 6px;">${linkify(esc(l.trim().slice(2)))}</li>`)
        .join("")}</ul>`;
      return `${lead ? p(lead) : ""}${list}`;
    })
    .join("");
  return shell(hello(t.full_name), `${blocks}${cta(teacherLinkUrl(t.edit_token), ctaLabel)}`);
}

// ── תצוגה מקדימה באדמין ──────────────────────────────────────────────────────

/** billing = מייל של מצב הגבייה; כשהמאגר חינם הוא לא נשלח ולכן גם לא מוצג. */
const ALL_EMAIL_PREVIEWS = [
  { key: "trial_ending", label: "יום 85 - המייל להרשמה", billing: true },
  { key: "trial_ending_no_contacts", label: "יום 85 - למורה בלי פניות", billing: true },
  { key: "trial_last_day", label: "היום האחרון", billing: true },
  { key: "signup_received", label: "קליטת ההרשמה (מורה פרטי/ת, בלי תעודה)", billing: false },
  { key: "signup_received_certificate", label: "קליטת ההרשמה (הוראה מתקנת, עם תעודה)", billing: false },
  { key: "approved", label: "אישור הפרופיל (נשלח מהאדמין; מורה פרטי/ת)", billing: false },
  { key: "approved_certificate", label: "אישור הפרופיל (נשלח מהאדמין; התעודה נבדקה)", billing: false },
  { key: "payment_confirmed", label: "אישור ההרשמה לתשלום", billing: true },
  { key: "personal_link", label: "שליחת הקישור האישי", billing: false },
  { key: "certificate_request", label: "טיפול: הוראה מתקנת בלי תעודה", billing: false },
  { key: "certificate_request_hinted", label: "טיפול: כותב/ת על הוראה מתקנת, רשום/ה כמורה פרטי/ת", billing: false },
  { key: "photo_request", label: "טיפול: בקשת תמונה", billing: false },
  { key: "profile_completion", label: "טיפול: השלמת פרופיל", billing: false },
  { key: "founding_note", label: "טיפול: מייל אחד למורים הראשונים (12 הראשונים שאושרו)", billing: false },
] as const;

/** המיילים שמורים מקבלים כרגע - מה שהאדמין מציג תחת "המיילים שהמורים מקבלים". */
export const TEACHER_EMAIL_PREVIEWS = ALL_EMAIL_PREVIEWS.filter((e) => !TEACHER_FREE_LISTING || !e.billing);

/** המייל כפי שהוא נשלח, עם מורה לדוגמה. null = מפתח לא מוכר. */
export function teacherEmailPreview(key: string, trialEndsAt: string): { subject: string; html: string } | null {
  const t = { full_name: "דנה לוי", edit_token: "PREVIEW-TOKEN", trial_ends_at: trialEndsAt };
  // מה שמייל האישור אומר על התשלום הוא מה שהמורה יקבל היום: בלי תאריך כשהמאגר חינם.
  const approvedEnd = TEACHER_FREE_LISTING ? null : trialEndsAt;
  switch (key) {
    case "trial_ending":
      return { subject: trialEndingSubject(trialEndsAt), html: trialEndingHtml(t, { impressions: 46, contacts: 7 }) };
    case "trial_ending_no_contacts":
      return { subject: trialEndingSubject(trialEndsAt), html: trialEndingHtml(t, { impressions: 0, contacts: 0 }) };
    case "trial_last_day":
      return { subject: TRIAL_LAST_DAY_SUBJECT, html: trialLastDayHtml(t) };
    case "signup_received":
      return { subject: SIGNUP_RECEIVED_SUBJECT, html: signupReceivedHtml(t) };
    case "signup_received_certificate":
      return { subject: SIGNUP_RECEIVED_SUBJECT, html: signupReceivedHtml({ ...t, needs_certificate: true }) };
    case "approved":
      return { subject: APPROVED_SUBJECT, html: approvedHtml({ ...t, trial_ends_at: approvedEnd }) };
    case "approved_certificate":
      return { subject: APPROVED_SUBJECT, html: approvedHtml({ ...t, trial_ends_at: approvedEnd, certificate_checked: true }) };
    case "payment_confirmed":
      return { subject: PAYMENT_CONFIRMED_SUBJECT, html: paymentConfirmedHtml(t, trialEndsAt.slice(0, 10)) };
    case "personal_link":
      return { subject: PERSONAL_LINK_SUBJECT, html: personalLinkHtml(t) };
    case "certificate_request":
    case "certificate_request_hinted":
    case "photo_request":
    case "founding_note": {
      const d = careDraft("founding_note", { full_name: t.full_name, qualification: "subject_degree" }, {
        missing: [
          { label: "תמונת פרופיל", why: "הורים נוטים לפנות ביתר ביטחון למורה שהם רואים" },
          { label: "ניסיון עם קשיים", why: "קשב, דיסלקסיה, התארגנות ועוד: הורה שמסמן קושי כזה רואה קודם מורים שציינו אותו" },
        ],
      });
      return { subject: d.subject, html: plainTextHtml(t, d.body) };
    }
    case "profile_completion": {
      const sample = { full_name: t.full_name, qualification: "student" };
      const d =
        key === "profile_completion"
          ? careDraft("profile_completion", sample, {
              missing: [
                { label: "מחיר לשיעור", why: "הורים משווים מחיר לפני שהם פונים; מספיק לציין טווח" },
                { label: "ניסיון עם קשיים", why: "קשב, דיסלקסיה, התארגנות ועוד: הורה שמסמן קושי כזה רואה קודם מורים שציינו אותו" },
              ],
            })
          : key === "photo_request"
            ? careDraft("photo_request", sample, {})
            : careDraft("certificate_request", sample, { mode: key === "certificate_request_hinted" ? "hinted" : "marked" });
      return { subject: d.subject, html: plainTextHtml(t, d.body) };
    }
    default:
      return null;
  }
}
