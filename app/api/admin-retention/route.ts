import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { latestRetentionReview, retentionOutcomes, runRetentionReview } from "@/app/lib/retention-review-data";
import {
  acknowledgeReview,
  createRetentionTask,
  dismissRetentionAction,
  extendTrial,
  freezeFromReview,
  sendRetentionEmail,
} from "@/app/lib/retention-actions";

// סקירת השימור השבועית: קריאה לעמוד ולמודאל, והכפתורים. מאחורי ה-Basic Auth
// של האדמין (middleware.ts מכסה כל /api/admin-*).

export const dynamic = "force-dynamic";
// ריצה ידנית עם המודל (סקירות כרטיס, טיוטות, נרטיב) לוקחת עד כשתי דקות.
export const maxDuration = 300;

const RISK_FOR_MODAL = new Set(["critical", "high", "medium"]);

export async function GET(req: NextRequest) {
  try {
    const brief = req.nextUrl.searchParams.get("brief") === "1";
    if (req.nextUrl.searchParams.get("outcomes") === "1") {
      const out = await retentionOutcomes();
      return NextResponse.json({ ok: true, ...out });
    }
    const latest = await latestRetentionReview();
    if (!latest) return NextResponse.json({ ok: true, review: null, rows: [], pending: [] });

    const { data: pending, error } = await supabaseAdmin
      .from("agent_actions")
      .select("id, action_type, title, body, severity, entity_id, entity_label, payload, status, created_at")
      .eq("agent", "retention")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    if (brief) {
      // למודאל בכניסה לאדמין: הסיכום וחמש השורות הראשונות שדורשות מבט.
      const top = latest.rows.filter((r) => RISK_FOR_MODAL.has(r.risk)).slice(0, 5);
      return NextResponse.json({
        ok: true,
        review: latest.review,
        top: top.map((r) => ({ therapist_id: r.therapist_id, name: r.name, tier: r.tier, risk: r.risk, risk_reason: r.risk_reason, todo: r.todo, primary_action: r.primary_action })),
        pending_count: (pending ?? []).filter((p) => p.action_type !== "alert").length,
      });
    }
    return NextResponse.json({ ok: true, review: latest.review, rows: latest.rows, pending: pending ?? [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const actionId = String(body.id ?? "");
  try {
    if (action === "run") {
      const result = await runRetentionReview({ mode: "manual" });
      return NextResponse.json({ ok: result.ok, error: result.error, summary: result.summary, week_start: result.weekStart, disabled: result.disabled }, { status: result.ok ? 200 : 500 });
    }
    if (action === "ack") {
      const reviewId = String(body.review_id ?? "");
      if (!reviewId) return NextResponse.json({ ok: false, error: "חסר review_id" }, { status: 400 });
      const r = await acknowledgeReview(reviewId, String(body.by ?? "admin"));
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    if (action === "extend_trial") {
      const therapistId = String(body.therapist_id ?? "");
      if (!therapistId) return NextResponse.json({ ok: false, error: "חסר therapist_id" }, { status: 400 });
      const r = await extendTrial({ therapistId, days: Number(body.days ?? 30) });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    if (!actionId) return NextResponse.json({ ok: false, error: "חסר id של ההצעה" }, { status: 400 });
    if (action === "email_send") {
      const r = await sendRetentionEmail({ actionId, subject: String(body.subject ?? ""), body: String(body.body ?? ""), force: body.force === true });
      return NextResponse.json(r, { status: r.ok ? 200 : r.cooled ? 409 : 400 });
    }
    if (action === "freeze") {
      const r = await freezeFromReview({ actionId, days: Number(body.days ?? 7) });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    if (action === "task") {
      const r = await createRetentionTask({ actionId });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (action === "dismiss") {
      const r = await dismissRetentionAction(actionId, typeof body.note === "string" ? body.note : null);
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    return NextResponse.json({ ok: false, error: `פעולה לא מוכרת: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
