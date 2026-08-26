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
  const since =
    period === "all" ? null : new Date(Date.now() - (DAYS[period] ?? 30) * 86_400_000).toISOString();
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_contact_destinations", {
      p_since: since,
      p_channel: channel || null,
      p_campaign: campaign || null,
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
