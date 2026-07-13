import { NextRequest, NextResponse } from "next/server";
import { runReport } from "@/app/api/cron/weekly-report/route";
import { cronAuthorized } from "@/app/lib/cron-auth";

export const dynamic = "force-dynamic";
// runReport("monthly") uses the reasoning LLM (~150-180s on real data); 120 was
// too tight and this monthly cron could 504. Match the weekly cron's headroom.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReport("monthly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
