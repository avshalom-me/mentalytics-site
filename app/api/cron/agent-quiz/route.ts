import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runQuizFunnel } from "@/app/lib/quiz-funnel";

// סוכן השאלונים - קריאה וניתוח בלבד. לא שולח דבר ולא נוגע בתוכן השאלון;
// הוא משווה את המשפך לשבועות שקדמו ומתריע על רגרסיה.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("quiz_funnel")) {
    return NextResponse.json({ ok: true, disabled: true });
  }
  const r = await runQuizFunnel();
  return NextResponse.json(
    {
      ok: r.ok,
      funnels: r.funnels.map((f) => ({
        quiz: f.quiz,
        entries: f.recentEntries,
        completion: f.recentCompletion,
        baseline_completion: f.baselineCompletion,
      })),
      findings: r.findings,
      error: r.error,
    },
    { status: r.ok ? 200 : 500 }
  );
}
