import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { writeAudit } from "@/app/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin-only (the /api/admin- prefix is gated by middleware Basic auth):
// attach a certificate to a therapist's profile on their behalf - the file a
// therapist sent by email or WhatsApp after the upload kept failing on their
// phone (29/9/2026). Same two steps as /api/therapist-cert: "sign" returns a
// signed upload URL, the admin's browser sends the bytes straight to Storage
// (so a 10MB scan does not hit Vercel's ~4.5MB body cap), and "commit" records
// the row once the file is really there.

const BUCKET = "therapist-certificates";
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

type Body = {
  action?: unknown;
  therapistId?: unknown;
  ext?: unknown;
  contentType?: unknown;
  size?: unknown;
  path?: unknown;
  name?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";
  const therapistId = typeof body.therapistId === "string" ? body.therapistId.trim() : "";
  if (!therapistId) return NextResponse.json({ ok: false, error: "Missing therapistId" }, { status: 400 });

  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("id", therapistId)
    .maybeSingle();
  if (!therapist) return NextResponse.json({ ok: false, error: "המטפל/ת לא נמצא/ה" }, { status: 404 });

  if (action === "sign") {
    const ext = (typeof body.ext === "string" ? body.ext : "").toLowerCase();
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : 0;
    if (!ALLOWED_EXT.includes(ext) || (contentType && !ALLOWED_TYPES.includes(contentType))) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד" }, { status: 400 });
    }
    if (size > MAX_BYTES) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
    const path = `certificates/admin-${therapistId}-${Date.now()}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "could not sign upload" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  }

  if (action === "commit") {
    const path = typeof body.path === "string" ? body.path : "";
    // Only a path this route signed for THIS therapist.
    if (!path.startsWith(`certificates/admin-${therapistId}-`)) {
      return NextResponse.json({ ok: false, error: "invalid path" }, { status: 400 });
    }
    const fileName = path.slice("certificates/".length);
    if (!ALLOWED_EXT.includes(fileName.split(".").pop()?.toLowerCase() ?? "")) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד" }, { status: 400 });
    }
    // Record the row only for a file that actually arrived - the whole point
    // of this feature is that an upload can fail silently in the browser.
    const { data: found, error: listErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .list("certificates", { search: fileName, limit: 5 });
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 500 });
    if (!found?.some((o) => o.name === fileName)) {
      return NextResponse.json({ ok: false, error: "הקובץ לא הגיע לאחסון. נסה/י להעלות שוב." }, { status: 409 });
    }

    const originalName = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 200) : "תעודה";
    const { data: cert, error } = await supabaseAdmin
      .from("therapist_certificates")
      .insert({
        therapist_id: therapistId,
        file_path: path,
        original_name: originalName,
        content_type: typeof body.contentType === "string" ? body.contentType : "",
        size_bytes: typeof body.size === "number" ? body.size : 0,
      })
      .select("id, original_name, content_type")
      .single();
    if (error || !cert) return NextResponse.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });

    // Not profile_updated_at: that timestamp means "the therapist updated",
    // and the admin card reads it as the answer to a completion request.
    await writeAudit(supabaseAdmin, {
      therapistId,
      actorType: "admin",
      action: "admin_upload_cert",
      after: { path, original_name: originalName },
      reason: "admin attached a certificate on the therapist's behalf",
    });

    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    return NextResponse.json({
      ok: true,
      certificate: {
        id: cert.id as string,
        original_name: cert.original_name as string,
        content_type: (cert.content_type as string) ?? "",
        signed_url: signed?.signedUrl ?? null,
      },
    });
  }

  return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
}
