import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

// PostgREST caps every select at 1000 rows. The event tables grow well past
// that (analytics_events alone is in the thousands), so a plain select silently
// returns only a 1000-row slice — which freezes all the counts once the table
// crosses 1000 rows. Page through with .range() to aggregate the FULL set.
// makeQuery must return a FRESH builder each call (a builder can't be reused
// after it's awaited).
async function fetchAllRows<T>(makeQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return all;
}

type TherapistRow = {
  id: string;
  full_name: string | null;
  status: string;
  admin_approved: boolean | null;
  promotion_source: string | null;
  gender: string | null;
  online: boolean | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  age_groups: string[] | null;
  regions: string[] | null;
  arrangements: string[] | null;
  languages: string[] | null;
  cultural_prefs: string[] | null;
  profile_photo_path: string | null;
  accepting_new_clients: boolean | null;
};

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const safePeriod: Period = validPeriods.includes(period) ? period : "all";
  const since = periodToDate(safePeriod);

  try {
    // Paginated fetches (see fetchAllRows) so counts reflect ALL rows, not just
    // the first 1000. Therapists is ~tens of rows so a single select is fine.
    const [events, views, clicks, therapistsRes] = await Promise.all([
      fetchAllRows<{ event_type: string; therapist_id: string | null; metadata: Record<string, string>; created_at: string }>(() => {
        let q = supabaseAdmin
          .from("analytics_events")
          .select("event_type, therapist_id, metadata, created_at")
          .order("created_at", { ascending: true });
        if (since) q = q.gte("created_at", since);
        return q;
      }),
      fetchAllRows<{ therapist_id: string; viewed_at: string; source?: string; viewer_region?: string; viewer_issue?: string; viewer_age_band?: string; viewer_gender?: string }>(() => {
        let q = supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at, source, viewer_region, viewer_issue, viewer_age_band, viewer_gender")
          .order("viewed_at", { ascending: true });
        if (since) q = q.gte("viewed_at", since);
        return q;
      }),
      fetchAllRows<{ therapist_id: string; click_type: string; clicked_at: string; source?: string }>(() => {
        let q = supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, click_type, clicked_at, source")
          .order("clicked_at", { ascending: true });
        if (since) q = q.gte("clicked_at", since);
        return q;
      }),
      // therapists for the impressions table + profile breakdowns (one fetch)
      supabaseAdmin
        .from("therapists")
        .select(
          "id, full_name, status, admin_approved, promotion_source, gender, online, therapist_types, training_areas, age_groups, regions, arrangements, languages, cultural_prefs, profile_photo_path, accepting_new_clients"
        )
        .in("status", ["paying", "approved"]),
    ]);

    const therapists = (therapistsRes.data ?? []) as TherapistRow[];

    // --- Funnel (split by acquisition source) ---
    // Directory: landing page_view → card impression (IntersectionObserver) →
    //   profile view (source=directory) → contact (source=directory).
    // Matching: quiz completion (reaching results) → card impression
    //   (source=match_card) → profile view (source=match) → contact (source=match).
    // page_view / profile_impression are emitted only on the directory.
    const dirEntries = events.filter(e => e.event_type === "page_view").length;
    const dirImpressions = events.filter(e => e.event_type === "profile_impression").length;
    const quizCompleted = events.filter(e => e.event_type === "quiz_complete").length;
    const dirViews = views.filter(v => v.source === "directory").length;
    const matchImpressions = views.filter(v => v.source === "match_card").length;
    const matchViews = views.filter(v => v.source === "match").length;
    // Everything that isn't a match-flow click counts as directory-side (directory,
    // profile-page site messages, or legacy null) so site_message contacts aren't
    // dropped from the funnel total.
    const dirClicks = clicks.filter(c => c.source !== "match").length;
    const matchClicks = clicks.filter(c => c.source === "match").length;

    const funnelBySource = {
      directory: { pageViews: dirEntries, impressions: dirImpressions, profileViews: dirViews, contactClicks: dirClicks },
      match: { pageViews: quizCompleted, impressions: matchImpressions, profileViews: matchViews, contactClicks: matchClicks },
    };
    // Combined = sum of the two sources (so "הכל" stays consistent with the
    // per-source split, and profile views no longer conflate match_card impressions).
    const pageViews = dirEntries + quizCompleted;
    const impressions = dirImpressions + matchImpressions;
    const profileViews = dirViews + matchViews;
    const contactClicks = dirClicks + matchClicks;

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
      // match_card is a card impression in the results list, not a profile
      // entry — count it as an impression, in line with the funnel.
      if (v.source === "match_card") weekBuckets[w].profile_impression++;
      else weekBuckets[w].profile_view++;
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
    const viewsWithContext = views;

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

    // --- Recommendation-explain clicks ("✦ למה הוצע לי?") ---
    // We persist this event into analytics_events with rich metadata, so
    // aggregation here is pure jsonb extraction.
    type ExplainEvent = {
      event_type: string;
      metadata: {
        questionnaire_type?: string;
        treatment_key?: string;
        treatment_label?: string;
        domain?: string | null;
        urgent?: boolean;
        viewer_age_band?: string | null;
        viewer_gender?: string | null;
        viewer_region?: string | null;
      } | null;
      created_at: string;
    };
    const explainEvents = events.filter(e => e.event_type === "recommendation_explain_click") as unknown as ExplainEvent[];

    function rankByMetadata(field: keyof NonNullable<ExplainEvent["metadata"]>) {
      const counts: Record<string, number> = {};
      for (const e of explainEvents) {
        const val = e.metadata?.[field];
        if (val == null) continue;
        const key = String(val);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    const explainAnalytics = {
      total: explainEvents.length,
      byQuestionnaireType: rankByMetadata("questionnaire_type"),
      byTreatment: rankByMetadata("treatment_label").slice(0, 15),
      byAgeBand: rankByMetadata("viewer_age_band"),
      byGender: rankByMetadata("viewer_gender"),
      byRegion: rankByMetadata("viewer_region"),
      byDomain: rankByMetadata("domain"),
    };

    // --- Impressions vs Clicks per therapist ---
    const therapistMap = new Map(therapists.map(t => [t.id, t]));

    // Per-therapist counts split by source. Directory impressions come from the
    // profile_impression event; matching impressions are the match_card views.
    // Profile views exclude match_card (those are impressions, not entries).
    type CtrAgg = { dirImpr: number; matchImpr: number; dirViews: number; matchViews: number; dirClicks: number; matchClicks: number };
    const ctrByTherapist: Record<string, CtrAgg> = {};
    const ensureCtr = (id: string): CtrAgg =>
      (ctrByTherapist[id] ??= { dirImpr: 0, matchImpr: 0, dirViews: 0, matchViews: 0, dirClicks: 0, matchClicks: 0 });

    for (const e of events) {
      if (e.event_type === "profile_impression" && e.therapist_id) ensureCtr(e.therapist_id).dirImpr++;
    }
    for (const v of views) {
      if (!v.therapist_id) continue;
      const a = ensureCtr(v.therapist_id);
      if (v.source === "match_card") a.matchImpr++;
      else if (v.source === "match") a.matchViews++;
      else a.dirViews++;
    }
    for (const c of clicks) {
      if (!c.therapist_id) continue;
      const a = ensureCtr(c.therapist_id);
      if (c.source === "match") a.matchClicks++;
      else a.dirClicks++;
    }

    const ctrCell = (impr: number, vw: number, clk: number) => ({
      impressions: impr,
      profile_views: vw,
      clicks: clk,
      ctr: impr > 0 ? Math.round((clk / impr) * 1000) / 10 : 0,
    });

    const therapistCTR = Object.entries(ctrByTherapist)
      .map(([id, a]) => {
        const t = therapistMap.get(id);
        return {
          id,
          full_name: t?.full_name ?? "—",
          status: t?.status ?? "unknown",
          all: ctrCell(a.dirImpr + a.matchImpr, a.dirViews + a.matchViews, a.dirClicks + a.matchClicks),
          directory: ctrCell(a.dirImpr, a.dirViews, a.dirClicks),
          match: ctrCell(a.matchImpr, a.matchViews, a.matchClicks),
        };
      })
      .filter(r => r.all.impressions > 0 || r.all.clicks > 0 || r.all.profile_views > 0)
      .sort((a, b) => b.all.impressions - a.all.impressions);

    // --- Listed-therapist profile breakdowns ---
    // Over therapists visible in matching (admin_approved), split paying vs
    // free. Reuses the therapists query above — no extra DB round-trip.
    const listed = therapists.filter(t => t.admin_approved);

    function countTherapistField(field: keyof TherapistRow) {
      const counts: Record<string, number> = {};
      for (const t of listed) {
        const val = t[field];
        if (Array.isArray(val)) {
          for (const v of val) if (v) counts[v] = (counts[v] ?? 0) + 1;
        } else if (typeof val === "string" && val) {
          counts[val] = (counts[val] ?? 0) + 1;
        }
      }
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }

    const therapistBreakdowns = {
      total: listed.length,
      // status='paying' covers both real payers and comped/promoted therapists;
      // promotion_source distinguishes them. 'paid' = charged via Sumit;
      // 'manual'/'trial'/null = gifted promotion (no revenue).
      paid: listed.filter(t => t.status === "paying" && t.promotion_source === "paid").length,
      gifted: listed.filter(t => t.status === "paying" && t.promotion_source !== "paid").length,
      free: listed.filter(t => t.status === "approved").length,
      withPhoto: listed.filter(t => t.profile_photo_path).length,
      acceptingNew: listed.filter(t => t.accepting_new_clients).length,
      onlineCount: listed.filter(t => t.online).length,
      byType: countTherapistField("therapist_types"),
      byTraining: countTherapistField("training_areas"),
      byAgeGroup: countTherapistField("age_groups"),
      byRegion: countTherapistField("regions"),
      byArrangement: countTherapistField("arrangements"),
      byGender: countTherapistField("gender"),
      byLanguage: countTherapistField("languages"),
      byCulturalPref: countTherapistField("cultural_prefs"),
    };

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      funnel: { pageViews, impressions, profileViews, contactClicks },
      funnelBySource,
      popularFilters,
      trends,
      therapistCTR,
      quizDropout: { adults: adultsQuiz, kids: kidsQuiz },
      demographics,
      clickTypeBreakdown,
      explainAnalytics,
      therapistBreakdowns,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
