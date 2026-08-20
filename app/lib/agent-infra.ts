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
export async function syncAgentAlerts(
  agent: string,
  active: Omit<NewAgentAction, "agent">[],
  opts?: { managedKeys?: string[]; recoveryNote?: string }
): Promise<{ created: number; refreshed: number; recovered: number }> {
  const results = await Promise.all(
    active.map((a) => createAgentAction({ agent, ...a }))
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

  return { created, refreshed, recovered };
}

export type NewAgentAction = {
  agent: string;
  actionType: string;
  // סיווג התוצר, נקבע על ידי הסוכן שכתב אותו ולא מנוחש בתצוגה:
  // "action" = יש מה לעשות וצריך אותך; "finding" = מסקנה לידיעה.
  // ברירת המחדל היא action, כדי שסוכן שלא הצהיר לא ייעלם מהתור בשקט.
  kind?: "action" | "finding";
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
