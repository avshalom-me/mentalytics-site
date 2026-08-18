import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendBulkEmail } from "./email-quota";
import { promotedPlanTable } from "./promoted-plan-table";

// תזכורת שבוע לפני החיוב הראשון במסלול ההזמנה.
//
// זו לא תזכורת שיווקית אלא קיום הבטחה: גם המייל של ההצעה וגם מסך ההצטרפות
// אומרים במפורש "שבוע לפני החיוב הראשון יישלח אליך מייל". בלי הקרון הזה
// המסלול כולו מבטיח דבר שלא קורה, והחיוב הראשון מגיע כהפתעה - וזה בדיוק
// מה שמייצר בקשות החזר וכעס.
//
// המייל מנוסח סביב ההחלטה ולא סביב השכנוע: התאריך, הסכום, ואיך מבטלים.
// אין בו נתוני ביצועים של המטפל (החלטת המשתמש: אין מיילי סטטיסטיקה).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const REMINDER_DAYS_BEFORE = 7;

export type ReminderTarget = {
  subscriptionId: string;
  therapistId: string;
  name: string;
  email: string;
  chargeDate: string; // YYYY-MM-DD
  amount: number;
};

export type ReminderRun = {
  ok: boolean;
  sent: number;
  targets: ReminderTarget[];
  previewOnly: boolean;
  error?: string;
};

function hebDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(t: ReminderTarget): string {
  const when = hebDate(t.chargeDate);
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>

      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${escapeHtml(t.name)},</h1>

      <p style="margin:0 0 16px;font-size:15px;">
        לפני כשני חודשים הצטרפת לקידום באתר, והתחייבנו לעדכן אותך שבוע לפני החיוב הראשון.
        זה המייל הזה.
      </p>

      <div style="background:#EAF4F3;border:1px solid #C2DFDE;border-radius:12px;padding:18px 20px;margin:0 0 22px;">
        <p style="margin:0 0 6px;font-size:15px;">
          <strong>החיוב הראשון: ${when}</strong>
        </p>
        <p style="margin:0;font-size:15px;">
          הסכום: ${t.amount} ש"ח + מע"מ לחודש, כל חודש.
        </p>
      </div>

      <p style="margin:0 0 16px;font-size:15px;">
        אם תרצה/י להמשיך - אין צורך לעשות דבר, והקידום פשוט ממשיך.
      </p>

      <p style="margin:0 0 22px;font-size:15px;">
        <strong>אם תרצה/י להפסיק</strong> - מספיק להשיב למייל הזה עד ${when} ונבטל מיד, בלי שאלות
        ובלי חיוב.
      </p>

      <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#0F5468;">מה כולל הקידום שלך</p>
      ${promotedPlanTable()}

      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;
}

// send=false (ברירת המחדל) מחזיר את הרשימה בלי לשלוח - אותו דפוס כמו שאר
// מסלולי השליחה: המייל יוצא רק כשהקרון חמוש במפורש.
export async function runGiftTrialReminder(opts: { send?: boolean } = {}): Promise<ReminderRun> {
  const send = opts.send === true;
  try {
    // התאמה על first_charge_on בלבד - העמודה שנכתבת רק בהצטרפות במסלול
    // ההזמנה. מנוי רגיל מקבל שם NULL ולכן לא יכול להיתפס כאן לעולם.
    const target = new Date();
    target.setDate(target.getDate() + REMINDER_DAYS_BEFORE);
    const chargeDay = target.toISOString().slice(0, 10);

    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, therapist_id, amount, first_charge_on")
      .eq("status", "active")
      .eq("first_charge_on", chargeDay)
      .is("first_charge_reminded_at", null);
    if (error) throw new Error(error.message);

    const rows = subs ?? [];
    if (rows.length === 0) {
      return { ok: true, sent: 0, targets: [], previewOnly: !send };
    }

    // רק מסלול ההזמנה: מנוי רגיל מתחדש כל חודש, ותזכורת חודשית על חיוב
    // שהלקוח כבר מכיר היא הטרדה.
    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, email, promotion_source, status")
      .in("id", rows.map((r) => r.therapist_id))
      .eq("promotion_source", "gift_trial")
      .eq("status", "paying");

    const byId = new Map((therapists ?? []).map((t) => [t.id, t]));
    const targets: ReminderTarget[] = [];
    for (const r of rows) {
      const t = byId.get(r.therapist_id);
      if (!t?.email) continue;
      targets.push({
        subscriptionId: r.id,
        therapistId: r.therapist_id,
        name: (t.full_name as string) || "מטפל/ת יקר/ה",
        email: t.email as string,
        chargeDate: String(r.first_charge_on).slice(0, 10),
        amount: Number(r.amount) || 140,
      });
    }

    if (!send) {
      return { ok: true, sent: 0, targets, previewOnly: true };
    }

    let sent = 0;
    for (const t of targets) {
      const res = await sendBulkEmail({
        from: FROM,
        to: t.email,
        subject: `החיוב הראשון שלך ב-${hebDate(t.chargeDate)} - טיפול חכם`,
        html: buildHtml(t),
        replyTo: "admin@getmentalytics.com",
      });
      if (res.ok) {
        sent++;
        // הסימון נכתב רק אחרי שליחה מוצלחת: כישלון שליחה חוזר בריצה הבאה
        // במקום להיעלם בשקט.
        await supabaseAdmin
          .from("subscriptions")
          .update({ first_charge_reminded_at: new Date().toISOString() })
          .eq("id", t.subscriptionId);
      } else if (!res.skipped) {
        console.error(`gift-trial reminder failed for ${t.therapistId}: ${res.error}`);
      }
    }

    return { ok: true, sent, targets, previewOnly: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, sent: 0, targets: [], previewOnly: !send, error: msg };
  }
}
