import { NextRequest, NextResponse } from "next/server";
import { loadBudgetReport } from "@/app/lib/budget-data";

// /admin/budget, read-only: the month's advertising ceiling, how the budgets
// set in Google today compare with it, and a recommended split
// (app/lib/budget-agent.ts). Nothing here writes anywhere.

export async function GET(req: NextRequest) {
  try {
    const report = await loadBudgetReport({ month: req.nextUrl.searchParams.get("month") ?? undefined });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
