import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { findClaimableTherapistByEmail } from "@/app/lib/therapist-claim";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Certificate uploads go DIRECT to Supabase Storage via a signed upload URL,
// so the (often multi-MB) file never passes through the Vercel function — which
// caps request bodies at ~4.5MB and was returning 413 for legitimate license
// scans/photos. This route only signs the upload and then records the row; the
// bytes travel client → Supabase Storage.

const BUCKET = "therapist-certificates";
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// Resolve the therapist row for this user, linking an unclaimed row by email or
// creating a pending stub — mirrors /api/therapist-upload so a brand-new signup
// has something to attach the certificate to.
async function resolveTherapist(user: { id: string; email?: string | null }) {
  let { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!therapist && user.email) {
    // Only a not-yet-live unclaimed row may be auto-claimed (takeover risk).
    const byEmail = await findClaimableTherapistByEmail(user.email, "id");
    if (byEmail) {
      await supabaseAdmin.from("therapists").update({ user_id: user.id }).eq("id", byEmail.id as string);
      therapist = { id: byEmail.id as string };
    }
  }

  if (!therapist) {
    const { data: created } = await supabaseAdmin
      .from("therapists")
      .insert({ user_id: user.id, email: user.email, full_name: "", gender: "", status: "pending", tier: "free" })
      .select("id")
      .single();
    therapist = created ?? null;
  }
  return therapist;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: { action?: unknown; ext?: unknown; contentType?: unknown; size?: unknown; path?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "sign") {
    const ext = (typeof body.ext === "string" ? body.ext : "").toLowerCase();
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = typeof body.size === "number" ? body.size : 0;
    if (!ALLOWED_EXT.includes(ext) || (contentType && !ALLOWED_TYPES.includes(contentType))) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך — יש להעלות PDF / JPG / PNG בלבד" }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
    }
    const path = `certificates/${user.id}-${Date.now()}.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "could not sign upload" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, path: data.path, token: data.token });
  }

  if (action === "commit") {
    const path = typeof body.path === "string" ? body.path : "";
    // The signed path is server-issued and namespaced to this user — reject
    // anything that isn't this user's certificates path.
    if (!path.startsWith(`certificates/${user.id}-`)) {
      return NextResponse.json({ ok: false, error: "invalid path" }, { status: 400 });
    }
    const therapist = await resolveTherapist(user);
    if (!therapist) {
      return NextResponse.json({ ok: false, error: "Could not resolve therapist record" }, { status: 500 });
    }
    const { error } = await supabaseAdmin.from("therapist_certificates").insert({
      therapist_id: therapist.id,
      file_path: path,
      original_name: typeof body.name === "string" ? body.name : "תעודה",
      content_type: typeof body.contentType === "string" ? body.contentType : "",
      size_bytes: typeof body.size === "number" ? body.size : 0,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await supabaseAdmin
      .from("therapists")
      .update({ profile_updated_at: new Date().toISOString() })
      .eq("id", therapist.id);
    return NextResponse.json({ ok: true, path });
  }

  return NextResponse.json({ ok: false, error: "invalid action" }, { status: 400 });
}
