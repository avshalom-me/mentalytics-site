import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const safePeriod: Period = validPeriods.includes(period) ? period : "all";
  const since = periodToDate(safePeriod);

  try {
    // Run all queries in parallel
    const [eventsRes, viewsRes, clicksRes, therapistsRes] = await Promise.all([
      // analytics_events (page_view, profile_impression, filter_used)
      (() => {
        let q = supabaseAdmin
          .from("analytics_events")
          .select("event_type, therapist_id, metadata, created_at");
        if (since) q = q.gte("created_at", since);
        return q;
      })(),
      // profile views from existing table (with context for demographics)
      (() => {
        let q = supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at, viewer_region, viewer_issue, viewer_age_band, viewer_gender");
        if (since) q = q.gte("viewed_at", since);
        return q;
      })(),
      // contact clicks from existing table
      (() => {
        let q = supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, click_type, clicked_at");
        if (since) q = q.gte("clicked_at", since);
        return q;
      })(),
      // therapist names for the impressions table
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, status")
        .in("status", ["paying", "approved"]),
    ]);

    const events = (eventsRes.data ?? []) as { event_type: string; therapist_id: string | null; metadata: Record<string, string>; created_at: string }[];
    const views = (viewsRes.data ?? []) as { therapist_id: string; viewed_at: string }[];
    const clicks = (clicksRes.data ?? []) as { therapist_id: string; click_type: string; clicked_at: string }[];
    const therapists = (therapistsRes.data ?? []) as { id: string; full_name: string | null; status: string }[];

    // --- Funnel ---
    const pageViews = events.filter(e => e.event_type === "page_view").length;
    const impressions = events.filter(e => e.event_type === "profile_impression").length;
    const profileViews = views.length;
    const contactClicks = clicks.length;

    // --- Popular filters ---
    const filterCounts: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === "filter_used" && e.metadata?.filter_value) {
        const key = e.metadata.filter_value;
        filterCounts[key] = (filterCounts[key] ?? 0) + 1;
      }
    }
    const popularFilters = Object.entries(filterCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Weekly trends ---
    const weekBuckets: Record<string, { page_view: number; profile_impression: number; profile_view: number; contact_click: number }> = {};
    function getWeek(dateStr: string) {
      const d = new Date(dateStr);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().slice(0, 10);
    }
    function ensureBucket(week: string) {
      if (!weekBuckets[week]) weekBuckets[week] = { page_view: 0, profile_impression: 0, profile_view: 0, contact_click: 0 };
    }

    for (const e of events) {
      if (e.event_type === "page_view" || e.event_type === "profile_impression") {
        const w = getWeek(e.created_at);
        ensureBucket(w);
        weekBuckets[w][e.event_type]++;
      }
    }
    for (const v of views) {
      const w = getWeek(v.viewed_at);
      ensureBucket(w);
      weekBuckets[w].profile_view++;
    }
    for (const c of clicks) {
      const w = getWeek(c.clicked_at);
      ensureBucket(w);
      weekBuckets[w].contact_click++;
    }

    const trends = Object.entries(weekBuckets)
      .map(([week, counts]) => ({ week, ...counts }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // --- Quiz dropout ---
    const quizSteps = events.filter(e => e.event_type === "quiz_step") as unknown as { metadata: { quiz_type: string; step: string; progress: number } }[];
    const quizCompletes = events.filter(e => e.event_type === "quiz_complete") as unknown as { metadata: { quiz_type: string } }[];

    function buildQuizFunnel(quizType: string) {
      const steps = quizSteps.filter(e => e.metadata?.quiz_type === quizType);
      const completed = quizCompletes.filter(e => e.metadata?.quiz_type === quizType).length;
      const stepCounts: Record<string, number> = {};
      for (const s of steps) {
        const step = s.metadata?.step;
        if (step) stepCounts[step] = (stepCounts[step] ?? 0) + 1;
      }
      const sorted = Object.entries(stepCounts)
        .map(([step, count]) => ({ step, count }))
        .sort((a, b) => b.count - a.count);
      return { steps: sorted, started: sorted[0]?.count ?? 0, completed };
    }

    const adultsQuiz = buildQuizFunnel("adults");
    const kidsQuiz = buildQuizFunnel("kids");

    // --- Demographics from profile views ---
    const viewsWithContext = (viewsRes.data ?? []) as { therapist_id: string; viewed_at: string; viewer_region?: string; viewer_issue?: string; viewer_age_band?: string; viewer_gender?: string }[];

    function countField(field: string) {
      const counts: Record<string, number> = {};
      for (const v of viewsWithContext) {
        const val = (v as Record<string, unknown>)[field] as string | undefined;
        if (val) counts[val] = (counts[val] ?? 0) + 1;
      }
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    const demographics = {
      byRegion: countField("viewer_region"),
      byIssue: countField("viewer_issue"),
      byAgeBand: countField("viewer_age_band"),
      byGender: countField("viewer_gender"),
    };

    // --- Click type breakdown ---
    const clickTypeBreakdown: Record<string, number> = {};
    for (const c of clicks) {
      clickTypeBreakdown[c.click_type] = (clickTypeBreakdown[c.click_type] ?? 0) + 1;
    }

    // --- Impressions vs Clicks per therapist ---
    const therapistMap = new Map(therapists.map(t => [t.id, t]));

    const impressionsByTherapist: Record<string, number> = {};
    for (const e of events) {
      if (e.event_type === "profile_impression" && e.therapist_id) {
        impressionsByTherapist[e.therapist_id] = (impressionsByTherapist[e.therapist_id] ?? 0) + 1;
      }
    }

    const clicksByTherapist: Record<string, number> = {};
    for (const c of clicks) {
      clicksByTherapist[c.therapist_id] = (clicksByTherapist[c.therapist_id] ?? 0) + 1;
    }

    const viewsByTherapist: Record<string, number> = {};
    for (const v of views) {
      viewsByTherapist[v.therapist_id] = (viewsByTherapist[v.therapist_id] ?? 0) + 1;
    }

    const allTherapistIds = new Set([
      ...Object.keys(impressionsByTherapist),
      ...Object.keys(clicksByTherapist),
      ...Object.keys(viewsByTherapist),
    ]);

    const therapistCTR = Array.from(allTherapistIds)
      .map(id => {
        const t = therapistMap.get(id);
        const imp = impressionsByTherapist[id] ?? 0;
        const clk = clicksByTherapist[id] ?? 0;
        const vw = viewsByTherapist[id] ?? 0;
        return {
          id,
          full_name: t?.full_name ?? "—",
          status: t?.status ?? "unknown",
          impressions: imp,
          profile_views: vw,
          clicks: clk,
          ctr: imp > 0 ? Math.round((clk / imp) * 1000) / 10 : 0,
        };
      })
      .filter(r => r.impressions > 0 || r.clicks > 0 || r.profile_views > 0)
      .sort((a, b) => b.impressions - a.impressions);

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      funnel: { pageViews, impressions, profileViews, contactClicks },
      popularFilters,
      trends,
      therapistCTR,
      quizDropout: { adults: adultsQuiz, kids: kidsQuiz },
      demographics,
      clickTypeBreakdown,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
