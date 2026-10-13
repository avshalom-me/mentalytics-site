import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { startAgentRun, finishAgentRun } from "@/app/lib/agent-infra";
import { runRetentionGiftReminder } from "@/app/lib/retention-gift";

// "הארכה במתנה - שימור": מייל שבוע לפני שהחיוב חוזר.
//
// קיום הבטחה ולא שיווק: מייל המתנה אומר למטפל "שבוע לפני סיום המתנה נשלח
// אליך מייל תזכורת". תצוגה מקדימה כברירת מחדל, כמו שאר מסלולי השליחה: בלי
// ?send=confirm הריצה רק מחזירה את מי שהיה מקבל היום.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  const runId = await startAgentRun("cron_retention_gift_reminder", send ? "send" : "preview");
  const result = await runRetentionGiftReminder({ send });
  await finishAgentRun(runId, {
    // תאריך שלא תואם את Sumit הוא ממצא שמישהו צריך לראות, ולכן הריצה מסומנת
    // כשגיאה גם כשלא נזרקה חריגה - מייל שהובטח לא יצא.
    status: result.ok && result.mismatched.length === 0 ? "ok" : "error",
    summary:
      `מתנות שימור שמסתיימות בשבוע הקרוב: ${result.targets.length}, נשלחו ${result.sent}` +
      (result.mismatched.length ? `; ${result.mismatched.length} עם תאריך שלא תואם את Sumit - לא נשלח` : ""),
    error:
      result.error ??
      (result.mismatched.length
        ? `תאריך החיוב ב-Sumit שונה מהרשום במתנה: ${result.mismatched.map((m) => `${m.therapistId} (${m.ours} מול ${m.sumit ?? "לא ידוע"})`).join(", ")}`
        : undefined),
  });

  return NextResponse.json(
    {
      ok: result.ok,
      preview_only: result.previewOnly,
      sent: result.sent,
      would_notify: result.targets.map((t) => ({ therapist_id: t.therapistId, charge_date: t.chargeDate, amount: t.amount })),
      mismatched: result.mismatched,
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
