import "server-only";

// העלאה ל-Google Drive לצורך גיבוי. REST בלבד עם fetch, בלי תלות npm חדשה -
// אותו דפוס רענון-טוקן שכבר עובד ב-google-ads.ts.
//
// למה בכלל: גיבוי מסד הנתונים של Supabase (יומי או PITR) **אינו כולל קבצי
// Storage** - כך כתוב בתיעוד שלהם. אצלנו שם יושבים 181MB של תעודות רישיון
// ותמונות פרופיל, כלומר החומר היחיד שבאמת אי אפשר לשחזר. בנוסף, כל הגיבויים
// של Supabase חיים בתוך אותו חשבון: מחיקת פרויקט מוחקת גם אותם. יעד בבעלות
// המשתמש סוגר את שני הפערים.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

/** ה-OAuth client של Google Ads משמש כברירת מחדל - אותו פרויקט Cloud. */
function clientId(): string | null {
  return process.env.GOOGLE_DRIVE_CLIENT_ID ?? process.env.GOOGLE_ADS_CLIENT_ID ?? null;
}
function clientSecret(): string | null {
  return process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? process.env.GOOGLE_ADS_CLIENT_SECRET ?? null;
}
function refreshToken(): string | null {
  // טוקן נפרד מזה של Ads: הוא נושא scope של drive.file, שמעניק גישה אך ורק
  // לקבצים שהאפליקציה עצמה יצרה - לא לשאר הדרייב.
  return process.env.GOOGLE_DRIVE_REFRESH_TOKEN ?? null;
}
export function driveFolderId(): string | null {
  return process.env.GOOGLE_DRIVE_FOLDER_ID ?? null;
}

export function driveConfigured(): boolean {
  return !!(clientId() && clientSecret() && refreshToken() && driveFolderId());
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId()!,
      client_secret: clientSecret()!,
      refresh_token: refreshToken()!,
      grant_type: "refresh_token",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive OAuth refresh failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

/**
 * תיקייה בתוך תיקיית הגיבוי, נוצרת רק אם אינה קיימת. מחזיר את המזהה.
 * שימושי כדי שהתעודות לא יישפכו לתיקייה אחת עם הדאמפים.
 */
export async function ensureFolder(name: string, parentId: string): Promise<string> {
  const token = await accessToken();
  const q = encodeURIComponent(
    `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents ` +
      `and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await fetch(`${FILES_URL}?q=${q}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (found.ok) {
    const j = (await found.json()) as { files?: { id: string }[] };
    if (j.files?.[0]?.id) return j.files[0].id;
  }
  const created = await fetch(`${FILES_URL}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, parents: [parentId], mimeType: "application/vnd.google-apps.folder" }),
  });
  const text = await created.text();
  if (!created.ok) throw new Error(`Drive folder create failed (${created.status}): ${text.slice(0, 300)}`);
  return (JSON.parse(text) as { id: string }).id;
}

/**
 * העלאה מרובת-חלקים (מטא-דאטה + תוכן בבקשה אחת). מתאים לגדלים שלנו -
 * הקובץ הגדול ביותר הוא 7.6MB, והממוצע 438KB.
 */
export async function uploadFile(opts: {
  name: string;
  parentId: string;
  content: ArrayBuffer | string;
  mimeType: string;
}): Promise<{ id: string; size: number }> {
  const token = await accessToken();
  const body = new FormData();
  body.append(
    "metadata",
    new Blob([JSON.stringify({ name: opts.name, parents: [opts.parentId] })], {
      type: "application/json",
    }),
  );
  const blob =
    typeof opts.content === "string"
      ? new Blob([opts.content], { type: opts.mimeType })
      : new Blob([opts.content], { type: opts.mimeType });
  body.append("file", blob);

  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id,size`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as { id: string; size?: string };
  return { id: json.id, size: Number(json.size ?? 0) };
}
