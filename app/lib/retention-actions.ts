import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { writeAudit } from "./audit";
import { operationalMailTarget } from "./therapist-recipient";
import { sendTherapistAdminMessageEmail } from "./therapist-emails";
import { applyMatchPause } from "./match-pause-apply";
import { OUTREACH_COOLDOWN_DAYS } from "./retention-review-data";
import { emailBodyProblem, reviewWeekStart } from "./retention-review";

/** עד כמה מיילי שימור יוצאים בשבוע (הבעלים, 11/10/26). */
export const WEEKLY_EMAIL_CAP = Number(process.env.RETENTION_WEEKLY_EMAIL_CAP ?? 5);

// הכפתורים של סקירת השימור. כל פעולה כאן נקראת אך ורק מלחיצה מפורשת של
// אדמין בעמוד השימור (/api/admin-retention), ולא מקרון: המייל יוצא רק
// אחרי עריכה ולחיצה, ההקפאה והמשימה הן לחיצה אחת.
//
// הפעולה מזוהה לפי המטפל/ת, לא לפי שורת התור: הכפתור בעמוד עובד גם כשאין
// הצעה ממתינה ב-agent_actions (הריצה לא יצרה אותה, או שהיא כבר נסגרה).
// ההצעה הממתינה, אם יש, נסגרת כבוצעה עם תיעוד מה נעשה; כשאין - נרשמת
// שורה "בוצע" חדשה, כדי שלולאת התוצאות ("מה קרה למה שעשינו") תמדוד גם
// את הפעולה הזו.

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

/** הלחיצה מזהה מטפל/ת ישירות, או דרך ההצעה הממתינה (הדרך הישנה, עדיין נתמכת). */
export type ActionTarget = { therapistId?: string | null; actionId?: string | null };

async function resolveTarget(t: ActionTarget, expectedType: string): Promise<{ ok: true; therapistId: string; actionId: string | null } | { ok: false; error: string }> {
  if (t.actionId) {
    const { data, error } = await supabaseAdmin
      .from("agent_actions")
      .select("id, agent, action_type, status, entity_id, entity_label, payload, body")
      .eq("id", t.actionId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "ההצעה לא נמצאה" };
    const a = data as ActionRow;
    if (a.agent !== "retention" || a.action_type !== expectedType) return { ok: false, error: "ההצעה הזו אינה מהסוג המבוקש" };
    if (!a.entity_id) return { ok: false, error: "להצעה אין מטפל/ת" };
    if (t.therapistId && t.therapistId !== a.entity_id) return { ok: false, error: "ההצעה שייכת למטפל/ת אחר/ת" };
    // הצעה שכבר נסגרה לא חוסמת: הלחיצה תקפה לפי המטפל/ת (למשל שליחה חוזרת אחרי הצינון).
    return { ok: true, therapistId: a.entity_id, actionId: a.status === "pending" ? a.id : null };
  }
  if (!t.therapistId) return { ok: false, error: "חסר מזהה מטפל/ת" };
  return { ok: true, therapistId: t.therapistId, actionId: null };
}

async function pendingIdFor(therapistId: string, actionType: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("agent_actions")
    .select("id")
    .eq("agent", "retention")
    .eq("action_type", actionType)
    .eq("entity_id", therapistId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function recordExecuted(opts: { therapistId: string; actionType: string; actionId: string | null; label: string | null; note: string; payload?: Record<string, unknown> }): Promise<void> {
  const id = opts.actionId ?? (await pendingIdFor(opts.therapistId, opts.actionType));
  const now = new Date().toISOString();
  if (id) {
    const { error } = await supabaseAdmin
      .from("agent_actions")
      .update({ status: "executed", status_changed_at: now, resolved_by: "admin", resolution_note: opts.note })
      .eq("id", id);
    if (error) console.error("retention action update failed:", error.message);
    return;
  }
  const { error } = await supabaseAdmin.from("agent_actions").insert({
    agent: "retention",
    action_type: opts.actionType,
    kind: "action",
    severity: "normal",
    title: `${opts.label ?? "מטפל/ת"}: ${opts.note}`,
    body: null,
    entity_type: "therapist",
    entity_id: opts.therapistId,
    entity_label: opts.label,
    payload: opts.payload ?? null,
    dedupe_key: null,
    status: "executed",
    status_changed_at: now,
    resolved_by: "admin",
    resolution_note: opts.note,
  });
  if (error) console.error("retention action record failed:", error.message);
}

async function therapistName(therapistId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("therapists").select("full_name").eq("id", therapistId).maybeSingle();
  return ((data?.full_name as string | null) ?? "").trim() || null;
}

export async function acknowledgeReview(reviewId: string, by: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from("retention_reviews")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: by.slice(0, 60) })
    .eq("id", reviewId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** "לא" על הצעה: ההצעה הממתינה (לפי id, או לפי מטפל/ת וסוג) נסגרת כנדחית. בלי הצעה ממתינה אין מה לסגור. */
export async function dismissRetentionAction(opts: ActionTarget & { type?: string | null; note: string | null }): Promise<{ ok: boolean; error?: string }> {
  let id = opts.actionId ?? null;
  if (!id && opts.therapistId && opts.type) id = await pendingIdFor(opts.therapistId, `retention_${opts.type}`);
  if (!id) return { ok: true };
  const { error } = await supabaseAdmin
    .from("agent_actions")
    .update({ status: "dismissed", status_changed_at: new Date().toISOString(), resolved_by: "admin", resolution_note: opts.note?.slice(0, 500) ?? null })
    .eq("id", id)
    .eq("agent", "retention")
    .eq("status", "pending");
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type RetentionEmailResult = { ok: boolean; error?: string; sentTo?: string; cooled?: { lastAt: string } };

/**
 * שליחת מייל השיפור. הצינון (21 יום מכל סוכן) נבדק מול יומן המיילים ברגע
 * השליחה ולא מהצילום של הריצה; `force` עוקף אותו אחרי שהאדמין ראה את האזהרה.
 */
export async function sendRetentionEmail(opts: ActionTarget & { subject: string; body: string; force?: boolean }): Promise<RetentionEmailResult> {
  const subject = opts.subject.trim().slice(0, 200) || "כמה הצעות לפרופיל שלך בטיפול חכם";
  const body = opts.body.trim().slice(0, 6000);
  if (!body) return { ok: false, error: "גוף המייל ריק" };
  const problem = emailBodyProblem(body);
  if (problem) return { ok: false, error: `${problem} - נא לתקן לפני השליחה.` };
  const target = await resolveTarget(opts, "retention_email");
  if (!target.ok) return { ok: false, error: target.error };
  const therapistId = target.therapistId;

  // תקרה שבועית (החלטת הבעלים 11/10/26): עד WEEKLY_EMAIL_CAP מיילי שימור בשבוע,
  // נספרים מיומן הביקורת מיום ראשון. בלי force - תקרה היא תקרה.
  const weekStartIso = new Date(`${reviewWeekStart(new Date())}T00:00:00+03:00`).toISOString();
  const { count: sentThisWeek } = await supabaseAdmin
    .from("therapist_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "retention_email_sent")
    .gte("created_at", weekStartIso);
  if ((sentThisWeek ?? 0) >= WEEKLY_EMAIL_CAP) {
    return { ok: false, error: `כבר נשלחו ${sentThisWeek} מיילי שימור השבוע - זו התקרה השבועית (${WEEKLY_EMAIL_CAP}). השאר ממתינים לשבוע הבא.` };
  }

  const { data: t, error: tErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status")
    .eq("id", therapistId)
    .maybeSingle();
  if (tErr || !t) return { ok: false, error: "המטפל/ת לא נמצא/ה" };
  if (t.status !== "paying") return { ok: false, error: "המטפל/ת כבר לא מקודם/ת - המייל לא נשלח" };

  const mailTarget = await operationalMailTarget(therapistId);
  if (!mailTarget.to) return { ok: false, error: "לא נמצאה כתובת מייל למטפל/ת" };

  if (!opts.force) {
    const since = new Date(Date.now() - OUTREACH_COOLDOWN_DAYS * 86_400_000).toISOString();
    const { data: prior } = await supabaseAdmin
      .from("crm_email_log")
      .select("created_at, template")
      .eq("recipient", mailTarget.to)
      .eq("status", "sent")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const outreach = (prior ?? []).find((p) => p.template === "bulk" || /retention|offer|nudge|message|feedback/i.test(String(p.template ?? "")));
    if (outreach) return { ok: false, cooled: { lastAt: outreach.created_at as string }, error: `כבר יצא מייל יזום לכתובת הזו ב-${new Date(outreach.created_at as string).toLocaleDateString("he-IL")}. לשלוח בכל זאת?` };
  }

  const name = ((t.full_name as string | null) ?? "").trim();
  const sent = await sendTherapistAdminMessageEmail({ to: mailTarget.to, name, subject, message: body });
  if (!sent.ok) return { ok: false, error: sent.error || "שליחת המייל נכשלה" };

  await writeAudit(supabaseAdmin, {
    therapistId,
    actorType: "admin",
    action: "retention_email_sent",
    before: {},
    after: { subject, body, action_id: target.actionId },
    reason: "admin sent a retention-review improvement email",
  });
  await recordExecuted({
    therapistId,
    actionType: "retention_email",
    actionId: target.actionId,
    label: name || null,
    note: `נשלח מייל שיפור ל${name || "מטפל/ת"} (${mailTarget.to})`,
    payload: { subject, body },
  });
  return { ok: true, sentTo: mailTarget.to };
}

export async function freezeFromReview(opts: ActionTarget & { days: number }): Promise<{ ok: boolean; error?: string; until?: string | null }> {
  const target = await resolveTarget(opts, "retention_freeze");
  if (!target.ok) return { ok: false, error: target.error };
  const days = Math.max(1, Math.min(14, Math.floor(opts.days) || 7));
  const result = await applyMatchPause({
    therapistId: target.therapistId,
    days,
    reason: "סקירת השימור: חזק/ה מדי באזור",
    auditReason: `admin paused from matching for ${days}d from the retention review (over-exposed in region)`,
  });
  if (!result.ok) return { ok: false, error: result.error };
  await recordExecuted({
    therapistId: target.therapistId,
    actionType: "retention_freeze",
    actionId: target.actionId,
    label: await therapistName(target.therapistId),
    note: `הוקפא/ה מההתאמות ל-${days} ימים (עד ${result.until ? new Date(result.until).toLocaleDateString("he-IL") : ""})`,
    payload: { days },
  });
  return { ok: true, until: result.until };
}

/**
 * הארכת תקופת ניסיון בלי תופעות לוואי: רק promoted_until זז, ותזכורות סוף
 * הניסיון מתאפסות כדי שיישלחו שוב לפני המועד החדש. (PATCH הקידום בעמוד
 * המטפלים מאפס promoted_since, שולח מייל קידום ומבטל הוראת קבע - לא כאן.)
 */
export async function extendTrial(opts: { therapistId: string; days: number; note?: string }): Promise<{ ok: boolean; error?: string; promoted_until?: string }> {
  const days = Math.max(7, Math.min(60, Math.floor(opts.days) || 30));
  const { data: t, error } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, status, promotion_source, promoted_until")
    .eq("id", opts.therapistId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!t) return { ok: false, error: "המטפל/ת לא נמצא/ה" };
  if (t.status !== "paying" || t.promotion_source !== "trial") return { ok: false, error: "הארכה אפשרית רק לתקופת ניסיון פעילה" };
  if (!t.promoted_until) return { ok: false, error: "לניסיון הזה אין תאריך סיום" };
  const base = Math.max(new Date(t.promoted_until as string).getTime(), Date.now());
  const until = new Date(base + days * 86_400_000).toISOString();
  const { error: updErr } = await supabaseAdmin
    .from("therapists")
    .update({ promoted_until: until, trial_ending_notified_at: null, trial_ending_reminded_at: null })
    .eq("id", opts.therapistId);
  if (updErr) return { ok: false, error: updErr.message };
  await writeAudit(supabaseAdmin, {
    therapistId: opts.therapistId,
    actorType: "admin",
    action: "trial_extended",
    before: { promoted_until: t.promoted_until },
    after: { promoted_until: until, days },
    reason: opts.note ?? "admin extended the trial from the retention review",
  });
  return { ok: true, promoted_until: until };
}

/**
 * תיעוד פעולת קמפיין (תקציב / הפעלה / הקמה) שבוצעה מהשורה של מטפל/ת, על
 * שמו/ה: כך הכפתור מסומן ✓ והפעולה נכנסת ללולאת התוצאות. יומן השינוי עצמו
 * (לפני/אחרי בגוגל) נכתב ב-google-ads-write.ts תחת הסוכן 'ads'.
 */
export async function recordCampaignAction(opts: { therapistId: string | null | undefined; note: string; payload: Record<string, unknown> }): Promise<void> {
  if (!opts.therapistId) return;
  await recordExecuted({ therapistId: opts.therapistId, actionType: "retention_campaign", actionId: null, label: await therapistName(opts.therapistId), note: opts.note, payload: opts.payload });
}

/**
 * משימת שיחת שימור ב-CRM. הפרטים (הסיבה והדגלים) מהשורה של המטפל/ת
 * בסקירה האחרונה; פעם אחת בשבוע לכל מטפל/ת, כדי שלחיצה כפולה לא תפתח שתיים.
 */
export async function createRetentionTask(opts: ActionTarget): Promise<{ ok: boolean; error?: string; taskId?: string }> {
  const target = await resolveTarget(opts, "retention_task");
  if (!target.ok) return { ok: false, error: target.error };
  const therapistId = target.therapistId;

  const { data: recent } = await supabaseAdmin
    .from("crm_tasks")
    .select("id")
    .eq("entity_type", "therapist")
    .eq("entity_id", therapistId)
    .eq("created_by", "retention")
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(1);
  if ((recent ?? []).length > 0) return { ok: false, error: "כבר נפתחה משימת שיחה למטפל/ת השבוע" };

  const { data: latest } = await supabaseAdmin.from("retention_reviews").select("id, week_start").order("week_start", { ascending: false }).limit(1).maybeSingle();
  const { data: row } = latest
    ? await supabaseAdmin.from("retention_review_rows").select("name, risk_reason, flags").eq("review_id", latest.id).eq("therapist_id", therapistId).maybeSingle()
    : { data: null };
  const name = ((row?.name as string | null) ?? "").trim() || (await therapistName(therapistId)) || "מטפל/ת";
  const flags = Array.isArray(row?.flags) ? (row!.flags as { label?: string }[]).map((f) => String(f.label ?? "")).filter(Boolean) : [];
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("crm_tasks")
    .insert({
      title: `שיחת שימור: ${name}`,
      details: [String(row?.risk_reason ?? ""), flags.length ? `דגלים: ${flags.join(", ")}` : "", latest ? `מתוך סקירת השימור (${String(latest.week_start)}).` : ""].filter(Boolean).join("\n").slice(0, 2000),
      entity_type: "therapist",
      entity_id: therapistId,
      entity_label: name,
      due_date: due,
      priority: "high",
      created_by: "retention",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await recordExecuted({ therapistId, actionType: "retention_task", actionId: target.actionId, label: name, note: `נפתחה משימת שיחה ל-${due}` });
  return { ok: true, taskId: data.id as string };
}
