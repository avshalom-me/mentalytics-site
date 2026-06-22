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
// `count` is the max across the IP row and the fp row so a user can't reset
// by rotating one identifier alone.
export async function getUsage(
  ip: string,
  fp: string | null,
  type: string
): Promise<UsageStatus> {
  const identifiers = identifiersFor(ip, fp);
  const { data } = await supabase
    .from("quiz_usage")
    .select("count")
    .in("ip", identifiers)
    .eq("quiz_type", type);

  const count = (data ?? []).reduce((m, r) => Math.max(m, r.count), 0);
  const limit = MAX_FREE + (await getPaidCredits(fp));
  return { count, limit, allowed: count < limit, paymentRequired: count >= limit };
}

// Increment usage for all identifiers to max+1. Call this only after a
// request has been permitted (count < limit) and a result is being served.
export async function consumeUsage(
  ip: string,
  fp: string | null,
  type: string
): Promise<void> {
  const current = await getUsage(ip, fp, type);
  const newCount = current.count + 1;
  const now = new Date().toISOString();

  for (const id of identifiersFor(ip, fp)) {
    await supabase.from("quiz_usage").upsert(
      { ip: id, quiz_type: type, count: newCount, updated_at: now },
      { onConflict: "ip,quiz_type" }
    );
  }
}
