import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

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
    // Certificates: store as-is, they are legal documents.
    uploadBody = await file.arrayBuffer();
    uploadContentType = file.type;
    uploadExt = file.name.split(".").pop() ?? "bin";
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
    const { data: byEmail } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("email", user.email)
      .single();
    if (byEmail) {
      // Link user_id for future requests
      await supabaseAdmin.from("therapists").update({ user_id: user.id }).eq("id", byEmail.id);
      therapist = byEmail;
    }
  }

  if (!therapist) return NextResponse.json({ ok: false, error: "Therapist not found" }, { status: 404 });

  if (type === "photo") {
    const { error: dbError } = await supabaseAdmin
      .from("therapists")
      .update({ profile_photo_path: path })
      .eq("id", therapist.id);
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  } else {

    const { error: dbError } = await supabaseAdmin
      .from("therapist_certificates")
      .insert({ therapist_id: therapist.id, file_path: path, file_name: file.name });
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
