import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-side quiz usage tracking + free-tier enforcement.
// Single source of truth shared by /api/usage/check, the questionnaire
// score routes, and anywhere else that needs to gate on the free limit.
// Uses the service-role key — server-only, never import into client code.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const MAX_FREE = 5;

// Coarse per-IP daily ceiling on FREE scored quizzes. Backstops the
// fingerprint-rotation bypass: the free tier is keyed on a client-minted
// fingerprint, so a script sending a fresh random _fp per request would
// otherwise get unlimited free results. This caps free serves per IP per UTC
// day regardless of fingerprint. Set to 0 to disable (default is a generous
// value chosen to sit well above this site's realistic per-IP legit traffic —
// raise it via QUIZ_FREE_IP_DAILY_CAP if CGNAT users ever hit it). Never
// applied to paid users or to "unknown" IPs.
export const FREE_IP_DAILY_CAP = Number(process.env.QUIZ_FREE_IP_DAILY_CAP ?? 40);

const FP_REGEX = /^[a-f0-9]{64}$/;

export function cleanFp(fp: unknown): string | null {
  if (typeof fp !== "string") return null;
  return FP_REGEX.test(fp) ? fp : null;
}

export function getIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Staff escape hatch. The token lives only in STAFF_BYPASS_TOKEN (server env)
// and travels from the ?staff= URL param into the request — it is never
// shipped in the client bundle. Bypass is granted only when the env is set
// AND matches, so a leaked/blank env can never open the gate.
export function isStaffBypass(token: unknown): boolean {
  const secret = process.env.STAFF_BYPASS_TOKEN;
  return typeof secret === "string" && secret.length > 0 && token === secret;
}

function identifiersFor(ip: string, fp: string | null): string[] {
  const ids = [ip];
  if (fp) ids.push(`fp:${fp}`);
  return ids;
}

async function getPaidCredits(fp: string | null): Promise<number> {
  if (!fp) return 0;
  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("payment_type", "quiz")
    .eq("reference_id", `fp:${fp}`)
    .eq("status", "completed");
  return count ?? 0;
}

export type UsageStatus = {
  count: number;
  limit: number;
  allowed: boolean;
  paymentRequired: boolean;
};

// Read the current usage for an IP+fingerprint without mutating anything.
// The fingerprint is a stable per-device identifier; the raw IP is NOT — in
// Israel the mobile carriers put many users behind a small pool of CGNAT /
// dynamic IPs, so counting by IP falsely blocks a first-time visitor whose
// shared IP was already exhausted by other people. We therefore gate on the
// fingerprint whenever we have one, and fall back to the IP only when no
// fingerprint is available (e.g. crypto.subtle missing in an old browser).
export async function getUsage(
  ip: string,
  fp: string | null,
  type: string
): Promise<UsageStatus> {
  const identifiers = identifiersFor(ip, fp);
  const { data } = await supabase
    .from("quiz_usage")
    .select("ip, count")
    .in("ip", identifiers)
    .eq("quiz_type", type);

  const rows = data ?? [];
  const fpKey = fp ? `fp:${fp}` : null;
  const count = fpKey
    ? rows.find((r) => r.ip === fpKey)?.count ?? 0
    : rows.reduce((m, r) => Math.max(m, r.count), 0);

  const limit = MAX_FREE + (await getPaidCredits(fp));
  return { count, limit, allowed: count < limit, paymentRequired: count >= limit };
}

// Increment usage for all identifiers by one. Call this only after a request
// has been permitted (count < limit) and a result is being served.
//
// Uses an atomic SQL increment (increment_quiz_usage RPC) rather than a JS
// read-modify-write: the previous version read the count then wrote count+1,
// so two concurrent /score requests both read N and both wrote N+1 — the pair
// advanced the counter by 1 instead of 2, letting a user shave free runs by
// firing requests in parallel. The RPC does `count = count + 1` in the
// database, so concurrent calls compose correctly.
export async function consumeUsage(
  ip: string,
  fp: string | null,
  type: string
): Promise<void> {
  const { error } = await supabase.rpc("increment_quiz_usage", {
    p_ids: identifiersFor(ip, fp),
    p_type: type,
  });
  if (error) {
    // The result has already been produced; a counter failure shouldn't 500
    // the request. Log for visibility rather than throwing.
    console.error("consumeUsage: increment_quiz_usage failed:", error.message);
  }
}

// Coarse per-IP daily backstop against fingerprint-rotation abuse of the free
// tier. Atomically bumps the IP's daily attempt counter and returns whether
// the IP is still at/under FREE_IP_DAILY_CAP. Fails OPEN (returns true) on a
// disabled cap, an "unknown" IP, or any RPC error — a coarse abuse limit must
// never block a legitimate user because of a transient counter failure. Call
// this only for genuinely free serves; paid users must bypass it at the call
// site.
export async function bumpAndCheckIpDaily(ip: string): Promise<boolean> {
  if (FREE_IP_DAILY_CAP <= 0 || !ip || ip === "unknown") return true;
  const { data, error } = await supabase.rpc("bump_quiz_ip_daily", { p_ip: ip });
  if (error) {
    console.error("bumpAndCheckIpDaily: bump_quiz_ip_daily failed:", error.message);
    return true;
  }
  return typeof data === "number" ? data <= FREE_IP_DAILY_CAP : true;
}
