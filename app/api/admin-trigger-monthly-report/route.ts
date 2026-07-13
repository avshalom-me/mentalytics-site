import { NextResponse } from "next/server";
import { runReport } from "@/app/api/cron/weekly-report/route";

export const dynamic = "force-dynamic";
// Same reasoning-LLM path as the weekly report (~150-180s); 120 timed out. Match
// the cron headroom so the manual trigger doesn't 504 and break the client.
export const maxDuration = 300;

// Auth is enforced by middleware (Basic Auth on /api/admin-*).
export async function POST() {
  const result = await runReport("monthly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
