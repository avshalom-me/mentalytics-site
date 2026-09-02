/**
 * When each code-generated page's content last changed, and the files that
 * decide it.
 *
 * Pages backed by a database row carry a real timestamp (therapist profiles use
 * created_at, community articles updated_at, centers updated_at). These do not:
 * they are prose written in a .tsx file, so until now 42 of the sitemap's URLs
 * went out with no <lastmod> at all - every /research guide among them, which
 * is the strongest organic asset the site has. Without one, a corrected article
 * gives Googlebot no reason to come back and look at it.
 *
 * We already paid for this once. LANDING_COPY_REVISED sat at 10/8 while three
 * copy fixes shipped after it, the last being data-nosnippet on the therapist
 * cards (22/8). Googlebot re-crawled Jerusalem and not Haifa, so on 29/8 one
 * SERP showed our copy and the other still listed therapist names, with
 * identical HTML behind both. A comment saying "remember to bump this" did not
 * survive three commits, so scripts/check-page-revised.mjs now checks it on
 * every push: if any file in `sources` has a git commit newer than `date`, the
 * push fails and names the file.
 *
 * That is why `sources` exists - it is not documentation, it is the input to
 * the check. Adding a page here without listing what it is built from creates
 * an entry nothing can verify.
 *
 * A date, never `new Date()`: a lastmod that is always "today" is the pattern
 * Google learns to ignore, and then it is worth nothing when it matters.
 */
export type PageRevision = { date: string; sources: string[] };

export const PAGE_REVISED: Record<string, PageRevision> = {
  // Not a URL. The directory landing families - city, city+topic, region,
  // topic, specialty, assessment, arrangement, online, para-medical - are
  // generated from live data and share one set of template files, so they share
  // one revision date. This is the entry that was wrong on 29/8; it lives here
  // rather than as a lone constant in sitemap.ts so the same check covers it.
  "@landing-families": {
    date: "2026-08-22",
    sources: [
      "app/therapists/city/[city]/page.tsx",
      "app/therapists/city/[city]/[topic]/page.tsx",
      "app/therapists/region/[region]/page.tsx",
      "app/therapists/region/page.tsx",
      "app/therapists/topic/[topic]/page.tsx",
      "app/therapists/specialty/[specialty]/page.tsx",
      "app/therapists/assessment/[type]/page.tsx",
      "app/therapists/arrangement/[slug]/page.tsx",
      "app/therapists/online/[topic]/page.tsx",
      "app/therapists/online/page.tsx",
      "app/therapists/para-medical/page.tsx",
      "app/therapists/CitySeoSection.tsx",
      "app/components/TherapistResultCard.tsx",
      "app/lib/meta-description.ts",
      "app/lib/topics.ts",
    ],
  },
  "/": { date: "2026-09-02", sources: ["app/page.tsx"] },
  "/therapists": { date: "2026-08-22", sources: ["app/therapists/page.tsx", "app/therapists/TherapistsClient.tsx"] },
  "/research": { date: "2026-08-02", sources: ["app/research/page.tsx"] },
  "/research/academic": { date: "2026-08-05", sources: ["app/research/academic/page.tsx"] },
  "/research/adhd-adults": { date: "2026-08-30", sources: ["app/research/adhd-adults/page.tsx"] },
  "/research/assessments": { date: "2026-08-05", sources: ["app/research/assessments/page.tsx"] },
  "/research/autism-assessment": { date: "2026-08-30", sources: ["app/research/autism-assessment/page.tsx"] },
  "/research/btl": { date: "2026-08-06", sources: ["app/research/btl/page.tsx", "app/lib/btl-tracks.ts"] },
  "/research/btl/[track]": { date: "2026-08-06", sources: ["app/research/btl/[track]/page.tsx", "app/lib/btl-tracks.ts"] },
  "/research/cbt-vs-dynamic": { date: "2026-08-04", sources: ["app/research/cbt-vs-dynamic/page.tsx"] },
  "/research/child-emotional-developmental": { date: "2026-08-30", sources: ["app/research/child-emotional-developmental/page.tsx"] },
  "/research/choosing-therapist": { date: "2026-08-02", sources: ["app/research/choosing-therapist/page.tsx"] },
  "/research/faq": { date: "2026-08-05", sources: ["app/research/faq/page.tsx"] },
  "/research/how-matching-works": { date: "2026-08-22", sources: ["app/research/how-matching-works/page.tsx"] },
  "/research/jealousy-polyamory": { date: "2026-08-09", sources: ["app/research/jealousy-polyamory/page.tsx"] },
  "/research/kupa-guide": { date: "2026-08-02", sources: ["app/research/kupa-guide/page.tsx"] },
  "/research/online-therapy": { date: "2026-08-05", sources: ["app/research/online-therapy/page.tsx"] },
  "/research/psychodiagnostic": { date: "2026-08-30", sources: ["app/research/psychodiagnostic/page.tsx"] },
  "/research/psychodidactic": { date: "2026-08-04", sources: ["app/research/psychodidactic/page.tsx"] },
  "/research/recommended-psychologist": { date: "2026-08-04", sources: ["app/research/recommended-psychologist/page.tsx"] },
  "/research/social-anxiety": { date: "2026-08-02", sources: ["app/research/social-anxiety/page.tsx"] },
  "/research/therapist-patient-match": { date: "2026-08-04", sources: ["app/research/therapist-patient-match/page.tsx"] },
  "/research/therapist-types": { date: "2026-08-05", sources: ["app/research/therapist-types/page.tsx"] },
  "/research/therapy-for-child": { date: "2026-08-04", sources: ["app/research/therapy-for-child/page.tsx"] },
  "/research/therapy-types": { date: "2026-08-03", sources: ["app/research/therapy-types/page.tsx"] },
  "/research/topic/[topic]": { date: "2026-08-22", sources: ["app/research/topic/[topic]/page.tsx", "app/lib/article-taxonomy.ts"] },
  "/research/which-therapy": { date: "2026-08-03", sources: ["app/research/which-therapy/page.tsx"] },
  "/about": { date: "2026-08-20", sources: ["app/about/page.tsx"] },
  "/accessibility": { date: "2026-07-26", sources: ["app/accessibility/page.tsx"] },
  "/centers": { date: "2026-08-06", sources: ["app/centers/page.tsx"] },
  "/developers": { date: "2026-08-06", sources: ["app/developers/page.tsx"] },
  "/privacy": { date: "2026-07-26", sources: ["app/privacy/page.tsx"] },
  "/terms": { date: "2026-07-26", sources: ["app/terms/page.tsx"] },
};

/**
 * Dynamic families share one template file, so every concrete URL under them
 * resolves to the same entry. `/research/btl` itself is a real hub page with
 * its own entry and must not fall through here - hence the required segment.
 */
function templateKey(route: string): string {
  if (/^\/research\/btl\/[^/]+$/.test(route)) return "/research/btl/[track]";
  if (/^\/research\/topic\/[^/]+$/.test(route)) return "/research/topic/[topic]";
  return route;
}

/** The lastmod for a page in PAGE_REVISED, or undefined if it is not listed. */
export function revisedAt(route: string): Date | undefined {
  const e = PAGE_REVISED[route] ?? PAGE_REVISED[templateKey(route)];
  return e ? new Date(e.date) : undefined;
}
