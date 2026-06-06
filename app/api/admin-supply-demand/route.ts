import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import {
  REGION_CATEGORIES,
  REGION_LABELS,
  therapistAreaToBucket,
  type RegionCategory,
} from "@/app/lib/stats-categories";

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";
type RegionStatus = "needs_therapists" | "needs_patients" | "balanced" | "empty";

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
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, regions, online")
        .eq("status", "paying"),
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

    const therapists = (therapistsRes.data ?? []) as {
      id: string; full_name: string | null; regions: string[] | null; online: boolean | null;
    }[];
    const views = (viewsRes.data ?? []) as { therapist_id: string | null; viewer_region: string | null }[];
    const clicks = (clicksRes.data ?? []) as { therapist_id: string | null }[];

    // Physical regions only (online is flexible capacity, handled separately)
    const physicalRegions = REGION_CATEGORIES.filter((r) => r !== "online") as RegionCategory[];
    const isPhysical = (r: string | null): r is RegionCategory =>
      !!r && (physicalRegions as readonly string[]).includes(r);

    // --- Supply: paying therapists serving each physical region ---
    const supply: Record<string, number> = Object.fromEntries(physicalRegions.map((r) => [r, 0]));
    let onlineTherapistCount = 0;
    for (const t of therapists) {
      if (t.online) onlineTherapistCount++;
      const buckets = new Set<RegionCategory>();
      for (const area of t.regions ?? []) {
        const b = therapistAreaToBucket(area);
        if (b && b !== "online") buckets.add(b);
      }
      for (const b of buckets) supply[b]++;
    }

    // --- Demand: profile views by patient region ---
    const demand: Record<string, number> = Object.fromEntries(physicalRegions.map((r) => [r, 0]));
    let demandNoRegion = 0;
    for (const v of views) {
      if (isPhysical(v.viewer_region)) demand[v.viewer_region]++;
      else if (v.viewer_region !== "online") demandNoRegion++;
    }

    const totalDemand = physicalRegions.reduce((s, r) => s + demand[r], 0);
    const totalSupplySlots = physicalRegions.reduce((s, r) => s + supply[r], 0);
    const globalRatio = totalSupplySlots > 0 ? totalDemand / totalSupplySlots : 0;

    function classify(d: number, s: number): RegionStatus {
      if (s === 0 && d === 0) return "empty";
      if (s === 0 && d > 0) return "needs_therapists";
      if (s > 0 && d === 0) return "needs_patients";
      const ratio = d / s;
      if (globalRatio > 0 && ratio >= 1.5 * globalRatio) return "needs_therapists";
      if (globalRatio > 0 && ratio <= 0.5 * globalRatio) return "needs_patients";
      return "balanced";
    }

    const regions = physicalRegions
      .map((r) => {
        const s = supply[r];
        const d = demand[r];
        return {
          region: r,
          label: REGION_LABELS[r],
          therapists: s,
          demand: d,
          demandPerTherapist: s > 0 ? Math.round((d / s) * 10) / 10 : null,
          status: classify(d, s),
        };
      })
      .sort((a, b) => b.demand - a.demand || b.therapists - a.therapists);

    // --- Per-therapist leads (the "every paying therapist gets a lead" check) ---
    const viewsByT: Record<string, number> = {};
    for (const v of views) if (v.therapist_id) viewsByT[v.therapist_id] = (viewsByT[v.therapist_id] ?? 0) + 1;
    const clicksByT: Record<string, number> = {};
    for (const c of clicks) if (c.therapist_id) clicksByT[c.therapist_id] = (clicksByT[c.therapist_id] ?? 0) + 1;

    const therapistLeads = therapists
      .map((t) => {
        const labels = [
          ...new Set(
            (t.regions ?? [])
              .map((a) => {
                const b = therapistAreaToBucket(a);
                return b ? REGION_LABELS[b] : null;
              })
              .filter((x): x is string => !!x),
          ),
        ];
        return {
          id: t.id,
          full_name: t.full_name ?? "—",
          online: !!t.online,
          regionLabels: labels,
          profileViews: viewsByT[t.id] ?? 0,
          contactClicks: clicksByT[t.id] ?? 0,
        };
      })
      .sort((a, b) => a.contactClicks - b.contactClicks || a.profileViews - b.profileViews);

    const starvingCount = therapistLeads.filter((t) => t.contactClicks === 0).length;

    return NextResponse.json({
      ok: true,
      period: safePeriod,
      regions,
      therapistLeads,
      onlineTherapistCount,
      payingTherapistCount: therapists.length,
      starvingCount,
      demandNoRegion,
      totals: { demand: totalDemand },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
