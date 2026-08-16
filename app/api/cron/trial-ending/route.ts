import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { sendTrialEndingEmail, trialEndingVariant, type TrialStats } from "@/app/lib/trial-ending-email";
import { TRIAL_UPGRADE_OFFER_DAYS } from "@/app/lib/promo";
import { alertRecipients } from "@/app/lib/alert-recipients";

// סיום תקופת מתנה: דוח כל-התקופה + הצעת שדרוג אישית.
//   3 ימים לפני הסיום  → המייל המרכזי (trial_ending_notified_at)
//   יום לפני, אם לא שודרג → תזכורת אחת (trial_ending_reminded_at)
//
// מי שקיבל *אפס פניות* בכל התקופה לא מקבל מייל מכירה - זה היה מזכיר לו ברגע
// ההחלטה שהמוצר לא עבד עבורו. במקומו יוצאת התראה לאדמין, שיחליט אם להאריך,
// לתקן פרופיל או להתקשר.
//
// ⚠️ ברירת המחדל היא תצוגה מקדימה. שליחה בפועל רק עם ?send=confirm.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;
// אוחד ל-alertRecipients (ביקורת 16/8). שים לב: ברירת המחדל הישנה כאן
// הכילה רק 2 כתובות (בלי omer@) - כנראה שריד מלפני פתיחת התיבה שלה;
// מהיום ההתנהגות אחידה עם כל שאר ההתראות.
const ADMIN_TO = alertRecipients();

const NOTICE_DAYS = 3;   // המייל המרכזי
const REMINDER_DAYS = 1; // התזכורת

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  promoted_since: string | null;
  promoted_until: string;
  trial_ending_notified_at: string | null;
  trial_ending_reminded_at: string | null;
};

function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000);
}

export async function runTrialEndingNotices(opts: { send: boolean; now?: Date }) {
  const now = opts.now ?? new Date();
  const horizonIso = new Date(now.getTime() + (NOTICE_DAYS + 1) * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, promoted_since, promoted_until, trial_ending_notified_at, trial_ending_reminded_at")
    .eq("status", "paying")
    .eq("promotion_source", "trial")
    .neq("entity_type", "center")
    .not("promoted_until", "is", null)
    .gt("promoted_until", now.toISOString())
    .lte("promoted_until", horizonIso);

  if (error) return { ok: false, error: error.message, status: 500 };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    return { ok: true, mode: opts.send ? "SENT" : "preview_only", candidates: 0, note: "אין תקופות מתנה שמסתיימות בחלון" };
  }

  // ── ממוצע המטפל החינמי, לנרמול הוגן: פניות/צפיות ליום ──────────────────
  // מחושב פעם אחת לכל הריצה. "חינמי" = מאושר, לא מקודם, מקבל מטופלים.
  const { data: freeRows } = await supabaseAdmin
    .from("therapists")
    .select("id, created_at")
    .eq("status", "approved")
    .eq("admin_approved", true)
    .eq("accepting_new_patients", true)
    .neq("entity_type", "center");
  const freeIds = (freeRows ?? []).map((r) => r.id as string);

  let freeViewsPerDay = 0;
  let freeContactsPerDay = 0;
  if (freeIds.length > 0) {
    const [fv, fc] = await Promise.all([
      fetchAllRows<{ therapist_id: string }>(() =>
        supabaseAdmin.from("therapist_profile_views").select("therapist_id")
          .in("therapist_id", freeIds).in("source", ["match", "directory"])),
      fetchAllRows<{ therapist_id: string }>(() =>
        supabaseAdmin.from("therapist_contact_clicks").select("therapist_id").in("therapist_id", freeIds)),
    ]);
    // ימי-חיים מצטברים של כל המטפלים החינמיים (לפחות יום אחד לכל אחד).
    const totalFreeDays = (freeRows ?? []).reduce((sum, r) => {
      const d = Math.max(1, Math.floor((now.getTime() - new Date(r.created_at as string).getTime()) / 86_400_000));
      return sum + d;
    }, 0);
    if (totalFreeDays > 0) {
      freeViewsPerDay = fv.length / totalFreeDays;
      freeContactsPerDay = fc.length / totalFreeDays;
    }
  }

  const results: Array<Record<string, unknown>> = [];
  const zeroAlerts: Array<{ name: string; days: number; views: number }> = [];
  let sent = 0;
  let skipped = 0;

  for (const t of rows) {
    const daysLeft = daysUntil(t.promoted_until, now);
    const isReminder = daysLeft <= REMINDER_DAYS;
    // מחוץ לשני החלונות (למשל 2 ימים) - לא עושים כלום.
    if (!isReminder && daysLeft !== NOTICE_DAYS) continue;
    // כל שלב נשלח פעם אחת בלבד.
    if (isReminder ? t.trial_ending_reminded_at : t.trial_ending_notified_at) continue;
    if (!t.email) { skipped++; continue; }

    const since = t.promoted_since ?? t.promoted_until;
    const periodDays = Math.max(1, Math.floor((now.getTime() - new Date(since).getTime()) / 86_400_000));

    const [{ count: views }, { count: contacts }] = await Promise.all([
      supabaseAdmin.from("therapist_profile_views").select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id).in("source", ["match", "directory"]).gte("viewed_at", since),
      supabaseAdmin.from("therapist_contact_clicks").select("id", { count: "exact", head: true })
        .eq("therapist_id", t.id).gte("clicked_at", since),
    ]);

    const stats: TrialStats = {
      days: periodDays,
      views: views ?? 0,
      contacts: contacts ?? 0,
      freeAvgViews: Math.round(freeViewsPerDay * periodDays * 10) / 10,
      freeAvgContacts: Math.round(freeContactsPerDay * periodDays * 10) / 10,
    };
    const variant = trialEndingVariant(stats.contacts);

    if (variant === "zero") {
      zeroAlerts.push({ name: t.full_name ?? "-", days: daysLeft, views: stats.views });
      // מסמנים כטופל כדי שלא ייבדק שוב מחר ויתריע פעמיים.
      if (opts.send) {
        await supabaseAdmin.from("therapists")
          .update(isReminder ? { trial_ending_reminded_at: now.toISOString() } : { trial_ending_notified_at: now.toISOString() })
          .eq("id", t.id);
      }
      results.push({ name: t.full_name, daysLeft, variant, action: "admin_alert_only", ...stats });
      continue;
    }

    results.push({
      name: t.full_name, to: t.email, daysLeft, variant,
      stage: isReminder ? "reminder" : "notice", ...stats,
    });

    if (!opts.send) continue;

    const r = await sendTrialEndingEmail({
      to: t.email, name: t.full_name ?? "", stats, daysLeft, isReminder,
    });
    if (r.ok) {
      sent++;
      const patch: Record<string, string> = isReminder
        ? { trial_ending_reminded_at: now.toISOString() }
        : { trial_ending_notified_at: now.toISOString() };
      // ההצעה האישית נפתחת עם המייל הראשון בלבד.
      if (!isReminder) {
        patch.upgrade_offer_until = new Date(now.getTime() + TRIAL_UPGRADE_OFFER_DAYS * 86_400_000).toISOString();
      }
      await supabaseAdmin.from("therapists").update(patch).eq("id", t.id);
    } else {
      skipped++;
    }
  }

  // התראת אדמין על מי שלא קיבל פניות - שם ההחלטה אנושית.
  if (opts.send && zeroAlerts.length > 0) {
    const rowsHtml = zeroAlerts
      .map((z) => `<li><strong>${z.name}</strong> - מסתיים בעוד ${z.days} ימים · ${z.views} צפיות · <strong>0 פניות</strong></li>`)
      .join("");
    try {
      await resend.emails.send({
        from: "טיפול חכם <noreply@mentalytics.co.il>",
        to: ADMIN_TO,
        subject: `⚠️ ${zeroAlerts.length} תקופות מתנה מסתיימות בלי אף פנייה`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;">
          <p>למטפלים הבאים תקופת המתנה מסתיימת, ו<strong>לא הגיעה אליהם אף פנייה</strong> בכל התקופה.
          לא נשלח אליהם מייל שדרוג - הוא היה מדגיש להם בדיוק את זה ברגע ההחלטה.</p>
          <ul>${rowsHtml}</ul>
          <p>כדאי לשקול: בדיקת הפרופיל (אזורים/תחומים/תמונה), הארכת התקופה, או שיחה אישית.</p>
        </div>`,
      });
    } catch (e) {
      console.error("trial-ending: admin alert failed:", e);
    }
  }

  return {
    ok: true,
    mode: opts.send ? "SENT" : "preview_only",
    ...(opts.send ? { sent, skipped } : { would_send: results.filter((r) => r.action !== "admin_alert_only").length }),
    zero_contact_alerts: zeroAlerts.length,
    candidates: results.length,
    details: results,
    ...(opts.send ? {} : { note: "לא נשלח דבר. לשליחה בפועל: ?send=confirm" }),
  };
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const result = await runTrialEndingNotices({ send });
  const { status, ...body } = result as Record<string, unknown> & { status?: number };
  return NextResponse.json(body, { status: status ?? 200 });
}
