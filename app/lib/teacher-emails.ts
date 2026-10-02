import "server-only";
import { Resend } from "resend";
import { logEmail } from "./email-log";
import { automatedSendAllowed } from "./automated-email-guard";
import { escapeHtml } from "./ops-email";
import { TEACHER_PRICE_GROSS, TEACHER_TRIAL_DAYS } from "./teacher-options";

// המיילים של ענף המורים. כולם עוברים דרך שער אחד (sendTeacherEmail) שרושם
// ל-crm_email_log, וכל מה שאינו נשלח מלחיצה ידנית של האדמין עובר דרך
// automatedSendAllowed - כלומר נחסם עד שהתבנית תתווסף לרשימת המאושרות
// (החלטת 19/8/2026: אף מייל אוטומטי לנמען חיצוני בלי אישור מפורש).
//
// התבניות שממתינות לאישור הבעלים:
//   teacher_signup_received   - אישור קליטת ההרשמה + הקישור האישי לעריכה
//   teacher_trial_ending      - 14 ו-3 ימים לפני סוף הניסיון (קרון)
//   teacher_trial_expired     - הניסיון נגמר והפרופיל ירד (קרון)
//   teacher_payment_confirmed - אישור הקמת הוראת הקבע
// עד האישור, המסך שאחרי ההרשמה מציג את הקישור האישי, ומייל האישור
// (שנשלח מלחיצה באדמין) מכיל אותו שוב.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";

export type TeacherEmailTemplate =
  | "teacher_signup_received"
  | "teacher_approved"
  | "teacher_rejected"
  | "teacher_trial_ending"
  | "teacher_trial_expired"
  | "teacher_payment_confirmed";

export type TeacherEmailResult = { status: "sent" | "failed" | "blocked"; error?: string };

function card(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7FAF9;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #DDE9E8;border-radius:14px;padding:28px;line-height:1.7;color:#131F1E;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 18px;border-bottom:1px solid #EAF0EE;margin:0 0 20px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#2A6462;font-size:21px;margin:0 0 14px;">${title}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#6B807E;">מענה לימודי של טיפול חכם · mentalytics.co.il · לשאלות, השיבו למייל הזה.</p>
    </div>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:18px 0;"><a href="${href}" style="display:inline-block;background:#3D8C8A;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:50px;">${label}</a></p>`;
}

function hebDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function teacherEditUrl(token: string): string {
  return `${SITE_URL}/learning/edit/${encodeURIComponent(token)}`;
}
export function teacherPayUrl(token: string): string {
  return `${SITE_URL}/learning/pay/${encodeURIComponent(token)}`;
}

async function sendTeacherEmail(opts: {
  to: string;
  teacherId: string;
  template: TeacherEmailTemplate;
  subject: string;
  html: string;
  /** לחיצה ידנית של האדמין - לא עוברת דרך שער האוטומציה (כמו מיילי האדמין למטפלים). */
  manual?: boolean;
}): Promise<TeacherEmailResult> {
  if (!opts.manual) {
    const gate = automatedSendAllowed(opts.to, opts.template);
    if (!gate.allowed) {
      void logEmail({
        recipient: opts.to,
        recipientType: "other",
        entityId: opts.teacherId,
        subject: opts.subject,
        template: opts.template,
        sentBy: "system",
        status: "failed",
        error: `blocked: ${gate.reason}`,
      });
      return { status: "blocked", error: gate.reason };
    }
  }
  if (!process.env.RESEND_API_KEY) return { status: "failed", error: "RESEND_API_KEY unset" };
  let status: "sent" | "failed" = "sent";
  let error = "";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendErr } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    if (sendErr) {
      status = "failed";
      error = sendErr.message;
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }
  void logEmail({
    recipient: opts.to,
    recipientType: "other",
    entityId: opts.teacherId,
    subject: opts.subject,
    template: opts.template,
    sentBy: opts.manual ? "admin" : "system",
    status,
    error: error || undefined,
  });
  return { status, error: error || undefined };
}

export async function sendTeacherSignupReceivedEmail(t: { id: string; email: string; full_name: string; edit_token: string }) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `תודה, ${name} - ההרשמה נקלטה`,
    `<p>קיבלנו את הפרטים שלך למענה הלימודי של טיפול חכם. בימים הקרובים נאמת את ההכשרה המוצהרת מול התעודה שצירפת, ונעדכן אותך במייל כשהפרופיל יאושר.</p>
     <p>זה הקישור האישי שלך לעדכון הפרופיל ולצפייה בנתונים. שמרו אותו - הוא מחליף סיסמה:</p>
     ${button(teacherEditUrl(t.edit_token), "לפרופיל שלי")}
     <p style="font-size:13px;color:#3E5250;">אחרי האישור: ${TEACHER_TRIAL_DAYS} ימי ניסיון ללא תשלום וללא כרטיס אשראי. בסיומם, המשך ההופעה במאגר הוא ${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות.</p>`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_signup_received", subject: "ההרשמה למענה הלימודי נקלטה | טיפול חכם", html });
}

export async function sendTeacherApprovedEmail(t: { id: string; email: string; full_name: string; edit_token: string; trial_ends_at: string }) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `${name}, הפרופיל שלך אושר`,
    `<p>אימתנו את ההכשרה, והפרופיל שלך מופיע מעכשיו להורים שהשאלון של טיפול חכם זיהה אצל ילדם קושי לימודי שמתאים לתחומים שבחרת.</p>
     <div style="background:#EAF4F3;border:1px solid #C2DFDE;border-radius:12px;padding:14px 18px;margin:16px 0;">
       <p style="margin:0 0 6px;font-weight:bold;color:#2A6462;">תקופת הניסיון</p>
       <p style="margin:0;">עד <strong>${hebDate(t.trial_ends_at)}</strong> - ללא תשלום וללא כרטיס אשראי. בסיומה, מי שרוצה להישאר במאגר משלם/ת ${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות וביטול בכל עת. אפשר להסדיר את התשלום כבר עכשיו, והחיוב הראשון ייצא רק בסוף הניסיון.</p>
     </div>
     ${button(teacherEditUrl(t.edit_token), "לפרופיל ולנתונים שלי")}
     <p style="font-size:13px;color:#3E5250;">ההורים פונים ישירות אליך בוואטסאפ או בטלפון. מומלץ להשיב בתוך שעות ספורות - פנייה שנענית מאוחר נתפסת כפנייה שלא נענתה.</p>`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_approved", subject: "הפרופיל שלך במענה הלימודי אושר | טיפול חכם", html, manual: true });
}

export async function sendTeacherRejectedEmail(t: { id: string; email: string; full_name: string }, reason: string | null) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `${name}, לגבי ההרשמה למענה הלימודי`,
    `<p>תודה שנרשמת. בשלב זה לא נוכל לכלול את הפרופיל במאגר.${reason ? ` הסיבה: ${escapeHtml(reason)}.` : ""}</p>
     <p>אם יש בידך תעודה או אישור הכשרה שלא צורפו, אפשר להשיב למייל הזה ונבחן שוב.</p>`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_rejected", subject: "לגבי ההרשמה למענה הלימודי | טיפול חכם", html, manual: true });
}

export async function sendTeacherTrialEndingEmail(t: { id: string; email: string; full_name: string; edit_token: string; trial_ends_at: string }, stats: { impressions: number; contacts: number }) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `${name}, תקופת הניסיון מסתיימת ב-${hebDate(t.trial_ends_at)}`,
    `<p>במהלך הניסיון הפרופיל שלך הופיע ${stats.impressions} פעמים להורים, ו-${stats.contacts} מהם לחצו כדי ליצור איתך קשר.</p>
     <p>כדי להמשיך להופיע במאגר אחרי ${hebDate(t.trial_ends_at)}: ${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות, ביטול בכל עת. בלי הסדרת תשלום הפרופיל יורד מהמאגר באותו יום, והנתונים נשמרים.</p>
     ${button(teacherPayUrl(t.edit_token), "להמשך ההופעה במאגר")}`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_trial_ending", subject: "תקופת הניסיון במענה הלימודי מסתיימת | טיפול חכם", html });
}

export async function sendTeacherTrialExpiredEmail(t: { id: string; email: string; full_name: string; edit_token: string }) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `${name}, תקופת הניסיון הסתיימה`,
    `<p>הפרופיל שלך ירד מהמאגר בסיום תקופת הניסיון. אפשר להחזיר אותו בכל רגע - ${TEACHER_PRICE_GROSS} ש"ח לחודש כולל מע"מ, ללא התחייבות:</p>
     ${button(teacherPayUrl(t.edit_token), "להחזרת הפרופיל למאגר")}`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_trial_expired", subject: "תקופת הניסיון במענה הלימודי הסתיימה | טיפול חכם", html });
}

export async function sendTeacherPaymentConfirmedEmail(t: { id: string; email: string; full_name: string; edit_token: string }, firstChargeOn: string) {
  const name = escapeHtml(t.full_name);
  const html = card(
    `${name}, התשלום הוסדר`,
    `<p>הוראת הקבע נפתחה. החיוב הראשון: <strong>${hebDate(firstChargeOn)}</strong>, ${TEACHER_PRICE_GROSS} ש"ח כולל מע"מ לחודש. חשבונית נשלחת אוטומטית בכל חיוב. ביטול בכל עת בהודעה למייל הזה.</p>
     ${button(teacherEditUrl(t.edit_token), "לפרופיל ולנתונים שלי")}`,
  );
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_payment_confirmed", subject: "התשלום למענה הלימודי הוסדר | טיפול חכם", html });
}
