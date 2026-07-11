import { NextRequest, NextResponse } from "next/server";
import { googleAdsConfigured, fetchGoogleAdsCampaigns } from "@/app/lib/google-ads";

export const dynamic = "force-dynamic";

// Read-only Google Ads spend/performance for the marketing dashboard. Behind the
// admin middleware (/api/admin-* prefix). Returns { configured:false } when the
// env vars aren't set so the dashboard shows a hint instead of an error.
// "all" uses a long lookback (~2y) so it lines up with the all-time contacts
// the funnel/attribution endpoints return — otherwise CPL on the "הכל" tab
// divides a short spend window by all-time contacts. Campaigns are all recent,
// so 730d effectively covers their full history.
const DAYS: Record<string, number> = { week: 7, month: 30, all: 730 };

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
