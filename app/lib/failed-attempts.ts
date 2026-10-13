import "server-only";

/**
 * A counter of FAILED attempts per key, for guessing attacks on a secret that
 * has no account around it (the staff PIN).
 *
 * rateLimit() counts every request, which a clock-in page makes several times
 * a minute for one person; it cannot be tight enough to stop a guesser without
 * stopping the people. This counts only the failures, so a tight limit costs a
 * legitimate user nothing: five wrong codes in a quarter of an hour are a
 * mistyping streak nobody has, and a 4-digit code has 10,000 possibilities.
 *
 * In memory, per instance, like rateLimit() - and the same caveat applies.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Map<string, Bucket>>();

function bucketsFor(name: string): Map<string, Bucket> {
  let m = buckets.get(name);
  if (!m) {
    m = new Map();
    buckets.set(name, m);
  }
  if (m.size >= 5_000) {
    const now = Date.now();
    for (const [k, v] of m) if (now > v.resetAt) m.delete(k);
  }
  return m;
}

/** True once `key` has recorded `limit` failures inside the current window. */
export function lockedOut(name: string, key: string, limit: number): boolean {
  const entry = bucketsFor(name).get(key);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= limit;
}

/** Records one failure for `key`; the window starts at the first failure. Returns the count. */
export function recordFailure(name: string, key: string, windowMs: number): number {
  const m = bucketsFor(name);
  const now = Date.now();
  const entry = m.get(key);
  if (!entry || now > entry.resetAt) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count++;
  return entry.count;
}

/** Test seam: forget every failure. */
export function resetFailures(): void {
  buckets.clear();
}
