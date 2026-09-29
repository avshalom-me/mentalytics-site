import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runBudgetAgent } from "@/app/lib/budget-run";

// סוכן התקציב - פעם בחודש, ב-1 לחודש לפני דוח הבוקר (vercel.json). אין כאן
// דפוס send=confirm כי הסוכן לא שולח דבר ולא נוגע בחשבון הפרסום: הוא מחשב,
// וכותב המלצה אחת לתור ההצעות.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("budget")) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const result = await runBudgetAgent({ mode: "cron" });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
