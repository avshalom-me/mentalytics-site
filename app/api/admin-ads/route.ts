import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";
import { computeSupplyDemand } from "@/app/lib/supply-demand";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

// Data + geography for the /admin/ads planning page: the promoted (paid / gift)
// and free therapists, where they are, AND the supply×demand balance — so the
// page can recommend WHERE to run paid patient search (advertise where paying
// therapists are) and WHERE demand outstrips supply (recruit therapists there).
// Guarded by the admin Basic-Auth middleware.

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  full_name: string | null;
  status: string | null;
  promotion_source: string | null;
  regions: string[] | null;
  therapist_types: string[] | null;
  online: boolean | null;
};

type Tier = "paid" | "gift" | "free";
const tierOf = (r: Row): Tier =>
  r.status === "paying" ? (r.promotion_source === "paid" ? "paid" : "gift") : "free";

const isSocialWorker = (types: string[]) =>
  types.some((t) => t.includes('עו"ס') || t.includes("סוציאל"));

export async function GET() {
  try {
    const [therapistsRes, views, clicks] = await Promise.all([
      supabaseAdmin
        .from("therapists")
        .select("id, full_name, status, promotion_source, regions, therapist_types, online")
        .eq("admin_approved", true)
        .in("status", ["paying", "approved"])
        .order("full_name", { ascending: true }),
      // Patient demand (profile views by viewer region) + clicks, for the
      // supply×demand cross-insight. Page past the 1000-row cap — views grows fast.
      fetchAllRows<{ therapist_id: string | null; viewer_region: string | null }>(() =>
        supabaseAdmin.from("therapist_profile_views").select("therapist_id, viewer_region"),
      ),
      fetchAllRows<{ therapist_id: string | null }>(() =>
        supabaseAdmin.from("therapist_contact_clicks").select("therapist_id"),
      ),
    ]);
    if (therapistsRes.error) throw therapistsRes.error;

    const rows = (therapistsRes.data ?? []) as Row[];
    const therapists = rows.map((r) => ({
      tier: tierOf(r),
      full_name: r.full_name ?? "—",
      regions: r.regions ?? [],
      types: r.therapist_types ?? [],
      online: Boolean(r.online),
    }));

    // ── Roster geography (city-level) ──
    const online = { paid: 0, gift: 0, free: 0 };
    const regionMap = new Map<string, { paid: number; gift: number; free: number; sw: boolean }>();
    for (const t of therapists) {
      if (t.online) online[t.tier]++;
      for (const region of t.regions) {
        let e = regionMap.get(region);
        if (!e) {
          e = { paid: 0, gift: 0, free: 0, sw: false };
          regionMap.set(region, e);
        }
        e[t.tier]++;
        if (isSocialWorker(t.types)) e.sw = true;
      }
    }
    const byRegion = [...regionMap.entries()]
      .map(([region, v]) => ({ region, slug: regionToSlug(region), ...v }))
      .sort(
        (a, b) =>
          b.paid - a.paid ||
          b.paid + b.gift - (a.paid + a.gift) ||
          b.free - a.free ||
          a.region.localeCompare(b.region, "he"),
      );

    // ── Supply × demand (region-category level): promoted therapists vs patient
    // demand. Reuses the shared computeSupplyDemand (same as /admin/supply-demand). ──
    const promoted = rows
      .filter((r) => r.status === "paying")
      .map((r) => ({ id: r.id, full_name: r.full_name, regions: r.regions, online: r.online }));
    const sd = computeSupplyDemand(promoted, views, clicks);

    return NextResponse.json({
      ok: true,
      counts: {
        paid: therapists.filter((t) => t.tier === "paid").length,
        gift: therapists.filter((t) => t.tier === "gift").length,
        free: therapists.filter((t) => t.tier === "free").length,
      },
      online,
      onlineSlug: ONLINE_SLUG,
      byRegion,
      supplyDemand: sd.regions,
      therapists,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
