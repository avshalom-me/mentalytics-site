import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin-only: replace a therapist's profile photo. Gated by middleware (the
// path starts with /api/admin-, which requires admin Basic auth). Mirrors the
// therapist-facing /api/therapist-upload photo branch (Sharp resize → WebP)
// but targets a therapist by id instead of the caller's own account — so the
// admin can fix a wrong/missing photo (e.g. a therapist who uploaded a
// certificate into the photo slot).
const BUCKET = "therapist-certificates";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected multipart form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const therapistId = String(formData.get("therapistId") ?? "").trim();

  if (!therapistId) return NextResponse.json({ ok: false, error: "Missing therapistId" }, { status: 400 });
  if (!file) return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });

  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id, profile_photo_path")
    .eq("id", therapistId)
    .single();
  if (!therapist) return NextResponse.json({ ok: false, error: "therapist not found" }, { status: 404 });

  // Compress to a square WebP thumbnail, same as the therapist upload path.
  let body: Buffer;
  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    body = await sharp(inputBuffer)
      .rotate()
      .resize(600, 600, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid image" }, { status: 400 });
  }

  const path = `photos/${therapistId}-${Date.now()}.webp`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, body, { contentType: "image/webp", upsert: true });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

  const { error: dbError } = await supabaseAdmin
    .from("therapists")
    .update({ profile_photo_path: path })
    .eq("id", therapistId);
  if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });

  // Best-effort cleanup of the replaced photo (photos/ only — never touch a
  // legacy path that might point at a certificate file).
  const oldPath = therapist.profile_photo_path as string | null;
  if (oldPath && oldPath !== path && oldPath.startsWith("photos/")) {
    await supabaseAdmin.storage.from(BUCKET).remove([oldPath]);
  }

  // Signed URL so the admin sees the new photo immediately.
  let photoUrl: string | null = null;
  const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  if (signed?.signedUrl) photoUrl = signed.signedUrl;

  return NextResponse.json({ ok: true, id: therapistId, path, photoUrl });
}
