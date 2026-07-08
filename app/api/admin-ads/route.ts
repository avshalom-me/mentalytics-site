import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { regionToSlug, ONLINE_SLUG } from "@/app/lib/regions";

// Data + geography for the /admin/ads planning page: the promoted (paid / gift)
// and free therapists, and where they are — so the page can recommend WHERE to
// run paid search (advertise where the paying therapists are, to feed them).
// Guarded by the admin Basic-Auth middleware. therapists is ~hundreds of rows
// (well under the 1000 cap), so a plain select is fine here.

export const dynamic = "force-dynamic";

type Row = {
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
    const { data, error } = await supabaseAdmin
      .from("therapists")
      .select("full_name, status, promotion_source, regions, therapist_types, online")
      .eq("admin_approved", true)
      .in("status", ["paying", "approved"])
      .order("full_name", { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as Row[];
    const therapists = rows.map((r) => ({
      tier: tierOf(r),
      full_name: r.full_name ?? "—",
      regions: r.regions ?? [],
      types: r.therapist_types ?? [],
      online: Boolean(r.online),
    }));

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
