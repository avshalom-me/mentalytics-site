import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { agentEnabled } from "@/app/lib/agent-infra";
import { runRetentionReview } from "@/app/lib/retention-review-data";

// סוכן שימור המטפלים - הסקירה השבועית (ראשון בבוקר, vercel.json). קורא
// בלבד: שומר צילום ב-retention_reviews ומכין פעולות בתור; שום מייל לא
// נשלח, שום קידום לא משתנה. הכפתורים בעמוד /admin/retention.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!agentEnabled("retention")) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const result = await runRetentionReview({ mode: "weekly" });
  return NextResponse.json(
    { ok: result.ok, week_start: result.weekStart, summary: result.summary, error: result.error },
    { status: result.ok ? 200 : 500 }
  );
}
