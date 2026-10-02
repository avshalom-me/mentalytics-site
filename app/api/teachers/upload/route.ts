import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { loadTeacherByToken, TEACHER_FILES_BUCKET } from "@/app/lib/teachers.server";

// העלאת תמונה או תעודה לפרופיל מורה, לפי הטוקן האישי. הקבצים יושבים באותו
// באקט פרטי של תעודות המטפלים, תחת תיקיית teachers/, והתמונה מוגשת דרך
// /teacher-photo/<id> בלבד (התעודה - רק לאדמין).

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CERT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-upload", ip, 30, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי העלאות - נסו שוב מאוחר יותר");

  try {
    const fd = await req.formData();
    const token = String(fd.get("token") ?? "");
    const type = String(fd.get("type") ?? "");
    const file = fd.get("file") as File | null;
    const teacher = await loadTeacherByToken(token);
    if (!teacher) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
    if (!file || (type !== "photo" && type !== "certificate")) {
      return NextResponse.json({ ok: false, error: "חסר קובץ" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
    const id = String(teacher.id);

    if (type === "photo") {
      let out: Buffer;
      try {
        out = await sharp(Buffer.from(await file.arrayBuffer()))
          .rotate()
          .resize(600, 600, { fit: "cover", position: "center" })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        return NextResponse.json({ ok: false, error: "קובץ התמונה אינו תקין" }, { status: 400 });
      }
      const path = `teachers/photos/${id}-${Date.now()}.webp`;
      const { error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).upload(path, out, { contentType: "image/webp", upsert: true });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      await supabaseAdmin.from("teachers").update({ photo_path: path, updated_at: new Date().toISOString() }).eq("id", id);
      return NextResponse.json({ ok: true, path });
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if ((file.type && !CERT_TYPES.includes(file.type)) || !["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך - PDF / JPG / PNG בלבד" }, { status: 400 });
    }
    const path = `teachers/certificates/${id}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(TEACHER_FILES_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await supabaseAdmin.from("teachers").update({ certificate_path: path, updated_at: new Date().toISOString() }).eq("id", id);
    return NextResponse.json({ ok: true, path });
  } catch (e) {
    console.error("teacher upload error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
