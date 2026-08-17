import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runWatchdog } from "@/app/lib/watchdog";

// שומר הלילה - קרון לילי. אותו דפוס כמו בקר הבוקר: בלי send=confirm
// הכישלונות נרשמים בתור וביומן בלבד; מייל התראה מיידי נשלח רק כשהנתיב
// ב-vercel.json חמוש ב-?send=confirm, אחרי אישור.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("watchdog")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const result = await runWatchdog({ send });

  return NextResponse.json(
    {
      ok: result.ok,
      mode: result.mode,
      passed: result.checks.filter((c) => c.ok && !c.skipped).length,
      skipped: result.checks.filter((c) => c.skipped).length,
      failures: result.failures.map((f) => ({ key: f.key, label: f.label, detail: f.detail })),
      email_status: result.emailStatus,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
