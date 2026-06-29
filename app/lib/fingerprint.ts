// Stable per-browser identifier used to gate the free-quiz limit.
//
// We deliberately do NOT use a device-characteristics fingerprint as the
// primary id. Those collide heavily — e.g. every Israeli iPhone on Safari
// produces a near-identical hash (same screen, Hebrew, Israel timezone, and
// Safari hides deviceMemory / caps hardwareConcurrency). That made brand-new
// users inherit strangers' usage counts and get falsely asked to pay on their
// first run. Instead we mint a random id once and persist it in localStorage:
// unique per browser, zero collisions, survives reloads. The free tier is
// low-stakes (₪30), so a clearable id is plenty — clearing storage / incognito
// just grants a fresh allowance, which is an acceptable trade.
//
// Output stays a 64-char hex string so the server's existing fp validation
// (cleanFp) and the quiz_usage storage format are unchanged.

const STORAGE_KEY = "mx_uid";
const HEX64 = /^[a-f0-9]{64}$/;

function randomId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getFingerprint(): Promise<string> {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && HEX64.test(existing)) return existing;
    const id = randomId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // localStorage unavailable (rare hardened privacy modes) — fall back to a
    // device hash so we still send *some* stable-ish id rather than nothing.
    return deviceHash();
  }
}

async function deviceHash(): Promise<string> {
  const parts = [
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? "",
    (navigator as any).deviceMemory ?? "",
    navigator.maxTouchPoints ?? 0,
    navigator.platform,
  ];

  const raw = parts.join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
