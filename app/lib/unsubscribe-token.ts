import "server-only";
import crypto from "crypto";

const SECRET = process.env.CRON_SECRET ?? "";

export function generateUnsubscribeToken(therapistId: string): string {
  if (!SECRET) {
    throw new Error("CRON_SECRET not set; cannot generate unsubscribe token");
  }
  return crypto
    .createHmac("sha256", SECRET)
    .update(`unsubscribe:${therapistId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(therapistId: string, token: string): boolean {
  if (!SECRET || !token || !therapistId) return false;
  let expected: string;
  try {
    expected = generateUnsubscribeToken(therapistId);
  } catch {
    return false;
  }
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function buildUnsubscribeUrl(baseUrl: string, therapistId: string): string {
  const token = generateUnsubscribeToken(therapistId);
  return `${baseUrl}/therapists/unsubscribe?id=${therapistId}&token=${token}`;
}
