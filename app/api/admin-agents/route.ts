import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { runDailyDigest } from "@/app/lib/daily-digest";
import { runWatchdog } from "@/app/lib/watchdog";

// ה-API של עמוד הסוכנים: יומן ריצות, תור ההצעות, והפעלת תצוגה מקדימה של
// דוח הבוקר. מוגן אוטומטית ב-Basic Auth דרך ה-middleware (קידומת /api/admin-).

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const [runsRes, pendingRes, resolvedRes] = await Promise.all([
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
    ]);

    return NextResponse.json({
      ok: true,
      runs: runsRes.data ?? [],
      pending_actions: pendingRes.data ?? [],
      resolved_actions: resolvedRes.data ?? [],
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
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
