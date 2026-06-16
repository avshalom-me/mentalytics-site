import "server-only";
import crypto from "crypto";

const SECRET = process.env.CRON_SECRET ?? "";

// `purpose` scopes the token so a stats-report unsubscribe link can't be used to
// remove someone from the newsletter and vice-versa. Empty purpose ("") keeps
// the LEGACY payload (`unsubscribe:<id>`) so stats links already in the wild
// stay valid. Newsletter links use purpose "newsletter".
function tokenPayload(therapistId: string, purpose: string): string {
  return purpose
    ? `unsubscribe:${purpose}:${therapistId}`
    : `unsubscribe:${therapistId}`;
}

export function generateUnsubscribeToken(therapistId: string, purpose = ""): string {
  if (!SECRET) {
    throw new Error("CRON_SECRET not set; cannot generate unsubscribe token");
  }
  return crypto
    .createHmac("sha256", SECRET)
    .update(tokenPayload(therapistId, purpose))
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(
  therapistId: string,
  token: string,
  purpose = "",
): boolean {
  if (!SECRET || !token || !therapistId) return false;
  let expected: string;
  try {
    expected = generateUnsubscribeToken(therapistId, purpose);
  } catch {
    return false;
  }
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

// Builds the unsubscribe link to embed in an email. For the newsletter pass
// purpose "newsletter"; the resulting link carries &type=newsletter so the
// unsubscribe page/route know which list to remove the recipient from.
export function buildUnsubscribeUrl(
  baseUrl: string,
  therapistId: string,
  purpose = "",
): string {
  const token = generateUnsubscribeToken(therapistId, purpose);
  const url = `${baseUrl}/therapists/unsubscribe?id=${therapistId}&token=${token}`;
  return purpose ? `${url}&type=${purpose}` : url;
}
