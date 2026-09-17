import "server-only";
import crypto from "crypto";

// קישור חתום לדף השיחה של המכונים - כדי שעומר תוכל לפתוח אותו בלי סיסמת
// האדמין. האדמין כולו יושב מאחורי Basic Auth עם סיסמה אחת משותפת, ולשתף
// אותה בשביל דף אחד זה לפתוח את כל האדמין. במקום זה: הקישור נושא תאריך
// תפוגה וחתימה על התאריך; בלי הסוד אי אפשר לזייף תפוגה אחרת, ואחרי
// התפוגה הקישור מת מעצמו. אותו דפוס כמו קישור ביטול המנוי (unsubscribe-token).
//
// הדף עצמו קריאה בלבד ואינו מכיל פרטי מטופלים - שמות מטפלים, מספרים
// מצטברים ושאלות לשיחה. זה מה שמצדיק חתימה בלי זהות נמען.

const SECRET = process.env.CRON_SECRET ?? "";
const DEFAULT_DAYS = 7;

function sign(exp: number): string {
  if (!SECRET) throw new Error("CRON_SECRET not set; cannot sign call-sheet link");
  return crypto.createHmac("sha256", SECRET).update(`call-sheet:${exp}`).digest("hex").slice(0, 32);
}

export function verifyCallSheetLink(exp: string | undefined, sig: string | undefined): boolean {
  if (!SECRET || !exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  let expected: string;
  try {
    expected = sign(expNum);
  } catch {
    return false;
  }
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function buildCallSheetLink(
  baseUrl: string,
  opts?: { days?: number; centerId?: string }
): { url: string; expiresAt: string } {
  const days = opts?.days ?? DEFAULT_DAYS;
  const exp = Math.floor(Date.now() / 1000) + days * 86_400;
  const params = new URLSearchParams({ exp: String(exp), sig: sign(exp) });
  if (opts?.centerId) params.set("center", opts.centerId);
  return {
    url: `${baseUrl}/centers/call-sheet?${params.toString()}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}
