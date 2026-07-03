import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Internal CRM notes on any entity (therapist / organization / lead / deal).
// Auth: middleware Basic Auth + CSRF guard cover every /api/admin-* route.

export async function GET(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get("entity_type");
  const entityId = req.nextUrl.searchParams.get("entity_id");
  if (!entityType || !entityId) {
    return NextResponse.json({ ok: false, error: "חסר entity" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_notes")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notes: data ?? [] });
}

export async function POST(req: NextRequest) {
  try {
    const { entity_type, entity_id, body, author } = await req.json();
    const text = String(body ?? "").trim();
    if (!entity_type || !entity_id || !text) {
      return NextResponse.json({ ok: false, error: "חסרים שדות" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ ok: false, error: "הערה ארוכה מדי" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("crm_notes")
      .insert({
        entity_type: String(entity_type),
        entity_id: String(entity_id),
        body: text,
        author: String(author ?? "admin").slice(0, 60),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, note: data });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, pinned, body } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (typeof pinned === "boolean") update.pinned = pinned;
    if (typeof body === "string" && body.trim()) update.body = body.trim().slice(0, 4000);
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "אין מה לעדכן" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("crm_notes").update(update).eq("id", id);
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
    const { error } = await supabaseAdmin.from("crm_notes").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
