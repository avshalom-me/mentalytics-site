import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { loadCentersWithReadiness } from "@/app/lib/center-readiness-load";
import { buildCenterNudgeEmail } from "@/app/lib/center-nudge-email";
import { sendCenterInviteReminderEmail, sendCenterNudgeEmail } from "@/app/lib/center-emails";
import { automatedSendAllowed } from "@/app/lib/automated-email-guard";

// נדנודי מרכזים - שתי משפחות, שתיהן מותנות בשער המיילים:
//   1. השלמת מוכנות, לפי המסלול שנרכש (per_therapist מול center_entity).
//   2. תזכורת למטפל שקיבל הזמנה מהמרכז ולא מילא.
//
// ההיסטוריה שמעצבת את הקוד הזה: ב-16/8/26 נשלח למרכז משלם "הפרופיל שלכם
// מלא ב-0%" - מדד של מסלול אחר, על הדבר הפחות חשוב אצלו, בזמן שהדבר שכן
// היה חשוב (עשרה מקומות ששולמו ולא אוישו) לא נאמר. לכן:
//   - המוכנות מחושבת ב-center-readiness לפי המסלול.
//   - פריט שהחסם שלו אצלנו (מטפל שממתין לאישור שלנו) לא נכנס למייל לעולם.
//   - הריצה מחזירה תצוגה מקדימה מלאה, כולל הנושא וגוף המייל, כדי שאפשר
//     יהיה לקרוא בדיוק מה היה יוצא בלי לשלוח.
//
// שליחה בפועל דורשת גם ?send=confirm וגם אישור התבנית בשער המיילים.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SETTLE_DAYS = 7; // כמה זמן נותנים למרכז חדש להתארגן לבד
const REPEAT_DAYS = 21; // מרווח מינימלי בין נדנוד לנדנוד לאותו מרכז
const INVITE_REMINDER_DAYS = 5;
const MAX_NUDGES_PER_RUN = 15;
const MAX_REMINDERS_PER_RUN = 25;
const NUDGE_TEMPLATE = "center_readiness_nudge";

type NudgePreview = {
  center: string;
  track: string;
  monthly_value: number;
  headline: string | null;
  pct: number;
  subject: string;
  missing: string[];
  blocked_on_us: string[];
  to: string | null;
  status: "would_send" | "sent" | "skipped";
  reason?: string;
};

async function runCenterNudges(send: boolean) {
  const now = Date.now();
  const centers = await loadCentersWithReadiness();
  const previews: NudgePreview[] = [];
  let sent = 0;

  for (const c of centers) {
    const base = {
      center: c.name,
      track: c.readiness.trackLabel,
      monthly_value: c.monthlyValue,
      headline: c.readiness.headline,
      pct: c.readiness.pct,
      missing: c.readiness.missingForCenter.map((i) => i.label),
      blocked_on_us: c.readiness.blockedOnUs.map((i) => i.label),
      to: c.payerEmail ?? c.email,
    };

    // אין מה לבקש מהם - גם אם משהו תקוע אצלנו.
    if (c.readiness.missingForCenter.length === 0) {
      previews.push({ ...base, subject: "", status: "skipped", reason: "אין פריט פתוח באחריותם" });
      continue;
    }
    if (!c.paidAt) {
      previews.push({ ...base, subject: "", status: "skipped", reason: "טרם שולם" });
      continue;
    }
    const paidAgo = now - new Date(c.paidAt).getTime();
    if (paidAgo < SETTLE_DAYS * 86_400_000) {
      previews.push({ ...base, subject: "", status: "skipped", reason: "פחות משבוע מהתשלום" });
      continue;
    }
    const to = base.to;
    if (!to) {
      previews.push({ ...base, subject: "", status: "skipped", reason: "אין כתובת מייל" });
      continue;
    }

    const { subject, html } = buildCenterNudgeEmail({
      centerName: c.name,
      readiness: c.readiness,
      token: c.token,
      hasAccount: c.hasAccount,
    });

    // מרווח בין נדנודים לאותו מרכז. הבדיקה לפי נמען + שם המרכז בנושא, כי
    // שני מרכזים של אותו בעלים חולקים כתובת אחת.
    const since = new Date(now - REPEAT_DAYS * 86_400_000).toISOString();
    const { data: prior } = await supabaseAdmin
      .from("crm_email_log")
      .select("id, subject, created_at")
      .eq("recipient", to)
      .eq("template", NUDGE_TEMPLATE)
      .eq("status", "sent")
      .gte("created_at", since);
    if ((prior ?? []).some((p) => String(p.subject ?? "").includes(c.name.trim()))) {
      previews.push({ ...base, subject, status: "skipped", reason: `נשלח נדנוד ב-${REPEAT_DAYS} הימים האחרונים` });
      continue;
    }

    if (!send) {
      previews.push({ ...base, subject, status: "would_send" });
      continue;
    }
    if (sent >= MAX_NUDGES_PER_RUN) {
      previews.push({ ...base, subject, status: "skipped", reason: "תקרת שליחות לריצה" });
      continue;
    }
    const gate = automatedSendAllowed(to, NUDGE_TEMPLATE);
    if (!gate.allowed) {
      previews.push({ ...base, subject, status: "skipped", reason: gate.reason });
      continue;
    }

    const r = await sendCenterNudgeEmail({ to, subject, html });
    if (r.ok) {
      sent++;
      previews.push({ ...base, subject, status: "sent" });
    } else {
      previews.push({ ...base, subject, status: "skipped", reason: r.error ?? "שליחה נכשלה" });
    }
  }

  // ── תזכורות הזמנות שלא מומשו ────────────────────────────────────────────
  const cutoff = new Date(now - INVITE_REMINDER_DAYS * 86_400_000).toISOString();
  const { data: staleInvites } = await supabaseAdmin
    .from("center_therapist_invites")
    .select("id, email, token, center_account_id, therapy_center_accounts(name, status)")
    .is("used_at", null)
    .is("reminded_at", null)
    .lt("invited_at", cutoff);

  let remindersSent = 0;
  const reminderPreviews: { to: string; center: string; status: string; reason?: string }[] = [];
  for (const inv of staleInvites ?? []) {
    const rawCenter = (inv as Record<string, unknown>).therapy_center_accounts;
    const center = (Array.isArray(rawCenter) ? rawCenter[0] : rawCenter) as
      | { name: string; status: string }
      | undefined;
    if (!center || center.status !== "active") continue;

    const to = inv.email as string;
    if (!send) {
      reminderPreviews.push({ to, center: center.name, status: "would_send" });
      continue;
    }
    if (remindersSent >= MAX_REMINDERS_PER_RUN) {
      reminderPreviews.push({ to, center: center.name, status: "skipped", reason: "תקרת שליחות לריצה" });
      continue;
    }
    const gate = automatedSendAllowed(to, "center_invite_reminder");
    if (!gate.allowed) {
      reminderPreviews.push({ to, center: center.name, status: "skipped", reason: gate.reason });
      continue;
    }
    const r = await sendCenterInviteReminderEmail({
      to,
      centerName: center.name,
      token: inv.token as string,
    });
    if (r.ok) {
      remindersSent++;
      reminderPreviews.push({ to, center: center.name, status: "sent" });
      await supabaseAdmin
        .from("center_therapist_invites")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", inv.id);
    } else {
      reminderPreviews.push({ to, center: center.name, status: "skipped", reason: r.error });
    }
  }

  return {
    ok: true,
    mode: send ? "send" : "preview",
    centers_checked: centers.length,
    nudges_sent: sent,
    invite_reminders_sent: remindersSent,
    nudges: previews,
    invite_reminders: reminderPreviews,
  };
}

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const send = req.nextUrl.searchParams.get("send") === "confirm";
    return NextResponse.json(await runCenterNudges(send));
  } catch (err) {
    console.error("center-nudges error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
