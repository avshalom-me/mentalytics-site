// Single source of truth for the newsletter consent wording.
//
// The SAME string is rendered in the signup form AND stored as the snapshot in
// consent_events.consent_text, so the legal record always matches exactly what
// the therapist saw. If you change the wording, bump NEWSLETTER_CONSENT_VERSION
// — old records keep their original text + version, new ones get the new pair.

export const NEWSLETTER_CONSENT_VERSION = "v1-2026-06";

export const NEWSLETTER_CONSENT_TEXT =
  'אני מעוניין/ת לקבל מידע אינפורמטיבי, מאמרים וחומרים מקצועיים מ"טיפול חכם". ללא פרסום שאינו קשור לפלטפורמה.';
