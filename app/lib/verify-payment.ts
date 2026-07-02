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

/**
 * Like isCompletedPayment, but returns the actual charged base amount so the
 * GA4 conversion reports the real value (e.g. ₪90 for an early-bird promo, not a
 * hardcoded ₪140). Returns null when the payment isn't a real completed one.
 */
export async function getCompletedPaymentAmount(
  pid: string | undefined,
  paymentType: "quiz" | "subscription"
): Promise<number | null> {
  if (!pid || !UUID_RE.test(pid)) return null;
  const { data } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("id", pid)
    .eq("payment_type", paymentType)
    .eq("status", "completed")
    .maybeSingle();
  if (!data || data.amount == null) return null;
  const amount = Number(data.amount);
  return Number.isFinite(amount) ? amount : null;
}
