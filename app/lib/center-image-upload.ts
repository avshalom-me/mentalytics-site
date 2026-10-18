// העלאת תמונות מפורטל המרכז (לוגו, צוות, גלריה, תמונת פרופיל).
//
// Vercel חותכת גוף בקשה בכ-4.5MB ומחזירה 413 בלי JSON. תמונה מהטלפון עוברת
// את זה בקלות, ועד 18/10/2026 הפורטל שלח אותה כמו שהיא וקרא את התשובה כ-JSON:
// הקריאה נזרקה, לא הוצגה שום הודעה, והגלריה נשארה על "מעלה..." - מנהלת מרכז
// חדש לא הצליחה להעלות תמונות ולא ידעה למה. מכאן: הקטנה בדפדפן לפני השליחה,
// והודעה בעברית על כל כישלון.

/** אותו סף כמו בעריכת פרופיל מטפל ובמורים: רק קובץ מעל 4MB מוקטן. */
const DOWNSCALE_ABOVE_BYTES = 4 * 1024 * 1024;

/**
 * מקטין תמונה גדולה בדפדפן ל-JPEG שהצלע הארוכה שלו maxDim לכל היותר.
 * תמונה שהדפדפן לא מצליח לפענח (למשל HEIC במחשב) חוזרת כמו שהיא, והשרת
 * יחזיר עליה הודעה מפורשת.
 */
export async function downscaleImageForUpload(file: File, maxDim: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= DOWNSCALE_ABOVE_BYTES) return file;
  try {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
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
    if (!ctx) { URL.revokeObjectURL(url); return file; }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** הודעה בעברית לכישלון העלאה, לפי קוד התשובה והשגיאה שהשרת החזיר (אם החזיר). */
export function centerUploadErrorMessage(status: number, serverError?: unknown): string {
  if (status === 413) {
    return "התמונה גדולה מדי להעלאה. אפשר לנסות תמונה קטנה יותר, או לצלם מסך של התמונה ולהעלות את צילום המסך.";
  }
  if (serverError === "Invalid image") {
    return "לא הצלחנו לקרוא את הקובץ כתמונה. אפשר לשמור אותו כ-JPG או PNG ולנסות שוב.";
  }
  if (status === 401) {
    return "החיבור לחשבון פג. רעננו את העמוד והתחברו מחדש, ואז נסו שוב.";
  }
  // הודעות השרת בעברית (למשל "המנוי של המרכז אינו פעיל") מוצגות כמו שהן;
  // שגיאות אחסון באנגלית לא אומרות כלום למנהלת מרכז.
  if (typeof serverError === "string" && /[֐-׿]/.test(serverError)) return serverError;
  return `העלאת התמונה לא הצליחה (שגיאה ${status}). אפשר לנסות שוב, ואם זה חוזר - לכתוב לנו: admin@getmentalytics.com`;
}

/** הודעה לכישלון רשת (הבקשה לא הגיעה לשרת בכלל). */
export const CENTER_UPLOAD_NETWORK_MESSAGE = "העלאת התמונה לא הצליחה - כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.";
