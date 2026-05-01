import { NextResponse } from "next/server";
import { runReport } from "@/app/api/cron/weekly-report/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Auth is enforced by middleware (Basic Auth on /api/admin-*).
export async function POST() {
  const result = await runReport("monthly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
