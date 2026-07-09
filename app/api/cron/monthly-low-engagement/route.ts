import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { cronAuthorized } from "@/app/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;

// Who gets the reminder. Defaults to the ops inbox requested; comma-separate to
// add more without a deploy.
const REMINDER_TO = (process.env.LOW_ENGAGEMENT_REPORT_TO ?? "admin@getmentalytics.com")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// A promoted therapist with FEWER than this many contact clicks (whatsapp /
// phone / email / site message — all counted together) in the month gets
// flagged. Tunable via env without a deploy.
const CLICK_THRESHOLD = Number(process.env.LOW_ENGAGEMENT_CLICK_THRESHOLD ?? 3);

// ── Previous calendar month in Israel time, as UTC ISO bounds ───────────────
// The reminder runs on the 1st and reports the month that just ended. Clicks
// are timestamptz, so we bound the query in Israel-local time (what "החודש"
// means to the admin) and hand PostgREST UTC instants.

function israelOffsetMinutes(at: Date): number {
  // Offset of Asia/Jerusalem from UTC at instant `at`, in minutes (+120/+180).
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

// UTC instant for Israel-local midnight (00:00) of the given Y-M-D (1-based month).
function israelMidnightUtcIso(y: number, m: number, d: number): string {
  const naiveUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = israelOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offset * 60_000).toISOString();
}

function previousIsraelMonth(now: Date): { sinceIso: string; untilIso: string; label: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value); // current Israel month, 1-12
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return {
    sinceIso: israelMidnightUtcIso(prevY, prevM, 1),
    untilIso: israelMidnightUtcIso(y, m, 1),
    label: `${String(prevM).padStart(2, "0")}/${prevY}`,
  };
}

// ── Email ───────────────────────────────────────────────────────────────────

type Flagged = {
  name: string;
  clicks: number;
  views: number;
  daysPromoted: number | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(flagged: Flagged[], totalPromoted: number, monthLabel: string): string {
  const rows = flagged
    .map((t) => {
      const flag =
        t.views === 0
          ? '<span style="color:#dc2626;">🔇 לא נצפה כלל</span>'
          : '<span style="color:#d97706;">👁️ נצפה — בלי פנייה</span>';
      const days =
        t.daysPromoted == null
          ? "—"
          : t.daysPromoted >= 30
            ? `<span style="color:#dc2626;font-weight:bold;">${t.daysPromoted}</span>`
            : t.daysPromoted >= 14
              ? `<span style="color:#d97706;font-weight:bold;">${t.daysPromoted}</span>`
              : `${t.daysPromoted}`;
      return `
        <tr>
          <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:13px;">${escapeHtml(t.name)}</td>
          <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;font-weight:bold;">${t.clicks}</td>
          <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;">${t.views}</td>
          <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:12px;">${days}</td>
          <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:11px;">${flag}</td>
        </tr>`;
    })
    .join("");

  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#0F5468,#2e7d8c);padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:21px;">תזכורת חודשית — מטפלים מקודמים עם מעט פניות</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">החודש שהסתיים: ${monthLabel}</p>
      </div>

      <div style="background:#f9f8f6;padding:24px 32px;border:1px solid #e8e0d8;border-top:0;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 14px;line-height:1.7;font-size:14px;">
          <strong>${flagged.length}</strong> מתוך <strong>${totalPromoted}</strong> המטפלים המקודמים קיבלו
          <strong>פחות מ-${CLICK_THRESHOLD}</strong> פניות (וואטסאפ / טלפון / הודעה) בחודש ${monthLabel}.
          כדאי לבדוק חשיפה ופרופיל — במיוחד למי שכבר מעל 30 יום בקידום.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:8px 0 14px;background:white;">
          <thead>
            <tr style="background:#f5f5f4;">
              <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">מטפל</th>
              <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">פניות</th>
              <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">צפיות</th>
              <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">ימים בקידום</th>
              <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">סטטוס</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <p style="font-size:12px;color:#666;margin:0 0 4px;line-height:1.6;">
          🔇 <strong>לא נצפה כלל</strong> — בעיית חשיפה (קידום/התאמת אזורים ותחומים בפרופיל).<br/>
          👁️ <strong>נצפה בלי פנייה</strong> — בעיית המרה (ביו, תמונה, ניסוח ההתמחות).
        </p>

        <p style="margin:16px 0 0;text-align:center;">
          <a href="https://www.mentalytics.co.il/admin/therapists"
             style="display:inline-block;background:#0F5468;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:bold;">
            פתיחת ניהול המטפלים
          </a>
        </p>
      </div>

      <p style="text-align:center;font-size:11px;color:#aaa;margin:12px 0 0;">
        תזכורת אוטומטית — נשלחת ב-1 בכל חודש עבור החודש שהסתיים. סף הפניות: ${CLICK_THRESHOLD}.
      </p>
    </div>
  `;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runLowEngagementReminder(now: Date = new Date()): Promise<{
  ok: boolean;
  month: string;
  flagged: number;
  totalPromoted: number;
  emailStatus?: string;
  error?: string;
  status?: number;
}> {
  const { sinceIso, untilIso, label } = previousIsraelMonth(now);

  try {
    const { data: therapists, error: tErr } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, promoted_since")
      .eq("status", "paying");

    if (tErr) {
      return { ok: false, month: label, flagged: 0, totalPromoted: 0, error: tErr.message, status: 500 };
    }

    const paying = (therapists ?? []) as { id: string; full_name: string | null; promoted_since: string | null }[];
    // Only evaluate therapists who were actually promoted during (or before) the
    // reported month — someone promoted AFTER it ended barely appeared in it, so
    // flagging them for "0 clicks last month" would be noise. promoted_since=null
    // (legacy/long-standing) counts as "promoted before".
    const promoted = paying.filter((t) => t.promoted_since == null || t.promoted_since < untilIso);
    const ids = promoted.map((t) => t.id);
    if (ids.length === 0) {
      return { ok: true, month: label, flagged: 0, totalPromoted: 0, emailStatus: "skipped: no therapists promoted during the month" };
    }

    // Contact clicks + profile views for the month, scoped to promoted therapists.
    // fetchAllRows pages past the 1000-row cap (safe even though the promoted
    // roster's monthly volume is well under it today).
    const [clicks, views] = await Promise.all([
      fetchAllRows<{ therapist_id: string }>(() =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id")
          .gte("clicked_at", sinceIso)
          .lt("clicked_at", untilIso)
          .in("therapist_id", ids),
      ),
      fetchAllRows<{ therapist_id: string }>(() =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id")
          .gte("viewed_at", sinceIso)
          .lt("viewed_at", untilIso)
          .in("therapist_id", ids),
      ),
    ]);

    const clicksBy: Record<string, number> = {};
    for (const c of clicks) clicksBy[c.therapist_id] = (clicksBy[c.therapist_id] ?? 0) + 1;
    const viewsBy: Record<string, number> = {};
    for (const v of views) viewsBy[v.therapist_id] = (viewsBy[v.therapist_id] ?? 0) + 1;

    const nowMs = now.getTime();
    const flagged: Flagged[] = promoted
      .map((t) => ({
        name: t.full_name ?? "—",
        clicks: clicksBy[t.id] ?? 0,
        views: viewsBy[t.id] ?? 0,
        daysPromoted: t.promoted_since
          ? Math.floor((nowMs - new Date(t.promoted_since).getTime()) / 86_400_000)
          : null,
      }))
      .filter((t) => t.clicks < CLICK_THRESHOLD)
      // Fewest clicks first; within that, longest-promoted-still-quiet first.
      .sort((a, b) => a.clicks - b.clicks || (b.daysPromoted ?? -1) - (a.daysPromoted ?? -1));

    // "A reminder IF there's a therapist below the threshold" — when everyone
    // met it, there's nothing to act on, so we don't send noise.
    if (flagged.length === 0) {
      return {
        ok: true,
        month: label,
        flagged: 0,
        totalPromoted: promoted.length,
        emailStatus: "skipped: all promoted therapists met the threshold",
      };
    }

    const html = buildEmailHtml(flagged, promoted.length, label);
    let emailStatus = "sent";
    try {
      await resend.emails.send({
        from: "טיפול חכם <noreply@mentalytics.co.il>",
        to: REMINDER_TO,
        subject: `תזכורת: ${flagged.length} מטפלים מקודמים עם פחות מ-${CLICK_THRESHOLD} פניות בחודש ${label}`,
        html,
      });
    } catch (e) {
      emailStatus = `failed: ${e instanceof Error ? e.message : "unknown"}`;
    }

    return {
      ok: emailStatus === "sent",
      month: label,
      flagged: flagged.length,
      totalPromoted: promoted.length,
      emailStatus,
      status: emailStatus === "sent" ? 200 : 502,
    };
  } catch (err) {
    return {
      ok: false,
      month: label,
      flagged: 0,
      totalPromoted: 0,
      error: err instanceof Error ? err.message : "Unknown error",
      status: 500,
    };
  }
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runLowEngagementReminder();
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
