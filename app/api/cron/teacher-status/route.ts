import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { sendOpsEmail, escapeHtml } from "@/app/lib/ops-email";
import { listRecurringForCustomer, SUMIT_RECURRING_ACTIVE_STATUSES } from "@/app/lib/sumit";
import { sendTeacherTrialEndingEmail, sendTeacherTrialExpiredEmail } from "@/app/lib/teacher-emails";
import { teacherStats } from "@/app/lib/teachers.server";

// הקרון היומי של ענף המורים:
//   1. ניסיון שנגמר בלי הוראת קבע → expired (+ מייל למורה, חסום עד אישור התבנית).
//   2. תזכורת 14 ימים לפני סוף הניסיון (אותו מצב אישור).
//   3. אימות מול Sumit של עד 8 משלמים בכל ריצה (מכסת ה-API קטנה): הוראה
//      שבוטלה שם מורידה את המורה מהמאגר ומתריעה לנו.
//   4. סיכום אלינו כשמשהו קרה.
// השליחה למורים דורשת ?send=confirm כמו בשאר הקרונים; בלעדיו הריצה רק
// מדווחת. התבניות עצמן נחסמות ב-automated-email-guard עד שיאושרו.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const REMIND_DAYS_BEFORE = 14;
const SUMIT_CHECKS_PER_RUN = 8;

type Row = {
  id: string;
  full_name: string;
  email: string;
  edit_token: string;
  listing_state: string;
  trial_ends_at: string | null;
  trial_ending_notified_at: string | null;
  sumit_recurring_id: string | null;
  sumit_cancelled_at: string | null;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const now = new Date();
  const nowIso = now.toISOString();
  const lines: string[] = [];

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id, full_name, email, edit_token, listing_state, trial_ends_at, trial_ending_notified_at, sumit_recurring_id, sumit_cancelled_at, updated_at")
    .in("listing_state", ["trial", "paying"]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Row[];

  // 1. ניסיון שנגמר
  const expired = rows.filter((r) => r.listing_state === "trial" && r.trial_ends_at && r.trial_ends_at <= nowIso && !(r.sumit_recurring_id && !r.sumit_cancelled_at));
  for (const r of expired) {
    const { error: upErr } = await supabaseAdmin.from("teachers").update({ listing_state: "expired", updated_at: nowIso }).eq("id", r.id).eq("listing_state", "trial");
    if (upErr) {
      lines.push(`❌ ${r.full_name}: המעבר ל-expired נכשל (${upErr.message})`);
      continue;
    }
    let mailNote = "בלי מייל (send לא אושר)";
    if (send) {
      const m = await sendTeacherTrialExpiredEmail(r);
      mailNote = `מייל: ${m.status}${m.error ? ` (${m.error})` : ""}`;
      if (m.status === "sent") await supabaseAdmin.from("teachers").update({ trial_expired_notified_at: nowIso }).eq("id", r.id);
    }
    lines.push(`⏹ ${r.full_name}: הניסיון נגמר, ירד/ה מהמאגר. ${mailNote}`);
  }

  // 2. תזכורת לפני הסיום
  const remindBefore = new Date(now.getTime() + REMIND_DAYS_BEFORE * 86400000).toISOString();
  const ending = rows.filter(
    (r) => r.listing_state === "trial" && r.trial_ends_at && r.trial_ends_at > nowIso && r.trial_ends_at <= remindBefore && !r.trial_ending_notified_at && !(r.sumit_recurring_id && !r.sumit_cancelled_at),
  );
  if (ending.length) {
    const stats = await teacherStats(ending.map((r) => r.id));
    for (const r of ending) {
      const s = stats[r.id];
      let mailNote = "בלי מייל (send לא אושר)";
      if (send) {
        const m = await sendTeacherTrialEndingEmail({ ...r, trial_ends_at: String(r.trial_ends_at) }, { impressions: s?.impressions_total ?? 0, contacts: s?.contacts_total ?? 0 });
        mailNote = `מייל: ${m.status}${m.error ? ` (${m.error})` : ""}`;
        if (m.status === "sent") await supabaseAdmin.from("teachers").update({ trial_ending_notified_at: nowIso }).eq("id", r.id);
      }
      lines.push(`⏳ ${r.full_name}: הניסיון מסתיים ב-${String(r.trial_ends_at).slice(0, 10)} (${s?.impressions_total ?? 0} הופעות, ${s?.contacts_total ?? 0} פניות). ${mailNote}`);
    }
  }

  // 3. אימות משלמים מול Sumit - הוותיקים ביותר קודם, עד 8 בריצה.
  const paying = rows
    .filter((r) => r.listing_state === "paying" && r.sumit_recurring_id && !r.sumit_cancelled_at)
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(0, SUMIT_CHECKS_PER_RUN);
  for (const r of paying) {
    try {
      const items = await listRecurringForCustomer({ externalIdentifier: `teacher:${r.id}`, includeInactive: true });
      const mine = items.find((i) => String(i.ID) === String(r.sumit_recurring_id));
      const alive = mine ? SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(mine.Status)) : false;
      if (alive) {
        await supabaseAdmin.from("teachers").update({ updated_at: nowIso }).eq("id", r.id);
        continue;
      }
      const trialLive = r.trial_ends_at && r.trial_ends_at > nowIso;
      await supabaseAdmin
        .from("teachers")
        .update({ sumit_cancelled_at: nowIso, listing_state: trialLive ? "trial" : "expired", paying_since: null, updated_at: nowIso })
        .eq("id", r.id);
      lines.push(`💳 ${r.full_name}: הוראת הקבע ${r.sumit_recurring_id} אינה פעילה ב-Sumit (${mine ? `סטטוס ${mine.Status}` : "לא נמצאה"}). ${trialLive ? "חזר/ה לניסיון" : "ירד/ה מהמאגר"}.`);
    } catch (e) {
      lines.push(`⚠️ ${r.full_name}: בדיקת Sumit נכשלה (${e instanceof Error ? e.message : e})`);
    }
  }

  if (lines.length) {
    await sendOpsEmail({
      template: "teacher_status_digest",
      subject: `מענה לימודי - ${lines.length} עדכונים (${nowIso.slice(0, 10)})`,
      html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;line-height:1.8">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il"}/admin/teachers">לעמוד המורים באדמין ←</a></p></div>`,
    });
  }

  return NextResponse.json({ ok: true, send, expired: expired.length, reminded: ending.length, verified: paying.length, lines });
}
