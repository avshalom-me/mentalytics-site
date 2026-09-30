import { NextRequest, NextResponse } from "next/server";
import { buildBudgetMonthlyReport } from "@/app/lib/budget-report";

// /admin/budget/report: the monthly budget report, fourteen chapters
// (app/lib/budget-report.ts). Read-only.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const report = await buildBudgetMonthlyReport({ month: req.nextUrl.searchParams.get("month") ?? undefined });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
