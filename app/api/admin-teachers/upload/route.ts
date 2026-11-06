import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { teacherNote, TEACHER_FILES_BUCKET } from "@/app/lib/teachers.server";

// תמונה או תעודה שהאדמין מעלה במקום המורה (כמו AdminCertUpload אצל
// המטפלים): מורה ששלח/ה תעודה במייל או בוואטסאפ, תמונה שהגיעה בהודעה.
// אותם נתיבים ואותו עיבוד כמו בהעלאה של המורה (app/api/teachers/upload),
// רק במסלול multipart, כי האדמין מעלה קבצים קטנים. Basic Auth של
// /api/admin-* מכסה את הנתיב.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CERT_EXT = ["pdf", "jpg", "jpeg", "png"];
const CERT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  const id = String(fd.get("id") ?? "");
  const type = String(fd.get("type") ?? "");
  const file = fd.get("file") as File | null;
  if (!id || !file || (type !== "photo" && type !== "certificate")) return NextResponse.json({ ok: false, error: "חסר קובץ" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-4MB. להקטין, או לבקש מהמורה להעלות מהקישור האישי" }, { status: 400 });
  const { data: t } = await supabaseAdmin.from("teachers").select("id, certificate_path, photo_path").eq("id", id).maybeSingle();
  if (!t) return NextResponse.json({ ok: false, error: "מורה לא נמצא/ה" }, { status: 404 });

  try {
    if (type === "photo") {
      let out: Buffer;
      try {
        out = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(600, 600, { fit: "cover", position: "center" }).webp({ quality: 80 }).toBuffer();
      } catch {
        return NextResponse.json({ ok: false, error: "קובץ התמונה אינו תקין" }, { status: 400 });
      }
      const path = `teachers/photos/${id}-${Date.now()}.webp`;
      const { error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).upload(path, out, { contentType: "image/webp", upsert: true });
      if (error) throw new Error(error.message);
      const { error: dbError } = await supabaseAdmin.from("teachers").update({ photo_path: path, updated_at: new Date().toISOString() }).eq("id", id);
      if (dbError) throw new Error(dbError.message);
      const previous = (t.photo_path as string | null) ?? null;
      if (previous && previous !== path && previous.startsWith("teachers/photos/")) await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).remove([previous]);
      await teacherNote(id, "תמונה הועלתה מהאדמין.", "admin");
      return NextResponse.json({ ok: true, path });
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if ((file.type && !CERT_TYPES.includes(file.type)) || !CERT_EXT.includes(ext)) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד" }, { status: 400 });
    }
    const path = `teachers/certificates/${id}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) throw new Error(error.message);
    const { error: dbError } = await supabaseAdmin.from("teachers").update({ certificate_path: path, updated_at: new Date().toISOString() }).eq("id", id);
    if (dbError) throw new Error(dbError.message);
    const previous = (t.certificate_path as string | null) ?? null;
    if (previous && previous !== path && previous.startsWith("teachers/certificates/")) await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).remove([previous]);
    await teacherNote(id, "תעודה הועלתה מהאדמין.", "admin");
    return NextResponse.json({ ok: true, path });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
