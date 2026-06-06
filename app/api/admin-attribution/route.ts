import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeAttribution } from "@/app/lib/attribution-report";

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
        let q = supabaseAdmin.from("therapist_profile_views").select("channel");
        if (since) q = q.gte("viewed_at", since);
        return q;
      })(),
      (() => {
        let q = supabaseAdmin.from("therapist_contact_clicks").select("channel, utm_campaign");
        if (since) q = q.gte("clicked_at", since);
        return q;
      })(),
    ]);

    if (eventsRes.error) throw eventsRes.error;
    if (viewsRes.error) throw viewsRes.error;
    if (clicksRes.error) throw clicksRes.error;

    const result = computeAttribution(eventsRes.data ?? [], viewsRes.data ?? [], clicksRes.data ?? []);

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      ...result,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
