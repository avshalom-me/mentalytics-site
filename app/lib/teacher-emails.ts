import "server-only";
import { Resend } from "resend";
import { logEmail } from "./email-log";
import { automatedSendAllowed } from "./automated-email-guard";
import {
  trialEndingSubject, trialEndingHtml, TRIAL_LAST_DAY_SUBJECT, trialLastDayHtml,
  SIGNUP_RECEIVED_SUBJECT, signupReceivedHtml, PERSONAL_LINK_SUBJECT, personalLinkHtml,
  APPROVED_SUBJECT, approvedHtml, REJECTED_SUBJECT, rejectedHtml,
  PAYMENT_CONFIRMED_SUBJECT, paymentConfirmedHtml, type TrialStats,
} from "./teacher-email-templates";

// השליחה של מיילי ענף המורים. הנוסח עצמו ב-teacher-email-templates.ts.
//
// כל מייל עובר דרך שער אחד (sendTeacherEmail) שרושם ל-crm_email_log. מה
// שאינו נשלח מלחיצה ידנית של האדמין עובר דרך automatedSendAllowed עם תבנית
// שאושרה (app/lib/automated-email-guard.ts):
//   teacher_trial_ending / teacher_trial_last_day - שני המיילים של הקרון.
//   teacher_signup_received / teacher_personal_link / teacher_payment_confirmed -
//     תגובה לפעולה של המורה עצמו/ה.
// teacher_approved ו-teacher_rejected נשלחים רק מלחיצה באדמין.

const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const REPLY_TO = "admin@getmentalytics.com";

export type TeacherEmailTemplate =
  | "teacher_signup_received"
  | "teacher_personal_link"
  | "teacher_approved"
  | "teacher_rejected"
  | "teacher_trial_ending"
  | "teacher_trial_last_day"
  | "teacher_payment_confirmed";

export type TeacherEmailResult = { status: "sent" | "failed" | "blocked"; error?: string };

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
    if (!gate.allowed) return { status: "blocked", error: gate.reason };
  }
  if (!process.env.RESEND_API_KEY) return { status: "failed", error: "RESEND_API_KEY unset" };
  let status: "sent" | "failed" = "sent";
  let error = "";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendErr } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, replyTo: REPLY_TO });
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

type Addressee = { id: string; email: string; full_name: string; edit_token: string };

export function sendTeacherSignupReceivedEmail(t: Addressee) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_signup_received", subject: SIGNUP_RECEIVED_SUBJECT, html: signupReceivedHtml(t) });
}

export function sendTeacherPersonalLinkEmail(t: Addressee) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_personal_link", subject: PERSONAL_LINK_SUBJECT, html: personalLinkHtml(t) });
}

export function sendTeacherApprovedEmail(t: Addressee & { trial_ends_at: string }) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_approved", subject: APPROVED_SUBJECT, html: approvedHtml(t), manual: true });
}

export function sendTeacherRejectedEmail(t: Addressee, reason: string | null) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_rejected", subject: REJECTED_SUBJECT, html: rejectedHtml(t, reason), manual: true });
}

export function sendTeacherTrialEndingEmail(t: Addressee & { trial_ends_at: string }, stats: TrialStats) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_trial_ending", subject: trialEndingSubject(t.trial_ends_at), html: trialEndingHtml(t, stats) });
}

export function sendTeacherTrialLastDayEmail(t: Addressee) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_trial_last_day", subject: TRIAL_LAST_DAY_SUBJECT, html: trialLastDayHtml(t) });
}

export function sendTeacherPaymentConfirmedEmail(t: Addressee, firstChargeOn: string) {
  return sendTeacherEmail({ to: t.email, teacherId: t.id, template: "teacher_payment_confirmed", subject: PAYMENT_CONFIRMED_SUBJECT, html: paymentConfirmedHtml(t, firstChargeOn) });
}
