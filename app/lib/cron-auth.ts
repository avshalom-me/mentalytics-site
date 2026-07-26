import "server-only";
import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

// Constant-time Bearer check for cron routes. Fails closed when CRON_SECRET is
// unset. Same pattern the payment crons (cleanup-pending-payments,
// sumit-status-sync) already use - shared here so the report crons stop using a
// plain `!==`, which is a (minor) timing side-channel on the secret.
export function cronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
