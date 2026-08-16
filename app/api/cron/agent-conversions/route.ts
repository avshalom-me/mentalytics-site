import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runConversionsSync } from "@/app/lib/google-ads-conversions";

// העלאת המרות אמת לגוגל - קרון יומי. אותו דפוס: בלי send=confirm שום נתון
// לא עוזב את המערכת (תצוגה מקדימה ביומן בלבד). חימוש = ?send=confirm
// ב-vercel.json, אחרי שפעולות ההמרה הוקמו ואחרי אישור מפורש.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("conversions")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const result = await runConversionsSync({ send });

  return NextResponse.json(
    {
      ok: result.ok,
      mode: result.mode,
      configured: result.configured,
      actions_ready: result.actionsReady,
      pending: result.pending.length,
      uploaded: result.uploaded,
      failed: result.failed,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
