import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runDailyDigest } from "@/app/lib/daily-digest";

// בקר התפעול היומי - קרון בוקר. אותו דפוס בטיחות של trial-ending: בלי
// send=confirm הריצה היא תצוגה מקדימה בלבד (נרשמת ביומן הריצות, לא שולחת
// כלום). החימוש נעשה בהוספת ?send=confirm לנתיב ב-vercel.json, אחרי אישור.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("daily_digest")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const result = await runDailyDigest({ send });

  // ל-HTML אין מקום בתשובת קרון - התצוגה המקדימה נצפית מעמוד הסוכנים.
  return NextResponse.json(
    {
      ok: result.ok,
      mode: result.mode,
      empty: result.empty,
      sections: result.sections.map((s) => ({ key: s.key, label: s.label, count: s.count })),
      email_status: result.emailStatus,
      recipients: result.recipients,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
