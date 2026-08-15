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

export type NewAgentAction = {
  agent: string;
  actionType: string;
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
): Promise<{ created: boolean; id?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("agent_actions")
      .insert({
        agent: action.agent,
        action_type: action.actionType,
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
      if (error.code === "23505") return { created: false };
      console.error("agent_actions insert failed:", error.message);
      return { created: false };
    }
    return { created: true, id: data.id as string };
  } catch (e) {
    console.error("agent_actions insert threw:", e);
    return { created: false };
  }
}
