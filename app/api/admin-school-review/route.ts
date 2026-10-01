import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { LIMITS, NOTE_STATUSES, type NoteStatus } from "@/app/lib/school-review";
import { NOTE_COLUMNS, newReviewToken } from "@/app/lib/school-review.server";

// The owner's side of the /school review mode - behind the admin middleware
// (/api/admin-*). The reviewer's own side is /api/school-review.
//
// GET  - every reviewer (with their link token) and every note.
// POST { action }:
//   create_reviewer      { name }            - a new reviewer and their link
//   set_reviewer_active  { id, active }      - switch a link off or back on
//   rename_reviewer      { id, name }
//   update_note          { id, status?, response? }
//   set_status           { ids, status }     - several notes at once

export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 80) : "");

export async function GET() {
  try {
    const [reviewersRes, notesRes] = await Promise.all([
      supabaseAdmin
        .from("school_reviewers")
        .select("id, name, token, active, seen, created_at, last_seen_at")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("school_review_notes")
        .select(NOTE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    if (reviewersRes.error) throw reviewersRes.error;
    if (notesRes.error) throw notesRes.error;
    const reviewers = (reviewersRes.data ?? []).map(r => ({
      id: r.id,
      name: r.name,
      token: r.token,
      active: r.active,
      created_at: r.created_at,
      last_seen_at: r.last_seen_at,
      seen: Object.keys((r.seen as Record<string, string> | null) ?? {}),
    }));
    return NextResponse.json({ ok: true, reviewers, notes: notesRes.data ?? [], generated_at: new Date().toISOString() });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "שגיאה", 500);
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("בקשה לא תקינה");
  }
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();

  try {
    if (action === "create_reviewer") {
      const name = cleanName(body.name);
      if (!name) return bad("חסר שם");
      const { data, error } = await supabaseAdmin
        .from("school_reviewers")
        .insert({ name, token: newReviewToken() })
        .select("id, name, token, active, created_at")
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, reviewer: data });
    }

    if (action === "set_reviewer_active") {
      if (!isUuid(body.id) || typeof body.active !== "boolean") return bad("בקשה לא תקינה");
      const { error } = await supabaseAdmin.from("school_reviewers").update({ active: body.active }).eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "rename_reviewer") {
      const name = cleanName(body.name);
      if (!isUuid(body.id) || !name) return bad("בקשה לא תקינה");
      const { error } = await supabaseAdmin.from("school_reviewers").update({ name }).eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "update_note") {
      if (!isUuid(body.id)) return bad("חסר מזהה ההערה");
      const patch: Record<string, unknown> = { updated_at: now };
      if (body.status !== undefined) {
        if (!NOTE_STATUSES.includes(body.status as NoteStatus)) return bad("סטטוס לא מוכר");
        patch.status = body.status;
        // The day it left the "new" pile, whichever way it went.
        patch.handled_at = body.status === "open" ? null : now;
      }
      if (body.response !== undefined) {
        patch.response = typeof body.response === "string" && body.response.trim() ? body.response.trim().slice(0, LIMITS.response) : null;
      }
      const { data, error } = await supabaseAdmin.from("school_review_notes").update(patch).eq("id", body.id).select(NOTE_COLUMNS).maybeSingle();
      if (error) throw error;
      if (!data) return bad("ההערה לא נמצאה", 404);
      return NextResponse.json({ ok: true, note: data });
    }

    if (action === "set_status") {
      const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid).slice(0, 500) : [];
      if (!ids.length || !NOTE_STATUSES.includes(body.status as NoteStatus)) return bad("בקשה לא תקינה");
      const { error } = await supabaseAdmin
        .from("school_review_notes")
        .update({ status: body.status, handled_at: body.status === "open" ? null : now, updated_at: now })
        .in("id", ids);
      if (error) throw error;
      return NextResponse.json({ ok: true, updated: ids.length });
    }

    return bad("פעולה לא מוכרת");
  } catch (err) {
    return bad(err instanceof Error ? err.message : "שגיאה", 500);
  }
}
