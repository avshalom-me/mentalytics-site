import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { sendOpsEmail, escapeHtml } from "@/app/lib/ops-email";
import { listRecurringForCustomer, SUMIT_RECURRING_ACTIVE_STATUSES } from "@/app/lib/sumit";
import { sendTeacherTrialEndingEmail, sendTeacherTrialLastDayEmail } from "@/app/lib/teacher-emails";
import { teacherStats, teacherNote, emptyTeacherStats } from "@/app/lib/teachers.server";
import { planTrialActions, israelDate, israelEndOfDay, sumitCheckDue, type TrialRow } from "@/app/lib/teacher-trial";

// הקרון היומי של ענף המורים (09:20 בשעון ישראל בקיץ, 08:20 בחורף).
//
//   1. תקופות הניסיון - לפי planTrialActions (teacher-trial.ts):
//        יום 85      → המייל להרשמה
//        היום האחרון → המייל הנוסף
//        למחרת       → ארכיון (יוצא/ת מהמאגר; הפיך)
//      מי שכבר נרשם/ה לתשלום לא מקבל/ת מיילים ולא עובר/ת לארכיון.
//   2. אימות הוראות הקבע מול Sumit - פעם אחת אחרי כל חיוב חודשי, עד
//      SUMIT_CHECKS_PER_RUN בריצה (מכסת ה-API של Sumit משותפת עם המטפלים).
//      הוראה שבוטלה שם מעבירה את המורה לארכיון ומתריעה לנו.
//   3. סיכום אלינו - רק כשמשהו קרה.
//
// בלי ?send=confirm הריצה היא תצוגה מקדימה בלבד: היא מחזירה מה הייתה עושה,
// לא שולחת מייל ולא משנה שום שורה. כך אפשר לבדוק אותה בלי לגעת באף מורה.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SUMIT_CHECKS_PER_RUN = 5;

type Row = {
  id: string;
  full_name: string;
  email: string;
  edit_token: string;
  listing_state: string;
  trial_ends_at: string | null;
  trial_ending_notified_at: string | null;
  trial_last_day_notified_at: string | null;
  sumit_recurring_id: string | null;
  sumit_cancelled_at: string | null;
  sumit_first_charge_on: string | null;
  sumit_verified_at: string | null;
};

const subscribed = (r: Row) => !!r.sumit_recurring_id && !r.sumit_cancelled_at;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const now = new Date();
  const nowIso = now.toISOString();
  const today = israelDate(now);
  const lines: string[] = [];

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select("id, full_name, email, edit_token, listing_state, trial_ends_at, trial_ending_notified_at, trial_last_day_notified_at, sumit_recurring_id, sumit_cancelled_at, sumit_first_charge_on, sumit_verified_at")
    .in("listing_state", ["trial", "paying"])
    .limit(1000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  // ── 1. תקופות הניסיון ─────────────────────────────────────────────────────
  const plan = planTrialActions(
    rows.map((r): TrialRow => ({
      id: r.id,
      listing_state: r.listing_state,
      trial_ends_at: r.trial_ends_at,
      trial_ending_notified_at: r.trial_ending_notified_at,
      trial_last_day_notified_at: r.trial_last_day_notified_at,
      hasActiveSubscription: subscribed(r),
    })),
    now,
  );
  const stats = await teacherStats(plan.map((a) => a.id));
  let payEmails = 0;
  let lastDayEmails = 0;
  let archived = 0;
  let stopped = false;

  for (const action of plan) {
    const r = byId.get(action.id)!;
    const s = stats[r.id] ?? emptyTeacherStats();
    const numbers = `${s.impressions_total} הופעות, ${s.contacts_total} פניות`;

    if (action.kind === "pay_email") {
      if (!send) {
        lines.push(`[תצוגה] ${r.full_name}: מייל ההרשמה של יום 85 (${numbers}).`);
        continue;
      }
      const m = await sendTeacherTrialEndingEmail({ ...r, trial_ends_at: String(r.trial_ends_at) }, { impressions: s.impressions_total, contacts: s.contacts_total });
      if (m.status === "sent") {
        const { error: stampErr } = await supabaseAdmin.from("teachers").update({ trial_ending_notified_at: nowIso }).eq("id", r.id);
        if (stampErr) {
          // המייל יצא והחותמת נכשלה: עוצרים. המשך היה שולח את אותו מייל שוב מחר.
          lines.push(`❌ ${r.full_name}: מייל יום 85 נשלח אבל הסימון נכשל (${stampErr.message}). הריצה נעצרה - לסמן ידנית trial_ending_notified_at.`);
          stopped = true;
          break;
        }
        await teacherNote(r.id, `נשלח מייל ההרשמה של יום 85 (${numbers}).`);
        payEmails++;
      }
      lines.push(`✉️ ${r.full_name}: מייל ההרשמה של יום 85 - ${m.status}${m.error ? ` (${m.error})` : ""}. ${numbers}. הניסיון מסתיים ב-${israelDate(new Date(String(r.trial_ends_at)))}.`);
      continue;
    }

    if (action.kind === "last_day_email") {
      if (!send) {
        lines.push(`[תצוגה] ${r.full_name}: מייל היום האחרון${action.moveEndToToday ? " (סוף הניסיון יידחה להיום)" : ""}.`);
        continue;
      }
      const m = await sendTeacherTrialLastDayEmail(r);
      if (m.status === "sent") {
        // כשהיום האחרון פוספס, הסוף נדחה להיום - כדי ש"היום מסתיימת" במייל
        // יהיה נכון, והארכיון יבוא רק מחר.
        const { error: stampErr } = await supabaseAdmin
          .from("teachers")
          .update({ trial_last_day_notified_at: nowIso, ...(action.moveEndToToday ? { trial_ends_at: israelEndOfDay(today).toISOString() } : {}) })
          .eq("id", r.id);
        if (stampErr) {
          lines.push(`❌ ${r.full_name}: מייל היום האחרון נשלח אבל הסימון נכשל (${stampErr.message}). הריצה נעצרה - לסמן ידנית trial_last_day_notified_at.`);
          stopped = true;
          break;
        }
        await teacherNote(r.id, "נשלח מייל היום האחרון של הניסיון.");
        lastDayEmails++;
      }
      lines.push(`✉️ ${r.full_name}: מייל היום האחרון - ${m.status}${m.error ? ` (${m.error})` : ""}. ${numbers}.`);
      continue;
    }

    // archive
    if (!send) {
      lines.push(`[תצוגה] ${r.full_name}: מעבר לארכיון.`);
      continue;
    }
    const { data: moved, error: upErr } = await supabaseAdmin
      .from("teachers")
      .update({ listing_state: "archived", archived_at: nowIso, updated_at: nowIso })
      .eq("id", r.id)
      .eq("listing_state", "trial")
      // מי שנרשם/ה לתשלום בין הקריאה לכתיבה נשאר/ת (הוראת קבע פעילה =
      // מזהה קיים ולא מבוטל).
      .or("sumit_recurring_id.is.null,sumit_cancelled_at.not.is.null")
      .select("id")
      .maybeSingle();
    if (upErr) {
      lines.push(`❌ ${r.full_name}: המעבר לארכיון נכשל (${upErr.message}).`);
      continue;
    }
    if (!moved) continue; // נרשם/ה לתשלום בין הקריאה לכתיבה
    await teacherNote(r.id, `הניסיון נגמר בלי הרשמה לתשלום - עבר/ה לארכיון${action.withoutLastDayEmail ? " (מייל היום האחרון לא יצא)" : ""}.`);
    archived++;
    lines.push(`📦 ${r.full_name}: הניסיון נגמר, עבר/ה לארכיון. ${numbers}.${action.withoutLastDayEmail ? " ⚠️ מייל היום האחרון לא יצא שלושה ימים רצופים." : ""}`);
  }

  // ── 2. אימות הוראות קבע מול Sumit ─────────────────────────────────────────
  const dueForCheck = (stopped ? [] : rows)
    .filter((r) => r.listing_state === "paying" && subscribed(r) && /^\d+$/.test(String(r.sumit_recurring_id)) && sumitCheckDue(r.sumit_first_charge_on, r.sumit_verified_at, now))
    .sort((a, b) => (a.sumit_verified_at ?? "").localeCompare(b.sumit_verified_at ?? ""))
    .slice(0, SUMIT_CHECKS_PER_RUN);
  let verified = 0;
  for (const r of dueForCheck) {
    if (!send) {
      lines.push(`[תצוגה] ${r.full_name}: אימות הוראת הקבע ${r.sumit_recurring_id} מול Sumit.`);
      continue;
    }
    try {
      const items = await listRecurringForCustomer({ externalIdentifier: `teacher:${r.id}`, includeInactive: true });
      const mine = items.find((i) => String(i.ID) === String(r.sumit_recurring_id));
      if (!mine) {
        // פריט שלא חזר ברשימה אינו אישור שבוטל - רק מתריעים, ולא נוגעים במצב.
        await supabaseAdmin.from("teachers").update({ sumit_verified_at: nowIso }).eq("id", r.id);
        lines.push(`⚠️ ${r.full_name}: הוראת הקבע ${r.sumit_recurring_id} לא נמצאה ברשימה של Sumit. המצב לא שונה - לבדוק ידנית.`);
        continue;
      }
      verified++;
      if (SUMIT_RECURRING_ACTIVE_STATUSES.includes(Number(mine.Status))) {
        await supabaseAdmin.from("teachers").update({ sumit_verified_at: nowIso }).eq("id", r.id);
        continue;
      }
      const trialLive = !!r.trial_ends_at && r.trial_ends_at > nowIso;
      await supabaseAdmin
        .from("teachers")
        .update({
          sumit_cancelled_at: nowIso,
          sumit_verified_at: nowIso,
          listing_state: trialLive ? "trial" : "archived",
          archived_at: trialLive ? null : nowIso,
          paying_since: null,
          updated_at: nowIso,
        })
        .eq("id", r.id);
      await teacherNote(r.id, `הוראת הקבע ${r.sumit_recurring_id} אינה פעילה ב-Sumit (סטטוס ${mine.Status}). מצב: ${trialLive ? "ניסיון" : "ארכיון"}.`);
      lines.push(`💳 ${r.full_name}: הוראת הקבע ${r.sumit_recurring_id} אינה פעילה ב-Sumit (סטטוס ${mine.Status}). ${trialLive ? "חזר/ה לניסיון" : "עבר/ה לארכיון"} - כדאי ליצור קשר.`);
    } catch (e) {
      lines.push(`⚠️ ${r.full_name}: בדיקת Sumit נכשלה (${e instanceof Error ? e.message : e}).`);
    }
  }

  // ── 3. סיכום אלינו ────────────────────────────────────────────────────────
  if (send && lines.length) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
    await sendOpsEmail({
      template: "teacher_status_digest",
      subject: `מענה לימודי - ${lines.length} עדכונים (${today})`,
      html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;line-height:1.8">${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}<p style="font-size:13px;color:#666">מורה בלי פניות לקראת סוף הניסיון כנראה לא יירשם לתשלום. אפשר להאריך לו את הניסיון מעמוד המורים, לפני שהמייל של היום האחרון יוצא.</p><p><a href="${site}/admin/teachers">לעמוד המורים באדמין ←</a></p></div>`,
    });
  }

  return NextResponse.json({ ok: !stopped, send, today, planned: plan.length, payEmails, lastDayEmails, archived, sumitDue: dueForCheck.length, verified, lines });
}
