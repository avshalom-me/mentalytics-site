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
 * `sameAs` is still empty on purpose. It is for *profile* pages of the same
 * person (Google Scholar, ORCID, ResearchGate, LinkedIn) - not for the papers
 * themselves, which are works he authored and live under PUBLICATIONS below.
 * A Scholar or ORCID profile URL would be the single most useful addition here.
 */
export const SITE_AUTHOR = {
  therapistId: "906837b9-dda5-49ad-995f-e6cc41d77aa5",
  name: 'ד"ר אבשלום גליל',
  alternateName: "Dr. Avshalom Galil",
  jobTitle: "פסיכולוג קליני וחינוכי מומחה-מדריך",
  /** Ministry of Health psychologist registry number. */
  licenseNumber: "27-131094",
  /** Verified against app/about/page.tsx and his own profile record. */
  credentials: [
    "פסיכולוג קליני וחינוכי - מומחה מדריך",
    "דוקטורט בפסיכולוגיה קלינית ומדעי המוח, אוניברסיטת בר-אילן",
    "מרצה וחוקר באוניברסיטת אריאל",
    "מרצה לאבחון והערכה במוסדות אקדמאיים",
  ],
} as const;

/**
 * Peer-reviewed publications. Metadata verified against CrossRef by DOI, not
 * transcribed from the links - a citation that misstates the journal or year is
 * worse than no citation on a YMYL page.
 *
 * These are the strongest expertise signal the site has: a clinical psychologist
 * with first-author papers in indexed journals is exactly the "who wrote this"
 * that Google's raters look for, and no Israeli competitor shows it.
 */
export const SITE_AUTHOR_PUBLICATIONS = [
  {
    title: "Cheating behavior in children: Integrating gaze allocation and social awareness",
    journal: "Journal of Experimental Child Psychology",
    year: 2019,
    doi: "10.1016/j.jecp.2018.08.013",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0022096518301474",
  },
  {
    title: "Cognitive strategies for managing cheating: The roles of cognitive abilities in managing moral transgressions",
    journal: "Psychonomic Bulletin & Review",
    year: 2021,
    doi: "10.3758/s13423-021-01936-7",
    url: "https://link.springer.com/article/10.3758/s13423-021-01936-7",
  },
  {
    title: "Encountering Bias: Examining Biases and Stereotypes in the Evaluation Process Among Experts",
    journal: "Psychological Reports",
    year: 2024,
    doi: "10.1177/00332941241269485",
    url: "https://journals.sagepub.com/doi/abs/10.1177/00332941241269485",
  },
] as const;

export const SITE_AUTHOR_PATH = therapistPath(SITE_AUTHOR.therapistId, SITE_AUTHOR.name);
export const SITE_AUTHOR_URL = `${BASE_URL}${SITE_AUTHOR_PATH}`;

/** Stable entity id every authored page points at. */
export const SITE_AUTHOR_ID = `${SITE_AUTHOR_URL}#person`;

/**
 * The `author` value for an Article. A reference by `@id` - the full Person
 * node lives on the profile page itself, so the description is stated once.
 */
/**
 * Extra Person fields for the profile page when the profile IS the site author.
 *
 * The Latin-script name matters more here than anywhere else: this is the node
 * the `@id` resolves to, so it is where Google reads the entity's identity.
 * Without it the graph knew "Dr. Avshalom Galil" only from the article
 * references and never from the entity itself - and academic profiles (Scholar,
 * ORCID, ResearchGate) are all indexed under the Latin spelling.
 */
export function siteAuthorProfileFields(therapistId: string) {
  if (therapistId !== SITE_AUTHOR.therapistId) return {};
  return {
    alternateName: SITE_AUTHOR.alternateName,
    alumniOf: { "@type": "CollegeOrUniversity", name: "אוניברסיטת בר-אילן" },
    // The registry number as a typed identifier rather than loose text, so the
    // claim "licensed psychologist" is machine-checkable against the registry.
    identifier: {
      "@type": "PropertyValue",
      propertyID: "מספר רישום בפנקס הפסיכולוגים",
      value: SITE_AUTHOR.licenseNumber,
    },
    // The papers as works authored by this entity. Not sameAs: a journal article
    // is something he wrote, not another page that *is* him.
    "@reverse": {
      author: SITE_AUTHOR_PUBLICATIONS.map((p) => ({
        "@type": "ScholarlyArticle",
        headline: p.title,
        name: p.title,
        datePublished: String(p.year),
        isPartOf: { "@type": "Periodical", name: p.journal },
        identifier: { "@type": "PropertyValue", propertyID: "DOI", value: p.doi },
        url: p.url,
      })),
    },
  };
}

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
