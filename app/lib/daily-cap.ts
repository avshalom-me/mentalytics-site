import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

/**
 * One site-wide counter per key per UTC day, kept in the database.
 *
 * The public explanation buttons call a paid model on every press, and their
 * only ceiling was a per-address counter in the memory of one serverless
 * instance - a caller spread over addresses or cold starts never met it. This
 * is the number that holds across instances: the migration's
 * bump_daily_counter() increments atomically and returns the new count.
 *
 * Fails open, like bumpAndCheckIpDaily: a counter that cannot be read must not
 * switch a public feature off because of a transient database error. It is
 * logged so the night watch can see it. A cap of 0 or less disables the check.
 */
export async function underDailyCap(key: string, cap: number): Promise<boolean> {
  if (!(cap > 0)) return true;
  const { data, error } = await supabaseAdmin.rpc("bump_daily_counter", { p_key: key });
  if (error) {
    console.error(`underDailyCap(${key}): bump_daily_counter failed:`, error.message);
    return true;
  }
  return typeof data === "number" ? data <= cap : true;
}
