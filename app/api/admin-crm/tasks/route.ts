import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// CRM follow-up tasks. Open tasks with a due date surface in the dashboard
// work queue; entity_label is denormalized so lists render without joins.

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const status = params.get("status") ?? "open"; // open | done | all
  const entityType = params.get("entity_type");
  const entityId = params.get("entity_id");

  let q = supabaseAdmin
    .from("crm_tasks")
    .select("*")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (status !== "all") q = q.eq("status", status);
  if (entityType) q = q.eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", entityId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tasks: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const title = String(b.title ?? "").trim();
    if (!title) return NextResponse.json({ ok: false, error: "חסרה כותרת" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .insert({
        title: title.slice(0, 300),
        details: b.details ? String(b.details).slice(0, 2000) : null,
        entity_type: b.entity_type ? String(b.entity_type) : null,
        entity_id: b.entity_id ? String(b.entity_id) : null,
        entity_label: b.entity_label ? String(b.entity_label).slice(0, 120) : null,
        due_date: b.due_date ? String(b.due_date) : null,
        priority: ["low", "normal", "high"].includes(b.priority) ? b.priority : "normal",
        assignee: b.assignee ? String(b.assignee).slice(0, 60) : null,
        created_by: String(b.created_by ?? "admin").slice(0, 60),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task: data });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (b.status === "done") {
      update.status = "done";
      update.completed_at = new Date().toISOString();
    } else if (b.status === "open") {
      update.status = "open";
      update.completed_at = null;
    }
    if ("title" in b && String(b.title).trim()) update.title = String(b.title).trim().slice(0, 300);
    if ("details" in b) update.details = b.details ? String(b.details).slice(0, 2000) : null;
    if ("due_date" in b) update.due_date = b.due_date ? String(b.due_date) : null;
    if ("snoozed_until" in b) update.snoozed_until = b.snoozed_until ? String(b.snoozed_until) : null;
    if ("priority" in b && ["low", "normal", "high"].includes(b.priority)) update.priority = b.priority;
    if ("assignee" in b) update.assignee = b.assignee ? String(b.assignee).slice(0, 60) : null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "אין מה לעדכן" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("crm_tasks").update(update).eq("id", b.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
    const { error } = await supabaseAdmin.from("crm_tasks").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
