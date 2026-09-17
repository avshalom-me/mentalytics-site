import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runCenterHealth } from "@/app/lib/center-health-agent";

// סוכן בריאות המרכזים - ריצה יומית לפני דוח הבוקר, כדי שממצא דחוף על
// מרכז יופיע בראש הדוח של אותו יום. קורא בלבד: לא שולח מייל ולא משנה דבר.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("center_health")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runCenterHealth();
  return NextResponse.json(
    {
      ok: result.ok,
      checked: result.checked,
      findings: result.findings,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
