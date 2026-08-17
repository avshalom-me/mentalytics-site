import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runFinanceRecon } from "@/app/lib/finance-recon";

// סוכן הכספים - התאמה יומית בין הקידום בפועל לחיוב בפועל. אין כאן
// send=confirm כי הסוכן לא שולח ולא משנה כלום: הוא קורא את הטבלאות שלנו,
// מצליב, וכותב ממצאים. רץ ב-07:15 UTC, אחרי sumit-status-sync שרץ ב-06:45
// UTC - אחרת היינו מדווחים על פערים שהסנכרון עומד לסגור בעצמו.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("finance")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runFinanceRecon();
  return NextResponse.json(
    {
      ok: result.ok,
      findings: result.findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
      checked: result.checked,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
