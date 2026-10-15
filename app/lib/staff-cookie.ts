/**
 * The staff browser cookie.
 *
 * Staff mode used to live in one place only: a code in the browser's
 * localStorage, put there by a button (or a ?staff= link) and sent along with
 * each questionnaire request. A browser that never pressed the button, or that
 * cleared its site data, met the free-attempts wall again - which is what kept
 * happening to the owner's own browser (12-15/10/2026).
 *
 * Now the admin gate does it: every request to an /admin page that passes the
 * password check also sets this cookie, for a year, renewed at each visit. So a
 * browser that is logged in to the admin is a staff browser - nothing to press,
 * nothing to remember - and the questionnaire routes recognise it on the
 * server. It cannot be forged: the value is an HMAC of a fixed label under
 * STAFF_BYPASS_TOKEN, so the token itself never leaves the server, and
 * rotating the token switches every staff cookie off at once.
 *
 * No imports and no "server-only": the Edge middleware sets the cookie and the
 * Node routes read it, with Web Crypto in both.
 */

export const STAFF_COOKIE = "mnt_staff";
/** One year, renewed on every admin page request. */
export const STAFF_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const LABEL = "mentalytics-staff-browser-v1";
const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Equal-length strings compared without stopping at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * The value a staff browser carries, or null when the server has no staff
 * token - without one there is no staff mode at all, exactly as isStaffBypass
 * never accepts an empty token.
 */
export async function staffCookieValue(secret: string | undefined = process.env.STAFF_BYPASS_TOKEN): Promise<string | null> {
  if (typeof secret !== "string" || secret.length === 0) return null;
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(LABEL)));
}

/** Whether a cookie value is the staff value. */
export async function isStaffCookieValue(value: string | null | undefined, secret?: string): Promise<boolean> {
  if (!value) return false;
  const expected = await staffCookieValue(secret ?? process.env.STAFF_BYPASS_TOKEN);
  return expected !== null && constantTimeEqual(value, expected);
}

/** Whether a request carries the staff cookie (NextRequest, or anything with the same cookies.get). */
export async function hasStaffCookie(req: { cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  return isStaffCookieValue(req.cookies.get(STAFF_COOKIE)?.value);
}
