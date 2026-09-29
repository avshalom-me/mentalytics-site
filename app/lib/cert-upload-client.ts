// העלאת תעודה מעמוד עריכת הפרופיל - הסדר, הגיבוי וההודעות.
//
// מה השתנה ב-29/9/2026: מטפלת ניסתה להעלות תעודה שש פעמים בשלושה ימים
// מאנדרואיד. בכל פעם השרת הכין את ההעלאה והדפדפן שלח את בקשת ה-preflight,
// אבל הקובץ עצמו לא יצא מהטלפון - וזה המצב המוכר של קובץ שהדפדפן לא מצליח
// לקרוא בזמן השליחה (קובץ ב-Google Drive או בענן, או קובץ שהמערכת "מחליפה"
// מתחת לרגליים). היא קיבלה "Failed to fetch" בלי הסבר, והאדמין לא ראה כלום.
//
// עכשיו:
//   1. הקובץ נקרא לזיכרון לפני כל שליחה. קובץ שלא נקרא - הודעה ברורה מה
//      לעשות, במקום שגיאה טכנית. קובץ שנקרא נשלח מהזיכרון, וכך גם לא נופל
//      על "הקובץ השתנה".
//   2. העלאה ישירה ל-Supabase נכשלה - ניסיון שני דרך השרת שלנו, לקבצים
//      שנכנסים במגבלת הבקשה של Vercel.
//   3. כל כישלון מדווח לשרת (report_failure) ומופיע באדמין.
//
// בלי תלות בדפדפן או ב-Supabase: הכול מוזרק, כדי שייבדק ביחידה.

export const CERT_UNREADABLE_MESSAGE =
  "לא הצלחנו לקרוא את הקובץ מהמכשיר. אם הוא שמור ב-Google Drive או בענן, שמרו אותו קודם בטלפון או במחשב, או צלמו את התעודה ישירות במצלמה והעלו את התמונה. אפשר גם לשלוח אותה אלינו ל-admin@getmentalytics.com ונצרף אותה בשבילכם.";

export const CERT_UPLOAD_FAILED_MESSAGE =
  "העלאת התעודה לא הצליחה. אפשר לנסות שוב, לנסות ממחשב, או לשלוח אותה אלינו ל-admin@getmentalytics.com ונצרף אותה בשבילכם.";

export const PHOTO_UNREADABLE_MESSAGE =
  "לא הצלחנו לקרוא את התמונה מהמכשיר. אם היא שמורה בענן, שמרו אותה קודם בטלפון או במחשב ונסו שוב.";

// Vercel caps a function request body at ~4.5MB; the multipart envelope needs
// a little room, so the server fallback takes files up to 4MB.
export const SERVER_UPLOAD_LIMIT = 4 * 1024 * 1024;

const TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

/** הבייטים של הקובץ, או null כשהדפדפן לא מצליח לקרוא אותו (או שהוא ריק). */
export async function readFileBytes(file: Blob): Promise<ArrayBuffer | null> {
  try {
    const bytes = await file.arrayBuffer();
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}

export type JsonResponse = { ok: boolean; status: number; json: Record<string, unknown> };

export type CertUploadDeps = {
  /** POST /api/therapist-cert עם גוף JSON. */
  postCert: (body: Record<string, unknown>) => Promise<JsonResponse>;
  /** supabase.storage.uploadToSignedUrl. */
  uploadSigned: (path: string, token: string, body: Blob, contentType: string) => Promise<{ error: { message: string } | null }>;
  /** POST /api/therapist-upload (multipart, type=certificate). */
  postServerUpload: (file: File) => Promise<JsonResponse>;
};

/**
 * מעלה תעודה. מחזיר null בהצלחה, או הודעה בעברית למטפל/ת.
 * כישלון ברשת לא זורק - הוא הופך להודעה ולדיווח.
 */
export async function uploadCertificate(file: File, deps: CertUploadDeps): Promise<string | null> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const contentType = file.type || TYPE_BY_EXT[ext] || "";
  const report = async (stage: string, message: string, size?: number) => {
    try {
      await deps.postCert({ action: "report_failure", stage, message, ext, contentType, size: size ?? file.size });
    } catch {
      /* a failed report must not hide the real message */
    }
  };

  const bytes = await readFileBytes(file);
  if (!bytes) {
    await report("read", file.size === 0 ? "empty file" : "file could not be read");
    return CERT_UNREADABLE_MESSAGE;
  }
  const blob = new Blob([bytes], { type: contentType });

  let sign: JsonResponse;
  try {
    sign = await deps.postCert({ action: "sign", ext, contentType, size: bytes.byteLength });
  } catch (e) {
    await report("sign", e instanceof Error ? e.message : "network error", bytes.byteLength);
    return CERT_UPLOAD_FAILED_MESSAGE;
  }
  if (!sign.ok || !sign.json.ok) {
    // A validation answer from our own server (wrong type, over 10MB) is
    // already a clear Hebrew message - show it as is. Reported either way:
    // "tried with a file type we refuse" is exactly what the admin needs.
    const err = typeof sign.json.error === "string" ? sign.json.error : `שגיאה בהכנת העלאת תעודה (${sign.status})`;
    await report("sign", err, bytes.byteLength);
    return err;
  }

  const { error: upErr } = await deps
    .uploadSigned(String(sign.json.path), String(sign.json.token), blob, contentType)
    .catch((e: unknown) => ({ error: { message: e instanceof Error ? e.message : "network error" } }));

  if (upErr) {
    await report("upload", upErr.message, bytes.byteLength);
    if (bytes.byteLength > SERVER_UPLOAD_LIMIT) return CERT_UPLOAD_FAILED_MESSAGE;
    // Second route: through our own server. The name must carry the
    // extension - the route validates it.
    const name = file.name && file.name.toLowerCase().endsWith(`.${ext}`) ? file.name : `certificate.${ext}`;
    try {
      const res = await deps.postServerUpload(new File([bytes], name, { type: contentType }));
      if (res.ok && res.json.ok) return null;
      await report("fallback", typeof res.json.error === "string" ? res.json.error : `HTTP ${res.status}`, bytes.byteLength);
    } catch (e) {
      await report("fallback", e instanceof Error ? e.message : "network error", bytes.byteLength);
    }
    return CERT_UPLOAD_FAILED_MESSAGE;
  }

  try {
    const commit = await deps.postCert({
      action: "commit",
      path: sign.json.path,
      name: file.name,
      contentType,
      size: bytes.byteLength,
    });
    if (commit.ok && commit.json.ok) return null;
    const err = typeof commit.json.error === "string" ? commit.json.error : `HTTP ${commit.status}`;
    await report("commit", err, bytes.byteLength);
  } catch (e) {
    await report("commit", e instanceof Error ? e.message : "network error", bytes.byteLength);
  }
  return CERT_UPLOAD_FAILED_MESSAGE;
}
