import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import {
  ISSUE_LABELS,
  REGION_LABELS,
  AGE_LABELS,
  GENDER_LABELS,
  type IssueCategory,
  type RegionCategory,
  type AgeBand,
  type Gender,
} from "./stats-categories";

/**
 * k-anonymity threshold: groups with fewer than this many observations
 * are rolled up to "other" (or suppressed entirely). Using 3 per user decision.
 */
const K_ANON_MIN = 3;

/** Minimum total views before showing enriched breakdown at all. */
const MIN_VIEWS_FOR_REPORT = 20;

export interface BucketRow {
  key: string;
  label: string;
  views: number;
  clicks: number;
  ctr: number; // 0-100
}

export interface EnrichedStats {
  by_region: BucketRow[];
  by_issue: BucketRow[];
  by_age_band: BucketRow[];
  by_gender: BucketRow[];
  conversion: {
    total_views: number;
    unique_sessions: number;
    contacted: number;
    no_click_rate: number; // %, (views - contacted) / views
  };
  data_quality: {
    enough_data: boolean;
    period_days: number;
    total_views: number;
  };
}

type ViewRow = {
  session_id: string | null;
  viewer_region: string | null;
  viewer_issue: string | null;
  viewer_age_band: string | null;
  viewer_gender: string | null;
  viewed_at: string;
};

/** Apply k-anon: roll up rare buckets into "other". */
function groupByField<T extends string>(
  views: ViewRow[],
  field: keyof ViewRow,
  labels: Record<T, string>,
  clicksCount: number,
): BucketRow[] {
  const counts = new Map<string, number>();
  for (const v of views) {
    const key = (v[field] as string | null) ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const totalViews = views.length;
  const buckets: BucketRow[] = [];
  let otherViews = 0;

  for (const [key, count] of counts.entries()) {
    if (count < K_ANON_MIN || key === "unknown") {
      otherViews += count;
      continue;
    }
    const label = labels[key as T] ?? key;
    // CTR is approximated from aggregate clicks distributed proportionally
    // to views. Accurate session-level CTR requires joining clicks by session_id,
    // which we can't do reliably today (clicks table has no session_id yet).
    const share = totalViews > 0 ? count / totalViews : 0;
    const approxClicks = Math.round(clicksCount * share);
    const ctr = count > 0 ? Math.round((approxClicks / count) * 1000) / 10 : 0;
    buckets.push({ key, label, views: count, clicks: approxClicks, ctr });
  }

  if (otherViews >= K_ANON_MIN) {
    const share = totalViews > 0 ? otherViews / totalViews : 0;
    const approxClicks = Math.round(clicksCount * share);
    const ctr = otherViews > 0 ? Math.round((approxClicks / otherViews) * 1000) / 10 : 0;
    buckets.push({ key: "other", label: "אחר", views: otherViews, clicks: approxClicks, ctr });
  }

  return buckets.sort((a, b) => b.views - a.views);
}

/**
 * Compute enriched stats for a therapist over a time window.
 * Returns null if the therapist isn't in paying status — caller should gate.
 */
export async function computeEnrichedStats(
  therapistId: string,
  sinceDate: Date,
): Promise<EnrichedStats> {
  const sinceIso = sinceDate.toISOString();
  const periodDays = Math.round((Date.now() - sinceDate.getTime()) / (1000 * 60 * 60 * 24));

  // Views in window
  const { data: viewsData } = await supabaseAdmin
    .from("therapist_profile_views")
    .select("session_id, viewer_region, viewer_issue, viewer_age_band, viewer_gender, viewed_at")
    .eq("therapist_id", therapistId)
    .gte("viewed_at", sinceIso);

  const views = (viewsData ?? []) as ViewRow[];
  const totalViews = views.length;

  // Contact clicks in same window
  const { count: clicksCount } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("*", { count: "exact", head: true })
    .eq("therapist_id", therapistId)
    .gte("clicked_at", sinceIso);

  const contacted = clicksCount ?? 0;

  // Unique sessions
  const uniqueSessions = new Set(views.map((v) => v.session_id).filter(Boolean)).size;

  const enoughData = totalViews >= MIN_VIEWS_FOR_REPORT;

  // If below threshold — return empty buckets but keep counts for UI
  const empty: BucketRow[] = [];
  if (!enoughData) {
    return {
      by_region: empty,
      by_issue: empty,
      by_age_band: empty,
      by_gender: empty,
      conversion: {
        total_views: totalViews,
        unique_sessions: uniqueSessions,
        contacted,
        no_click_rate: totalViews > 0 ? Math.round(((totalViews - contacted) / totalViews) * 1000) / 10 : 0,
      },
      data_quality: { enough_data: false, period_days: periodDays, total_views: totalViews },
    };
  }

  return {
    by_region: groupByField<RegionCategory>(views, "viewer_region", REGION_LABELS, contacted),
    by_issue: groupByField<IssueCategory>(views, "viewer_issue", ISSUE_LABELS, contacted),
    by_age_band: groupByField<AgeBand>(views, "viewer_age_band", AGE_LABELS, contacted),
    by_gender: groupByField<Gender>(views, "viewer_gender", GENDER_LABELS, contacted),
    conversion: {
      total_views: totalViews,
      unique_sessions: uniqueSessions,
      contacted,
      no_click_rate: totalViews > 0 ? Math.round(((totalViews - contacted) / totalViews) * 1000) / 10 : 0,
    },
    data_quality: { enough_data: true, period_days: periodDays, total_views: totalViews },
  };
}
