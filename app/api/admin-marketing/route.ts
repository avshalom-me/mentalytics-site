import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// PHASE 1 marketing/leads dashboard — READ-ONLY. Serves the AI insight from the
// latest weekly report, 30-day KPIs (with the prior 30 days for deltas), and
// the business-plan targets annotated with the actuals we can derive today.
// Funnels / campaigns / demand come in later phases.

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// A metric whose name ends in `_max` is a ceiling (lower is better); everything
// else is a goal (higher is better). Drives the pass/fail direction on the page.
function directionFor(metric: string): "ceiling" | "goal" {
  return metric.endsWith("_max") ? "ceiling" : "goal";
}

export async function GET() {
  try {
    const d30 = daysAgoIso(30);
    const d60 = daysAgoIso(60);

    const [
      aiRes,
      contactsRes,
      contactsPrevRes,
      profileViewsRes,
      explainClicksRes,
      payingRes,
      planTargetsRes,
    ] = await Promise.all([
      // Latest weekly report → the AI narrative.
      supabaseAdmin
        .from("weekly_reports")
        .select(
          "week_start, week_end, ai_summary, ai_recommendations, ai_silent_therapists_advice, ai_marketing, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1),
      // Contacts (therapist contact clicks), last 30 days.
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("id", { count: "exact", head: true })
        .gte("clicked_at", d30),
      // Contacts, the 30 days before that (for the delta).
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("id", { count: "exact", head: true })
        .gte("clicked_at", d60)
        .lt("clicked_at", d30),
      // Profile views, last 30 days.
      supabaseAdmin
        .from("therapist_profile_views")
        .select("id", { count: "exact", head: true })
        .gte("viewed_at", d30),
      // "AI explain" clicks on therapist cards, last 30 days.
      supabaseAdmin
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "therapist_explain_click")
        .gte("created_at", d30),
      // Paying, admin-approved therapists (the therapists_total actual).
      supabaseAdmin
        .from("therapists")
        .select("id", { count: "exact", head: true })
        .eq("status", "paying")
        .eq("admin_approved", true),
      // Business-plan targets — all rows.
      supabaseAdmin
        .from("plan_targets")
        .select("id, metric, month, scenario, target")
        .order("month", { ascending: true }),
    ]);

    if (aiRes.error) throw aiRes.error;
    if (contactsRes.error) throw contactsRes.error;
    if (contactsPrevRes.error) throw contactsPrevRes.error;
    if (profileViewsRes.error) throw profileViewsRes.error;
    if (explainClicksRes.error) throw explainClicksRes.error;
    if (payingRes.error) throw payingRes.error;
    if (planTargetsRes.error) throw planTargetsRes.error;

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

    const contacts = contactsRes.count ?? 0;
    const contactsPrev = contactsPrevRes.count ?? 0;
    const profileViews = profileViewsRes.count ?? 0;
    const explainClicks = explainClicksRes.count ?? 0;
    const conversionPct = profileViews > 0 ? (contacts / profileViews) * 100 : 0;

    const paying = payingRes.count ?? 0;

    // Actuals we can compute right now. Everything not here stays null (e.g.
    // CPL / CAC need ad spend, lead→treatment needs outcome data, churn is not
    // wired up yet). The page renders those as "טרם מחושב".
    const actualByMetric: Record<string, number> = {
      therapists_total: paying,
    };

    const targets = (planTargetsRes.data ?? []).map((t) => ({
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
      kpis: {
        contacts,
        contactsPrev,
        profileViews,
        conversionPct,
        explainClicks,
      },
      targets,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
