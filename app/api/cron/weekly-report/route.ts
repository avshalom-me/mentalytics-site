import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import OpenAI from "openai";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeAttribution, type AttributionResult } from "@/app/lib/attribution-report";
import { CHANNEL_LABELS } from "@/app/lib/attribution";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { alertRecipients } from "@/app/lib/alert-recipients";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // reasoning models need more headroom (Vercel caps to plan max)

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CRON_SECRET = process.env.CRON_SECRET;
// The reports run a few times a month (not per-user), so we can afford the
// strongest reasoning model here. Isolated via env from the per-user agents.
const REPORT_LLM_MODEL = process.env.REPORT_LLM_MODEL ?? "gpt-5.5";
const REPORT_LLM_EFFORT = process.env.REPORT_LLM_EFFORT ?? "high";
const REPORT_TO = alertRecipients();

type Period = { since: string; until: string };
export type ReportType = "weekly" | "monthly";

const REPORT_DAYS: Record<ReportType, number> = { weekly: 7, monthly: 30 };

function getRange(periodsAgo: number, periodDays: number): Period {
  const now = Date.now();
  const ms = periodDays * 86_400_000;
  const until = new Date(now - periodsAgo * ms).toISOString();
  const since = new Date(now - (periodsAgo + 1) * ms).toISOString();
  return { since, until };
}

type ReportConfig = {
  type: ReportType;
  table: "weekly_reports" | "monthly_admin_reports";
  startCol: "week_start" | "month_start";
  endCol: "week_end" | "month_end";
  periodLabel: string; // "שבועי" / "חודשי"
  periodNoun: string;  // "השבוע" / "החודש"
  prevLabel: string;   // "השבוע הקודם" / "החודש הקודם"
  midAvgLabel: string; // "ממוצע חודשי" / "ממוצע 3-חודשי"
  longAvgLabel: string; // "ממוצע רבעוני" / "ממוצע חצי שנתי"
  // How many trailing buckets (excluding the current one) each average spans.
  // Must match the labels above, per report type — the comparison used to
  // hardcode weekly-shaped slices, so the monthly report averaged 4 buckets
  // under a "3-month" header and 5 under a "6-month" header.
  midAvgBuckets: number;
  longAvgBuckets: number;
};

const CONFIGS: Record<ReportType, ReportConfig> = {
  weekly: {
    type: "weekly",
    table: "weekly_reports",
    startCol: "week_start",
    endCol: "week_end",
    periodLabel: "שבועי",
    periodNoun: "השבוע",
    prevLabel: "השבוע הקודם",
    midAvgLabel: "ממוצע 4-שבועי",
    longAvgLabel: "ממוצע 12-שבועי",
    midAvgBuckets: 4,
    longAvgBuckets: 12,
  },
  monthly: {
    type: "monthly",
    table: "monthly_admin_reports",
    startCol: "month_start",
    endCol: "month_end",
    periodLabel: "חודשי",
    periodNoun: "החודש",
    prevLabel: "החודש הקודם",
    midAvgLabel: "ממוצע 3-חודשי",
    longAvgLabel: "ממוצע 6-חודשי",
    midAvgBuckets: 3,
    longAvgBuckets: 6,
  },
};

function topN<T extends { name: string; count: number }>(rows: T[], n: number): T[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, n);
}

function diffPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
}

// ── DATA AGGREGATORS ────────────────────────────────────────────────

const WEEKLY_TREND_BUCKETS = 13;
const WEEKLY_TREND_BUCKET_DAYS = 7;
const MONTHLY_TREND_BUCKETS = 6;
const MONTHLY_TREND_BUCKET_DAYS = 30;

type TrendPoint = {
  week_start: string; // bucket start date (kept name for backwards compat with stored data)
  pageViews: number;
  profileViews: number;
  contactClicks: number;
  quizCompletions: number;
};

async function aggregateTrend(now: Date, bucketDays: number, numBuckets: number): Promise<TrendPoint[]> {
  const totalMs = bucketDays * numBuckets * 86_400_000;
  const since = new Date(now.getTime() - totalMs).toISOString();
  const until = now.toISOString();

  // fetchAllRows pages past PostgREST's 1000-row cap (profile_views already
  // exceeds it; page_views/clicks will). Counting capped rows undercounts.
  const [events, views, clicks] = await Promise.all([
    fetchAllRows<{ event_type: string; created_at: string }>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("event_type, created_at")
        .gte("created_at", since)
        .lt("created_at", until)
        .in("event_type", ["page_view", "quiz_complete"]),
    ),
    fetchAllRows<{ viewed_at: string }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("viewed_at")
        .gte("viewed_at", since)
        .lt("viewed_at", until),
    ),
    fetchAllRows<{ clicked_at: string }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("clicked_at")
        .gte("clicked_at", since)
        .lt("clicked_at", until),
    ),
  ]);

  const buckets: TrendPoint[] = [];
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketEnd = new Date(now.getTime() - i * bucketDays * 86_400_000);
    const bucketStart = new Date(bucketEnd.getTime() - bucketDays * 86_400_000);
    buckets.push({
      week_start: bucketStart.toISOString().slice(0, 10),
      pageViews: 0,
      profileViews: 0,
      contactClicks: 0,
      quizCompletions: 0,
    });
  }

  function bucketIdx(dateStr: string): number {
    const d = new Date(dateStr).getTime();
    const diffDays = Math.floor((now.getTime() - d) / 86_400_000);
    const periodsAgo = Math.floor(diffDays / bucketDays);
    return numBuckets - 1 - periodsAgo;
  }

  for (const e of events) {
    const i = bucketIdx(e.created_at);
    if (i < 0 || i >= numBuckets) continue;
    if (e.event_type === "page_view") buckets[i].pageViews++;
    if (e.event_type === "quiz_complete") buckets[i].quizCompletions++;
  }
  for (const v of views) {
    const i = bucketIdx(v.viewed_at);
    if (i >= 0 && i < numBuckets) buckets[i].profileViews++;
  }
  for (const c of clicks) {
    const i = bucketIdx(c.clicked_at);
    if (i >= 0 && i < numBuckets) buckets[i].contactClicks++;
  }

  return buckets;
}

type ComparisonStats = {
  current: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
  monthAvg: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
  quarterAvg: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
};

function computeComparison(
  trend: TrendPoint[],
  midBuckets: number,
  longBuckets: number
): ComparisonStats {
  const current = trend[trend.length - 1] ?? { pageViews: 0, profileViews: 0, contactClicks: 0, quizCompletions: 0 };
  // Buckets before the current one, most-recent last. Slice the trailing N of
  // these per report type so the averages match their labels (weekly 4/12,
  // monthly 3/6) instead of hardcoded weekly-shaped windows.
  const prior = trend.slice(0, -1);
  const monthSlice = prior.slice(-midBuckets);
  const quarterSlice = prior.slice(-longBuckets);

  return {
    current: {
      pageViews: current.pageViews,
      profileViews: current.profileViews,
      contactClicks: current.contactClicks,
      quizCompletions: current.quizCompletions,
    },
    monthAvg: {
      pageViews: avg(monthSlice.map(t => t.pageViews)),
      profileViews: avg(monthSlice.map(t => t.profileViews)),
      contactClicks: avg(monthSlice.map(t => t.contactClicks)),
      quizCompletions: avg(monthSlice.map(t => t.quizCompletions)),
    },
    quarterAvg: {
      pageViews: avg(quarterSlice.map(t => t.pageViews)),
      profileViews: avg(quarterSlice.map(t => t.profileViews)),
      contactClicks: avg(quarterSlice.map(t => t.contactClicks)),
      quizCompletions: avg(quarterSlice.map(t => t.quizCompletions)),
    },
  };
}

type PatientData = {
  pageViews: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  popularFilters: { name: string; count: number }[];
  byRegion: { name: string; count: number }[];
  byIssue: { name: string; count: number }[];
  byAgeBand: { name: string; count: number }[];
  byGender: { name: string; count: number }[];
  clickTypeBreakdown: Record<string, number>;
  quizStarted: { adults: number; kids: number };
  quizCompleted: { adults: number; kids: number };
  trend?: TrendPoint[];
  comparison?: ComparisonStats;
};

async function aggregatePatientData(period: Period): Promise<PatientData> {
  // fetchAllRows pages past the 1000-row cap — analytics_events over a 7/30-day
  // window (incl. ~7,800 impressions) and profile_views both exceed it, so a
  // plain select would freeze every count below at 1000.
  const [events, views, clicks] = await Promise.all([
    fetchAllRows<{ event_type: string; metadata: Record<string, string> }>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("event_type, metadata, created_at")
        .gte("created_at", period.since)
        .lt("created_at", period.until),
    ),
    fetchAllRows<{ viewer_region?: string; viewer_issue?: string; viewer_age_band?: string; viewer_gender?: string }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("therapist_id, viewer_region, viewer_issue, viewer_age_band, viewer_gender")
        .gte("viewed_at", period.since)
        .lt("viewed_at", period.until),
    ),
    fetchAllRows<{ click_type: string }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id, click_type")
        .gte("clicked_at", period.since)
        .lt("clicked_at", period.until),
    ),
  ]);

  const pageViews = events.filter(e => e.event_type === "page_view").length;
  const impressions = events.filter(e => e.event_type === "profile_impression").length;

  const filterCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type === "filter_used" && e.metadata?.filter_value) {
      filterCounts[e.metadata.filter_value] = (filterCounts[e.metadata.filter_value] ?? 0) + 1;
    }
  }

  function countField(field: keyof typeof views[number]) {
    const counts: Record<string, number> = {};
    for (const v of views) {
      const val = v[field] as string | undefined;
      if (val) counts[val] = (counts[val] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  const clickTypeBreakdown: Record<string, number> = {};
  for (const c of clicks) {
    clickTypeBreakdown[c.click_type] = (clickTypeBreakdown[c.click_type] ?? 0) + 1;
  }

  const adultStarts = events.filter(e => e.event_type === "quiz_step" && e.metadata?.quiz_type === "adults").length;
  const kidStarts = events.filter(e => e.event_type === "quiz_step" && e.metadata?.quiz_type === "kids").length;
  const adultCompletes = events.filter(e => e.event_type === "quiz_complete" && e.metadata?.quiz_type === "adults").length;
  const kidCompletes = events.filter(e => e.event_type === "quiz_complete" && e.metadata?.quiz_type === "kids").length;

  return {
    pageViews,
    impressions,
    profileViews: views.length,
    contactClicks: clicks.length,
    popularFilters: topN(Object.entries(filterCounts).map(([name, count]) => ({ name, count })), 10),
    byRegion: topN(countField("viewer_region"), 10),
    byIssue: topN(countField("viewer_issue"), 10),
    byAgeBand: countField("viewer_age_band"),
    byGender: countField("viewer_gender"),
    clickTypeBreakdown,
    quizStarted: { adults: adultStarts, kids: kidStarts },
    quizCompleted: { adults: adultCompletes, kids: kidCompletes },
  };
}

type TherapistWeeklyTrend = {
  id: string;
  full_name: string;
  weeklyClicks: number[];
  currentWeek: number;
  prior4WeekAvg: number;
  changePct: number | null;
  category: "grower" | "decliner" | "stalled" | "new" | "stable";
};

async function aggregateTherapistTrends(
  now: Date,
  bucketDays: number,
  numBuckets: number,
  priorAvgBuckets: number,
): Promise<TherapistWeeklyTrend[]> {
  const totalMs = numBuckets * bucketDays * 86_400_000;
  const since = new Date(now.getTime() - totalMs).toISOString();
  const until = now.toISOString();

  const [therapistsRes, clicks] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, full_name")
      .eq("status", "paying"),
    // Clicks across all paying therapists over the full trend window can exceed
    // 1000 as the recruitment effort grows — page past the cap.
    fetchAllRows<{ therapist_id: string; clicked_at: string }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id, clicked_at")
        .gte("clicked_at", since)
        .lt("clicked_at", until),
    ),
  ]);

  const therapists = (therapistsRes.data ?? []) as { id: string; full_name: string | null }[];

  function bucketIdx(d: string): number {
    const t = new Date(d).getTime();
    const diffDays = Math.floor((now.getTime() - t) / 86_400_000);
    const periodsAgo = Math.floor(diffDays / bucketDays);
    return numBuckets - 1 - periodsAgo;
  }

  const byTherapist = new Map<string, number[]>();
  for (const t of therapists) {
    byTherapist.set(t.id, new Array(numBuckets).fill(0));
  }
  for (const c of clicks) {
    const arr = byTherapist.get(c.therapist_id);
    if (!arr) continue;
    const i = bucketIdx(c.clicked_at);
    if (i >= 0 && i < numBuckets) arr[i]++;
  }

  const trends: TherapistWeeklyTrend[] = [];
  for (const t of therapists) {
    const series = byTherapist.get(t.id) ?? new Array(numBuckets).fill(0);
    const current = series[series.length - 1] ?? 0;
    const priorSlice = series.slice(-(priorAvgBuckets + 1), -1);
    const priorAvg = avg(priorSlice);

    let category: TherapistWeeklyTrend["category"];
    let changePct: number | null = null;

    if (priorAvg === 0 && current === 0) {
      category = "stable";
    } else if (priorAvg === 0) {
      category = "new";
    } else if (current === 0) {
      category = "stalled";
      changePct = -100;
    } else {
      changePct = Math.round(((current - priorAvg) / priorAvg) * 100);
      if (changePct >= 25) category = "grower";
      else if (changePct <= -25) category = "decliner";
      else category = "stable";
    }

    trends.push({
      id: t.id,
      full_name: t.full_name ?? "—",
      weeklyClicks: series,
      currentWeek: current,
      prior4WeekAvg: Math.round(priorAvg),
      changePct,
      category,
    });
  }

  return trends;
}

type SilentTherapist = {
  id: string;
  full_name: string;
  email: string | null;
  views: number;
  clicks: number;
  bio_length: number;
  training_count: number;
  region_count: number;
  has_photo: boolean;
  days_promoted: number | null;
};

type TherapistData = {
  totalActive: number;
  paying: number;
  free: number;
  byTherapistType: { name: string; count: number }[];
  byTrainingArea: { name: string; count: number }[];
  byRegion: { name: string; count: number }[];
  byGender: { name: string; count: number }[];
  rareTrainingAreas: { name: string; count: number }[];
  newThisWeek: number;
  silentPayingTherapists: SilentTherapist[];
  invisiblePayingCount: number;
  viewedNoClickPayingCount: number;
  growers?: TherapistWeeklyTrend[];
  decliners?: TherapistWeeklyTrend[];
};

async function aggregateTherapistData(period: Period): Promise<TherapistData> {
  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status, therapist_types, training_areas, regions, gender, bio, profile_photo_path, created_at, promoted_since")
    .in("status", ["paying", "approved"]);

  const list = (therapists ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    status: string;
    therapist_types: string[] | null;
    training_areas: string[] | null;
    regions: string[] | null;
    gender: string | null;
    bio: string | null;
    profile_photo_path: string | null;
    created_at: string;
    promoted_since: string | null;
  }[];

  const paying = list.filter(t => t.status === "paying").length;
  const free = list.filter(t => t.status === "approved").length;

  function countArrayField(field: "therapist_types" | "training_areas" | "regions") {
    const counts: Record<string, number> = {};
    for (const t of list) {
      for (const v of t[field] ?? []) {
        counts[v] = (counts[v] ?? 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  const byTherapistType = countArrayField("therapist_types");
  const byTrainingArea = countArrayField("training_areas");
  const byRegion = countArrayField("regions");

  const genderCounts: Record<string, number> = {};
  for (const t of list) {
    const g = t.gender ?? "לא צוין";
    genderCounts[g] = (genderCounts[g] ?? 0) + 1;
  }

  const newThisWeek = list.filter(t => t.created_at >= period.since && t.created_at < period.until).length;

  const sortedTraining = [...byTrainingArea].sort((a, b) => a.count - b.count);

  // Per-therapist click + view counts for the week (paying only)
  const payingList = list.filter(t => t.status === "paying");
  const payingIds = payingList.map(t => t.id);

  const [views, clicks] = await Promise.all([
    fetchAllRows<{ therapist_id: string }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("therapist_id")
        .gte("viewed_at", period.since)
        .lt("viewed_at", period.until)
        .in("therapist_id", payingIds.length > 0 ? payingIds : ["00000000-0000-0000-0000-000000000000"]),
    ),
    fetchAllRows<{ therapist_id: string }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id")
        .gte("clicked_at", period.since)
        .lt("clicked_at", period.until)
        .in("therapist_id", payingIds.length > 0 ? payingIds : ["00000000-0000-0000-0000-000000000000"]),
    ),
  ]);

  const viewsByT: Record<string, number> = {};
  for (const v of views) {
    viewsByT[v.therapist_id] = (viewsByT[v.therapist_id] ?? 0) + 1;
  }
  const clicksByT: Record<string, number> = {};
  for (const c of clicks) {
    clicksByT[c.therapist_id] = (clicksByT[c.therapist_id] ?? 0) + 1;
  }

  const nowMs = Date.now();
  const silentPayingTherapists: SilentTherapist[] = payingList
    .filter(t => (clicksByT[t.id] ?? 0) === 0)
    .map(t => ({
      id: t.id,
      full_name: t.full_name ?? "—",
      email: t.email,
      views: viewsByT[t.id] ?? 0,
      clicks: 0,
      bio_length: (t.bio ?? "").length,
      training_count: t.training_areas?.length ?? 0,
      region_count: t.regions?.length ?? 0,
      has_photo: Boolean(t.profile_photo_path),
      days_promoted: t.promoted_since
        ? Math.floor((nowMs - new Date(t.promoted_since).getTime()) / 86_400_000)
        : null,
    }))
    .sort((a, b) => (b.days_promoted ?? -1) - (a.days_promoted ?? -1));

  const invisiblePayingCount = silentPayingTherapists.filter(t => t.views === 0).length;
  const viewedNoClickPayingCount = silentPayingTherapists.filter(t => t.views > 0).length;

  return {
    totalActive: list.length,
    paying,
    free,
    byTherapistType: topN(byTherapistType, 15),
    byTrainingArea: topN(byTrainingArea, 15),
    byRegion: topN(byRegion, 15),
    byGender: Object.entries(genderCounts).map(([name, count]) => ({ name, count })),
    rareTrainingAreas: sortedTraining.slice(0, 8),
    newThisWeek,
    silentPayingTherapists,
    invisiblePayingCount,
    viewedNoClickPayingCount,
  };
}

// ── MARKETING (attribution by channel) ──────────────────────────────

async function aggregateMarketingData(period: Period): Promise<AttributionResult> {
  // page_views + impressions (~7,800) exceed the 1000-row cap; page past it so
  // the per-channel funnel isn't frozen at 1000 (same bug fixed in
  // admin-attribution). computeAttribution counts whatever rows it's given.
  const [events, views, clicks] = await Promise.all([
    fetchAllRows<{ event_type: string; channel: string | null; session_id: string | null }>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("event_type, channel, session_id")
        .in("event_type", ["page_view", "profile_impression"])
        .gte("created_at", period.since)
        .lt("created_at", period.until),
    ),
    fetchAllRows<{ channel: string | null }>(() =>
      supabaseAdmin
        .from("therapist_profile_views")
        .select("channel")
        // match_card = card impression, not a profile view — exclude so viewToClick
        // matches /admin/attribution (the admin_attribution_report RPC).
        .neq("source", "match_card")
        .gte("viewed_at", period.since)
        .lt("viewed_at", period.until),
    ),
    fetchAllRows<{ channel: string | null; utm_campaign?: string | null }>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("channel, utm_campaign")
        .gte("clicked_at", period.since)
        .lt("clicked_at", period.until),
    ),
  ]);
  return computeAttribution(events, views, clicks);
}

// ── LLM SYNTHESIS ───────────────────────────────────────────────────

async function generateInsights(
  current: { patient: PatientData; therapist: TherapistData; marketing: AttributionResult },
  previous: { patient: PatientData; therapist: TherapistData },
  periodStart: string,
  periodEnd: string,
  config: ReportConfig,
): Promise<{ summary: string; recommendations: string; silentTherapistsAdvice: string; marketingAdvice: string }> {
  const wow = {
    pageViews: diffPct(current.patient.pageViews, previous.patient.pageViews),
    profileViews: diffPct(current.patient.profileViews, previous.patient.profileViews),
    contactClicks: diffPct(current.patient.contactClicks, previous.patient.contactClicks),
    quizCompletedAdults: diffPct(current.patient.quizCompleted.adults, previous.patient.quizCompleted.adults),
    quizCompletedKids: diffPct(current.patient.quizCompleted.kids, previous.patient.quizCompleted.kids),
  };

  const N = config.periodNoun; // "השבוע" / "החודש"

  const mk = current.marketing;
  const channelLines = mk.channels.length
    ? mk.channels.map(c => `- ${CHANNEL_LABELS[c.channel] ?? c.channel}: ${c.sessions ?? c.pageViews} ביקורים ייחודיים (${c.pageViews} צפיות-עמוד גולמיות), ${c.profileViews} צפיות בפרופיל, ${c.contactClicks} פניות, המרה צפייה→פנייה ${c.viewToClick}%`).join("\n")
    : "(אין עדיין נתוני מקור לתקופה זו)";
  // Guardrail for the model: raw page-views over-count (bots/prefetch) and a
  // contact whose channel is "unknown" is an un-attributed click, not a funnel
  // impossibility — so it doesn't repeat "X entries, 0 views is a tracking bug".
  const marketingCaveat = `הערת מדידה: "ביקורים ייחודיים" הם המספר האמין; "צפיות-עמוד גולמיות" (כניסות) כוללות בוטים/פרי-פץ' ולכן גבוהות מהקליקים שגוגל מחייבת — אל תתייחס אליהן כאל קליקים בתשלום. ערוץ "לא ידוע" עם פניות ובלי צפיות = קליקים ישנים ללא תיוג מקור (נסגר לאחרונה), לא באג פאנל.`;
  const campaignLines = mk.topCampaigns.length ? JSON.stringify(mk.topCampaigns) : "(אין קמפיינים מתויגים ב-UTM)";

  const prompt = `אתה אנליסט מוצר עבור "טיפול חכם" — פלטפורמה ישראלית לחיבור בין מטופלים למטפלים. אני מנהל המוצר וקיבלת את הנתונים האחרונים (${config.periodLabel}).

תקופה: ${periodStart} עד ${periodEnd}

## נתוני ${N} (ביקוש מצד מטופלים פוטנציאליים)
- כניסות לדירקטוריה: ${current.patient.pageViews} (שינוי מ${config.prevLabel}: ${wow.pageViews}%)
- צפיות בפרופילים: ${current.patient.profileViews} (שינוי: ${wow.profileViews}%)
- לחיצות יצירת קשר: ${current.patient.contactClicks} (שינוי: ${wow.contactClicks}%)
- שאלון מבוגרים — סיומים: ${current.patient.quizCompleted.adults} (שינוי: ${wow.quizCompletedAdults}%)
- שאלון ילדים — סיומים: ${current.patient.quizCompleted.kids} (שינוי: ${wow.quizCompletedKids}%)

### השוואה לממוצעים ארוכי טווח (ממוצעים, לא כולל ${N} הנוכחי):
${current.patient.comparison ? `
| מדד | ${N} | ${config.midAvgLabel} | ${config.longAvgLabel} |
| --- | --- | --- | --- |
| כניסות | ${current.patient.comparison.current.pageViews} | ${current.patient.comparison.monthAvg.pageViews} | ${current.patient.comparison.quarterAvg.pageViews} |
| צפיות בפרופיל | ${current.patient.comparison.current.profileViews} | ${current.patient.comparison.monthAvg.profileViews} | ${current.patient.comparison.quarterAvg.profileViews} |
| פניות | ${current.patient.comparison.current.contactClicks} | ${current.patient.comparison.monthAvg.contactClicks} | ${current.patient.comparison.quarterAvg.contactClicks} |
| סיומי שאלון | ${current.patient.comparison.current.quizCompletions} | ${current.patient.comparison.monthAvg.quizCompletions} | ${current.patient.comparison.quarterAvg.quizCompletions} |
` : "(אין מספיק היסטוריה)"}

### פילוח אזורים שמטופלים חיפשו (לפי צפיות בפרופילים):
${JSON.stringify(current.patient.byRegion, null, 2)}

### פילוח נושאים שמטופלים חיפשו:
${JSON.stringify(current.patient.byIssue, null, 2)}

### פילטרים פופולריים:
${JSON.stringify(current.patient.popularFilters, null, 2)}

### גיל ומגדר של הצופים:
גיל: ${JSON.stringify(current.patient.byAgeBand)}
מגדר: ${JSON.stringify(current.patient.byGender)}

## נתוני המטפלים (היצע)
- סה"כ פעילים: ${current.therapist.totalActive} (מקודמים: ${current.therapist.paying}, חינמיים: ${current.therapist.free})
- מטפלים חדשים שהתווספו השבוע: ${current.therapist.newThisWeek}

### פילוח לפי סוג מטפל:
${JSON.stringify(current.therapist.byTherapistType, null, 2)}

### פילוח לפי תחומי הכשרה:
${JSON.stringify(current.therapist.byTrainingArea, null, 2)}

### תחומי הכשרה נדירים (מעט מטפלים):
${JSON.stringify(current.therapist.rareTrainingAreas, null, 2)}

### פילוח לפי אזורים:
${JSON.stringify(current.therapist.byRegion, null, 2)}

### פילוח לפי מגדר:
${JSON.stringify(current.therapist.byGender, null, 2)}

### מטפלים ממומנים שלא קיבלו אף פנייה ${N} (${current.therapist.silentPayingTherapists.length}):
מתוכם ${current.therapist.invisiblePayingCount} בכלל לא נצפו (חוסר חשיפה), ${current.therapist.viewedNoClickPayingCount} נצפו אבל לא לחצו (חוסר המרה).
${JSON.stringify(current.therapist.silentPayingTherapists.slice(0, 15).map(t => ({
  שם: t.full_name,
  צפיות: t.views,
  ימים_בקידום: t.days_promoted,
  אורך_ביו: t.bio_length,
  תחומים: t.training_count,
  אזורים: t.region_count,
  תמונה: t.has_photo,
})), null, 2)}

## ערוצי שיווק — מאיפה הגיעו המבקרים (attribution)
${channelLines}
קמפיינים מובילים (לפי פניות): ${campaignLines}
${marketingCaveat}

---

אנא הפק ארבעה חלקים נפרדים, בעברית פשוטה וברורה:

**חלק 1 — סיכום ${N} (5-7 משפטים):**
מצב כללי, מגמות בולטות מול ${config.prevLabel} **וגם מול הממוצעים ארוכי הטווח**, ושני-שלושה דברים שראויים לתשומת לב מיידית. אם ${N} חריג כלפי מעלה או מטה ביחס לממוצע, ציין זאת מפורשות.

**חלק 2 — המלצות פעולה ממוקדות (3-6 פעולות):**
זהה גאפים בין ביקוש להיצע (אזורים/נושאים שמבוקשים אבל אין מספיק מטפלים, או להפך). תן המלצות קונקרטיות לפרסום ממוקד — מי הקהל (מטפלים או מטופלים), איזה אזור/תחום, ולמה. כל המלצה במשפט-שניים, עם הסבר מספרי קצר.

**חלק 3 — מטפלים ממומנים בלי פניות:**
התייחס ספציפית למטפלים שלא קיבלו אף פנייה ${N}. הפרד בין שתי קבוצות:
- "לא נצפו בכלל" — בעיית חשיפה. הצע פעולות מוצריות (קידום במערכת ההתאמות, שיפור התאמת אזורים/תחומים בפרופיל, פרסום ממוקד באזור שלהם).
- "נצפו אבל לא לחצו" — בעיית המרה. הצע פעולות שיפור פרופיל (ביו ארוך יותר, תמונה איכותית, הוספת תחומי הכשרה, ניסוח התמחות חד יותר).
**חשוב במיוחד:** סמן את המטפלים שיותר מ-30 ימים בקידום ועדיין 0 פניות — אלה דורשים טיפול דחוף. אם יש כאלה ברשימה, הזכר אותם בשם ותן להם עדיפות.
תן 3-5 פעולות קונקרטיות.

**חלק 4 — ערוצי שיווק:**
נתח מאילו ערוצים מגיעים הלידים ואיזה ערוץ ממיר טוב יותר (צפייה→פנייה). אם רוב התנועה "ישיר"/"אורגני" כי עדיין אין פרסום בתשלום — ציין זאת מפורשות, והמלץ על מה לשים דגש כשמתחילים לפרסם בתשלום (איזה ערוץ/אזור, ומול איזה benchmark של המרה אורגנית). 2-4 נקודות. השתמש ב"ביקורים ייחודיים" (לא ב"צפיות-עמוד גולמיות") להשוואות ולחישובי המרה, וכבד את הערת המדידה למעלה.

חשוב: דבר ישירות בלי מבוא, בלי "כמובן" / "בוודאי" / "אשמח". התחל מיד בחלק 1.`;

  // Reasoning models work best via the Responses API and reject `temperature`.
  const SYSTEM = "אתה אנליסט מוצר ישראלי ענייני. אתה כותב עברית טבעית, ממוקדת מספרים וללא מליצות.";
  // Cap the call below the 300s function limit (aggregations run before this,
  // email/DB after) and disable the SDK's default retries — a retry on a
  // slow-but-eventually-fine call would blow the budget. On overrun this THROWS,
  // caught by runReport → clean JSON error instead of a platform 504.
  const response = await openai.responses.create(
    {
      model: REPORT_LLM_MODEL,
      reasoning: { effort: REPORT_LLM_EFFORT as "minimal" | "low" | "medium" | "high" },
      input: `${SYSTEM}\n\n${prompt}`,
    },
    { timeout: 240_000, maxRetries: 0 },
  );

  const text = response.output_text ?? "";

  const part2Split = text.split(/\*\*חלק 2.*?\*\*/);
  const summary = (part2Split[0] ?? text).replace(/\*\*חלק 1.*?\*\*/, "").trim();
  const afterPart1 = part2Split[1] ?? "";
  const part3Split = afterPart1.split(/\*\*חלק 3.*?\*\*/);
  const recommendations = (part3Split[0] ?? "").trim();
  const part4Split = (part3Split[1] ?? "").split(/\*\*חלק 4.*?\*\*/);
  const silentTherapistsAdvice = (part4Split[0] ?? "").trim();
  const marketingAdvice = (part4Split[1] ?? "").trim();

  return { summary, recommendations, silentTherapistsAdvice, marketingAdvice };
}

// ── EMAIL ───────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mdToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;color:#0F5468;margin:18px 0 8px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;color:#0F5468;margin:22px 0 10px;">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\s*)+/g, m => `<ul style="padding-right:20px;margin:8px 0;">${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p style="margin:10px 0;line-height:1.7;">')
    .replace(/^/, '<p style="margin:10px 0;line-height:1.7;">')
    .replace(/$/, "</p>");
}

function buildSparkline(values: number[], color: string): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  const bars = values.map(v => {
    const h = Math.max(Math.round((v / max) * 38), 2);
    return `<td style="vertical-align:bottom;padding:0 1px;width:7%;"><div style="height:${h}px;background:${color};border-radius:1px 1px 0 0;" title="${v}"></div></td>`;
  }).join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;height:42px;border-collapse:collapse;"><tr style="height:42px;">${bars}</tr></table>`;
}

function buildTrendSection(trend: TrendPoint[], comparison: ComparisonStats, config: ReportConfig): string {
  if (trend.length === 0) return "";

  const rows = [
    { label: "כניסות", color: "#3b82f6", values: trend.map(t => t.pageViews), curr: comparison.current.pageViews, m: comparison.monthAvg.pageViews, q: comparison.quarterAvg.pageViews },
    { label: "צפיות בפרופיל", color: "#9333ea", values: trend.map(t => t.profileViews), curr: comparison.current.profileViews, m: comparison.monthAvg.profileViews, q: comparison.quarterAvg.profileViews },
    { label: "פניות", color: "#22c55e", values: trend.map(t => t.contactClicks), curr: comparison.current.contactClicks, m: comparison.monthAvg.contactClicks, q: comparison.quarterAvg.contactClicks },
    { label: "סיומי שאלון", color: "#f59e0b", values: trend.map(t => t.quizCompletions), curr: comparison.current.quizCompletions, m: comparison.monthAvg.quizCompletions, q: comparison.quarterAvg.quizCompletions },
  ];

  function arrow(curr: number, baseline: number): string {
    if (baseline === 0) return curr === 0 ? "—" : "▲ חדש";
    const pct = Math.round(((curr - baseline) / baseline) * 100);
    if (pct >= 5) return `<span style="color:#22c55e;">▲ ${pct}%</span>`;
    if (pct <= -5) return `<span style="color:#ef4444;">▼ ${pct}%</span>`;
    return `<span style="color:#888;">≈ ${pct}%</span>`;
  }

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:13px;font-weight:bold;color:#333;width:24%;">${escapeHtml(r.label)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;width:36%;">${buildSparkline(r.values, r.color)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:13px;font-weight:bold;width:13%;">${r.curr}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;width:13%;">${r.m}<br/><span style="font-size:10px;">${arrow(r.curr, r.m)}</span></td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:center;font-size:11px;width:14%;">${r.q}<br/><span style="font-size:10px;">${arrow(r.curr, r.q)}</span></td>
    </tr>
  `).join("");

  const trendLabel = config.type === "weekly" ? `${trend.length} שבועות אחרונים` : `${trend.length} חודשים אחרונים`;

  return `
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e8e0d8;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:8px;text-align:right;font-size:11px;color:#666;font-weight:bold;">מדד</th>
          <th style="padding:8px;text-align:right;font-size:11px;color:#666;font-weight:bold;">${trendLabel}</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#666;font-weight:bold;">${config.periodNoun}</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#666;font-weight:bold;">${config.midAvgLabel}*</th>
          <th style="padding:8px;text-align:center;font-size:11px;color:#666;font-weight:bold;">${config.longAvgLabel}*</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="font-size:10px;color:#aaa;margin:6px 0 0;">* ללא ${config.periodNoun} הנוכחי</p>
  `;
}

function buildTherapistTrendTable(rows: TherapistWeeklyTrend[], direction: "up" | "down", config: ReportConfig): string {
  if (rows.length === 0) {
    const msg = direction === "up" ? `אין מטפלים בולטים בעלייה ${config.periodNoun}.` : `אין מטפלים בולטים בירידה ${config.periodNoun}.`;
    return `<p style="font-size:12px;color:#888;margin:6px 0;">${msg}</p>`;
  }
  const arrow = direction === "up" ? "▲" : "▼";
  const arrowColor = direction === "up" ? "#22c55e" : "#ef4444";

  const tr = rows.map(r => {
    const pct = r.changePct == null ? "חדש" : `${arrow} ${Math.abs(r.changePct)}%`;
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${escapeHtml(r.full_name)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-size:13px;font-weight:bold;">${r.currentWeek}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;color:#666;">${r.prior4WeekAvg}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;font-size:12px;font-weight:bold;color:${arrowColor};">${pct}</td>
      </tr>`;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;background:white;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:6px 10px;text-align:right;font-size:11px;color:#666;">מטפל</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#666;">${config.periodNoun}</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#666;">${config.midAvgLabel}</th>
          <th style="padding:6px 10px;text-align:center;font-size:11px;color:#666;">שינוי</th>
        </tr>
      </thead>
      <tbody>${tr}</tbody>
    </table>`;
}

function buildSilentTherapistsTable(silent: SilentTherapist[], config: ReportConfig): string {
  if (silent.length === 0) {
    return `<p style="margin:8px 0;color:#22c55e;font-size:13px;">🎉 כל המטפלים הממומנים קיבלו לפחות פנייה אחת ${config.periodNoun}.</p>`;
  }

  const rows = silent.slice(0, 20).map(t => {
    const concerns: string[] = [];
    if (t.bio_length < 80) concerns.push("ביו קצר");
    if (!t.has_photo) concerns.push("אין תמונה");
    if (t.training_count <= 2) concerns.push("מעט תחומים");
    if (t.region_count <= 1) concerns.push("מעט אזורים");
    const flag = t.views === 0 ? "🔇 לא נצפה" : "👁️ נצפה — לא לחצו";
    const flagColor = t.views === 0 ? "#dc2626" : "#d97706";
    const daysHtml = t.days_promoted == null
      ? "—"
      : t.days_promoted >= 30
        ? `<span style="color:#dc2626;font-weight:bold;">${t.days_promoted}</span>`
        : t.days_promoted >= 14
          ? `<span style="color:#d97706;font-weight:bold;">${t.days_promoted}</span>`
          : `${t.days_promoted}`;
    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:13px;">${escapeHtml(t.full_name)}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;color:${flagColor};font-size:11px;font-weight:bold;">${flag}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;">${t.views}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:12px;">${daysHtml}</td>
        <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:11px;color:#888;">${concerns.length > 0 ? escapeHtml(concerns.join(" · ")) : "—"}</td>
      </tr>`;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;background:white;">
      <thead>
        <tr style="background:#f5f5f4;">
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">מטפל</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">סטטוס</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">צפיות</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">ימים בקידום</th>
          <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">דגלים בפרופיל</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${silent.length > 20 ? `<p style="font-size:11px;color:#999;margin:0;">מציג 20 ראשונים מתוך ${silent.length}.</p>` : ""}
  `;
}

function buildMarketingSection(marketing: AttributionResult, advice: string): string {
  if (marketing.channels.length === 0 && !advice) {
    return `<p style="font-size:13px;color:#888;margin:8px 0;">אין עדיין נתוני מקור לתקופה זו (פרסום בתשלום עוד לא רץ).</p>`;
  }
  const rows = marketing.channels.map(c => `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;font-size:13px;">${escapeHtml(CHANNEL_LABELS[c.channel] ?? c.channel)}</td>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;">${c.sessions ?? "—"}</td>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;color:#999;">${c.pageViews}</td>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;">${c.profileViews}</td>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:13px;font-weight:bold;">${c.contactClicks}</td>
      <td style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:12px;">${c.profileViews > 0 ? c.viewToClick + "%" : "—"}</td>
    </tr>`).join("");
  const table = marketing.channels.length ? `
    <table style="width:100%;border-collapse:collapse;margin:8px 0;background:white;">
      <thead><tr style="background:#f5f5f4;">
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:right;font-size:11px;color:#666;">ערוץ</th>
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">ביקורים</th>
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#999;">כניסות</th>
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">צפיות</th>
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">פניות</th>
        <th style="padding:8px 10px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#666;">צפייה→פנייה</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:11px;color:#999;margin:4px 0 0;line-height:1.6;">
      <b>ביקורים</b> = מבקרים ייחודיים (sessions). <b>כניסות</b> = צפיות-עמוד גולמיות, כולל בוטים ופרי-פץ' — לרוב גבוה מהקליקים שגוגל מחייבת עליהם. לחישוב עלות-לפנייה (CPL) השתמשו במשפך הקמפיינים בדשבורד, שמיושר מול הקליקים המחויבים בפועל.
    </p>` : "";
  const adviceHtml = advice ? `<div style="background:white;padding:14px 16px;border-radius:8px;border:1px solid #e8e0d8;margin-top:8px;">${mdToHtml(advice)}</div>` : "";
  return table + adviceHtml;
}

function buildEmailHtml(
  periodStart: string,
  periodEnd: string,
  patient: PatientData,
  therapist: TherapistData,
  marketing: AttributionResult,
  insights: { summary: string; recommendations: string; silentTherapistsAdvice: string; marketingAdvice: string },
  config: ReportConfig,
): string {
  const trendBucketLabel = config.type === "weekly" ? "שבועות" : "חודשים";
  const dashboardLink = config.type === "weekly"
    ? "https://www.mentalytics.co.il/admin/weekly-reports"
    : "https://www.mentalytics.co.il/admin/monthly-reports";
  return `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#333;">
      <div style="background:linear-gradient(135deg,#0F5468,#2e7d8c);padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;">דוח ${config.periodLabel} — טיפול חכם</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">${periodStart} עד ${periodEnd}</p>
      </div>

      <div style="background:#f9f8f6;padding:24px 32px;border:1px solid #e8e0d8;border-top:0;">
        <h2 style="font-size:17px;color:#0F5468;margin:0 0 12px;">סיכום</h2>
        ${mdToHtml(insights.summary)}

        ${patient.trend && patient.comparison ? `
          <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">מגמה ${patient.trend.length} ${trendBucketLabel} והשוואה</h2>
          ${buildTrendSection(patient.trend, patient.comparison, config)}
        ` : ""}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">המלצות פעולה</h2>
        ${mdToHtml(insights.recommendations)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">ערוצי שיווק — מאיפה הגיעו המבקרים</h2>
        ${buildMarketingSection(marketing, insights.marketingAdvice)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">מטפלים בעלייה (vs ${config.midAvgLabel})</h2>
        ${buildTherapistTrendTable(therapist.growers ?? [], "up", config)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">מטפלים בירידה (vs ${config.midAvgLabel})</h2>
        ${buildTherapistTrendTable(therapist.decliners ?? [], "down", config)}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">
          מטפלים ממומנים בלי פניות ${config.periodNoun}
          <span style="font-size:13px;color:#888;font-weight:normal;">(${therapist.silentPayingTherapists.length})</span>
        </h2>
        <p style="font-size:12px;color:#666;margin:0 0 8px;">
          🔇 ${therapist.invisiblePayingCount} לא נצפו בכלל · 👁️ ${therapist.viewedNoClickPayingCount} נצפו אבל לא יצרו קשר
        </p>
        ${buildSilentTherapistsTable(therapist.silentPayingTherapists, config)}
        ${insights.silentTherapistsAdvice ? `<div style="background:white;padding:14px 16px;border-radius:8px;border:1px solid #e8e0d8;">${mdToHtml(insights.silentTherapistsAdvice)}</div>` : ""}

        <h2 style="font-size:17px;color:#0F5468;margin:24px 0 12px;">מספרים מרכזיים</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:white;">
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.pageViews}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.profileViews}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.contactClicks}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;">${patient.quizCompleted.adults + patient.quizCompleted.kids}</td>
            <td style="padding:10px;border:1px solid #e8e0d8;text-align:center;font-weight:bold;background:#0F5468;color:white;">${therapist.totalActive}</td>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">כניסות</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">צפיות</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">לחיצות קשר</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">סיומי שאלון</td>
            <td style="padding:6px;border:1px solid #e8e0d8;text-align:center;font-size:11px;color:#888;">מטפלים פעילים</td>
          </tr>
        </table>
      </div>

      <div style="padding:14px 32px;text-align:center;font-size:12px;color:#999;border:1px solid #e8e0d8;border-top:0;border-radius:0 0 12px 12px;">
        <a href="${dashboardLink}" style="color:#0F5468;">צפייה בכל הדוחות הקודמים</a>
      </div>
    </div>
  `;
}

// ── MAIN ────────────────────────────────────────────────────────────

export async function runReport(type: ReportType): Promise<{
  ok: boolean;
  period_start?: string;
  emailStatus?: string;
  error?: string;
  status?: number;
}> {
  const config = CONFIGS[type];
  const periodDays = REPORT_DAYS[type];
  const trendBuckets = type === "weekly" ? WEEKLY_TREND_BUCKETS : MONTHLY_TREND_BUCKETS;
  const trendBucketDays = type === "weekly" ? WEEKLY_TREND_BUCKET_DAYS : MONTHLY_TREND_BUCKET_DAYS;

  try {
    const current = getRange(0, periodDays);
    const previous = getRange(1, periodDays);
    const now = new Date();

    const therapistTrendPriorBuckets = type === "weekly" ? 4 : 3;

    const [patient, therapist, prevPatient, prevTherapist, trend, therapistTrends, marketing] = await Promise.all([
      aggregatePatientData(current),
      aggregateTherapistData(current),
      aggregatePatientData(previous),
      aggregateTherapistData(previous),
      aggregateTrend(now, trendBucketDays, trendBuckets),
      aggregateTherapistTrends(now, trendBucketDays, trendBuckets, therapistTrendPriorBuckets),
      aggregateMarketingData(current),
    ]);

    const comparison = computeComparison(trend, config.midAvgBuckets, config.longAvgBuckets);
    patient.trend = trend;
    patient.comparison = comparison;

    therapist.growers = therapistTrends
      .filter(t => t.category === "grower" || t.category === "new")
      .sort((a, b) => (b.changePct ?? 9999) - (a.changePct ?? 9999))
      .slice(0, 5);
    therapist.decliners = therapistTrends
      .filter(t => t.category === "decliner" || t.category === "stalled")
      .sort((a, b) => (a.changePct ?? -9999) - (b.changePct ?? -9999))
      .slice(0, 5);

    const insights = await generateInsights(
      { patient, therapist, marketing },
      { patient: prevPatient, therapist: prevTherapist },
      current.since.slice(0, 10),
      current.until.slice(0, 10),
      config,
    );

    const html = buildEmailHtml(
      current.since.slice(0, 10),
      current.until.slice(0, 10),
      patient,
      therapist,
      marketing,
      insights,
      config,
    );

    let emailStatus = "sent";
    try {
      await resend.emails.send({
        from: "טיפול חכם <noreply@mentalytics.co.il>",
        to: REPORT_TO,
        subject: `דוח ${config.periodLabel} — ${current.since.slice(0, 10)} עד ${current.until.slice(0, 10)}`,
        html,
      });
    } catch (e) {
      emailStatus = `failed: ${e instanceof Error ? e.message : "unknown"}`;
    }

    const { error: insertErr } = await supabaseAdmin
      .from(config.table)
      .upsert(
        {
          [config.startCol]: current.since.slice(0, 10),
          [config.endCol]: current.until.slice(0, 10),
          patient_data: patient,
          therapist_data: therapist,
          marketing_data: marketing,
          ai_summary: insights.summary,
          ai_recommendations: insights.recommendations,
          ai_silent_therapists_advice: insights.silentTherapistsAdvice,
          ai_marketing: insights.marketingAdvice,
          email_sent_to: REPORT_TO.join(", "),
          email_status: emailStatus,
        },
        { onConflict: config.startCol },
      );

    if (insertErr) {
      return { ok: false, error: `DB save failed: ${insertErr.message}`, emailStatus, status: 500 };
    }

    return { ok: true, period_start: current.since.slice(0, 10), emailStatus };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error", status: 500 };
  }
}

// Backwards-compat alias for the existing admin trigger.
export const runWeeklyReport = () => runReport("weekly");

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReport("weekly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
