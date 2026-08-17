import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runAdsMonitor } from "@/app/lib/ads-monitor";

// סוכן הפרסום - ניטור יומי. אין כאן דפוס send=confirm כי הסוכן לא שולח
// דבר ולא משנה דבר בחשבון הפרסום: הוא קורא, מצליב, וכותב ממצאים לתור
// ההצעות. הזמן נבחר ל-04:00 UTC (07:00 בישראל) כדי שיום הפרסום הקודם
// ייסגר במלואו בשעון החשבון.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("ads")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runAdsMonitor();
  return NextResponse.json(
    {
      ok: result.ok,
      configured: result.configured,
      findings: result.findings.map((f) => ({ key: f.key, title: f.title })),
      spend_mtd: result.spendMtd,
      budget_pace: result.budgetPace,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
