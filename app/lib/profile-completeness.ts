// Single source of truth for "what is missing from a therapist profile".
// Pure + isomorphic: used by the admin page (to badge / count), the per-
// therapist "request completion" action, and the bulk completion mailer.

export type ProfileLike = {
  full_name?: string | null;
  profile_photo_path?: string | null;
  regions?: string[] | null;
  therapist_types?: string[] | null;
  training_areas?: string[] | null;
};

function hasLastName(fullName?: string | null): boolean {
  return !!fullName && fullName.trim().split(/\s+/).filter(Boolean).length >= 2;
}

/** Hebrew labels of the profile fields a therapist still needs to provide.
 *  Empty array → the profile is complete. */
export function missingProfileFields(t: ProfileLike, hasCertificate: boolean): string[] {
  const missing: string[] = [];
  if (!hasLastName(t.full_name)) missing.push("שם משפחה");
  if (!hasCertificate) missing.push("תעודת רישיון / אישור מקצועי");
  if (!t.profile_photo_path) missing.push("תמונת פרופיל");
  if (!t.regions || t.regions.length === 0) missing.push("אזורי טיפול (גיאוגרפיה)");
  if (!t.therapist_types || t.therapist_types.length === 0) missing.push("סוג מטפל");
  if (!t.training_areas || t.training_areas.length === 0) missing.push("תחומי טיפול");
  return missing;
}
