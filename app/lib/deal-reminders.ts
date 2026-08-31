import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { syncAgentAlerts } from "./agent-infra";
import { DEAL_STAGES, labelOf } from "./crm";

// תזכורות על עסקאות B2B. עד היום שדה "הצעד הבא" האדים בעמוד העסקאות
// ושם נגמר הסיפור - מי שלא נכנס לעמוד לא ידע. עסקה B2B היא הכי יקרה
// שיש כאן, ושכחה של שבועיים בה עולה יותר מכל שאר התור ביחד.
//
// שני סוגים, שניהם ממצאים שנסגרים מעצמם:
//   - צעד הבא שעבר את תאריך היעד
//   - עסקה שלא זזה יותר מדי זמן, גם אם יש בה צעד עתידי

const STALE_DAYS = 21;
const OPEN_STAGES = DEAL_STAGES.filter((s) => s.value !== "closed" && s.value !== "lost").map(
  (s) => s.value
);

export type DealReminderResult = { overdue: number; stale: number };

export async function syncDealReminders(): Promise<DealReminderResult> {
  const today = new Date().toISOString().slice(0, 10);
  const staleCut = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

  const { data } = await supabaseAdmin
    .from("crm_deals")
    .select("id, title, stage, next_step, next_step_due, updated_at, value_ils")
    .in("stage", OPEN_STAGES)
    .limit(200);
  const deals = data ?? [];

  const alerts: Parameters<typeof syncAgentAlerts>[1] = [];
  let overdue = 0;
  let stale = 0;

  for (const d of deals) {
    const stageLabel = labelOf(DEAL_STAGES, d.stage as string);
    const worth = d.value_ils ? ` · ₪${Number(d.value_ils).toLocaleString("he-IL")} לחודש` : "";

    if (d.next_step_due && String(d.next_step_due) < today) {
      overdue++;
      const daysLate = Math.floor(
        (Date.now() - new Date(String(d.next_step_due)).getTime()) / 86_400_000
      );
      alerts.push({
        actionType: "deal_step_overdue",
        kind: "finding",
        // עסקה שהצעד בה באיחור של יותר משבוע היא הכנסה שנשמטת בהיסח הדעת.
        severity: daysLate >= 7 ? "high" : "normal",
        title: `צעד באיחור בעסקה: ${d.title}`,
        body:
          `"${d.next_step}" היה אמור לקרות ב-${String(d.next_step_due)} - לפני ${daysLate} ימים. ` +
          `שלב: ${stageLabel}${worth}.`,
        dedupeKey: `deal:overdue:${d.id}`,
      });
      continue;
    }

    if (String(d.updated_at) < staleCut) {
      stale++;
      const daysIdle = Math.floor(
        (Date.now() - new Date(String(d.updated_at)).getTime()) / 86_400_000
      );
      alerts.push({
        actionType: "deal_stale",
        kind: "finding",
        severity: "normal",
        title: `עסקה תקועה ${daysIdle} ימים: ${d.title}`,
        body:
          `לא עודכנה מאז ${String(d.updated_at).slice(0, 10)}. שלב: ${stageLabel}${worth}. ` +
          (d.next_step ? `הצעד הרשום: "${d.next_step}".` : "אין צעד הבא רשום."),
        dedupeKey: `deal:stale:${d.id}`,
      });
    }
  }

  // ממצאים שנסגרים מעצמם: עסקה שזזה או שהצעד עודכן מפסיקה להופיע.
  await syncAgentAlerts("deals", alerts, {
    recoveryNote: "העסקה זזה או שהצעד עודכן - נסגר אוטומטית",
  });
  return { overdue, stale };
}
