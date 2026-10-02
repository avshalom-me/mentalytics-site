import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { startAgentRun, finishAgentRun } from "@/app/lib/agent-infra";
import { runFinalSignupReminder } from "@/app/lib/final-signup-reminder";

// תזכורת אחרונה לנרשמים שלא מילאו פרופיל (4-7/10/2026, 40 ביום), וסגירת
// ההרשמה שבוע אחריה. כל הכללים ב-app/lib/final-signup-reminder.ts.
//
// תצוגה מקדימה כברירת מחדל, כמו שאר מסלולי השליחה: בלי ?send=confirm הריצה
// רק מחזירה כמה היו מקבלים היום ולא שולחת ולא סוגרת דבר.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const runId = await startAgentRun("cron_final_signup_reminder", send ? "send" : "preview");
  const result = await runFinalSignupReminder({ send });
  await finishAgentRun(runId, {
    status: result.ok ? "ok" : "error",
    summary:
      `תזכורת אחרונה: נשלחו ${result.sent}, נכשלו ${result.failed}, נדחו ${result.deferred}, ` +
      `נותרו ${Math.max(0, result.remainingBefore - result.sent)}; הרשמות שנסגרו ${result.archived}`,
    error: result.error,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
