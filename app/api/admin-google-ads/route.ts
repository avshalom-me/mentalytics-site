import { NextRequest, NextResponse } from "next/server";
import { googleAdsConfigured, fetchGoogleAdsCampaigns } from "@/app/lib/google-ads";

export const dynamic = "force-dynamic";

// Read-only Google Ads spend/performance for the marketing dashboard. Behind the
// admin middleware (/api/admin-* prefix). Returns { configured:false } when the
// env vars aren't set so the dashboard shows a hint instead of an error.
const DAYS: Record<string, number> = { week: 7, month: 30, all: 90 };

export async function GET(req: NextRequest) {
  if (!googleAdsConfigured()) {
    return NextResponse.json({ ok: true, configured: false });
  }
  const period = req.nextUrl.searchParams.get("period") ?? "month";
  const days = DAYS[period] ?? 30;
  try {
    const data = await fetchGoogleAdsCampaigns(days);
    return NextResponse.json({ ok: true, configured: true, ...data, generated_at: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, configured: true, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
