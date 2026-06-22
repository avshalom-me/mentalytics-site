import { supabaseAdmin } from "./supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only when `pid` is a real, completed payment of the given type.
 *
 * Used to gate the GA4 conversion events on the success pages: those pages are
 * plain URLs, so a direct/bookmarked/refreshed/shared visit (or a JS-running
 * crawler) would otherwise fire a fake ₪30 / ₪140 conversion on page load. We
 * only count the conversion when the redirect carried the id of a payment row
 * that actually completed.
 */
export async function isCompletedPayment(
  pid: string | undefined,
  paymentType: "quiz" | "subscription"
): Promise<boolean> {
  if (!pid || !UUID_RE.test(pid)) return false;
  const { data } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("id", pid)
    .eq("payment_type", paymentType)
    .eq("status", "completed")
    .maybeSingle();
  return Boolean(data);
}
