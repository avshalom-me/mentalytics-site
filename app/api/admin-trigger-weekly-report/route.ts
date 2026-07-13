import { NextResponse } from "next/server";
import { runWeeklyReport } from "@/app/api/cron/weekly-report/route";

export const dynamic = "force-dynamic";
// Must match the cron route (runReport uses a reasoning LLM that takes ~150-180s
// on real data). At 120 the manual trigger 504'd mid-LLM while the Sunday cron
// (300) succeeded — the button returned a plain-text timeout page that broke the
// client's JSON.parse ("Unexpected token 'A'").
export const maxDuration = 300;

// Auth is enforced by middleware (Basic Auth on /api/admin-*).
export async function POST() {
  const result = await runWeeklyReport();
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
