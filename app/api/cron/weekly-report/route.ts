import { NextRequest, NextResponse } from "next/server";
import { runReport } from "@/app/lib/admin-report";
import { cronAuthorized } from "@/app/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // reasoning models need more headroom (Vercel caps to plan max)

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReport("weekly");
  const { status, ...body } = result;
  return NextResponse.json(body, { status: status ?? 200 });
}
