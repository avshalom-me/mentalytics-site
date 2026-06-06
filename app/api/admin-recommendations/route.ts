import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { computeSupplyDemand } from "@/app/lib/supply-demand";
import { buildRecommendations } from "@/app/lib/recommendations";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["pending", "accepted"];
const VALID_TARGET_STATUSES = ["accepted", "dismissed", "done", "pending"];

type Rec = {
  id: string;
  type: string;
  target_key: string;
  title: string;
  rationale: string;
  suggested_action: string;
  priority: number;
  metadata: Record<string, unknown>;
  status: string;
  created_at: string;
  resolved_at: string | null;
};

// List current recommendations grouped by status.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("marketing_recommendations")
      .select("*")
      .order("priority", { ascending: false })
      .limit(300);
    if (error) throw error;
    const all = (data ?? []) as Rec[];
    return NextResponse.json({
      ok: true,
      pending: all.filter((r) => r.status === "pending"),
      accepted: all.filter((r) => r.status === "accepted"),
      dismissed: all
        .filter((r) => r.status === "dismissed" || r.status === "done")
        .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""))
        .slice(0, 20),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// Generate: recompute organic recommendations and insert new pending ones
// (deduped against existing pending/accepted by type+target_key).
export async function POST() {
  try {
    const [tRes, vRes, cRes] = await Promise.all([
      supabaseAdmin.from("therapists").select("id, full_name, regions, online").eq("status", "paying"),
      supabaseAdmin.from("therapist_profile_views").select("therapist_id, viewer_region"),
      supabaseAdmin.from("therapist_contact_clicks").select("therapist_id"),
    ]);

    const sd = computeSupplyDemand(tRes.data ?? [], vRes.data ?? [], cRes.data ?? []);
    const computed = buildRecommendations(sd);

    const { data: existing } = await supabaseAdmin
      .from("marketing_recommendations")
      .select("type, target_key")
      .in("status", ACTIVE_STATUSES);
    const seen = new Set((existing ?? []).map((r) => `${r.type}|${r.target_key}`));

    const toInsert = computed.filter((r) => !seen.has(`${r.type}|${r.target_key}`));
    if (toInsert.length) {
      const { error } = await supabaseAdmin.from("marketing_recommendations").insert(
        toInsert.map((r) => ({
          type: r.type,
          target_key: r.target_key,
          title: r.title,
          rationale: r.rationale,
          suggested_action: r.suggested_action,
          priority: r.priority,
          metadata: r.metadata,
        })),
      );
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, generated: toInsert.length, totalComputed: computed.length });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// Resolve a recommendation: accept / dismiss / done / re-open (pending).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id;
    const status = body?.status;
    if (!id || typeof id !== "string" || !VALID_TARGET_STATUSES.includes(status)) {
      return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from("marketing_recommendations")
      .update({ status, resolved_at: status === "pending" ? null : new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
