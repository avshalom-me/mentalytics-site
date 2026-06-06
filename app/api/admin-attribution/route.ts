import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { CHANNELS, type Channel } from "@/app/lib/attribution";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";
type Bucket = Channel | "unknown";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const ms = period === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
  return new Date(Date.now() - ms).toISOString();
}

function bucketOf(channel: string | null | undefined): Bucket {
  return channel && (CHANNELS as readonly string[]).includes(channel)
    ? (channel as Channel)
    : "unknown";
}

const ALL_BUCKETS: Bucket[] = [...CHANNELS, "unknown"];

export async function GET(req: NextRequest) {
  const period = (req.nextUrl.searchParams.get("period") ?? "all") as Period;
  const validPeriods: Period[] = ["week", "month", "all"];
  const safePeriod: Period = validPeriods.includes(period) ? period : "all";
  const since = periodToDate(safePeriod);

  try {
    const [eventsRes, viewsRes, clicksRes] = await Promise.all([
      (() => {
        let q = supabaseAdmin
          .from("analytics_events")
          .select("event_type, channel")
          .in("event_type", ["page_view", "profile_impression"]);
        if (since) q = q.gte("created_at", since);
        return q;
      })(),
      (() => {
        let q = supabaseAdmin
          .from("therapist_profile_views")
          .select("channel");
        if (since) q = q.gte("viewed_at", since);
        return q;
      })(),
      (() => {
        let q = supabaseAdmin
          .from("therapist_contact_clicks")
          .select("channel, utm_campaign, click_type");
        if (since) q = q.gte("clicked_at", since);
        return q;
      })(),
    ]);

    const events = (eventsRes.data ?? []) as { event_type: string; channel: string | null }[];
    const views = (viewsRes.data ?? []) as { channel: string | null }[];
    const clicks = (clicksRes.data ?? []) as { channel: string | null; utm_campaign: string | null; click_type: string }[];

    // Per-channel funnel counters
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

    const channels = ALL_BUCKETS
      .map((b) => {
        const c = byChannel[b];
        return {
          channel: b,
          ...c,
          // % of profile-viewers who clicked a contact button (the "make it to the end" rate)
          viewToClick: pct(c.contactClicks, c.profileViews),
          impressionToClick: pct(c.contactClicks, c.impressions),
        };
      })
      .filter((c) => c.pageViews || c.impressions || c.profileViews || c.contactClicks)
      .sort((a, b) => b.contactClicks - a.contactClicks || b.profileViews - a.profileViews);

    const totals = channels.reduce(
      (acc, c) => {
        acc.pageViews += c.pageViews;
        acc.impressions += c.impressions;
        acc.profileViews += c.profileViews;
        acc.contactClicks += c.contactClicks;
        return acc;
      },
      empty(),
    );

    // Top campaigns by contact clicks (only rows that carry a utm_campaign)
    const campaignCounts: Record<string, number> = {};
    for (const c of clicks) {
      if (c.utm_campaign) campaignCounts[c.utm_campaign] = (campaignCounts[c.utm_campaign] ?? 0) + 1;
    }
    const topCampaigns = Object.entries(campaignCounts)
      .map(([campaign, contactClicks]) => ({ campaign, contactClicks }))
      .sort((a, b) => b.contactClicks - a.contactClicks)
      .slice(0, 15);

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      totals,
      channels,
      topCampaigns,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
