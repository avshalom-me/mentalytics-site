import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// PHASE 1 marketing/leads dashboard — READ-ONLY. KPIs over 2 / 7 / 30 days (each
// with the prior same-length window for a delta), the latest weekly-report AI
// insight (shown on-demand on the page), and business-plan targets annotated
// with the actuals we can derive today. Funnels / campaigns come in later phases.

const PERIODS = [2, 7, 30] as const;

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

// A metric whose name contains `_max` is a ceiling (lower is better) — e.g.
// cpl_max, cac_max, churn_max_pct; everything else is a goal (higher is better).
// Drives the pass/fail direction on the page.
function directionFor(metric: string): "ceiling" | "goal" {
  return metric.includes("_max") ? "ceiling" : "goal";
}

function countRows(table: string, col: string, sinceIso: string, untilIso?: string) {
  let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true }).gte(col, sinceIso);
  if (untilIso) q = q.lt(col, untilIso);
  return q;
}
// "Personal AI analysis" = both explain surfaces: the treatment-type one
// (recommendation_explain_click, live for a while) and the newer per-therapist
// one (therapist_explain_click). Counting only the latter under-reported to 0.
function countExplain(sinceIso: string) {
  return supabaseAdmin
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .in("event_type", ["recommendation_explain_click", "therapist_explain_click"])
    .gte("created_at", sinceIso);
}

export async function GET() {
  try {
    const aiQ = supabaseAdmin
      .from("weekly_reports")
      .select(
        "week_start, week_end, ai_summary, ai_recommendations, ai_silent_therapists_advice, ai_marketing, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1);
    const targetsQ = supabaseAdmin
      .from("plan_targets")
      .select("id, metric, month, scenario, target")
      .order("month", { ascending: true });

    // Supply tiers. "therapists_total" (the plan metric) = therapists who
    // actually completed registration, i.e. have a name — NOT the ~86 nameless
    // abandoned drafts. We count each tier so the dashboard can show the split:
    //   paid  = real paying (promotion_source='paid')
    //   trial = gifted / promoted for free (paying status but not 'paid')
    //   free  = approved directory listings (not paying)
    // pendingNamed (submitted, awaiting approval) and incomplete (no name) are
    // derived on the client from total/registered.
    const tCount = () => supabaseAdmin.from("therapists").select("id", { count: "exact", head: true });
    const totalQ = tCount();
    const registeredQ = tCount().not("full_name", "is", null).neq("full_name", "");
    const paidQ = tCount().eq("status", "paying").eq("promotion_source", "paid");
    const trialQ = tCount().eq("status", "paying").neq("promotion_source", "paid");
    const freeQ = tCount().eq("status", "approved");

    // Questionnaires completed in the current calendar month (UTC on Vercel).
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const quizMonthQ = supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "quiz_complete")
      .gte("created_at", monthStart);

    // 4 counts per period, in order: contacts, contactsPrev, profileViews, explainClicks.
    const periodQs = PERIODS.flatMap((d) => [
      countRows("therapist_contact_clicks", "clicked_at", iso(d)),
      countRows("therapist_contact_clicks", "clicked_at", iso(2 * d), iso(d)),
      countRows("therapist_profile_views", "viewed_at", iso(d)),
      countExplain(iso(d)),
    ]);

    // Two typed Promise.all groups (kept apart so the period results stay a
    // single count-query type), run concurrently.
    const [[aiRes, targetsRes, totalRes, registeredRes, paidRes, trialRes, freeRes, quizMonthRes], periodRes] =
      await Promise.all([
        Promise.all([aiQ, targetsQ, totalQ, registeredQ, paidQ, trialQ, freeQ, quizMonthQ]),
        Promise.all(periodQs),
      ]);

    if (aiRes.error) throw aiRes.error;
    if (targetsRes.error) throw targetsRes.error;
    for (const r of [totalRes, registeredRes, paidRes, trialRes, freeRes, quizMonthRes]) if (r.error) throw r.error;
    for (const r of periodRes) if (r.error) throw r.error;

    const report = aiRes.data?.[0] ?? null;
    const ai = report
      ? {
          summary: report.ai_summary ?? null,
          recommendations: report.ai_recommendations ?? null,
          silentTherapists: report.ai_silent_therapists_advice ?? null,
          marketing: report.ai_marketing ?? null,
          weekStart: report.week_start ?? null,
          weekEnd: report.week_end ?? null,
        }
      : null;

    const kpis: Record<string, unknown> = {};
    PERIODS.forEach((d, i) => {
      const b = i * 4;
      const contacts = periodRes[b].count ?? 0;
      const contactsPrev = periodRes[b + 1].count ?? 0;
      const profileViews = periodRes[b + 2].count ?? 0;
      const explainClicks = periodRes[b + 3].count ?? 0;
      kpis[`d${d}`] = {
        contacts,
        contactsPrev,
        profileViews,
        explainClicks,
        conversionPct: profileViews > 0 ? (contacts / profileViews) * 100 : 0,
      };
    });

    const total = totalRes.count ?? 0;
    const registered = registeredRes.count ?? 0;
    const paid = paidRes.count ?? 0;
    const trial = trialRes.count ?? 0;
    const free = freeRes.count ?? 0;
    const supply = {
      total,
      registered,
      paid,
      trial,
      free,
      paying: paid + trial,
      pendingNamed: Math.max(0, registered - paid - trial - free),
      incomplete: Math.max(0, total - registered),
    };
    const quizThisMonth = quizMonthRes.count ?? 0;

    // Actuals we can compute now; everything else stays null → "טרם מחושב".
    const actualByMetric: Record<string, number> = {
      therapists_total: registered,
      questionnaires_month: quizThisMonth,
    };
    const targets = (targetsRes.data ?? []).map((t) => ({
      id: t.id,
      metric: t.metric,
      month: t.month,
      scenario: t.scenario,
      target: Number(t.target),
      actual: t.metric in actualByMetric ? actualByMetric[t.metric] : null,
      direction: directionFor(t.metric),
    }));

    return NextResponse.json({
      ok: true,
      ai,
      kpis,
      targets,
      supply,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
