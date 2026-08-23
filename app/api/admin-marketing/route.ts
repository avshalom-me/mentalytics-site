import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

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
// Real profile-page views only. `source='match_card'` rows are impressions (a
// card shown in match results), not views — the rest of admin (analytics /
// stats) treats them as impressions, so they must be excluded here too or the
// conversion denominator inflates and view→contact % under-reports.
function countProfileViews(sinceIso: string) {
  return supabaseAdmin
    .from("therapist_profile_views")
    .select("id", { count: "exact", head: true })
    .neq("source", "match_card")
    .gte("viewed_at", sinceIso);
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
    // admin_approved gates visibility for PAYING therapists too (a therapist who
    // paid during signup stays hidden until vetted) — without the filter,
    // "מוצגים למטופלים" here would overcount vs. /admin/analytics the moment a
    // paid-but-unvetted therapist exists. Unvetted payers fall into pendingNamed.
    const paidQ = tCount().eq("status", "paying").eq("promotion_source", "paid").eq("admin_approved", true);
    const trialQ = tCount().eq("status", "paying").neq("promotion_source", "paid").eq("admin_approved", true);
    const freeQ = tCount().eq("status", "approved").eq("admin_approved", true);

    // Questionnaires completed in the current calendar month (UTC on Vercel).
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const quizMonthQ = supabaseAdmin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "quiz_complete")
      .gte("created_at", monthStart);

    // Subscriptions drive churn. Only real paying therapists have a Sumit
    // subscription (gifted/trial promotions do not), so this is a small table.
    const subsQ = supabaseAdmin.from("subscriptions").select("therapist_id, status");

    // Contact COVERAGE of paying therapists — the dashboard's reason to exist:
    // does every paying (then promoted) therapist actually receive inquiries?
    // Raw rows, aggregated here: clicks is a small table, real profile views in
    // the last 30d likewise; both fetched cap-safe.
    const payingListQ = supabaseAdmin
      .from("therapists")
      .select("id, full_name, promotion_source")
      .eq("status", "paying")
      .eq("admin_approved", true);
    const clicksAllQ = fetchAllRows<{ therapist_id: string; clicked_at: string; channel: string | null }>(() =>
      supabaseAdmin.from("therapist_contact_clicks").select("therapist_id, clicked_at, channel")
    );
    const views30Q = fetchAllRows<{ therapist_id: string }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("therapist_id")
        .in("source", ["match", "directory"])
        .gte("viewed_at", iso(30))
    );

    // 4 counts per period, in order: contacts, contactsPrev, profileViews, explainClicks.
    const periodQs = PERIODS.flatMap((d) => [
      countRows("therapist_contact_clicks", "clicked_at", iso(d)),
      countRows("therapist_contact_clicks", "clicked_at", iso(2 * d), iso(d)),
      countProfileViews(iso(d)),
      countExplain(iso(d)),
    ]);

    // Typed Promise.all groups (kept apart so the period results stay a
    // single count-query type), run concurrently.
    const [
      [aiRes, targetsRes, totalRes, registeredRes, paidRes, trialRes, freeRes, quizMonthRes, subsRes],
      periodRes,
      payingListRes,
      clicksAll,
      views30,
    ] = await Promise.all([
      Promise.all([aiQ, targetsQ, totalQ, registeredQ, paidQ, trialQ, freeQ, quizMonthQ, subsQ]),
      Promise.all(periodQs),
      payingListQ,
      clicksAllQ,
      views30Q,
    ]);

    if (aiRes.error) throw aiRes.error;
    if (targetsRes.error) throw targetsRes.error;
    if (subsRes.error) throw subsRes.error;
    if (payingListRes.error) throw payingListRes.error;
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
      listed: paid + trial + free, // approved & shown to patients (= /admin dashboard's paying+approved)
      paying: paid + trial,
      pendingNamed: Math.max(0, registered - paid - trial - free),
      incomplete: Math.max(0, total - registered),
    };
    const quizThisMonth = quizMonthRes.count ?? 0;

    // --- Contact coverage of paying/promoted therapists ---
    type PayingRow = { id: string; full_name: string | null; promotion_source: string | null };
    const payingList = (payingListRes.data ?? []) as PayingRow[];
    const payingIdSet = new Set(payingList.map((t) => t.id));

    // Last contact ever + per-window covered sets, from one pass over all clicks.
    // Ads contacts are tracked in a parallel map so the coverage chips can also
    // answer "and how many of those did the ad spend actually reach". Coverage
    // alone cannot: a therapist reached purely by organic traffic looks
    // identical to one a campaign is paying for.
    const lastContactAt = new Map<string, number>();
    const lastAdsContactAt = new Map<string, number>();
    for (const c of clicksAll) {
      if (!payingIdSet.has(c.therapist_id)) continue;
      const ts = new Date(c.clicked_at).getTime();
      if (ts > (lastContactAt.get(c.therapist_id) ?? 0)) lastContactAt.set(c.therapist_id, ts);
      if (c.channel === "google_paid" && ts > (lastAdsContactAt.get(c.therapist_id) ?? 0)) {
        lastAdsContactAt.set(c.therapist_id, ts);
      }
    }
    const views30ByTherapist = new Map<string, number>();
    for (const v of views30) {
      if (payingIdSet.has(v.therapist_id)) {
        views30ByTherapist.set(v.therapist_id, (views30ByTherapist.get(v.therapist_id) ?? 0) + 1);
      }
    }

    const tierOf = (t: PayingRow) => (t.promotion_source === "paid" ? "paid" : "trial");
    const coveredInWindow = (t: PayingRow, days: number) =>
      (lastContactAt.get(t.id) ?? 0) >= Date.now() - days * 86_400_000;

    const coveredByAdsInWindow = (t: PayingRow, days: number) =>
      (lastAdsContactAt.get(t.id) ?? 0) >= Date.now() - days * 86_400_000;

    type CoveragePeriod = { paid: number; trial: number; paidAds: number; trialAds: number };
    const coveragePeriods: Record<string, CoveragePeriod> = {};
    for (const d of PERIODS) {
      const p: CoveragePeriod = { paid: 0, trial: 0, paidAds: 0, trialAds: 0 };
      for (const t of payingList) {
        const tier = tierOf(t);
        if (coveredInWindow(t, d)) p[tier]++;
        // Always a subset of the line above - being reached by an ad is one way
        // of being reached - so paidAds can never exceed paid.
        if (coveredByAdsInWindow(t, d)) p[tier === "paid" ? "paidAds" : "trialAds"]++;
      }
      coveragePeriods[`d${d}`] = p;
    }

    // "Starving" = paying/promoted, listed, and no contact in the last 30 days.
    // Never-contacted first, then longest-since; paid before trial.
    const nowMs = Date.now();
    const starving = payingList
      .filter((t) => !coveredInWindow(t, 30))
      .map((t) => {
        const last = lastContactAt.get(t.id) ?? null;
        return {
          id: t.id,
          name: t.full_name ?? "—",
          tier: tierOf(t),
          views30: views30ByTherapist.get(t.id) ?? 0,
          daysSinceContact: last ? Math.floor((nowMs - last) / 86_400_000) : null,
        };
      })
      .sort((a, b) => {
        if (a.tier !== b.tier) return a.tier === "paid" ? -1 : 1;
        const aDays = a.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
        const bDays = b.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
        return bDays !== aDays ? bDays - aDays : b.views30 - a.views30;
      });

    const coverage = {
      paidTotal: payingList.filter((t) => tierOf(t) === "paid").length,
      trialTotal: payingList.filter((t) => tierOf(t) === "trial").length,
      periods: coveragePeriods,
      starving,
    };

    // Cumulative churn: therapists who ever had a subscription but no longer have
    // an active one. cancelled_at is unreliable (nullable), so we compare the
    // ever-paid vs currently-active sets rather than timestamps. A stable MONTHLY
    // churn rate needs more history (the paying base is still ~tiny), so this is
    // cumulative-to-date.
    const subs = (subsRes.data ?? []) as { therapist_id: string; status: string }[];
    const everPaid = new Set(subs.map((s) => s.therapist_id));
    const activePaying = new Set(subs.filter((s) => s.status === "active").map((s) => s.therapist_id));
    const churnedCount = [...everPaid].filter((id) => !activePaying.has(id)).length;
    const churn = {
      everPaid: everPaid.size,
      active: activePaying.size,
      churned: churnedCount,
      pct: everPaid.size > 0 ? Math.round((churnedCount / everPaid.size) * 1000) / 10 : null,
    };

    // Actuals we can compute now; everything else stays null → "טרם מחושב".
    // therapists_total = listed/active supply (consistent with the main admin
    // dashboard), not raw registrations.
    const actualByMetric: Record<string, number> = {
      therapists_total: supply.listed,
      questionnaires_month: quizThisMonth,
    };
    if (churn.pct != null) actualByMetric.churn_max_pct = churn.pct;
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
      churn,
      coverage,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
