import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { latestRetentionReview, retentionOutcomes, runRetentionReview } from "@/app/lib/retention-review-data";
import {
  acknowledgeReview,
  createRetentionTask,
  dismissRetentionAction,
  extendTrial,
  freezeFromReview,
  recordCampaignAction,
  sendRetentionEmail,
  type ActionTarget,
} from "@/app/lib/retention-actions";
import { buildRegionCampaignSpec, NEW_CAMPAIGN_DAILY_ILS } from "@/app/lib/ads-campaign-spec";
import { createPausedCampaign, freeCampaignName, setCampaignDailyBudget, setCampaignStatus } from "@/app/lib/google-ads-write";

// סקירת השימור השבועית: קריאה לעמוד ולמודאל, והכפתורים. מאחורי ה-Basic Auth
// של האדמין (middleware.ts מכסה כל /api/admin-*).

export const dynamic = "force-dynamic";
// ריצה ידנית עם המודל (סקירות כרטיס, טיוטות) לוקחת עד כשתי דקות.
export const maxDuration = 300;

const RISK_FOR_MODAL = new Set(["critical", "high", "medium"]);
/** כמה ימים אחורה העמוד יודע מה כבר בוצע או נדחה (לסימון ✓ על הכפתור). */
const DONE_DAYS = 14;

export async function GET(req: NextRequest) {
  try {
    const brief = req.nextUrl.searchParams.get("brief") === "1";
    if (req.nextUrl.searchParams.get("outcomes") === "1") {
      const out = await retentionOutcomes();
      return NextResponse.json({ ok: true, ...out });
    }
    const latest = await latestRetentionReview();
    if (!latest) return NextResponse.json({ ok: true, review: null, rows: [], pending: [], done: [] });

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

    const { data: done, error: doneErr } = await supabaseAdmin
      .from("agent_actions")
      .select("id, action_type, entity_id, status, status_changed_at, resolution_note")
      .eq("agent", "retention")
      .in("status", ["executed", "dismissed"])
      .neq("action_type", "alert")
      .gte("status_changed_at", new Date(Date.now() - DONE_DAYS * 86_400_000).toISOString())
      .order("status_changed_at", { ascending: false })
      .limit(300);
    if (doneErr) throw new Error(doneErr.message);
    return NextResponse.json({ ok: true, review: latest.review, rows: latest.rows, pending: pending ?? [], done: done ?? [] });
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
  // הכפתור מזהה מטפל/ת; id של הצעה ממתינה הוא תוספת, לא תנאי.
  const target: ActionTarget = {
    therapistId: typeof body.therapist_id === "string" && body.therapist_id ? body.therapist_id : null,
    actionId: typeof body.id === "string" && body.id ? body.id : null,
  };
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
      if (!target.therapistId) return NextResponse.json({ ok: false, error: "חסר therapist_id" }, { status: 400 });
      const r = await extendTrial({ therapistId: target.therapistId, days: Number(body.days ?? 30) });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    // פעולות הקמפיין: כתיבה לגוגל אדס מלחיצה, עם אישור בדפדפן. המטפל/ת הוא/היא
    // רק מי שבגללו/ה (לסימון ✓ וללולאת התוצאות); השינוי עצמו ברמת החשבון.
    if (action === "campaign_budget") {
      const campaignId = String(body.campaign_id ?? "").replace(/\D/g, "");
      const to = Number(body.to);
      if (!campaignId || !Number.isFinite(to)) return NextResponse.json({ ok: false, error: "חסר קמפיין או סכום" }, { status: 400 });
      const r = await setCampaignDailyBudget({ campaignId, amountIls: to, reason: `retention review${target.therapistId ? ` (therapist ${target.therapistId})` : ""}`, override: body.override === true });
      if (r.ok) await recordCampaignAction({ therapistId: target.therapistId, note: `תקציב ${r.name}: מ-₪${r.from ?? "?"} ל-₪${r.to} ליום`, payload: { kind: "budget", campaign_id: r.campaignId, name: r.name, from: r.from, to: r.to } });
      return NextResponse.json(r, { status: r.ok ? 200 : r.overCeiling ? 409 : 400 });
    }
    if (action === "campaign_status") {
      const campaignId = String(body.campaign_id ?? "").replace(/\D/g, "");
      const status = body.status === "PAUSED" ? "PAUSED" : "ENABLED";
      if (!campaignId) return NextResponse.json({ ok: false, error: "חסר קמפיין" }, { status: 400 });
      const r = await setCampaignStatus({ campaignId, status, reason: `retention review${target.therapistId ? ` (therapist ${target.therapistId})` : ""}`, override: body.override === true });
      if (r.ok) await recordCampaignAction({ therapistId: target.therapistId, note: `${r.name} ${status === "ENABLED" ? "הופעל" : "הושהה"}`, payload: { kind: status === "ENABLED" ? "enable" : "pause", campaign_id: r.campaignId, name: r.name } });
      return NextResponse.json(r, { status: r.ok ? 200 : r.overCeiling ? 409 : 400 });
    }
    if (action === "campaign_create") {
      const region = String(body.region ?? "");
      const daily = Number(body.daily ?? NEW_CAMPAIGN_DAILY_ILS);
      const base = buildRegionCampaignSpec(region, { dailyBudgetIls: Number.isFinite(daily) ? daily : NEW_CAMPAIGN_DAILY_ILS });
      if (!base) return NextResponse.json({ ok: false, error: "לאזור הזה אין מפרט קמפיין" }, { status: 400 });
      const name = await freeCampaignName(base.name);
      const spec = name === base.name ? base : { ...base, name };
      const r = await createPausedCampaign(spec, `retention review${target.therapistId ? ` (therapist ${target.therapistId})` : ""}`);
      if (r.ok) await recordCampaignAction({ therapistId: target.therapistId, note: `הוקם קמפיין ${r.name} ב${region} (מושהה)`, payload: { kind: "create", campaign_id: r.campaignId, name: r.name, region, daily: spec.dailyBudgetIls } });
      return NextResponse.json(r.ok ? { ...r, daily: spec.dailyBudgetIls, keywords: spec.keywords.length } : r, { status: r.ok ? 200 : 400 });
    }
    if (!target.therapistId && !target.actionId) return NextResponse.json({ ok: false, error: "חסר מזהה מטפל/ת" }, { status: 400 });
    if (action === "email_send") {
      const r = await sendRetentionEmail({ ...target, subject: String(body.subject ?? ""), body: String(body.body ?? ""), force: body.force === true });
      return NextResponse.json(r, { status: r.ok ? 200 : r.cooled ? 409 : 400 });
    }
    if (action === "freeze") {
      const r = await freezeFromReview({ ...target, days: Number(body.days ?? 7) });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    if (action === "task") {
      const r = await createRetentionTask(target);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (action === "dismiss") {
      const r = await dismissRetentionAction({ ...target, type: typeof body.type === "string" ? body.type : null, note: typeof body.note === "string" ? body.note : null });
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    return NextResponse.json({ ok: false, error: `פעולה לא מוכרת: ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
