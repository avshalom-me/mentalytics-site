import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// תשתית משותפת לכל הסוכנים: יומן ריצות, תור הצעות עם מניעת כפילויות,
// ומתגי הפעלה. כל סוכן חדש משתמש בשלושת אלה ולא ממציא מנגנון משלו.

export type AgentRunStatus = "ok" | "empty" | "error";

// מתג חירום לכל סוכן: AGENT_DAILY_DIGEST_ENABLED=0 מכבה בלי פריסה.
// ברירת המחדל דלוקה - סוכן שנפרס במצב תצוגה-מקדימה בטוח מטבעו.
export function agentEnabled(agent: string): boolean {
  const key = `AGENT_${agent.toUpperCase()}_ENABLED`;
  return process.env[key] !== "0";
}

export async function startAgentRun(agent: string, mode?: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_runs")
      .insert({ agent, mode: mode ?? null })
      .select("id")
      .single();
    if (error) {
      console.error("agent_runs insert failed:", error.message);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error("agent_runs insert threw:", e);
    return null;
  }
}

export async function finishAgentRun(
  runId: string | null,
  result: {
    status: AgentRunStatus;
    summary?: string;
    details?: Record<string, unknown>;
    error?: string;
  }
): Promise<void> {
  if (!runId) return;
  try {
    const { error } = await supabaseAdmin
      .from("agent_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: result.status,
        summary: result.summary ?? null,
        details: result.details ?? null,
        error: result.error ?? null,
      })
      .eq("id", runId);
    if (error) console.error("agent_runs update failed:", error.message);
  } catch (e) {
    console.error("agent_runs update threw:", e);
  }
}

// סנכרון התראות סוכן: יוצר את מה שפעיל עכשיו, וסוגר אוטומטית התראות
// ממתינות שהמצב שלהן כבר לא מתקיים ("החלימו"). מנגנון משותף - שומר הלילה
// וסוכן הפרסום משתמשים בו, וכל סוכן עתידי יקבל אותו בחינם.
//
// managedKeys = כל המפתחות שהריצה הזו באמת בדקה. מפתח שממתין בתור אך לא
// נבדק בריצה (למשל בדיקה שדולגה) לא ייסגר בטעות.
//
// snoozeDays = "ידוע, עזוב". בלי זה ממצא שנדחה ידנית נפתח מחדש בריצה של
// למחרת, כי המצב שיצר אותו עדיין מתקיים - ואז אין טעם לדחות, והתור מזדקן:
// ב-7/10/26 היו לסוכן הפרסום 11 ממצאים פתוחים בגיל ממוצע של 27 יום, ואף
// אחד מהם לא נדחה ידנית מאז 30/8. עם snoozeDays, ממצא שהאדמין דחה לא חוזר
// במשך התקופה, אלא אם החמיר מאז (חומרה גבוהה יותר מזו שנדחתה). סגירה
// אוטומטית של הסוכן עצמו אינה דחייה ואינה משתיקה דבר. noSnooze פוטר מפתחות
// שאסור להשתיק (למשל: הסנכרון עצמו מת, ואז כל שאר המספרים קפואים).
export async function syncAgentAlerts(
  agent: string,
  active: Omit<NewAgentAction, "agent">[],
  opts?: { managedKeys?: string[]; recoveryNote?: string; snoozeDays?: number; noSnooze?: (key: string) => boolean }
): Promise<{ created: number; refreshed: number; recovered: number; snoozed: number }> {
  let toCreate = active;
  if (opts?.snoozeDays && opts.snoozeDays > 0) {
    const keys = active
      .map((a) => a.dedupeKey)
      .filter((k): k is string => Boolean(k) && !opts.noSnooze?.(k as string));
    if (keys.length > 0) {
      try {
        const since = new Date(Date.now() - opts.snoozeDays * 86_400_000).toISOString();
        const { data, error } = await supabaseAdmin
          .from("agent_actions")
          .select("dedupe_key, severity")
          .eq("agent", agent)
          .eq("status", "dismissed")
          .eq("resolved_by", "admin")
          .gte("status_changed_at", since)
          .in("dedupe_key", keys);
        if (error) throw new Error(error.message);
        // החומרה הגבוהה ביותר שנדחתה לכל מפתח (דירוג נמוך = חמור יותר).
        const dismissedRank = new Map<string, number>();
        for (const row of data ?? []) {
          const rank = SEVERITY_RANK[(row.severity as AgentSeverity) ?? "normal"] ?? SEVERITY_RANK.normal;
          const prev = dismissedRank.get(row.dedupe_key as string);
          if (prev === undefined || rank < prev) dismissedRank.set(row.dedupe_key as string, rank);
        }
        toCreate = active.filter((a) => {
          const dismissed = a.dedupeKey ? dismissedRank.get(a.dedupeKey) : undefined;
          if (dismissed === undefined) return true;
          return SEVERITY_RANK[a.severity ?? "normal"] < dismissed; // החמיר מאז הדחייה
        });
      } catch (e) {
        // לא יודעים מה נדחה - עדיף ממצא שחוזר מממצא שנבלע.
        console.error(`syncAgentAlerts(${agent}) snooze lookup failed:`, e);
        toCreate = active;
      }
    }
  }
  const snoozed = active.length - toCreate.length;

  const results = await Promise.all(
    toCreate.map((a) => createAgentAction({ agent, ...a }))
  );
  const created = results.filter((r) => r.created).length;
  const refreshed = results.filter((r) => r.updated).length;

  const activeKeys = new Set(
    active.map((a) => a.dedupeKey).filter((k): k is string => Boolean(k))
  );
  const managed = opts?.managedKeys;
  let recovered = 0;
  try {
    const { data: pendingRows } = await supabaseAdmin
      .from("agent_actions")
      .select("id, dedupe_key")
      .eq("agent", agent)
      .eq("status", "pending")
      .not("dedupe_key", "is", null);

    const staleIds = (pendingRows ?? [])
      .filter((r) => {
        const key = r.dedupe_key as string;
        if (activeKeys.has(key)) return false; // עדיין פעיל
        return managed ? managed.includes(key) : true; // רק מה שנבדק בפועל
      })
      .map((r) => r.id as string);

    if (staleIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("agent_actions")
        .update({
          status: "dismissed",
          status_changed_at: new Date().toISOString(),
          resolved_by: agent,
          resolution_note: opts?.recoveryNote ?? "המצב חזר לתקין - נסגר אוטומטית",
        })
        .in("id", staleIds)
        .select("id");
      recovered = data?.length ?? 0;
    }
  } catch (e) {
    console.error(`syncAgentAlerts(${agent}) recovery failed:`, e);
  }

  return { created, refreshed, recovered, snoozed };
}

export type AgentSeverity = "critical" | "high" | "normal" | "low";

/** סדר הצגה: החמור קודם. */
export const SEVERITY_RANK: Record<AgentSeverity, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export type NewAgentAction = {
  agent: string;
  actionType: string;
  // סיווג התוצר, נקבע על ידי הסוכן שכתב אותו ולא מנוחש בתצוגה:
  // "action" = יש מה לעשות וצריך אותך; "finding" = מסקנה לידיעה.
  // ברירת המחדל היא action, כדי שסוכן שלא הצהיר לא ייעלם מהתור בשקט.
  kind?: "action" | "finding";
  // דחיפות. ברירת המחדל normal - סוכן שלא הצהיר לא מקבל בליטה שלא מגיעה
  // לו, אבל גם לא נבלע. critical שמור למה שאסור שיחכה יום: אובדן נתונים,
  // כסף שנגבה שלא כדין, מסלול שבור בפרודקשן.
  severity?: AgentSeverity;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  payload?: Record<string, unknown>;
  dedupeKey?: string;
};

// יצירת הצעה בתור. אם כבר קיימת הצעה פתוחה עם אותו dedupe_key - לא נוצרת
// כפילות (האינדקס הייחודי החלקי אוכף; קוד 23505 נבלע בשקט).
export async function createAgentAction(
  action: NewAgentAction
): Promise<{ created: boolean; updated?: boolean; id?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_actions")
      .insert({
        agent: action.agent,
        action_type: action.actionType,
        kind: action.kind ?? "action",
        title: action.title,
        body: action.body ?? null,
        entity_type: action.entityType ?? null,
        entity_id: action.entityId ?? null,
        entity_label: action.entityLabel ?? null,
        payload: action.payload ?? null,
        severity: action.severity ?? "normal",
        dedupe_key: action.dedupeKey ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        // מפתח dedupe קיים - האינדקס חלקי על pending, כלומר יש שורה פתוחה
        // עם אותו מפתח. ממצא הוא *תיאור מצב נוכחי*, ולכן הניסוח, הגוף
        // והחומרה מתרעננים; המצב (status) ומי שסגר אותו לא נגעים.
        //
        // בלי זה ממצא נכתב פעם אחת ומתאבן: ב-20/8/26 שונה הניסוח כך
        // שמקודם-מתנה לא ייקרא "משלם/ת", וכל 12 הממצאים הקיימים המשיכו
        // להציג את הטקסט הישן ואת החומרה הישנה - התיקון היה בלתי נראה.
        const { data: bumped } = await supabaseAdmin
          .from("agent_actions")
          .update({
            title: action.title,
            body: action.body ?? null,
            payload: action.payload ?? null,
            entity_label: action.entityLabel ?? null,
            severity: action.severity ?? "normal",
          })
          .eq("agent", action.agent)
          .eq("dedupe_key", action.dedupeKey ?? "")
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        return { created: false, updated: !!bumped, id: bumped?.id as string | undefined };
      }
      console.error("agent_actions insert failed:", error.message);
      return { created: false };
    }
    return { created: true, id: data.id as string };
  } catch (e) {
    console.error("agent_actions insert threw:", e);
    return { created: false };
  }
}
