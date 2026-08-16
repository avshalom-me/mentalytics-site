import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { runDailyDigest } from "@/app/lib/daily-digest";
import { runWatchdog } from "@/app/lib/watchdog";
import { runConversionsSync, setupConversionActions } from "@/app/lib/google-ads-conversions";
import { googleAdsConfigured } from "@/app/lib/google-ads";
import { runAdsMonitor } from "@/app/lib/ads-monitor";

// ה-API של עמוד הסוכנים: יומן ריצות, תור ההצעות, והפעלת תצוגה מקדימה של
// דוח הבוקר. מוגן אוטומטית ב-Basic Auth דרך ה-middleware (קידומת /api/admin-).

export const dynamic = "force-dynamic";
// 300 ולא 120: הרצת שומר הלילה הידנית יכולה להימשך עד ~35 שניות בריצה
// מקבילה, אבל בתרחיש תקלה כוללת עם ניסיונות חוזרים אסור שוורסל יהרוג את
// הפונקציה לפני שהריצה נרשמת (ממצא ביקורת: ריצה שנהרגה נשארת "רץ..." לנצח).
export const maxDuration = 300;

export async function GET() {
  try {
    const [runsRes, pendingRes, resolvedRes, latestDigestRes] = await Promise.all([
      supabaseAdmin
        .from("agent_runs")
        .select("id, agent, started_at, finished_at, status, mode, summary, error")
        .order("started_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("agent_actions")
        .select("id, agent, action_type, title, body, entity_type, entity_label, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("agent_actions")
        .select("id, agent, title, status, status_changed_at")
        .neq("status", "pending")
        .order("status_changed_at", { ascending: false })
        .limit(10),
      // הדוח האחרון של בקר הבוקר, כולל תוכנו המלא (details) - כך העמוד מציג
      // אותו ישירות בלי מייל ובלי להריץ מחדש (החלטת המשתמש 16/8).
      supabaseAdmin
        .from("agent_runs")
        .select("started_at, mode, status, details")
        .eq("agent", "daily_digest")
        .in("status", ["ok", "empty"])
        .order("started_at", { ascending: false })
        .limit(1),
    ]);

    const latestDigestRun = latestDigestRes.data?.[0] ?? null;
    const digestDetails = (latestDigestRun?.details ?? null) as {
      sections?: unknown[];
      ai_summary?: string | null;
    } | null;

    return NextResponse.json({
      ok: true,
      runs: runsRes.data ?? [],
      pending_actions: pendingRes.data ?? [],
      resolved_actions: resolvedRes.data ?? [],
      latest_digest: latestDigestRun
        ? {
            started_at: latestDigestRun.started_at,
            status: latestDigestRun.status,
            sections: digestDetails?.sections ?? [],
            ai_summary: digestDetails?.ai_summary ?? null,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// הפעלה ידנית מהאדמין - תמיד תצוגה מקדימה, אף פעם לא שליחה. השליחה
// האמיתית שמורה לקרון החמוש בלבד, כדי שלא יהיו שני מסלולי שליחה.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action === "digest_preview") {
      const result = await runDailyDigest({ send: false });
      return NextResponse.json({
        ok: result.ok,
        empty: result.empty,
        sections: result.sections,
        ai_summary: result.aiSummary,
        html: result.html,
        recipients: result.recipients,
        error: result.error,
      });
    }
    if (body?.action === "watchdog_run") {
      const result = await runWatchdog({ send: false });
      return NextResponse.json({
        ok: result.ok,
        checks: result.checks,
        failures: result.failures.length,
        error: result.error,
      });
    }
    if (body?.action === "ads_run") {
      const result = await runAdsMonitor();
      return NextResponse.json({
        ok: result.ok,
        configured: result.configured,
        findings: result.findings,
        campaigns: result.campaigns,
        spend_mtd: result.spendMtd,
        budget_pace: result.budgetPace,
        error: result.error,
      });
    }
    if (body?.action === "conversions_preview") {
      const result = await runConversionsSync({ send: false });
      return NextResponse.json({
        ok: result.ok,
        configured: result.configured,
        actions: result.actions,
        actions_ready: result.actionsReady,
        pending: result.pending,
        error: result.error,
      });
    }
    // הקמה חד-פעמית של פעולות ההמרה בחשבון גוגל - כתיבה יחידה, מופעלת רק
    // מקליק מפורש בכפתור ייעודי (עם אישור) בעמוד הסוכנים.
    if (body?.action === "conversions_setup") {
      if (!googleAdsConfigured()) {
        return NextResponse.json(
          { ok: false, error: "חיבור Google Ads לא מוגדר בסביבה הזו" },
          { status: 400 }
        );
      }
      const actions = await setupConversionActions();
      return NextResponse.json({
        ok: true,
        actions,
        actions_ready: Boolean(actions.quiz && actions.subscription),
      });
    }
    return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id ?? "");
    const status = String(body?.status ?? "");
    if (!id || !["approved", "dismissed", "pending"].includes(status)) {
      return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("agent_actions")
      .update({
        status,
        status_changed_at: new Date().toISOString(),
        resolved_by: status === "pending" ? null : "admin",
        resolution_note: body?.note ? String(body.note) : null,
      })
      .eq("id", id);
    if (error) {
      // "החזר" על התראה שהסוכן כבר פתח מחדש נתקל באינדקס הייחודי - זו לא
      // תקלה אלא מצב צפוי, עם הסבר במקום כישלון שקט (ממצא ביקורת).
      if (error.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "כבר קיימת הצעה זהה ממתינה בתור - אין צורך להחזיר את הישנה" },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
