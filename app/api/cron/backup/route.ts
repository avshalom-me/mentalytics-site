import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { runBackup } from "@/app/lib/backup-run";
import { alertRecipients } from "@/app/lib/alert-recipients";
import { Resend } from "resend";

// גיבוי יומי ל-Google Drive של המשתמש.
//
// אין כאן send=confirm ואין שער מיילים: הקרון הזה לא שולח דבר לאף גורם
// חיצוני - הוא מעלה קבצים לדרייב שבבעלות המשתמש. ההתראה היחידה יוצאת
// **אלינו** ורק כשהגיבוי נכשל, כי גיבוי שנכשל בשקט גרוע מאין גיבוי: הוא
// מייצר ביטחון שאין לו כיסוי.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runBackup();

  // כשל אמיתי בלבד. "לא מוגדר" אינו כשל - זה מצב ההמתנה עד שהאישורים יוקמו.
  if (!result.ok && result.configured) {
    try {
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "טיפול חכם <noreply@mentalytics.co.il>",
        to: alertRecipients(),
        subject: "⚠️ הגיבוי היומי ל-Google Drive נכשל",
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;">
          <p>ריצת הגיבוי נכשלה. <strong>קבצי ה-Storage אינם מכוסים בגיבויי Supabase</strong>,
          ולכן כל יום שהגיבוי לא רץ הוא יום שבו 181MB של תעודות ותמונות אינם מגובים בשום מקום.</p>
          <p><strong>השגיאה:</strong> ${String(result.error ?? "לא ידוע").replace(/</g, "&lt;").slice(0, 500)}</p>
          <p>אם הטוקן פג - יש להנפיק GOOGLE_DRIVE_REFRESH_TOKEN חדש ולעדכן ב-Vercel.</p>
        </div>`,
      });
    } catch (e) {
      console.error("backup failure alert failed:", e);
    }
  }

  return NextResponse.json(result, { status: result.ok || !result.configured ? 200 : 500 });
}
