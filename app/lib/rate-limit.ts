import "server-only";

/**
 * Per-IP rate limiting for public write endpoints.
 *
 * The urgent case is /api/contact: every submission sends a real email through
 * Resend, whose free tier allows 100 sends a day for the whole site. With no
 * ceiling, a trivial loop drains that allowance in minutes and then everything
 * else that needs mail stops working for the rest of the day - patient messages
 * to therapists, registration confirmations, the monthly reports. The damage is
 * an outage of a business channel, not a noisy inbox.
 *
 * Deliberately in-memory. Serverless means each instance keeps its own counter,
 * so a distributed attacker spread across many cold starts sees a higher
 * effective limit than the number below. That is fine for the threat this
 * addresses - a single script hammering one endpoint - and it costs no
 * dependency and no database round trip on the happy path. Move to a shared
 * store only if abuse ever proves distributed.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Map<string, Bucket>>();

/** Stops a long-lived instance's map from growing without bound. */
function sweep(m: Map<string, Bucket>, now: number) {
  if (m.size < 5_000) return;
  for (const [k, v] of m) if (now > v.resetAt) m.delete(k);
}

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Claims one slot for `ip` under `name`. Returns ok:false once `limit` requests
 * have been made inside `windowMs`, with the seconds left until the window
 * resets so the caller can send a Retry-After header.
 */
export function rateLimit(
  name: string,
  ip: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let m = buckets.get(name);
  if (!m) {
    m = new Map();
    buckets.set(name, m);
  }
  sweep(m, now);

  const entry = m.get(ip);
  if (!entry || now > entry.resetAt) {
    m.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (entry.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count++;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * Caller IP. x-forwarded-for is a client-settable header, but on Vercel the
 * platform overwrites it, so the leftmost entry is the real client there. A
 * spoofed value can only ever move an attacker between buckets - it cannot
 * raise any single bucket's ceiling.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 429 with Retry-After, in the shape these routes already return. */
export function tooManyRequests(retryAfterSeconds: number, message: string) {
  return Response.json(
    { ok: false, error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
