/**
 * Shared supply/demand computation - the single source of truth for the
 * Phase 1 dashboard (/api/admin-supply-demand) AND the Phase 2 recommendation
 * generator (/api/admin-recommendations). Pure function, no DB access.
 */

import {
  REGION_CATEGORIES,
  REGION_LABELS,
  therapistAreaToBucket,
  type RegionCategory,
} from "./stats-categories";

export type TherapistRow = {
  id: string;
  full_name: string | null;
  regions: string[] | null;
  online: boolean | null;
};
export type ViewRow = { therapist_id: string | null; viewer_region: string | null };
export type ClickRow = { therapist_id: string | null };

export type RegionStatus = "needs_therapists" | "needs_patients" | "balanced" | "empty";

export type RegionBalance = {
  region: RegionCategory;
  label: string;
  therapists: number;
  demand: number;
  demandPerTherapist: number | null;
  status: RegionStatus;
};
export type TherapistLead = {
  id: string;
  full_name: string;
  online: boolean;
  regionLabels: string[];
  profileViews: number;
  contactClicks: number;
};
export type SupplyDemand = {
  regions: RegionBalance[];
  therapistLeads: TherapistLead[];
  onlineTherapistCount: number;
  payingTherapistCount: number;
  starvingCount: number;
  demandNoRegion: number;
  totalDemand: number;
};

export function computeSupplyDemand(
  therapists: TherapistRow[],
  views: ViewRow[],
  clicks: ClickRow[],
): SupplyDemand {
  const physicalRegions = REGION_CATEGORIES.filter((r) => r !== "online") as RegionCategory[];
  const isPhysical = (r: string | null): r is RegionCategory =>
    !!r && (physicalRegions as readonly string[]).includes(r);

  // Supply: paying therapists serving each physical region
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

  // Demand: profile views by patient region
  const demand: Record<string, number> = Object.fromEntries(physicalRegions.map((r) => [r, 0]));
  let demandNoRegion = 0;
  for (const v of views) {
    if (isPhysical(v.viewer_region)) demand[v.viewer_region]++;
    else if (v.viewer_region !== "online") demandNoRegion++;
  }

  const totalDemand = physicalRegions.reduce((s, r) => s + demand[r], 0);
  const totalSupplySlots = physicalRegions.reduce((s, r) => s + supply[r], 0);
  const globalRatio = totalSupplySlots > 0 ? totalDemand / totalSupplySlots : 0;

  const classify = (d: number, s: number): RegionStatus => {
    if (s === 0 && d === 0) return "empty";
    if (s === 0 && d > 0) return "needs_therapists";
    if (s > 0 && d === 0) return "needs_patients";
    const ratio = d / s;
    if (globalRatio > 0 && ratio >= 1.5 * globalRatio) return "needs_therapists";
    if (globalRatio > 0 && ratio <= 0.5 * globalRatio) return "needs_patients";
    return "balanced";
  };

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
        full_name: t.full_name ?? "-",
        online: !!t.online,
        regionLabels: labels,
        profileViews: viewsByT[t.id] ?? 0,
        contactClicks: clicksByT[t.id] ?? 0,
      };
    })
    .sort((a, b) => a.contactClicks - b.contactClicks || a.profileViews - b.profileViews);

  const starvingCount = therapistLeads.filter((t) => t.contactClicks === 0).length;

  return {
    regions,
    therapistLeads,
    onlineTherapistCount,
    payingTherapistCount: therapists.length,
    starvingCount,
    demandNoRegion,
    totalDemand,
  };
}
