import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeSupplyDemand } from "@/app/lib/supply-demand";

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
    const [therapistsRes, viewsRes, clicksRes] = await Promise.all([
      supabaseAdmin.from("therapists").select("id, full_name, regions, online").eq("status", "paying"),
      (() => {
        let q = supabaseAdmin.from("therapist_profile_views").select("therapist_id, viewer_region");
        if (since) q = q.gte("viewed_at", since);
        return q;
      })(),
      (() => {
        let q = supabaseAdmin.from("therapist_contact_clicks").select("therapist_id");
        if (since) q = q.gte("clicked_at", since);
        return q;
      })(),
    ]);

    if (therapistsRes.error) throw therapistsRes.error;
    if (viewsRes.error) throw viewsRes.error;
    if (clicksRes.error) throw clicksRes.error;

    const sd = computeSupplyDemand(
      therapistsRes.data ?? [],
      viewsRes.data ?? [],
      clicksRes.data ?? [],
    );

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      ...sd,
      totals: { demand: sd.totalDemand },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
