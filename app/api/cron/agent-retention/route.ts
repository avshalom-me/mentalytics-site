import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runRetention } from "@/app/lib/retention";

// סוכן שימור המטפלים - ריצה יומית. קורא בלבד: לא שולח מייל לאף אחד,
// לא משנה קידום ולא נוגע במנויים. הממצאים מוצגים בעמוד המטפלים באדמין.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("retention")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runRetention();
  return NextResponse.json(
    {
      ok: result.ok,
      checked: result.checked,
      findings: result.findings.map((f) => ({ key: f.key, severity: f.severity, title: f.title })),
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
