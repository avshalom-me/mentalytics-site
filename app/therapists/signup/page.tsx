import { redirect } from "next/navigation";

// The standalone public signup form was replaced by the account-based flow
// (register → login → dashboard → edit, via the authenticated
// /api/therapist-profile). Its old POST endpoint - public, unauthenticated,
// service-role, unrate-limited - was decommissioned. Keep this path working by
// sending any visitor to the live funnel.
export default function TherapistSignupPage() {
  redirect("/therapists/join");
}
