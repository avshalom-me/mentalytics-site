import "server-only";
import { Resend } from "resend";
import { logEmail, type EmailLogEntry } from "./email-log";

// שליחת מייל פנייה מהאתר (למטפל/ת, למרכז, לטופס "צור קשר") עם רישום התוצאה.
//
// עד 15/9/26 שלושת נתיבי הפניות קראו ל-resend.emails.send בלי לבדוק את
// התשובה ובלי לרשום ליומן. ה-SDK לא זורק על דחיית API - הוא מחזיר { error } -
// ולכן דחייה הייתה שקופה: הפונה ראה "נשלח", ה-CRM רשם ליד, ואיש לא ידע שהמייל
// לא יצא. המקרה שחשף את זה: פנייה לאחד המרכזים מ-14/9 שהמרכז דיווח שלא קיבל,
// ומהצד שלנו לא היה שום רישום שיגיד אם יצאה בכלל ולאן.
//
// כל שליחה נרשמת ב-crm_email_log (template = patient_inquiry / center_inquiry /
// contact_form) עם status sent או failed, וכישלון חוזר לקורא כדי שיגיד לפונה
// את האמת. דוח הבוקר (daily-digest) מצליב את היומן מול crm_leads.

const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const resend = new Resend(process.env.RESEND_API_KEY);

export type InquiryEmailTemplate = "patient_inquiry" | "center_inquiry" | "contact_form";

export type InquirySendResult = { ok: true; id: string | null } | { ok: false; error: string };

/** מה הפונה רואה כשהמייל לא יצא. */
export const INQUIRY_SEND_FAILED_MESSAGE =
  "ההודעה לא נשלחה בגלל תקלה זמנית. אפשר לנסות שוב בעוד רגע, או ליצור קשר בטלפון או בוואטסאפ.";

export async function sendInquiryEmail(
  mail: { to: string; replyTo?: string; subject: string; html: string },
  record: {
    template: InquiryEmailTemplate;
    recipientType: NonNullable<EmailLogEntry["recipientType"]>;
    entityId?: string | null;
  },
): Promise<InquirySendResult> {
  // הרישום הוא fire-and-forget: לעולם לא מעכב ולא מפיל את השליחה.
  const log = (status: "sent" | "failed", error?: string) => {
    void logEmail({
      recipient: mail.to,
      recipientType: record.recipientType,
      entityId: record.entityId ?? null,
      subject: mail.subject,
      template: record.template,
      sentBy: "system",
      status,
      error,
    });
  };
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    if (error) {
      const msg = String((error as { message?: string }).message ?? error);
      console.error(`${record.template}: resend rejected mail to ${mail.to}: ${msg}`);
      log("failed", msg);
      return { ok: false, error: msg };
    }
    console.info(`${record.template}: sent to ${mail.to} (resend ${data?.id ?? "?"})`);
    log("sent");
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error(`${record.template}: send threw for ${mail.to}: ${msg}`);
    log("failed", msg);
    return { ok: false, error: msg };
  }
}
