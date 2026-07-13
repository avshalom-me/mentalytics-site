/**
 * Shared per-channel funnel computation. Single source of truth for the
 * "מקורות לידים" admin report (/api/admin-attribution) AND the marketing
 * section of the weekly/monthly AI report. Pure function, no DB access.
 */

import { CHANNELS, type Channel } from "./attribution";

export type Bucket = Channel | "unknown";

export type ChannelFunnel = {
  channel: Bucket;
  pageViews: number;
  sessions?: number;          // distinct visits (distinct session_id among page_views); honest visit count vs raw pageViews
  impressions: number;
  profileViews: number;
  contactClicks: number;
  viewToClick: number;        // % of profile-viewers who clicked a contact button
  impressionToClick: number;
};

export type AttributionResult = {
  channels: ChannelFunnel[];
  totals: { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
  topCampaigns: { campaign: string; contactClicks: number }[];
};

const ALL_BUCKETS: Bucket[] = [...CHANNELS, "unknown"];

export function bucketOf(channel: string | null | undefined): Bucket {
  return channel && (CHANNELS as readonly string[]).includes(channel) ? (channel as Channel) : "unknown";
}

type Counts = { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
const emptyCounts = (): Counts => ({ pageViews: 0, impressions: 0, profileViews: 0, contactClicks: 0 });
const emptyByChannel = (): Record<Bucket, Counts> =>
  Object.fromEntries(ALL_BUCKETS.map((b) => [b, emptyCounts()])) as Record<Bucket, Counts>;

/** Shared tail: turn per-channel counts + campaign counts into the report shape. */
function finalize(
  byChannel: Record<Bucket, Counts>,
  campaignCounts: Record<string, number>,
  sessionsByChannel?: Record<Bucket, number>,
): AttributionResult {
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  const channels = ALL_BUCKETS.map((b) => {
    const c = byChannel[b];
    return {
      channel: b,
      ...c,
      sessions: sessionsByChannel?.[b],
      viewToClick: pct(c.contactClicks, c.profileViews),
      impressionToClick: pct(c.contactClicks, c.impressions),
    };
  })
    .filter((c) => c.pageViews || c.impressions || c.profileViews || c.contactClicks)
    .sort((a, b) => b.contactClicks - a.contactClicks || b.profileViews - a.profileViews);

  const totals = channels.reduce(
    (acc, c) => {
      acc.pageViews += c.pageViews; acc.impressions += c.impressions;
      acc.profileViews += c.profileViews; acc.contactClicks += c.contactClicks;
      return acc;
    },
    emptyCounts(),
  );

  const topCampaigns = Object.entries(campaignCounts)
    .map(([campaign, contactClicks]) => ({ campaign, contactClicks }))
    .sort((a, b) => b.contactClicks - a.contactClicks)
    .slice(0, 15);

  return { channels, totals, topCampaigns };
}

/**
 * Row-based: counts raw event/view/click rows. NOTE: callers must fetch ALL
 * rows — a single PostgREST response caps at 1000, which silently undercounts
 * any metric above 1000. Prefer computeAttributionFromCounts (DB-side
 * aggregation) for the large tables (impressions / profile_views).
 */
export function computeAttribution(
  events: { event_type: string; channel: string | null; session_id?: string | null }[],
  views: { channel: string | null }[],
  clicks: { channel: string | null; utm_campaign?: string | null }[],
): AttributionResult {
  const byChannel = emptyByChannel();
  // Distinct session_id per channel among page_views — the honest "visits"
  // count (raw pageViews over-counts: bots, prefetch, multi-page sessions).
  const sessionSets = Object.fromEntries(ALL_BUCKETS.map((b) => [b, new Set<string>()])) as Record<Bucket, Set<string>>;

  for (const e of events) {
    const bucket = bucketOf(e.channel);
    if (e.event_type === "page_view") {
      byChannel[bucket].pageViews++;
      if (e.session_id) sessionSets[bucket].add(e.session_id);
    } else if (e.event_type === "profile_impression") {
      byChannel[bucket].impressions++;
    }
  }
  for (const v of views) byChannel[bucketOf(v.channel)].profileViews++;
  for (const c of clicks) byChannel[bucketOf(c.channel)].contactClicks++;

  const campaignCounts: Record<string, number> = {};
  for (const c of clicks) {
    if (c.utm_campaign) campaignCounts[c.utm_campaign] = (campaignCounts[c.utm_campaign] ?? 0) + 1;
  }

  const sessionsByChannel = Object.fromEntries(ALL_BUCKETS.map((b) => [b, sessionSets[b].size])) as Record<Bucket, number>;
  return finalize(byChannel, campaignCounts, sessionsByChannel);
}

/**
 * Aggregate-based: takes per-channel + per-campaign counts already computed in
 * SQL (the admin_attribution_report RPC). Exact at any volume — no 1000-row
 * cap. Counts may arrive as numbers or numeric strings (Postgres bigint).
 */
export function computeAttributionFromCounts(
  channelRows: {
    channel: string | null;
    page_views: number | string;
    impressions: number | string;
    profile_views: number | string;
    contact_clicks: number | string;
  }[],
  campaignRows: { campaign: string | null; contact_clicks: number | string }[],
): AttributionResult {
  const byChannel = emptyByChannel();

  for (const r of channelRows) {
    const c = byChannel[bucketOf(r.channel)];
    c.pageViews += Number(r.page_views) || 0;
    c.impressions += Number(r.impressions) || 0;
    c.profileViews += Number(r.profile_views) || 0;
    c.contactClicks += Number(r.contact_clicks) || 0;
  }

  const campaignCounts: Record<string, number> = {};
  for (const r of campaignRows) {
    if (r.campaign) {
      campaignCounts[r.campaign] = (campaignCounts[r.campaign] ?? 0) + (Number(r.contact_clicks) || 0);
    }
  }

  return finalize(byChannel, campaignCounts);
}
