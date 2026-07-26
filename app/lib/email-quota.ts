import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { logEmail } from "./email-log";

// ─────────────────────────────────────────────────────────────────────────────
// Daily-quota safety net for BULK email sends.
//
// Resend's free tier caps sending at 100 emails/day. A single admin bulk
// reminder run (77 in one morning) once blew the whole day's quota, silently
// failing the transactional mail that followed (registration confirmations,
// leads). This gate makes BULK sends (completion reminders, monthly reports)
// claim a slot from a shared daily counter first; once the bulk ceiling is hit
// they defer to the next day, leaving the rest of Resend's daily allowance for
// critical transactional mail - which is NOT gated.
//
// EMAIL_BULK_DAILY_CAP (env, default 60) is the bulk ceiling. Raise it - or set
// it to 0 to disable gating - after upgrading the Resend plan.
// ─────────────────────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

export const BULK_DAILY_CAP = Number(process.env.EMAIL_BULK_DAILY_CAP ?? 60);

export type BulkEmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export type BulkEmailResult = { ok: boolean; skipped?: boolean; error?: string };

/** True if a bulk slot is still available today (atomically claims it). */
async function claimBulkSlot(): Promise<boolean> {
  if (!BULK_DAILY_CAP || BULK_DAILY_CAP <= 0) return true; // gating disabled
  try {
    const { data, error } = await supabaseAdmin.rpc("bump_email_counter", {
      p_limit: BULK_DAILY_CAP,
    });
    if (error) {
      // Fail open: a DB hiccup must not drop legitimate mail. The gate is the
      // normal path; losing it during a rare outage is acceptable.
      console.error("claimBulkSlot: bump_email_counter error, sending anyway:", error.message);
      return true;
    }
    // data is the new count, or null when the cap is already reached.
    return data != null;
  } catch (e) {
    console.error("claimBulkSlot: threw, sending anyway:", e);
    return true;
  }
}

/**
 * Send a BULK-category email through the daily gate. Returns skipped:true (and
 * ok:false) when today's bulk ceiling is reached, so the caller can surface it
 * (e.g. the admin sees the reminder wasn't sent and can retry tomorrow).
 */
export async function sendBulkEmail(payload: BulkEmailPayload): Promise<BulkEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "resend not configured" };
  }
  const allowed = await claimBulkSlot();
  if (!allowed) {
    console.warn(
      `sendBulkEmail: daily bulk cap (${BULK_DAILY_CAP}) reached - deferring send to ${payload.to}`
    );
    return {
      ok: false,
      skipped: true,
      error: `הגיעה תקרת המיילים ההמוניים היומית (${BULK_DAILY_CAP}). המייל לא נשלח - נסו שוב מחר.`,
    };
  }
  try {
    const { error } = await resend.emails.send({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    });
    // CRM email history - fire-and-forget, never blocks the send result.
    void logEmail({
      recipient: Array.isArray(payload.to) ? payload.to[0] : payload.to,
      subject: payload.subject,
      template: "bulk",
      sentBy: "system",
      status: error ? "failed" : "sent",
      error: error ? String((error as { message?: string })?.message ?? error) : undefined,
    });
    if (error) return { ok: false, error: String((error as { message?: string })?.message ?? error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
