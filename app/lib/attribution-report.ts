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

export function computeAttribution(
  events: { event_type: string; channel: string | null }[],
  views: { channel: string | null }[],
  clicks: { channel: string | null; utm_campaign?: string | null }[],
): AttributionResult {
  const empty = () => ({ pageViews: 0, impressions: 0, profileViews: 0, contactClicks: 0 });
  const byChannel: Record<Bucket, ReturnType<typeof empty>> = Object.fromEntries(
    ALL_BUCKETS.map((b) => [b, empty()]),
  ) as Record<Bucket, ReturnType<typeof empty>>;

  for (const e of events) {
    const b = byChannel[bucketOf(e.channel)];
    if (e.event_type === "page_view") b.pageViews++;
    else if (e.event_type === "profile_impression") b.impressions++;
  }
  for (const v of views) byChannel[bucketOf(v.channel)].profileViews++;
  for (const c of clicks) byChannel[bucketOf(c.channel)].contactClicks++;

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  const channels = ALL_BUCKETS.map((b) => {
    const c = byChannel[b];
    return {
      channel: b,
      ...c,
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
    empty(),
  );

  const campaignCounts: Record<string, number> = {};
  for (const c of clicks) {
    if (c.utm_campaign) campaignCounts[c.utm_campaign] = (campaignCounts[c.utm_campaign] ?? 0) + 1;
  }
  const topCampaigns = Object.entries(campaignCounts)
    .map(([campaign, contactClicks]) => ({ campaign, contactClicks }))
    .sort((a, b) => b.contactClicks - a.contactClicks)
    .slice(0, 15);

  return { channels, totals, topCampaigns };
}
