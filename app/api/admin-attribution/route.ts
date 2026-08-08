import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeAttributionFromCounts } from "@/app/lib/attribution-report";

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
    // Aggregate per-channel + per-campaign server-side (COUNT + GROUP BY) via
    // RPC. The old approach fetched raw rows and counted them in JS, which hit
    // PostgREST's 1000-row cap and silently froze any metric above 1000 at
    // exactly 1000 (e.g. impressions 7800+ -> 1000). The RPC is exact + cheap.
    const { data, error } = await supabaseAdmin.rpc("admin_attribution_report", {
      p_since: since,
    });
    if (error) throw error;

    const agg = (data ?? {}) as {
      channels?: {
        channel: string | null;
        page_views: number;
        impressions: number;
        profile_views: number;
        contact_clicks: number;
      }[];
      campaigns?: { campaign: string | null; contact_clicks: number }[];
    };

    const result = computeAttributionFromCounts(agg.channels ?? [], agg.campaigns ?? []);

    // Which referring SITE sent them - the question the channel breakdown
    // cannot answer and the backlink campaign needs. Non-fatal: this shipped
    // after the main report, so a failure here must not blank the page.
    let referrers: {
      host: string;
      sessions: number;
      pageViews: number;
      profileViews: number;
      contactClicks: number;
    }[] = [];
    try {
      const { data: refData } = await supabaseAdmin.rpc("admin_referrer_report", { p_since: since });
      referrers = ((refData ?? []) as Record<string, unknown>[])
        .map((r) => ({
          host: String(r.host ?? ""),
          sessions: Number(r.sessions) || 0,
          pageViews: Number(r.page_views) || 0,
          profileViews: Number(r.profile_views) || 0,
          contactClicks: Number(r.contact_clicks) || 0,
        }))
        .filter((r) => r.host)
        .slice(0, 30);
    } catch {
      referrers = [];
    }

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      ...result,
      referrers,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
