import { NextRequest, NextResponse } from "next/server";
import { runReport } from "@/app/api/cron/weekly-report/route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const hasSecret = CRON_SECRET && req.headers.get("authorization") === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReport("monthly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
