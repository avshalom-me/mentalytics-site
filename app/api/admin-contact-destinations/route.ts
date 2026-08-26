import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// "Where did the contacts go" - per therapist, per campaign. Behind the admin
// middleware, read-only, aggregated in SQL (see the admin_contact_destinations
// RPC for why the match/profile split is not optional).
const DAYS: Record<string, number> = { "2d": 2, week: 7, month: 30 };

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const channel = req.nextUrl.searchParams.get("channel");
  const campaign = req.nextUrl.searchParams.get("campaign");
  // Group by campaign only when the caller actually shows a campaign column.
  // The all-channels view must not: 172 of 328 clicks carry a utm_campaign, so
  // grouping would split one therapist into rows that read as duplicates.
  const byCampaign = req.nextUrl.searchParams.get("byCampaign") !== "0";
  const since =
    period === "all" ? null : new Date(Date.now() - (DAYS[period] ?? 30) * 86_400_000).toISOString();
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_contact_destinations", {
      p_since: since,
      p_channel: channel || null,
      p_campaign: campaign || null,
      p_by_campaign: byCampaign,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data ?? [], generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
