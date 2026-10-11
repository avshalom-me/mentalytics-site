import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { writeAudit } from "./audit";
import { operationalMailTarget } from "./therapist-recipient";
import { sendTherapistAdminMessageEmail } from "./therapist-emails";
import { applyMatchPause } from "./match-pause-apply";
import { OUTREACH_COOLDOWN_DAYS } from "./retention-review-data";

// הכפתורים של סקירת השימור. כל פעולה כאן נקראת אך ורק מלחיצה מפורשת של
// אדמין בעמוד השימור (/api/admin-retention), ולא מקרון: המייל יוצא רק
// אחרי עריכה ולחיצה, ההקפאה והמשימה הן לחיצה אחת. כל פעולה מאמתת שההצעה
// עדיין ממתינה (קליק כפול, טאב ישן), עושה את הדבר, ומסמנת את ההצעה כבוצעה
// עם תיעוד מה נעשה.

type ActionRow = {
  id: string;
  agent: string;
  action_type: string;
  status: string;
  entity_id: string | null;
  entity_label: string | null;
  payload: Record<string, unknown> | null;
  body: string | null;
};

async function loadPending(actionId: string, expectedType: string): Promise<{ ok: true; action: ActionRow } | { ok: false; error: string }> {
  const { data, error } = await supabaseAdmin
    .from("agent_actions")
    .select("id, agent, action_type, status, entity_id, entity_label, payload, body")
    .eq("id", actionId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "ההצעה לא נמצאה" };
  const a = data as ActionRow;
  if (a.agent !== "retention" || a.action_type !== expectedType) return { ok: false, error: "ההצעה הזו אינה מהסוג המבוקש" };
  if (a.status !== "pending") return { ok: false, error: "ההצעה כבר טופלה - רענן/י את העמוד" };
  if (!a.entity_id) return { ok: false, error: "להצעה אין מטפל/ת" };
  return { ok: true, action: a };
}

async function markExecuted(actionId: string, note: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "executed", status_changed_at: new Date().toISOString(), resolved_by: "admin", resolution_note: note })
    .eq("id", actionId);
  if (error) console.error("retention action update failed:", error.message);
}

export async function acknowledgeReview(reviewId: string, by: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("retention_reviews")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: by.slice(0, 60) })
    .eq("id", reviewId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function dismissRetentionAction(actionId: string, note: string | null): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "dismissed", status_changed_at: new Date().toISOString(), resolved_by: "admin", resolution_note: note?.slice(0, 500) ?? null })
    .eq("id", actionId)
    .eq("agent", "retention")
    .eq("status", "pending");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type RetentionEmailResult = { ok: boolean; error?: string; sentTo?: string; cooled?: { lastAt: string } };

/**
 * שליחת מייל השיפור. הצינון (21 יום מכל סוכן) נבדק מול יומן המיילים ברגע
 * השליחה ולא מהצילום של הריצה; `force` עוקף אותו אחרי שהאדמין ראה את האזהרה.
 */
export async function sendRetentionEmail(opts: { actionId: string; subject: string; body: string; force?: boolean }): Promise<RetentionEmailResult> {
  const subject = opts.subject.trim().slice(0, 200) || "כמה הצעות לפרופיל שלך בטיפול חכם";
  const body = opts.body.trim().slice(0, 6000);
  if (!body) return { ok: false, error: "גוף המייל ריק" };
  if (/\d{2,}/.test(body.replace(/\d+%/g, ""))) {
    // מספר דו-ספרתי שאינו אחוז ביקוש כללי = כנראה מספר ביצועים של המטפל/ת.
    return { ok: false, error: "בגוף המייל יש מספר. לפי ההחלטה מ-15/8/26 לא שולחים למטפלים מספרי ביצועים - נא להסיר אותו." };
  }
  const loaded = await loadPending(opts.actionId, "retention_email");
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const therapistId = loaded.action.entity_id as string;

  const { data: t, error: tErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status")
    .eq("id", therapistId)
    .maybeSingle();
  if (tErr || !t) return { ok: false, error: "המטפל/ת לא נמצא/ה" };
  if (t.status !== "paying") return { ok: false, error: "המטפל/ת כבר לא מקודם/ת - המייל לא נשלח" };

  const target = await operationalMailTarget(therapistId);
  if (!target.to) return { ok: false, error: "לא נמצאה כתובת מייל למטפל/ת" };

  if (!opts.force) {
    const since = new Date(Date.now() - OUTREACH_COOLDOWN_DAYS * 86_400_000).toISOString();
    const { data: prior } = await supabaseAdmin
      .from("crm_email_log")
      .select("created_at, template")
      .eq("recipient", target.to)
      .eq("status", "sent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const outreach = (prior ?? []).find((p) => p.template === "bulk" || /retention|offer|nudge|message|feedback/i.test(String(p.template ?? "")));
    if (outreach) return { ok: false, cooled: { lastAt: outreach.created_at as string }, error: `כבר יצא מייל יזום לכתובת הזו ב-${new Date(outreach.created_at as string).toLocaleDateString("he-IL")}. לשלוח בכל זאת?` };
  }

  const sent = await sendTherapistAdminMessageEmail({ to: target.to, name: (t.full_name as string) ?? "", subject, message: body });
  if (!sent.ok) return { ok: false, error: sent.error || "שליחת המייל נכשלה" };

  await writeAudit(supabaseAdmin, {
    therapistId,
    actorType: "admin",
    action: "retention_email_sent",
    before: {},
    after: { subject, body, action_id: opts.actionId },
    reason: "admin sent a retention-review improvement email",
  });
  await markExecuted(opts.actionId, `נשלח מייל שיפור ל${(t.full_name as string) ?? "מטפל/ת"} (${target.to})`);
  return { ok: true, sentTo: target.to };
}

export async function freezeFromReview(opts: { actionId: string; days: number }): Promise<{ ok: boolean; error?: string; until?: string | null }> {
  const loaded = await loadPending(opts.actionId, "retention_freeze");
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const days = Math.max(1, Math.min(14, Math.floor(opts.days) || 7));
  const result = await applyMatchPause({
    therapistId: loaded.action.entity_id as string,
    days,
    reason: "סקירת השימור: חזק/ה מדי באזור",
    auditReason: `admin paused from matching for ${days}d from the retention review (over-exposed in region)`,
  });
  if (!result.ok) return { ok: false, error: result.error };
  await markExecuted(opts.actionId, `הוקפא/ה מההתאמות ל-${days} ימים (עד ${result.until ? new Date(result.until).toLocaleDateString("he-IL") : ""})`);
  return { ok: true, until: result.until };
}

export async function createRetentionTask(opts: { actionId: string }): Promise<{ ok: boolean; error?: string; taskId?: string }> {
  const loaded = await loadPending(opts.actionId, "retention_task");
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const a = loaded.action;
  const flags = Array.isArray(a.payload?.flags) ? (a.payload?.flags as string[]) : [];
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("crm_tasks")
    .insert({
      title: `שיחת שימור: ${a.entity_label ?? "מטפל/ת"}`,
      details: [a.body ?? "", flags.length ? `דגלים: ${flags.join(", ")}` : "", `מתוך סקירת השימור (${String(a.payload?.week_start ?? "")}).`].filter(Boolean).join("\n").slice(0, 2000),
      entity_type: "therapist",
      entity_id: a.entity_id,
      entity_label: a.entity_label,
      due_date: due,
      priority: "high",
      created_by: "retention",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await markExecuted(opts.actionId, `נפתחה משימת שיחה ל-${due}`);
  return { ok: true, taskId: data.id as string };
}
