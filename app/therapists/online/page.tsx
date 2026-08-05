import { redirect } from "next/navigation";

// /therapists/online has no content of its own - the online hub lives at
// /therapists/region/אונליין (established URL, already indexed). This route
// exists only so the parent path of the online×topic pages never 404s.
export default function OnlineIndexRedirect() {
  // Percent-encoded: this becomes an HTTP Location header, which must be
  // ASCII - the raw Hebrew form throws ERR_INVALID_CHAR and 500s the route.
  redirect(`/therapists/region/${encodeURIComponent("אונליין")}`);
}
