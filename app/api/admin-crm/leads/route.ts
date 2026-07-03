import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// Inbound inquiries (patients, prospective therapists/teachers, general).
// Captured automatically from the site's contact pipelines; manageable here.

const VALID_STATUSES = ["new", "in_progress", "converted", "closed"];
const VALID_TYPES = ["patient", "therapist", "teacher", "organization", "general"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const status = params.get("status"); // optional filter
  const leadType = params.get("lead_type");
  const therapistId = params.get("therapist_id");
  const limit = Math.min(Number(params.get("limit") ?? 200), 500);

  let q = supabaseAdmin
    .from("crm_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && VALID_STATUSES.includes(status)) q = q.eq("status", status);
  if (leadType && VALID_TYPES.includes(leadType)) q = q.eq("lead_type", leadType);
  if (therapistId) q = q.eq("therapist_id", therapistId);

  const { data: leads, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Attach therapist names for site messages (one lookup, mapped in JS).
  const therapistIds = Array.from(
    new Set((leads ?? []).map((l) => l.therapist_id).filter(Boolean))
  ) as string[];
  let names: Record<string, string> = {};
  if (therapistIds.length > 0) {
    const { data: therapists } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name")
      .in("id", therapistIds);
    names = Object.fromEntries((therapists ?? []).map((t) => [t.id, t.full_name ?? ""]));
  }

  const withNames = (leads ?? []).map((l) => ({
    ...l,
    therapist_name: l.therapist_id ? names[l.therapist_id] ?? null : null,
  }));

  return NextResponse.json({ ok: true, leads: withNames });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const name = String(b.name ?? "").trim();
    const contact = String(b.contact ?? "").trim();
    if (!name && !contact) {
      return NextResponse.json({ ok: false, error: "חסר שם או פרטי קשר" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("crm_leads")
      .insert({
        lead_type: VALID_TYPES.includes(b.lead_type) ? b.lead_type : "general",
        name: name || null,
        contact: contact || null,
        message: b.message ? String(b.message).slice(0, 4000) : null,
        therapist_id: b.therapist_id ? String(b.therapist_id) : null,
        source: "manual",
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, lead: data });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (!b.id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (b.status && VALID_STATUSES.includes(b.status)) {
      update.status = b.status;
      update.status_changed_at = new Date().toISOString();
    }
    if ("handled_by" in b) update.handled_by = b.handled_by ? String(b.handled_by).slice(0, 60) : null;
    if (b.lead_type && VALID_TYPES.includes(b.lead_type)) update.lead_type = b.lead_type;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: false, error: "אין מה לעדכן" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("crm_leads").update(update).eq("id", b.id);
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
    const { error } = await supabaseAdmin.from("crm_leads").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
