import { therapistPath } from "@/app/lib/therapist-url";

const BASE_URL = "https://www.mentalytics.co.il";

/**
 * The site's editorial author identity (E-E-A-T).
 *
 * Mental health is YMYL, so Google weighs *who* wrote a page heavily. Three
 * research pages already named him in their Article JSON-LD, but each emitted
 * a standalone Person node with no identifier - so from a crawler's side those
 * were three unrelated people who happen to share a name, and none of them was
 * connected to his profile on this site. A single `@id`, referenced from every
 * page he authored, is what turns that into one entity.
 *
 * The `@id` is anchored on his EXISTING therapist profile rather than a new
 * /team/... page. He is already listed here with credentials, education and an
 * article list, and minting a second URL for the same human would split the
 * very entity we are trying to consolidate.
 *
 * Still to fill once supplied (never invent these - a wrong identifier or a
 * profile URL that is not his is a false identity claim):
 *   - `identifier`: his Ministry of Health psychologist registry number
 *     (the site already shows these for other therapists, e.g. "מ.ר. 27-148029")
 *   - `sameAs`: real Google Scholar / ResearchGate / ORCID / LinkedIn URLs
 */
export const SITE_AUTHOR = {
  therapistId: "906837b9-dda5-49ad-995f-e6cc41d77aa5",
  name: 'ד"ר אבשלום גליל',
  alternateName: "Dr. Avshalom Galil",
  jobTitle: "פסיכולוג קליני וחינוכי מומחה-מדריך",
  /** Verified against app/about/page.tsx and his own profile record. */
  credentials: [
    "פסיכולוג קליני וחינוכי - מומחה מדריך",
    "דוקטורט בפסיכולוגיה קלינית ומדעי המוח, אוניברסיטת בר-אילן",
    "מרצה וחוקר באוניברסיטת אריאל",
    "מרצה לאבחון והערכה במוסדות אקדמאיים",
  ],
} as const;

export const SITE_AUTHOR_PATH = therapistPath(SITE_AUTHOR.therapistId, SITE_AUTHOR.name);
export const SITE_AUTHOR_URL = `${BASE_URL}${SITE_AUTHOR_PATH}`;

/** Stable entity id every authored page points at. */
export const SITE_AUTHOR_ID = `${SITE_AUTHOR_URL}#person`;

/**
 * The `author` value for an Article. A reference by `@id` - the full Person
 * node lives on the profile page itself, so the description is stated once.
 */
export function siteAuthorRef() {
  return {
    "@type": "Person",
    "@id": SITE_AUTHOR_ID,
    name: SITE_AUTHOR.name,
    alternateName: SITE_AUTHOR.alternateName,
    jobTitle: SITE_AUTHOR.jobTitle,
    url: SITE_AUTHOR_URL,
  };
}
