import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

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

  const ext = file.name.split(".").pop();
  const folder = type === "photo" ? "photos" : "certificates";
  const path = `${folder}/${user.id}-${Date.now()}.${ext}`;
  const bucket = "therapist-certificates";

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

  if (type === "photo") {
    // Store the path in profile_photo_path (same pattern as signup form)
    const { error: dbError } = await supabaseAdmin
      .from("therapists")
      .update({ profile_photo_path: path })
      .eq("user_id", user.id);
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  } else {
    // Find the therapist id, then insert into therapist_certificates table
    const { data: therapist } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!therapist) return NextResponse.json({ ok: false, error: "Therapist not found" }, { status: 404 });

    const { error: dbError } = await supabaseAdmin
      .from("therapist_certificates")
      .insert({ therapist_id: therapist.id, file_path: path, file_name: file.name });
    if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
