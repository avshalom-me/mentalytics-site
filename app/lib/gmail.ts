import "server-only";
import { randomBytes } from "crypto";
import { dropRepeatedClosing } from "./email-signature";
import { splitQuoted, stripQuoted } from "./email-quote";

// לקוח Gmail לתיבת admin@getmentalytics.com, במסלול OAuth פנימי של
// Workspace - אותו דפוס בדיוק כמו GOOGLE_ADS_REFRESH_TOKEN: אפליקציה
// Internal פטורה מאימות של גוגל, והטוקן לא פג כמו External-in-testing.
//
// שלושה משתני סביבה: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
// GMAIL_REFRESH_TOKEN. בלעדיהם כל הפונקציות כאן לא נקראות -
// gmailConfigured() נבדק קודם, והסוכן מדווח "לא מוגדר" במקום ליפול.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
  );
}

// טוקן גישה חי ~שעה; נשמר בזיכרון התהליך עם רזרבה של 5 דקות. בסביבת
// serverless זה אומר "לרוב נחסכת קריאת רענון", לא יותר - וזה מספיק.
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID ?? "",
      client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
      refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) {
    throw new Error(`רענון טוקן Gmail נכשל: ${j.error ?? res.status}`);
  }
  cached = { token: j.access_token, expiresAt: Date.now() + ((j.expires_in ?? 3600) - 300) * 1000 };
  return j.access_token;
}

async function gmailFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail API ${path} נכשל (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** כתובת החשבון שהטוקן מאשר בפועל - לאימות שאושר החשבון הנכון. */
export async function connectedAccount(): Promise<string> {
  const j = await gmailFetch<{ emailAddress?: string }>(`/profile`);
  return (j.emailAddress ?? "").toLowerCase();
}

// ── קריאת הודעות ────────────────────────────────────────────────────────

export type GmailHeaderMap = Record<string, string>;

type RawPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: RawPart[];
};

type RawMessage = {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: RawPart & { headers?: { name: string; value: string }[] };
  snippet?: string;
};

export type InboundMessage = {
  id: string;
  threadId: string;
  headerMessageId: string | null;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  receivedAt: string; // ISO
};

/**
 * מזהי הודעות בתיבה הנכנסת (חדשות בלבד נקבעות מול הטבלה, לא כאן).
 *
 * GMAIL_INGEST_TO (אופציונלי): אם admin@ הוא כינוי שנוחת לתיבה אישית
 * (למשל של avshalom@), התיבה מכילה גם מייל אישי - ואסור שהסוכן
 * יקרא אותו או ישלח אותו ל-OpenAI. הגדרת המשתנה מצמצמת את הקליטה
 * למייל שמוען לכתובת הזו בלבד (deliveredto: תופס גם עותק וכינויים).
 */
export async function listInboxIds(newerThanDays: number, max = 50): Promise<{ id: string; threadId: string }[]> {
  const onlyTo = (process.env.GMAIL_INGEST_TO ?? "").trim();
  const q = encodeURIComponent(
    `in:inbox -in:chats newer_than:${newerThanDays}d` + (onlyTo ? ` deliveredto:${onlyTo}` : "")
  );
  const j = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(
    `/messages?q=${q}&maxResults=${max}`
  );
  return j.messages ?? [];
}

/**
 * האם יצאה מאיתנו תשובה בשרשור אחרי רגע נתון. קריאה אחת לשרשור
 * (ורק לשרשורים של פניות פתוחות) - מזהה "נענה ישירות בג'ימייל",
 * כדי שפנייה שענית מחוץ למערכת לא תישאר תקועה בתור לנצח.
 */
export async function threadAnsweredAfter(threadId: string, afterMs: number): Promise<boolean> {
  const j = await gmailFetch<{
    messages?: { labelIds?: string[]; internalDate?: string }[];
  }>(`/threads/${threadId}?format=minimal`);
  return (j.messages ?? []).some(
    (m) => (m.labelIds ?? []).includes("SENT") && Number(m.internalDate ?? 0) > afterMs
  );
}

function decodeB64Url(data: string): string {
  try {
    return Buffer.from(data, "base64url").toString("utf-8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** חילוץ טקסט: text/plain קודם, ואם אין - HTML מפושט. */
function extractBody(part: RawPart | undefined): string {
  if (!part) return "";
  const flat: RawPart[] = [];
  const walk = (p: RawPart) => {
    flat.push(p);
    (p.parts ?? []).forEach(walk);
  };
  walk(part);
  const plain = flat.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain?.body?.data) return decodeB64Url(plain.body.data).trim();
  const html = flat.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html?.body?.data) return stripHtml(decodeB64Url(html.body.data));
  return "";
}

function parseFrom(v: string): { email: string; name: string | null } {
  const m = v.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].replace(/^"|"$/g, "").trim();
    return { email: m[2].trim().toLowerCase(), name: name || null };
  }
  return { email: v.trim().toLowerCase(), name: null };
}

export async function getMessage(id: string): Promise<InboundMessage | null> {
  const raw = await gmailFetch<RawMessage>(`/messages/${id}?format=full`);
  const headers: GmailHeaderMap = {};
  for (const h of raw.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
  const from = parseFrom(headers["from"] ?? "");
  if (!from.email) return null;
  const body = extractBody(raw.payload).slice(0, 20_000);
  return {
    id: raw.id,
    threadId: raw.threadId,
    headerMessageId: headers["message-id"] ?? null,
    fromEmail: from.email,
    fromName: from.name,
    subject: (headers["subject"] ?? "").slice(0, 500),
    bodyText: body,
    receivedAt: new Date(Number(raw.internalDate ?? Date.now())).toISOString(),
  };
}

/** מזהי הודעות שיצאו מאיתנו - בסיס לבניית מאגר הדוגמאות ההיסטורי. */
export async function listSentIds(newerThanDays: number, max = 60): Promise<string[]> {
  const q = encodeURIComponent(`in:sent newer_than:${newerThanDays}d`);
  const j = await gmailFetch<{ messages?: { id: string }[] }>(
    `/messages?q=${q}&maxResults=${max}`
  );
  return (j.messages ?? []).map((m) => m.id);
}

export type ThreadMessage = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  bodyText: string;
  internalDate: number;
  isSent: boolean;
};

/**
 * שרשור מלא, ממוין לפי זמן. משמש לזיווג "פנייה שנכנסה" עם "התשובה שיצאה
 * עליה" - הזוג הזה הוא הדוגמה שהסוכן לומד ממנה.
 */
export async function getThread(threadId: string): Promise<ThreadMessage[]> {
  const j = await gmailFetch<{ messages?: (RawMessage & { labelIds?: string[] })[] }>(
    `/threads/${threadId}?format=full`
  );
  const out: ThreadMessage[] = [];
  for (const raw of j.messages ?? []) {
    const headers: GmailHeaderMap = {};
    for (const h of raw.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value;
    const from = parseFrom(headers["from"] ?? "");
    if (!from.email) continue;
    out.push({
      id: raw.id,
      fromEmail: from.email,
      fromName: from.name,
      subject: (headers["subject"] ?? "").slice(0, 500),
      // הציטוט של ההתכתבות הקודמת נחתך: בדוגמה הוא רעש שמסתיר את מה
      // שנכתב בפועל, ומנפח כל דוגמה פי כמה.
      bodyText: stripQuoted(extractBody(raw.payload)).slice(0, 4000),
      internalDate: Number(raw.internalDate ?? 0),
      isSent: (raw.labelIds ?? []).includes("SENT"),
    });
  }
  return out.sort((a, b) => a.internalDate - b.internalDate);
}

// הפרדת הציטוט עברה ל-email-quote.ts כדי שגם עמוד האדמין ישתמש בה. כאן
// היא ממשיכה להיות זמינה לכל מי שמייבא מ-gmail.ts. חיתוך החתימה ("-- ")
// חשוב גם כאן: תשובה שנשלחה מ-Gmail נושאת את החתימה בגוף, ובלי החיתוך
// הסוכן היה לומד להקליד אותה בטיוטה.
export { splitQuoted, stripQuoted };

// ── חתימה ───────────────────────────────────────────────────────────────
//
// למה התשובות מהאדמין יצאו בלי חתימה: Gmail מוסיף את החתימה רק בחלון
// הכתיבה של הממשק שלו ("included in messages composed ... in the Gmail web
// UI"). הודעה שנשלחת דרך ה-API היא MIME גולמי שיוצא כמו שהוא, ו-Gmail לא
// נוגע בה. לכן החתימה נקראת כאן מהגדרות החשבון ומוצמדת בשליחה - והמקור
// היחיד שלה נשאר Gmail: מה שמשנים שם יוצא גם מכאן. gmail.readonly מספיקה
// לקריאת ההגדרות, כך שלא נדרש אישור מחדש של הטוקן.

/** כתובת ה-From של התשובות, וממילא הכתובת שהחתימה שלה נבחרת. */
function senderAddress(): string {
  // בלי From מפורש התשובה יוצאת עם שם התצוגה של חשבון גוגל ("Admin
  // Admin") במקום שם המותג. הכתובת היא של החשבון המחובר עצמו, אלא אם
  // הוגדר כינוי מאומת ב-GMAIL_SENDER ("Send mail as" בהגדרות Gmail).
  return (
    (process.env.GMAIL_SENDER ?? "").trim() ||
    (process.env.GMAIL_ACCOUNT ?? "admin@getmentalytics.com").trim()
  );
}

export type GmailSignature = { html: string; text: string; alias: string };

/** מה קרה לחתימה בשליחה: צורפה / לא מוגדרת ב-Gmail / הקריאה נכשלה. */
export type SignatureOutcome = "attached" | "none" | "failed";

type SendAs = {
  sendAsEmail: string;
  signature?: string;
  isDefault?: boolean;
  isPrimary?: boolean;
};

function decodeNumericEntities(v: string): string {
  const cp = (n: number, raw: string) => {
    try {
      return String.fromCodePoint(n);
    } catch {
      return raw;
    }
  };
  return v
    .replace(/&#(\d+);/g, (raw, n) => cp(Number(n), raw))
    .replace(/&#x([0-9a-f]+);/gi, (raw, h) => cp(parseInt(h, 16), raw))
    .replace(/&apos;/g, "'");
}

/** גרסת טקסט של חתימת HTML - לחלק ה-text/plain של ההודעה. */
function signatureText(html: string): string {
  // חתימות של Gmail בנויות משורות <div>, ו-stripHtml שובר שורות רק ב-<br>
  // וב-</p>. ללוגו אין ייצוג בטקסט.
  const flat = stripHtml(
    html.replace(/<img\b[^>]*>/gi, "").replace(/<\/(div|tr|li|h[1-6])>/gi, "\n")
  );
  return decodeNumericEntities(flat)
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** חתימה "ריקה" של Gmail היא לפעמים <div><br></div> - זו לא חתימה. */
function hasSignature(html: string | undefined): boolean {
  if (!html) return false;
  return /<img\b/i.test(html) || signatureText(html).length > 0;
}

// המטמון הוא לתצוגה המקדימה באדמין, שנטענת בכל כניסה לעמוד. השליחה עצמה
// קוראת טרי, כדי שמה שיוצא יהיה בדיוק מה שמוגדר ב-Gmail באותו רגע.
let sigCache: { value: GmailSignature | null; at: number } | null = null;
const SIG_TTL_MS = 2 * 60_000;

/**
 * החתימה של כתובת השולח כפי שהוגדרה ב-Gmail, או null אם לא הוגדרה.
 * כינוי בלי חתימה נופל לחתימת ברירת המחדל של החשבון - אחרת הגדרת
 * GMAIL_SENDER הייתה מעלימה את החתימה בשקט. זורקת אם הקריאה נכשלה.
 */
export async function gmailSignature(opts?: { fresh?: boolean }): Promise<GmailSignature | null> {
  if (!opts?.fresh && sigCache && Date.now() - sigCache.at < SIG_TTL_MS) return sigCache.value;
  const j = await gmailFetch<{ sendAs?: SendAs[] }>(`/settings/sendAs`);
  const withSig = (j.sendAs ?? []).filter((a) => hasSignature(a.signature));
  const sender = senderAddress().toLowerCase();
  const pick =
    withSig.find((a) => a.sendAsEmail.toLowerCase() === sender) ??
    withSig.find((a) => a.isDefault) ??
    withSig.find((a) => a.isPrimary) ??
    null;
  const value = pick
    ? {
        html: pick.signature as string,
        text: signatureText(pick.signature as string),
        alias: pick.sendAsEmail,
      }
    : null;
  sigCache = { value, at: Date.now() };
  return value;
}

/**
 * החתימה מחוץ ל-div של הגוף: הגוף הוא pre-wrap, ושם כל שבירת שורה במקור
 * ה-HTML של החתימה הייתה נהפכת לשורה ריקה. dir="rtl" הוא רק ברירת המחדל -
 * חתימה שנכתבה ב-Gmail נושאת dir משלה, והוא גובר.
 */
function signatureHtml(sig: string): string {
  return `<br><div dir="rtl" class="gmail_signature" data-smartmail="gmail_signature">${sig}</div>`;
}

// ── שליחת תשובה ─────────────────────────────────────────────────────────

/** כותרת מייל בעברית חייבת קידוד RFC 2047. */
function encodeHeader(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

/**
 * תשובה בתוך השרשור המקורי, מהחשבון המחובר (admin@). ההודעה נבנית כ-RFC
 * 2822 גולמי כי זה מה ש-Gmail API מקבל; In-Reply-To/References הם מה
 * שגורם לה להופיע אצל הנמען כתשובה ולא כמייל חדש.
 */
/** הברחת תווים ל-HTML. עותק מקומי - gmail.ts לא תלוי בשכבת המיילים. */
function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * גוף התשובה כ-HTML עם כיוון מפורש.
 *
 * טקסט פשוט הוא חסר כיוון: אין בו מטא-דאטה, ולכן הלקוח מרנדר לפי ברירת
 * המחדל שלו - שהיא LTR. בעברית זה מזיז סימני פיסוק לצד הלא נכון ומיישר
 * את כל הפסקה שמאלה. הפתרון היחיד שעובד בכל הלקוחות הוא dir="rtl" מפורש,
 * וזה מחייב HTML.
 *
 * pre-wrap שומר על שורות ריקות ורווחים כפי שהאדמין הקליד, ו-<br> נשאר
 * כגיבוי ללקוחות שמסירים סגנונות (חלק מגרסאות אאוטלוק).
 */
function rtlHtmlBody(text: string): string {
  // בלי תו שורה אחרי ה-<br>: תחת pre-wrap גם הוא נספר כשבירה, וכל שורה
  // בתשובה הייתה יוצאת מוכפלת.
  const safe = escapeHtmlText(text).replace(/\r?\n/g, "<br>");
  return [
    '<div dir="rtl" style="direction:rtl;text-align:right;unicode-bidi:plaintext;',
    "white-space:pre-wrap;font-family:'Heebo',Arial,sans-serif;font-size:15px;",
    'line-height:1.7;color:#1a4a5c;">',
    safe,
    "</div>",
  ].join("");
}

export async function sendGmailReply(opts: {
  threadId: string;
  to: string;
  subject: string;
  inReplyTo: string | null;
  body: string;
}): Promise<{ id: string; signature: SignatureOutcome }> {
  const subject = opts.subject.startsWith("Re:") || opts.subject.startsWith("RE:")
    ? opts.subject
    : `Re: ${opts.subject}`;
  const sender = senderAddress();

  // כשל בקריאת החתימה לא עוצר תשובה ללקוח: היא יוצאת בלעדיה, והאדמין
  // מקבל על כך הודעה. "none" ו-"failed" נפרדים בכוונה: חשבון בלי חתימה
  // מוגדרת הוא לא תקלה, ולא צריך להיראות כמו תקלה בכל שליחה.
  let signature: GmailSignature | null = null;
  let outcome: SignatureOutcome = "none";
  try {
    signature = await gmailSignature({ fresh: true });
    if (signature) outcome = "attached";
  } catch (e) {
    outcome = "failed";
    console.error("gmail signature load failed:", e instanceof Error ? e.message : e);
  }
  // שורת סיום שהחתימה כבר אומרת ("צוות טיפול חכם") לא יוצאת פעמיים.
  const body = signature ? dropRepeatedClosing(opts.body, signature.text) : opts.body;
  // חתימה שהיא לוגו בלבד אין לה ייצוג בטקסט - ואז גם לא מפריד "-- " תלוי.
  const textPart = signature?.text ? `${body}\n\n-- \n${signature.text}` : body;
  const htmlPart = rtlHtmlBody(body) + (signature ? signatureHtml(signature.html) : "");

  // multipart/alternative: גרסת HTML לכיוון נכון, וגרסת טקסט כגיבוי למי
  // שחוסם HTML. הגבול אקראי כדי שלא יופיע בטעות בתוך גוף ההודעה.
  const boundary = `mtl_${randomBytes(12).toString("hex")}`;
  const b64 = (v: string) => Buffer.from(v, "utf-8").toString("base64");

  const lines = [
    `From: ${encodeHeader("טיפול חכם")} <${sender}>`,
    `To: ${opts.to}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(opts.inReplyTo ? [`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(textPart),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(htmlPart),
    `--${boundary}--`,
    "",
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf-8").toString("base64url");
  const j = await gmailFetch<{ id: string }>(`/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw, threadId: opts.threadId }),
  });
  return { id: j.id, signature: outcome };
}
