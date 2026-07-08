import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { findClaimableTherapistByEmail } from "@/app/lib/therapist-claim";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "photo" | "certificate"

  if (!file || !type) return NextResponse.json({ ok: false, error: "Missing file or type" }, { status: 400 });

  const folder = type === "photo" ? "photos" : "certificates";
  const bucket = "therapist-certificates";

  let uploadBody: ArrayBuffer | Uint8Array;
  let uploadContentType: string;
  let uploadExt: string;

  if (type === "photo") {
    // Auto-compress profile photos: resize + convert to WebP.
    // Therapists can upload any size — the server shrinks it to a reasonable
    // thumbnail (~40-80KB) without touching the UX on their end.
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    try {
      uploadBody = await sharp(inputBuffer)
        .rotate() // respect EXIF orientation
        .resize(600, 600, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toBuffer();
      uploadContentType = "image/webp";
      uploadExt = "webp";
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid image" }, { status: 400 });
    }
  } else {
    // Certificates: license/diploma docs. Validate type + size (mirrors the
    // signup route) — never trust a client-supplied content-type/extension blindly.
    const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
    const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png"];
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
    }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if ((file.type && !ALLOWED_TYPES.includes(file.type)) || !ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך — יש להעלות PDF / JPG / PNG בלבד" }, { status: 400 });
    }
    uploadBody = await file.arrayBuffer();
    uploadContentType = file.type || "application/octet-stream";
    uploadExt = ext;
  }

  const path = `${folder}/${user.id}-${Date.now()}.${uploadExt}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, uploadBody, { contentType: uploadContentType, upsert: true });

  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

  // Find therapist by user_id, fallback to email
  let { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!therapist && user.email) {
    // Only auto-claim an UNLINKED, not-yet-live row by email — never a row
    // owned by another user, and never a live/paying profile (takeover risk).
    const byEmail = await findClaimableTherapistByEmail(user.email, "id");
    if (byEmail) {
      // Link user_id for future requests
      await supabaseAdmin.from("therapists").update({ user_id: user.id }).eq("id", byEmail.id as string);
      therapist = { id: byEmail.id as string };
    }
  }

  // Brand-new therapist — no row yet. Create a stub so the upload has something
  // to attach to. The full profile is saved via PATCH /api/therapist-profile
  // right after this upload in the dashboard save flow.
  if (!therapist) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("therapists")
      .insert({
        user_id: user.id,
        email: user.email,
        full_name: "",
        // gender is NOT NULL in the schema — omitting it made this stub
        // insert fail silently, which orphaned uploaded files.
        gender: "",
        status: "pending",
        tier: "free",
      })
      .select("id")
      .single();
    if (createErr || !created) {
      // Unique-violation on therapists(user_id) → a concurrent first request
      // won the insert; re-read that row instead of returning a 500.
      const { data: raced } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!raced) {
        return NextResponse.json({ ok: false, error: createErr?.message ?? "Could not create therapist record" }, { status: 500 });
      }
      therapist = raced;
    } else {
      therapist = created;
    }
  }

  if (type === "photo") {
    const { error: dbError } = await supabaseAdmin
      .from("therapists")
      .update({ profile_photo_path: path, profile_updated_at: new Date().toISOString() })
      .eq("id", therapist.id);
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  } else {

    const { error: dbError } = await supabaseAdmin
      .from("therapist_certificates")
      .insert({
        therapist_id: therapist.id,
        file_path: path,
        original_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
      });
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
    await supabaseAdmin
      .from("therapists")
      .update({ profile_updated_at: new Date().toISOString() })
      .eq("id", therapist.id);
  }

  return NextResponse.json({ ok: true, path });
}
