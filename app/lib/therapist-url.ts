import { slugify } from "@/app/lib/articles";

// Canonical, SEO-friendly path for a therapist profile: the name as a slug
// followed by the UUID (which remains the real key). Falls back to the bare
// UUID when there's no name.
export function therapistPath(id: string, name?: string | null): string {
  const slug = name ? slugify(name) : "";
  return slug ? `/therapists/${slug}-${id}` : `/therapists/${id}`;
}

// Just the route segment (no leading /therapists/), for comparing against the
// requested [id] param.
export function therapistSlug(id: string, name?: string | null): string {
  return therapistPath(id, name).replace("/therapists/", "");
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Extract the therapist UUID from a route param that may be either the bare
// UUID or a "<name-slug>-<uuid>" pretty path. Returns null if no UUID present.
export function extractTherapistId(param: string): string | null {
  let s = param;
  try {
    s = decodeURIComponent(param);
  } catch {
    /* keep raw */
  }
  const m = s.match(UUID_RE);
  return m ? m[0].toLowerCase() : null;
}
