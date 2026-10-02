import "server-only";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { writeAudit } from "@/app/lib/audit";
import { automatedSendAllowed } from "@/app/lib/automated-email-guard";
import { sendSignupFinalReminderEmail } from "@/app/lib/therapist-emails";

// ─────────────────────────────────────────────────────────────────────────────
// תזכורת אחרונה לנרשמים שלא מילאו פרופיל + סגירת ההרשמה שבוע אחריה.
//
// מה אושר (המשתמש, 2/10/2026): מייל אחד, בנוסח קבוע, למי שנרשם ולא מילא שום
// דבר בפרופיל; 40 ביום בימים ראשון-רביעי 4-7/10/2026 ב-09:00; בחוץ מי שקיבל
// תזכורת בחודש האחרון. שבוע אחרי המייל, מי שהפרופיל שלו עדיין ריק - ההרשמה
// שלו מסומנת כלא פעילה (הפיך, לא מחיקה).
//
// זה מסלול חד-פעמי, ולכן הוא נסגר מעצמו: מחוץ לחלון התאריכים הוא לא שולח
// כלום, גם אם הקרון ממשיך לרוץ. שלב הסגירה ממשיך לרוץ עד שכל מי שקיבל את
// המייל טופל, ואז הריצה ריקה.
// ─────────────────────────────────────────────────────────────────────────────

export const FINAL_REMINDER_TEMPLATE = "signup_final_reminder";

/** מכסה יומית. נמוכה מתקרת המיילים ההמוניים (60) כדי להשאיר מקום לשאר. */
export const DAILY_LIMIT = 40;

/** חלון השליחה לפי תאריך בישראל. 4-7/10 הם ימי התכנון; ההמשך עד 11/10 קיים
 *  רק כדי שיום שנכשל (תקלה, מכסה) יושלם למחרת במקום להשאיר נמענים בלי מייל. */
const SEND_WINDOW_START = "2026-10-04";
const SEND_WINDOW_END = "2026-10-11";

/** מי שקיבל תזכורת השלמה מהתאריך הזה והלאה נשאר בחוץ (פנייה אחת בחודש). קבוע
 *  ולא "30 יום אחורה מהיום", כדי שהקבוצה לא תגדל מיום ליום בתוך החלון. */
const RECENTLY_REMINDED_SINCE = "2026-09-04T00:00:00+03:00";

/** מי שנרשם מהתאריך הזה והלאה נשאר בחוץ: "תזכורת אחרונה" למי שנרשם לפני
 *  ימים ספורים ומעולם לא קיבל תזכורת ראשונה אינה נכונה עובדתית. */
const SIGNED_UP_BEFORE = "2026-09-20T00:00:00+03:00";

/** כמה ימים אחרי המייל ההרשמה נסגרת. חייב להתאים למה שכתוב במייל. */
export const ARCHIVE_AFTER_DAYS = 7;

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  completion_requested_at: string | null;
  entity_type: string | null;
  center_account_id: string | null;
};

/** "נרשם ולא מילא כלום" - אותה הגדרה כמו הטאב "נרשמו" באדמין (isStub). */
function isStub(t: { full_name: string | null }): boolean {
  return !(t.full_name ?? "").trim();
}

function israelDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

/** כל מי שעדיין אמור לקבל את התזכורת, מהוותיק לחדש (סדר קבוע בין ריצות). */
export async function finalReminderCandidates(): Promise<Row[]> {
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select("id, email, full_name, created_at, completion_requested_at, entity_type, center_account_id")
    .eq("status", "pending")
    .is("final_reminder_sent_at", null)
    .is("signup_archived_at", null)
    .lt("created_at", SIGNED_UP_BEFORE)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`final reminder: candidates query failed: ${error.message}`);
  const cutoff = new Date(RECENTLY_REMINDED_SINCE).getTime();
  return (data as Row[]).filter(
    (t) =>
      isStub(t) &&
      t.entity_type !== "center" &&
      !t.center_account_id &&
      !!(t.email ?? "").trim() &&
      (!t.completion_requested_at || new Date(t.completion_requested_at).getTime() < cutoff)
  );
}

export type FinalReminderResult = {
  ok: boolean;
  previewOnly: boolean;
  today: string;
  inWindow: boolean;
  remainingBefore: number;
  sentToday: number;
  sent: number;
  failed: number;
  deferred: number;
  archived: number;
  wouldArchive: number;
  error?: string;
};

export async function runFinalSignupReminder(opts: { send: boolean }): Promise<FinalReminderResult> {
  const today = israelDate();
  const inWindow = today >= SEND_WINDOW_START && today <= SEND_WINDOW_END;
  const result: FinalReminderResult = {
    ok: true,
    previewOnly: !opts.send,
    today,
    inWindow,
    remainingBefore: 0,
    sentToday: 0,
    sent: 0,
    failed: 0,
    deferred: 0,
    archived: 0,
    wouldArchive: 0,
  };

  try {
    // ── (1) שליחה ──────────────────────────────────────────────────────────
    const candidates = await finalReminderCandidates();
    result.remainingBefore = candidates.length;

    // ריצה שנייה באותו יום (ניסיון חוזר של Vercel, הפעלה ידנית) לא שולחת מנה
    // נוספת: סופרים את מה שכבר יצא היום ומשלימים רק עד המכסה.
    const dayStart = new Date(`${today}T00:00:00+03:00`).toISOString();
    const { count: alreadyToday, error: countErr } = await supabaseAdmin
      .from("therapists")
      .select("id", { count: "exact", head: true })
      .gte("final_reminder_sent_at", dayStart);
    if (countErr) throw new Error(`final reminder: daily count failed: ${countErr.message}`);
    result.sentToday = alreadyToday ?? 0;

    const quota = Math.max(0, DAILY_LIMIT - result.sentToday);
    const batch = inWindow ? candidates.slice(0, quota) : [];

    if (opts.send) {
      for (const t of batch) {
        const to = (t.email ?? "").trim();
        const gate = automatedSendAllowed(to, FINAL_REMINDER_TEMPLATE);
        if (!gate.allowed) {
          result.failed++;
          continue;
        }
        const r = await sendSignupFinalReminderEmail({ to });
        if (r.skipped) {
          // תקרת המיילים ההמוניים היומית מוצתה - אין טעם להמשיך, מחר ממשיכים.
          result.deferred = batch.length - result.sent - result.failed;
          break;
        }
        if (!r.ok) {
          result.failed++;
          console.error(`final reminder: send failed for ${t.id}: ${r.error}`);
          continue;
        }
        const now = new Date().toISOString();
        const { error: stampErr } = await supabaseAdmin
          .from("therapists")
          // completion_requested_at מתעדכן גם הוא, כדי שהאדמין יראה שיצאה
          // תזכורת וכפתור "שלח תזכורת לכולם" לא יכלול אותם שוב.
          .update({ final_reminder_sent_at: now, completion_requested_at: now })
          .eq("id", t.id);
        if (stampErr) {
          // המייל יצא אבל הסימון נכשל: עוצרים את הריצה. המשך היה שולח לאותו
          // אדם שוב מחר, ו"תזכורת אחרונה" פעמיים גרועה מיום של עיכוב.
          throw new Error(`final reminder: sent to ${t.id} but stamp failed: ${stampErr.message}`);
        }
        result.sent++;
        await writeAudit(supabaseAdmin, {
          therapistId: t.id,
          actorType: "cron",
          action: "signup_final_reminder_sent",
          before: null,
          after: { final_reminder_sent_at: now },
          reason: "one-off final reminder to incomplete signups (approved 2/10/2026)",
        });
      }
    }

    // ── (2) סגירת הרשמות, שבוע אחרי המייל ──────────────────────────────────
    // רק מי שקיבל את המייל, עבר שבוע, והפרופיל שלו עדיין ריק. מי שמילא שם
    // בינתיים כבר אינו "נרשם ולא מילא" ולא נסגר. הפיך: שום דבר לא נמחק.
    const archiveBefore = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: due, error: dueErr } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, final_reminder_sent_at")
      .eq("status", "pending")
      .is("signup_archived_at", null)
      .not("final_reminder_sent_at", "is", null)
      .lte("final_reminder_sent_at", archiveBefore)
      .limit(1000);
    if (dueErr) throw new Error(`final reminder: archive query failed: ${dueErr.message}`);
    const toArchive = (due ?? []).filter((t) => isStub(t as { full_name: string | null }));
    result.wouldArchive = toArchive.length;

    if (opts.send) {
      for (const t of toArchive) {
        const now = new Date().toISOString();
        const { error: archErr } = await supabaseAdmin
          .from("therapists")
          .update({ signup_archived_at: now })
          .eq("id", t.id)
          .is("signup_archived_at", null);
        if (archErr) {
          console.error(`final reminder: archive failed for ${t.id}: ${archErr.message}`);
          continue;
        }
        result.archived++;
        await writeAudit(supabaseAdmin, {
          therapistId: t.id as string,
          actorType: "cron",
          action: "signup_archived",
          before: { signup_archived_at: null },
          after: { signup_archived_at: now },
          reason: `profile still empty ${ARCHIVE_AFTER_DAYS} days after the final reminder; reversible`,
        });
      }
    }
  } catch (e) {
    result.ok = false;
    result.error = e instanceof Error ? e.message : "unknown error";
  }
  return result;
}
