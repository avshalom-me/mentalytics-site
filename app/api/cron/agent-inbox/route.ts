import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runInboxAgent } from "@/app/lib/inbox-agent";

// סוכן שירות הלקוחות - קליטה, סיווג וטיוטות בלבד. שום מייל לא נשלח מכאן:
// שליחה קיימת רק כלחיצת אדמין על טיוטה ספציפית בעמוד הסוכנים.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("inbox")) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const r = await runInboxAgent();
  return NextResponse.json(
    {
      ok: r.ok,
      configured: r.configured,
      fetched: r.fetched,
      inserted: r.inserted,
      drafted: r.drafted,
      auto_ignored: r.autoIgnored,
      answered_external: r.answeredExternal,
      errors: r.errors.slice(0, 10),
      error: r.error,
    },
    { status: r.ok ? 200 : 500 }
  );
}
