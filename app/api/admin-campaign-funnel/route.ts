import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Per-campaign on-site funnel (entries -> profile views -> contacts by type),
// via the admin_campaign_funnel SQL RPC. Behind the admin middleware.
const DAYS: Record<string, number> = { week: 7, month: 30 };

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const since = period === "all" ? null : new Date(Date.now() - (DAYS[period] ?? 30) * 86_400_000).toISOString();
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_campaign_funnel", { p_since: since });
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data ?? [], generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
