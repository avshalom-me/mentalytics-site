import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { loadTeacherFromRequest, crossSiteWrite, teacherNote, TEACHER_FILES_BUCKET } from "@/app/lib/teachers.server";

// תמונה ותעודה של מורה (לפי העוגייה). אותו מבנה כמו אצל המטפלים:
//
//   תעודה - JSON: sign → הדפדפן מעלה ישירות ל-Supabase Storage → commit.
//           הקובץ לא עובר דרך הפונקציה של Vercel, שחותכת בקשות ב-4.5MB
//           (צילום תעודה מטלפון עובר את זה בקלות). report_failure רושם
//           ניסיון שנכשל בהיסטוריה של המורה, כדי שנראה אותו באדמין.
//   תמונה - multipart, אחרי הקטנה בדפדפן; כאן היא נחתכת ל-600x600 webp.
//   תעודה ב-multipart - מסלול גיבוי לקבצים קטנים, כשההעלאה הישירה נכשלה.
//
// הקבצים יושבים בבאקט הפרטי של תעודות המטפלים, תחת teachers/. התמונה מוגשת
// רק דרך /teacher-photo/<id>, והתעודה - רק לאדמין.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CERT_EXT = ["pdf", "jpg", "jpeg", "png"];
const CERT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;
const FAILURE_STAGES = ["read", "sign", "upload", "fallback", "commit"];

async function setCertificate(teacherId: string, path: string, previous: string | null) {
  const { error } = await supabaseAdmin.from("teachers").update({ certificate_path: path, updated_at: new Date().toISOString() }).eq("id", teacherId);
  if (error) return error.message;
  if (previous && previous !== path && previous.startsWith("teachers/certificates/")) {
    await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).remove([previous]);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit("teacher-upload", clientIp(req), 40, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי העלאות - נסו שוב מאוחר יותר");
  if (crossSiteWrite(req)) return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 403 });
  const teacher = await loadTeacherFromRequest(req);
  if (!teacher) return NextResponse.json({ ok: false, error: "לא מחובר/ת" }, { status: 401 });
  const id = String(teacher.id);

  try {
    const contentType = req.headers.get("content-type") ?? "";

    // ── תעודה: העלאה ישירה ───────────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      const action = typeof body.action === "string" ? body.action : "";

      if (action === "sign") {
        const ext = (typeof body.ext === "string" ? body.ext : "").toLowerCase();
        const type = typeof body.contentType === "string" ? body.contentType : "";
        const size = typeof body.size === "number" ? body.size : 0;
        if (!CERT_EXT.includes(ext) || (type && !CERT_TYPES.includes(type))) {
          return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד" }, { status: 400 });
        }
        if (size > MAX_BYTES) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });
        const path = `teachers/certificates/${id}-${Date.now()}.${ext}`;
        const { data, error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).createSignedUploadUrl(path);
        if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "could not sign upload" }, { status: 500 });
        return NextResponse.json({ ok: true, path: data.path, token: data.token });
      }

      if (action === "commit") {
        const path = typeof body.path === "string" ? body.path : "";
        // הנתיב הונפק בשרת ומשויך למורה הזה/זו - כל נתיב אחר נדחה.
        if (!path.startsWith(`teachers/certificates/${id}-`) || !CERT_EXT.includes(path.split(".").pop()?.toLowerCase() ?? "")) {
          return NextResponse.json({ ok: false, error: "invalid path" }, { status: 400 });
        }
        const err = await setCertificate(id, path, (teacher.certificate_path as string | null) ?? null);
        if (err) return NextResponse.json({ ok: false, error: err }, { status: 500 });
        return NextResponse.json({ ok: true, path });
      }

      if (action === "report_failure") {
        const stage = FAILURE_STAGES.includes(String(body.stage)) ? String(body.stage) : "upload";
        const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
        await teacherNote(id, `העלאת תעודה נכשלה (שלב: ${stage})${message ? `: ${message}` : ""}`);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
    }

    // ── תמונה, או תעודה במסלול הגיבוי ─────────────────────────────────────
    const fd = await req.formData();
    const type = String(fd.get("type") ?? "");
    const file = fd.get("file") as File | null;
    if (!file || (type !== "photo" && type !== "certificate")) {
      return NextResponse.json({ ok: false, error: "חסר קובץ" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "הקובץ גדול מ-10MB" }, { status: 400 });

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
      const previous = (teacher.photo_path as string | null) ?? null;
      const { error: dbError } = await supabaseAdmin.from("teachers").update({ photo_path: path, updated_at: new Date().toISOString() }).eq("id", id);
      if (dbError) return NextResponse.json({ ok: false, error: dbError.message }, { status: 500 });
      if (previous && previous !== path && previous.startsWith("teachers/photos/")) {
        await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).remove([previous]);
      }
      return NextResponse.json({ ok: true, path });
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if ((file.type && !CERT_TYPES.includes(file.type)) || !CERT_EXT.includes(ext)) {
      return NextResponse.json({ ok: false, error: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד" }, { status: 400 });
    }
    const path = `teachers/certificates/${id}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(TEACHER_FILES_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type || "application/octet-stream", upsert: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const err = await setCertificate(id, path, (teacher.certificate_path as string | null) ?? null);
    if (err) return NextResponse.json({ ok: false, error: err }, { status: 500 });
    return NextResponse.json({ ok: true, path });
  } catch (e) {
    console.error("teacher upload error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
