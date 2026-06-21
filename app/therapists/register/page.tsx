import { redirect } from "next/navigation";

// The plan-comparison/registration content was merged into /therapists/join,
// and the plan choice now happens after profile submission (in the dashboard).
// This route is kept as a redirect so existing links/bookmarks still work.
export default function TherapistRegisterPage() {
  redirect("/therapists/join");
}
