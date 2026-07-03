import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// Best-effort record of an outbound email into crm_email_log so the 360°
// timeline can show communication history. Logging must never break the
// email path itself — failures are swallowed after a console.error.

export type EmailLogEntry = {
  recipient: string;
  recipientType?: "therapist" | "lead" | "organization" | "other";
  entityId?: string | null;
  subject?: string;
  template?: string; // named email kind, or "custom"
  sentBy?: string; // "admin" | "system" | "cron"
  status?: "sent" | "failed";
  error?: string;
};

export async function logEmail(entry: EmailLogEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("crm_email_log").insert({
      recipient: entry.recipient,
      recipient_type: entry.recipientType ?? null,
      entity_id: entry.entityId ?? null,
      subject: entry.subject ?? null,
      template: entry.template ?? null,
      sent_by: entry.sentBy ?? "system",
      status: entry.status ?? "sent",
      error: entry.error ?? null,
    });
    if (error) console.error("crm_email_log insert failed:", error.message);
  } catch (e) {
    console.error("crm_email_log insert threw:", e);
  }
}
