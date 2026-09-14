import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { startAgentRun, finishAgentRun } from "@/app/lib/agent-infra";
import { runGiftTrialReminder } from "@/app/lib/gift-trial-reminder";

// תזכורת שבוע לפני החיוב הראשון במסלול ההזמנה.
//
// תצוגה מקדימה כברירת מחדל, בדיוק כמו שאר מסלולי השליחה: המייל יוצא רק
// כשה-URL בקרון נושא ?send=confirm. עד שהמסלול יחומש, הריצה רק מחזירה את
// מי שהיה מקבל תזכורת היום.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const send = req.nextUrl.searchParams.get("send") === "confirm";
  // דופק ליומן הריצות. שלושת הקרונים ששולחים מייל ללקוחות לא נרשמו בשום
// מקום, ולכן קרון שהפסיק לרוץ היה כשל שקט לחלוטין - איש לא היה יודע עד
// שמטפל היה שואל למה לא קיבל הודעה. שומר הלילה בודק את הרישום הזה.
  const runId = await startAgentRun("cron_gift_reminder", send ? "send" : "preview");
  const result = await runGiftTrialReminder({ send });
  await finishAgentRun(runId, {
    status: result.ok ? "ok" : "error",
    summary: `${result.targets.length} חיובים ראשונים בעוד שבוע, נשלחו ${result.sent}`,
    error: result.error,
  });

  return NextResponse.json(
    {
      ok: result.ok,
      preview_only: result.previewOnly,
      sent: result.sent,
      would_notify: result.targets.map((t) => ({
        therapist_id: t.therapistId,
        charge_date: t.chargeDate,
        amount: t.amount,
      })),
      error: result.error,
    },
    { status: result.ok ? 200 : 500 }
  );
}
