import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { centerProfileCompleteness } from "@/app/lib/center-completeness";
import { sendCenterCompletenessNudgeEmail, sendCenterInviteReminderEmail } from "@/app/lib/center-emails";

// דחיפות עדינות למרכזים - רץ יומית:
//   1. מרכז פעיל ששילם לפני 7+ ימים והפרופיל הציבורי שלו עדיין חסר -
//      מייל חד-פעמי "הפרופיל שלכם X% מלא" עם רשימת מה שחסר (החד-פעמיות
//      נאכפת דרך crm_email_log: template=center_completeness_nudge לנמען).
//   2. הזמנת מטפל (מסלול 1) שנשלחה לפני 5+ ימים ולא מולאה - תזכורת
//      חד-פעמית למטפל (reminded_at על ההזמנה).

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const WEEK_MS = 7 * 86_400_000;
const INVITE_REMINDER_DAYS = 5;
// תקרות בטיחות לריצה אחת - הריצה היומית לא אמורה לשרוף את מכסת Resend
// (100/יום בתוכנית החינמית) על גל תזכורות; מה שנשאר יטופל מחר.
const MAX_NUDGES_PER_RUN = 15;
const MAX_REMINDERS_PER_RUN = 25;

async function runCenterNudges() {
  const now = Date.now();

  // ── 1. תזכורות שלמות פרופיל ─────────────────────────────────────────────
  const { data: centers } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, status, email, payer_email, user_id, token, paid_at, logo_path, public_description, team_members, gallery, public_director, public_founded_year, public_team_size, public_address, public_hours, public_faq")
    .eq("status", "active")
    .not("paid_at", "is", null);

  let nudgesSent = 0;
  const nudgeSkips: string[] = [];
  for (const c of centers ?? []) {
    if (nudgesSent >= MAX_NUDGES_PER_RUN) { nudgeSkips.push("הגיעה תקרת התזכורות לריצה - יימשך מחר"); break; }
    const paidAgo = now - new Date(c.paid_at as string).getTime();
    if (paidAgo < WEEK_MS) continue; // עדיין טרי - נותנים שבוע להתארגן

    const { pct, missing } = centerProfileCompleteness(c);
    if (missing.length === 0) continue;

    const to = (c.payer_email as string | null) ?? (c.email as string | null);
    if (!to) { nudgeSkips.push(`${c.name}: אין מייל`); continue; }

    // חד-פעמי לכל מרכז. המפתח כולל את שם המרכז בנושא כי שני מרכזים של אותו
    // בעלים חולקים payer_email - בדיקה לפי נמען בלבד הייתה משתיקה את השני.
    const subjectForCenter = `הפרופיל של ${(c.name as string).trim()} מלא ב-`;
    const { data: prior } = await supabaseAdmin
      .from("crm_email_log")
      .select("id, subject")
      .eq("recipient", to)
      .eq("template", "center_completeness_nudge")
      .eq("status", "sent");
    if ((prior ?? []).some((r) => String(r.subject ?? "").startsWith(subjectForCenter))) continue;

    const r = await sendCenterCompletenessNudgeEmail({
      to,
      centerName: c.name as string,
      pct,
      missing,
      token: c.token as string | null,
      hasAccount: !!c.user_id,
    });
    if (r.ok) nudgesSent++;
    else nudgeSkips.push(`${c.name}: ${r.error}`);
  }

  // ── 2. תזכורות הזמנות-מילוי שלא מומשו ──────────────────────────────────
  const cutoff = new Date(now - INVITE_REMINDER_DAYS * 86_400_000).toISOString();
  const { data: staleInvites } = await supabaseAdmin
    .from("center_therapist_invites")
    .select("id, email, token, center_account_id, therapy_center_accounts(name, status)")
    .is("used_at", null)
    .is("reminded_at", null)
    .lt("invited_at", cutoff);

  let remindersSent = 0;
  const reminderSkips: string[] = [];
  for (const inv of staleInvites ?? []) {
    if (remindersSent >= MAX_REMINDERS_PER_RUN) { reminderSkips.push("הגיעה תקרת התזכורות לריצה - יימשך מחר"); break; }
    // supabase מטפוס join של FK כמערך - בפועל שורה אחת (FK יחיד).
    const rawCenter = (inv as Record<string, unknown>).therapy_center_accounts;
    const center = (Array.isArray(rawCenter) ? rawCenter[0] : rawCenter) as { name: string; status: string } | undefined;
    if (!center || center.status !== "active") continue; // מרכז שבוטל - לא מטרידים

    const r = await sendCenterInviteReminderEmail({
      to: inv.email as string,
      centerName: center.name,
      token: inv.token as string,
    });
    if (r.ok) {
      remindersSent++;
      await supabaseAdmin
        .from("center_therapist_invites")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", inv.id);
    } else {
      reminderSkips.push(`${inv.email}: ${r.error}`);
    }
  }

  console.log(`center-nudges: completeness=${nudgesSent} invite-reminders=${remindersSent} skips=${nudgeSkips.length + reminderSkips.length}`);
  return {
    ok: true,
    completeness_nudges_sent: nudgesSent,
    invite_reminders_sent: remindersSent,
    skips: [...nudgeSkips, ...reminderSkips],
  };
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runCenterNudges());
  } catch (err) {
    console.error("center-nudges error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
