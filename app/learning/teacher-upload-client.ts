import { supabase } from "@/app/lib/supabaseClient";
import { uploadCertificate, readFileBytes, PHOTO_UNREADABLE_MESSAGE, type JsonResponse } from "@/app/lib/cert-upload-client";

// העלאת תעודה ותמונה של מורה מהדפדפן. התעודה הולכת באותו מסלול של המטפלים
// (app/lib/cert-upload-client.ts): קריאה לזיכרון, העלאה ישירה ל-Supabase דרך
// כתובת חתומה, גיבוי דרך השרת לקבצים קטנים, ודיווח על כל כישלון. המורה
// מזוהה/ית בעוגייה, ולכן אין כאן טוקן.

const BUCKET = "therapist-certificates";

async function asJson(res: Response): Promise<JsonResponse> {
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

/** מחזיר null בהצלחה, או הודעה בעברית למורה. */
export function uploadTeacherCertificate(file: File): Promise<string | null> {
  return uploadCertificate(file, {
    postCert: async (body) =>
      asJson(await fetch("/api/teachers/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    uploadSigned: (path, signedToken, body, contentType) =>
      supabase.storage.from(BUCKET).uploadToSignedUrl(path, signedToken, body, { contentType: contentType || undefined }),
    postServerUpload: async (f) => {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("type", "certificate");
      return asJson(await fetch("/api/teachers/upload", { method: "POST", body: fd }));
    },
  });
}

/**
 * הקטנת תמונה גדולה בדפדפן, כדי שתישאר מתחת למגבלת גוף הבקשה של Vercel
 * (כ-4.5MB). אותו כלל כמו בעריכת פרופיל של מטפל: רק קבצים מעל 4MB נוגעים.
 */
async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 4 * 1024 * 1024) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    const maxDim = 1200;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return file;
    }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** מחזיר null בהצלחה, או הודעה בעברית למורה. */
export async function uploadTeacherPhoto(file: File): Promise<string | null> {
  const bytes = await readFileBytes(file);
  if (!bytes) return PHOTO_UNREADABLE_MESSAGE;
  const inMemory = new File([bytes], file.name || "photo.jpg", { type: file.type || "image/jpeg" });
  try {
    const toSend = await downscaleImage(inMemory);
    const fd = new FormData();
    fd.append("file", toSend);
    fd.append("type", "photo");
    const res = await fetch("/api/teachers/upload", { method: "POST", body: fd });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return typeof json.error === "string" ? json.error : `שגיאה בהעלאת התמונה (${res.status})`;
  } catch {
    return "העלאת התמונה לא הצליחה. אפשר לנסות שוב או לנסות ממחשב.";
  }
}
