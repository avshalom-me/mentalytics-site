import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Organic entries by landing-page family. Behind the admin middleware,
// read-only, aggregated in SQL (see the admin_organic_by_page_family RPC for
// why `online` is split out of `region`).
const DAYS: Record<string, number> = { month: 30, quarter: 90 };

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get("period") ?? "all";
  const since =
    period === "all" ? null : new Date(Date.now() - (DAYS[period] ?? 30) * 86_400_000).toISOString();
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_organic_by_page_family", { p_since: since });
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data ?? [], generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
