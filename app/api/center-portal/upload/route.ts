import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { resolveCenter } from "@/app/lib/center-auth";

// העלאת קבצים מפורטל המרכז — תמונת פרופיל / תעודה עבור מטפל של המרכז.
// שיקוף של /api/therapist-upload (כיווץ תמונות, ולידציית תעודות), עם אימות
// מרכז במקום אימות מטפל: מותר להעלות רק למטפל שמשויך למרכז המחובר.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (center.status !== "active") {
    return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "photo" | "certificate" | "center_image" | "center_gallery"

  if (!file || !type) {
    return NextResponse.json({ ok: false, error: "Missing file or type" }, { status: 400 });
  }

  // תמונת מרכז — מכווצת ומוחזרת; הנתיב נשמר ע"י הפורטל דרך update_public_page.
  // אין צורך ב-therapist_id — התמונה משויכת למרכז.
  //   center_image   — לוגו / תמונת חבר צוות (קטן, 512).
  //   center_gallery — תמונת גלריה של המרכז (הכניסה/חדרים) — רזולוציה גבוהה יותר.
  if (type === "center_image" || type === "center_gallery") {
    const isGallery = type === "center_gallery";
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    let out: Buffer;
    try {
      out = await sharp(inputBuffer)
        .rotate()
        .resize(isGallery ? 1600 : 512, isGallery ? 1200 : 512, { fit: "inside", withoutEnlargement: true }) // שומר יחס
        .webp({ quality: isGallery ? 80 : 82 })
        .toBuffer();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid image" }, { status: 400 });
    }
    const p = `center-assets/${center.id}-${isGallery ? "g-" : ""}${Date.now()}.webp`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("therapist-certificates")
      .upload(p, out, { contentType: "image/webp", upsert: true });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, path: p });
  }

  const therapistId = formData.get("therapist_id") as string | null;
  if (!therapistId) {
    return NextResponse.json({ ok: false, error: "Missing therapist_id" }, { status: 400 });
  }

  // בעלות: המטפל חייב להיות משויך למרכז המחובר.
  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("id, center_account_id")
    .eq("id", therapistId)
    .eq("center_account_id", center.id)
    .maybeSingle();
  if (!therapist) {
    return NextResponse.json({ ok: false, error: "המטפל/ת אינו/ה משויך/ת למרכז שלכם" }, { status: 404 });
  }

  const folder = type === "photo" ? "photos" : "certificates";
  const bucket = "therapist-certificates";

  let uploadBody: ArrayBuffer | Uint8Array;
  let uploadContentType: string;
  let uploadExt: string;

  if (type === "photo") {
    // כיווץ אוטומטי — כמו בהעלאת מטפל: 600x600 WebP.
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    try {
      uploadBody = await sharp(inputBuffer)
        .rotate()
        .resize(600, 600, { fit: "cover", position: "center" })
        .webp({ quality: 80 })
        .toBuffer();
      uploadContentType = "image/webp";
      uploadExt = "webp";
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid image" }, { status: 400 });
    }
  } else {
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

  const path = `${folder}/center-${therapist.id}-${Date.now()}.${uploadExt}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, uploadBody, { contentType: uploadContentType, upsert: true });
  if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });

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
