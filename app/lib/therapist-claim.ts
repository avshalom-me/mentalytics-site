import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

/**
 * Find an UNCLAIMED therapist row whose email matches, that is SAFE to
 * auto-associate with a freshly-registered account.
 *
 * SECURITY: email confirmation is not enforced at signup (accounts are
 * auto-confirmed), so the address on the auth user is NOT proof of ownership.
 * If we auto-linked any matching row, whoever registered first with a given
 * email could seize that profile. We therefore refuse to hand over a LIVE
 * profile - one that is admin_approved, or already approved/paying - because
 * taking it over is a full account takeover (edit a live, paying, publicly
 * listed profile). Live profiles must be linked to their owner by an admin
 * explicitly. Only unclaimed, not-yet-live rows are eligible for auto-claim
 * (the legitimate "admin pre-added your pending profile, now claim it" flow).
 *
 * CENTER-OWNED PROFILES ARE NEVER CLAIMABLE: a profile created by a therapy
 * center from the center portal (center_account_id set, user_id null) is
 * managed exclusively by the center's managers and intentionally has no
 * therapist login. Without this exclusion, anyone registering with the
 * profile's (unverified) email address would seize a center's therapist
 * profile - and once the center's subscription promotes it into matching,
 * the attacker controls a live promoted profile.
 *
 * @param columns  columns to select on the matched row (default "id")
 * @returns the eligible row, or null when there is no safe match
 */
export async function findClaimableTherapistByEmail(
  email: string | null | undefined,
  columns = "id",
): Promise<Record<string, unknown> | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("therapists")
    .select(columns)
    .eq("email", email)
    .is("user_id", null)
    .is("center_account_id", null)
    .not("admin_approved", "is", true)
    .not("status", "in", "(approved,paying)")
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}
