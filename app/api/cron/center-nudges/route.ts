import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { runCenterNudgeAgent } from "@/app/lib/center-nudge-agent";
import { sendCenterInviteReminderEmail } from "@/app/lib/center-emails";
import { automatedSendAllowed } from "@/app/lib/automated-email-guard";

// מרכזים - ריצה יומית שעושה שני דברים שונים לגמרי:
//
//   1. מריצה את סוכן המרכזים, שמנסח טיוטת נדנוד לכל מרכז שחסר לו משהו
//      ומכניס אותה לתור באדמין. **הקרון הזה לא שולח נדנודים.** השליחה היא
//      קליק שלך על הטיוטה, אחרי שקראת ותיקנת (החלטת המשתמש 20/8).
//
//   2. תזכורת למטפל שקיבל הזמנה מהמרכז ולא מילא - זו עדיין שליחה
//      אוטומטית, ולכן היא עוברת בשער המיילים ונחסמת עד שתאושר תבנית.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const INVITE_REMINDER_DAYS = 5;
const MAX_REMINDERS_PER_RUN = 25;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const send = req.nextUrl.searchParams.get("send") === "confirm";
    const agentRun = await runCenterNudgeAgent();

    const cutoff = new Date(Date.now() - INVITE_REMINDER_DAYS * 86_400_000).toISOString();
    const { data: staleInvites } = await supabaseAdmin
      .from("center_therapist_invites")
      .select("id, email, token, center_account_id, therapy_center_accounts(name, status)")
      .is("used_at", null)
      .is("reminded_at", null)
      .lt("invited_at", cutoff);

    let remindersSent = 0;
    const reminders: { to: string; center: string; status: string; reason?: string }[] = [];
    for (const inv of staleInvites ?? []) {
      const rawCenter = (inv as Record<string, unknown>).therapy_center_accounts;
      const center = (Array.isArray(rawCenter) ? rawCenter[0] : rawCenter) as
        | { name: string; status: string }
        | undefined;
      if (!center || center.status !== "active") continue;

      const to = inv.email as string;
      if (!send) {
        reminders.push({ to, center: center.name, status: "would_send" });
        continue;
      }
      if (remindersSent >= MAX_REMINDERS_PER_RUN) {
        reminders.push({ to, center: center.name, status: "skipped", reason: "תקרת שליחות לריצה" });
        continue;
      }
      const gate = automatedSendAllowed(to, "center_invite_reminder");
      if (!gate.allowed) {
        reminders.push({ to, center: center.name, status: "skipped", reason: gate.reason });
        continue;
      }
      const r = await sendCenterInviteReminderEmail({
        to,
        centerName: center.name,
        token: inv.token as string,
      });
      if (r.ok) {
        remindersSent++;
        reminders.push({ to, center: center.name, status: "sent" });
        await supabaseAdmin
          .from("center_therapist_invites")
          .update({ reminded_at: new Date().toISOString() })
          .eq("id", inv.id);
      } else {
        reminders.push({ to, center: center.name, status: "skipped", reason: r.error });
      }
    }

    return NextResponse.json({
      ok: agentRun.ok,
      centers_checked: agentRun.checked,
      drafts_queued: agentRun.proposals.length,
      drafts: agentRun.proposals.map((p) => ({ center: p.centerName, subject: p.subject })),
      skipped: agentRun.skipped,
      invite_reminders_sent: remindersSent,
      invite_reminders: reminders,
      error: agentRun.error,
    });
  } catch (err) {
    console.error("center-nudges error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
