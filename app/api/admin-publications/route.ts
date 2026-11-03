import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { normalizePublication, normalizePublicationPatch } from "@/app/lib/publications";

// The publications library (/admin/publications, table marketing_publications). Guarded by the
// admin Basic-Auth middleware like every /api/admin-* route, writes included (its Origin check).
// A row only describes a piece and where it lives: nothing here publishes, uploads or sends.
// There is no delete: a replaced piece is marked "retired" and stays in the list.

export const dynamic = "force-dynamic";

const COLS =
  "id, campaign, audience, kind, title, version, status, channels, public_url, file_url, links, notes, published_on, sort_order, created_at, updated_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  // Hundreds of rows at most for years; the cap only keeps a runaway table from flooding the page.
  const { data, error } = await supabaseAdmin.from("marketing_publications").select(COLS).limit(2000);
  if (error) return fail("הפרסומים לא נטענו - נסו לרענן", 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { action?: unknown; id?: unknown; item?: unknown } | null;
  if (!body) return fail("בקשה לא תקינה", 400);

  if (body.action === "create") {
    const v = normalizePublication(body.item);
    if (!v.ok) return fail(v.error, 400);
    const { data, error } = await supabaseAdmin.from("marketing_publications").insert(v.value).select(COLS).single();
    if (error) return fail("הפרסום לא נשמר - נסו שוב", 500);
    return NextResponse.json({ ok: true, item: data });
  }

  if (body.action === "update") {
    if (typeof body.id !== "string" || !UUID_RE.test(body.id)) return fail("בקשה לא תקינה", 400);
    const v = normalizePublicationPatch(body.item);
    if (!v.ok) return fail(v.error, 400);
    if (Object.keys(v.value).length === 0) return fail("אין מה לעדכן", 400);
    const { data, error } = await supabaseAdmin
      .from("marketing_publications")
      .update({ ...v.value, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select(COLS)
      .maybeSingle();
    if (error) return fail("השינוי לא נשמר - נסו שוב", 500);
    if (!data) return fail("הפרסום לא נמצא. אולי הרשימה ישנה - רעננו את העמוד", 404);
    return NextResponse.json({ ok: true, item: data });
  }

  return fail("בקשה לא תקינה", 400);
}
