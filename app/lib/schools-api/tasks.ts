import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ACTIVE_TASK_STATUSES, TASK_STATUSES } from "@/app/lib/crm";
import { SCHOOL_ENTITY_TYPES } from "@/app/lib/schools-crm";
import type { Viewer } from "@/app/lib/schools-crm.server";

// משימות, הערות ורשימת האחראים של ענף בתי הספר, לפורטל השותפה. אותן טבלאות
// של ה-CRM (crm_tasks, crm_notes) ואותה צורת בקשה כמו /api/admin-crm/tasks ו-
// /api/admin-crm/notes, כדי שאותם מסכים יעבדו מול שני הנתיבים, אבל רק על
// ישויות הענף: משימה או הערה של מטפל, מרכז או ליד אינן נראות ואינן ניתנות
// לשינוי מכאן. מחבר/ת ההערה הוא תמיד הצופה, לא מה שהדפדפן שלח.

const TYPES = [...SCHOOL_ENTITY_TYPES] as string[];
const isBranchType = (t: unknown): t is string => typeof t === "string" && TYPES.includes(t);
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function branchTask(id: unknown): Promise<boolean> {
  if (typeof id !== "string" || !id) return false;
  const { data } = await supabaseAdmin.from("crm_tasks").select("entity_type").eq("id", id).maybeSingle();
  return !!data && isBranchType(data.entity_type);
}

export async function tasksGet(req: NextRequest, v: Viewer) {
  const p = req.nextUrl.searchParams;
  const status = p.get("status") ?? "open";
  const entityType = p.get("entity_type");
  const entityId = p.get("entity_id");
  if (entityType && !isBranchType(entityType)) return fail("סוג ישות לא מוכר");
  let q = supabaseAdmin
    .from("crm_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (status === "active") q = q.in("status", [...ACTIVE_TASK_STATUSES]);
  else if (status !== "all") q = q.eq("status", status);
  q = entityType ? q.eq("entity_type", entityType) : q.in("entity_type", TYPES);
  if (entityId) q = q.eq("entity_id", entityId);
  if (p.get("mine")) q = q.eq("assignee", v.name);
  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, tasks: data ?? [] });
}

export async function tasksPost(req: NextRequest, v: Viewer) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return fail("בקשה לא תקינה");
  const title = String(b.title ?? "").trim();
  if (!title) return fail("חסרה כותרת");
  if (!isBranchType(b.entity_type) || typeof b.entity_id !== "string") return fail("משימה בענף שייכת לבית ספר, לעסקה או לרישיון");
  const { data, error } = await supabaseAdmin
    .from("crm_tasks")
    .insert({
      title: title.slice(0, 300),
      details: b.details ? String(b.details).slice(0, 2000) : null,
      entity_type: b.entity_type,
      entity_id: b.entity_id,
      entity_label: b.entity_label ? String(b.entity_label).slice(0, 120) : null,
      due_date: b.due_date ? String(b.due_date).slice(0, 10) : null,
      priority: ["low", "normal", "high"].includes(b.priority) ? b.priority : "normal",
      assignee: b.assignee ? String(b.assignee).slice(0, 60) : null,
      created_by: v.name.slice(0, 60),
    })
    .select()
    .single();
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, task: data });
}

export async function tasksPatch(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || !b.id) return fail("חסר id");
  if (!(await branchTask(b.id))) return fail("המשימה לא נמצאה", 404);
  const update: Record<string, unknown> = {};
  if (TASK_STATUSES.some((x) => x.value === b.status)) {
    update.status = b.status;
    update.completed_at = b.status === "done" ? new Date().toISOString() : null;
  }
  if ("title" in b && String(b.title).trim()) update.title = String(b.title).trim().slice(0, 300);
  if ("details" in b) update.details = b.details ? String(b.details).slice(0, 2000) : null;
  if ("due_date" in b) update.due_date = b.due_date ? String(b.due_date).slice(0, 10) : null;
  if ("snoozed_until" in b) update.snoozed_until = b.snoozed_until ? String(b.snoozed_until).slice(0, 10) : null;
  if ("priority" in b && ["low", "normal", "high"].includes(b.priority)) update.priority = b.priority;
  if ("assignee" in b) update.assignee = b.assignee ? String(b.assignee).slice(0, 60) : null;
  if ("completion_note" in b) update.completion_note = b.completion_note ? String(b.completion_note).trim().slice(0, 1000) : null;
  if (Object.keys(update).length === 0) return fail("אין מה לעדכן");
  const { error } = await supabaseAdmin.from("crm_tasks").update(update).eq("id", b.id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function tasksDelete(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || !b.id) return fail("חסר id");
  if (!(await branchTask(b.id))) return fail("המשימה לא נמצאה", 404);
  const { error } = await supabaseAdmin.from("crm_tasks").delete().eq("id", b.id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function notesGet(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get("entity_type");
  const entityId = req.nextUrl.searchParams.get("entity_id");
  if (!isBranchType(entityType) || !entityId) return fail("חסר entity");
  const { data, error } = await supabaseAdmin
    .from("crm_notes")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, notes: data ?? [] });
}

export async function notesPost(req: NextRequest, v: Viewer) {
  const b = await req.json().catch(() => null);
  const text = String(b?.body ?? "").trim();
  if (!b || !isBranchType(b.entity_type) || typeof b.entity_id !== "string" || !text) return fail("חסרים שדות");
  if (text.length > 4000) return fail("הערה ארוכה מדי");
  const { data, error } = await supabaseAdmin
    .from("crm_notes")
    .insert({ entity_type: b.entity_type, entity_id: b.entity_id, body: text, author: v.name.slice(0, 60) })
    .select()
    .single();
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, note: data });
}

/** מי אפשר להטיל עליו משימה בענף: אנשי הצוות הפעילים והשותפות הפעילות. */
export async function branchAssignees() {
  const [staff, partners] = await Promise.all([
    supabaseAdmin.from("staff_members").select("full_name").eq("active", true),
    supabaseAdmin.from("partner_users").select("name").eq("active", true),
  ]);
  if (staff.error) return fail(staff.error.message, 500);
  if (partners.error) return fail(partners.error.message, 500);
  const names = new Set<string>();
  for (const r of staff.data ?? []) if (r.full_name) names.add(String(r.full_name).trim());
  for (const r of partners.data ?? []) if (r.name) names.add(String(r.name).trim());
  return NextResponse.json({ ok: true, assignees: [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "he")) });
}
