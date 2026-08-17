import { NextResponse } from "next/server";
import { buildDashboardData } from "@/app/lib/work-queue";

// The CRM home: KPI counts, the daily work queue (everything that needs the
// admin's attention today), and actual-vs-business-plan targets.
// The data assembly lives in app/lib/work-queue.ts, shared with the agents'
// daily digest so both always show the same queue.

export async function GET() {
  try {
    const data = await buildDashboardData();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
