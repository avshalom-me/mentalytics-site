import "server-only";
import { Resend } from "resend";
import { alertRecipients } from "./alert-recipients";
import { logEmail } from "./email-log";

// מייל תפעולי לצוות - נקודת שליחה אחת לכל הסוכנים (דוח בוקר, התראות שומר
// הלילה, וכל סוכן עתידי): from אחיד, נמענים מ-alertRecipients, רישום
// ל-crm_email_log, וסטטוס אחיד גם כשהמפתח חסר. מחליף שני העתקים שנטו
// להיסחף זה מזה (ממצא ביקורת 16/8).

export const OPS_FROM = "טיפול חכם <noreply@mentalytics.co.il>";

// הברחת HTML לערכים שמוזרקים לתבניות מייל. קיימת בעוד מודולים ותיקים -
// זה הבית המשותף; אימוץ הדרגתי.
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type OpsEmailResult = {
  status: "sent" | "failed" | "skipped";
  error?: string;
  recipients: string[];
};

export async function sendOpsEmail(opts: {
  subject: string;
  html: string;
  template: string;
}): Promise<OpsEmailResult> {
  const recipients = alertRecipients();
  if (!process.env.RESEND_API_KEY) {
    return { status: "failed", error: "RESEND_API_KEY unset", recipients };
  }
  let status: "sent" | "failed" = "sent";
  let error = "";
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendErr } = await resend.emails.send({
      from: OPS_FROM,
      to: recipients,
      subject: opts.subject,
      html: opts.html,
    });
    if (sendErr) {
      status = "failed";
      error = sendErr.message;
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }
  void logEmail({
    recipient: recipients.join(","),
    recipientType: "other",
    subject: opts.subject,
    template: opts.template,
    sentBy: "cron",
    status,
    error: error || undefined,
  });
  return { status, error: error || undefined, recipients };
}
