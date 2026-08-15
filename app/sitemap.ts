import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ALL_REGIONS, regionToSlug, ONLINE_SLUG, CITY_SEO_LIST } from "@/app/lib/regions";
import { therapistPath } from "@/app/lib/therapist-url";
import { loadListedCounts, MIN_LISTED_FOR_INDEX, cityIsIndexable } from "@/app/lib/therapist-directory";
import { SPECIALTY_LIST, specialtyToSlug } from "@/app/lib/specialties";
import { TOPICS, PILOT_CITIES, MIN_CITY_TOPIC, CITY_TOPIC_SLUGS, CITY_TOPIC_APPROACHES, slugToCityTopic, onlineTopicSlugs, MIN_ONLINE_TOPIC } from "@/app/lib/topics";
import { listPublicCenters } from "@/app/lib/center-public";
import { SECTIONS, editorialBySection, sectionForTopic, MIN_ARTICLES_FOR_SECTION_INDEX } from "@/app/lib/article-taxonomy";
import { ASSESSMENTS } from "@/app/lib/assessments";
import { ARRANGEMENT_PAGES } from "@/app/lib/arrangements";
import { BTL_TRACKS } from "@/app/lib/btl-tracks";

const BASE = "https://www.mentalytics.co.il";

// Served from cache, regenerated at most hourly (ISR). Newly-approved
// therapists still enter without a redeploy - just within the hour instead of
// instantly, which no crawler can tell apart. The previous force-dynamic
// version recomputed everything per request and took 26+ seconds in production
// (caught by the night watchdog on 15/8/2026) - long enough for Googlebot to
// abandon the fetch, which is the worst possible trade for one-second
// freshness nobody observes.
export const revalidate = 3600;

/**
 * When the copy on the directory landing pages (city / region / topic /
 * specialty / assessment / arrangement / online) last changed.
 *
 * Therapist profiles and community articles carry a real per-row timestamp;
 * these pages are generated from code, so until now half the sitemap went out
 * with no <lastmod> at all - and Google had no reason to re-crawl after a copy
 * fix. That is exactly what happened to the city descriptions rewritten on
 * 6/8/2026: four days later the Haifa SERP snippet was still the pre-fix text.
 *
 * BUMP THIS when the landing-page copy or template actually changes. Do not
 * wire it to `new Date()` - a lastmod that is always "today" is the pattern
 * Google learns to ignore, and then it is worth nothing when it matters.
 */
const LANDING_COPY_REVISED = new Date("2026-08-10");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: "weekly" },
    // /adults and /kids are deliberately absent: both are noindex (they are the
    // quiz flow, not landing pages - see app/adults/layout.tsx). Listing a
    // noindex URL here only earns "submitted URL marked noindex" in Search
    // Console and wastes crawl budget.
    { url: `${BASE}/therapists`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${BASE}/research`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/research/therapist-patient-match`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/research/online-therapy`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/which-therapy`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/therapy-for-child`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/cbt-vs-dynamic`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/adhd-adults`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/therapy-types`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/therapist-types`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/choosing-therapist`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/kupa-guide`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/research/recommended-psychologist`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/research/faq`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/assessments`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/psychodiagnostic`, priority: 0.6, changeFrequency: "monthly" },
    // Deep guide - targets "אבחון פסיכודידקטי מחיר" and its long tail, a niche
    // where no large portal ranks (see docs/seo-week-plan-2026-08.md, day 4).
    { url: `${BASE}/research/psychodidactic`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE}/research/social-anxiety`, priority: 0.7, changeFrequency: "monthly" },
    // Guest article by Dr Daniel Heiman, from his doctoral research.
    { url: `${BASE}/research/jealousy-polyamory`, priority: 0.7, changeFrequency: "monthly" },
    // National-insurance entitlement cluster: hub + one page per track.
    { url: `${BASE}/research/btl`, priority: 0.7, changeFrequency: "monthly" },
    ...BTL_TRACKS.map((t) => ({
      url: `${BASE}/research/btl/${t.slug}`,
      priority: 0.6,
      changeFrequency: "monthly" as const,
    })),
    { url: `${BASE}/research/autism-assessment`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/child-emotional-developmental`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/academic`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE}/centers`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/about`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE}/developers`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/terms`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${BASE}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${BASE}/accessibility`, priority: 0.3, changeFrequency: "yearly" },
  ];

  // Four independent data sources, fetched concurrently. Every indexability
  // count below comes from the ONE query inside loadListedCounts() - the
  // sitemap makes 4 DB round-trips total, not one per landing page.
  const [{ data }, { data: articles }, counts, centers] = await Promise.all([
    supabaseAdmin
      .from("therapists")
      .select("id, created_at, full_name")
      .in("status", ["approved", "paying"])
      .eq("admin_approved", true)
      .neq("entity_type", "center"), // ישות-מרכז אינה עמוד מטפל ציבורי
    supabaseAdmin
      .from("therapist_articles")
      .select("slug, updated_at, topic")
      .eq("status", "approved"),
    loadListedCounts(),
    listPublicCenters(),
  ]);

  const therapistPages: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
    url: `${BASE}${therapistPath(t.id, t.full_name)}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
    lastModified: t.created_at ? new Date(t.created_at) : undefined,
  }));

  const articlePages: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${BASE}/research/community/${a.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
    lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
  }));

  // Article-section hubs. Same thin gate the pages themselves apply: a section
  // holding fewer than MIN_ARTICLES_FOR_SECTION_INDEX items is noindex, so
  // listing it here would only produce "submitted URL marked noindex".
  const communityBySection = new Map<string, number>();
  for (const a of (articles ?? []) as { topic?: string | null }[]) {
    const s = sectionForTopic(a.topic ?? null);
    if (s) communityBySection.set(s.slug, (communityBySection.get(s.slug) ?? 0) + 1);
  }
  const sectionPages: MetadataRoute.Sitemap = SECTIONS.filter(
    (s) => editorialBySection(s.slug).length + (communityBySection.get(s.slug) ?? 0) >= MIN_ARTICLES_FOR_SECTION_INDEX
  ).map((s) => ({
    url: `${BASE}/research/topic/${s.slug}`,
    priority: 0.6,
    changeFrequency: "weekly" as const,
  }));

  // Region + online landing pages (and the region hub) + the para-medical rubric.
  // Only region/city pages that have enough listed therapists are included -
  // near-empty ones are noindex, so listing them here would only produce
  // "submitted URL marked noindex" warnings and waste crawl budget. They rejoin
  // the sitemap automatically once they fill up (regenerated hourly).
  const { regions: regionCounts, cities: cityCounts, cityPools, specialties: specialtyCounts } = counts;
  const regionPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/therapists/para-medical`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/region`, priority: 0.7, changeFrequency: "weekly" as const },
    // Hubs for the specialty/topic families - previously only the individual
    // pages existed, so there was no crawl path into them from the site.
    { url: `${BASE}/therapists/specialty`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/topic`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/assessment`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/arrangement`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/region/${ONLINE_SLUG}`, priority: 0.7, changeFrequency: "weekly" as const },
    ...ALL_REGIONS.filter((region) => (regionCounts[region] ?? 0) >= MIN_LISTED_FOR_INDEX).map((region) => ({
      url: `${BASE}/therapists/region/${regionToSlug(region)}`,
      priority: 0.7,
      changeFrequency: "weekly" as const,
    })),
    ...CITY_SEO_LIST.filter((city) => cityIsIndexable(city, cityCounts[city] ?? 0, cityPools[city] ?? 0)).map((city) => ({
      url: `${BASE}/therapists/city/${regionToSlug(city)}`,
      priority: 0.6,
      changeFrequency: "weekly" as const,
    })),
    // Specialty landing pages - same populated-enough gate as regions/cities.
    ...SPECIALTY_LIST.filter((s) => (specialtyCounts[s] ?? 0) >= MIN_LISTED_FOR_INDEX).map((s) => ({
      url: `${BASE}/therapists/specialty/${specialtyToSlug(s)}`,
      priority: 0.6,
      changeFrequency: "weekly" as const,
    })),
  ];

  // Topic (condition/audience) pages + the city×topic pilot - only combos with
  // real supply enter the sitemap (the anti-doorway discipline).
  const topicPages: MetadataRoute.Sitemap = [];
  for (const topic of TOPICS) {
    if (topic.adsOnly) continue;
    const count = counts.count(topic.filter);
    if (count >= MIN_LISTED_FOR_INDEX) {
      topicPages.push({
        url: `${BASE}/therapists/topic/${topic.slug}`,
        priority: 0.6,
        changeFrequency: "weekly" as const,
      });
    }
  }
  // Assessment landing pages - same supply gate.
  for (const a of ASSESSMENTS) {
    const count = counts.count({ assessmentType: a.value });
    if (count >= MIN_LISTED_FOR_INDEX) {
      topicPages.push({
        url: `${BASE}/therapists/assessment/${a.slug}`,
        priority: 0.6,
        changeFrequency: "weekly" as const,
      });
    }
  }

  // Funding-route pages - same supply gate.
  for (const a of ARRANGEMENT_PAGES) {
    const count = counts.count({ arrangement: a.value });
    if (count >= MIN_LISTED_FOR_INDEX) {
      topicPages.push({
        url: `${BASE}/therapists/arrangement/${a.slug}`,
        priority: 0.6,
        changeFrequency: "weekly" as const,
      });
    }
  }

  // Online×topic pages - same supply gate as city×topic (anti-doorway).
  for (const slug of onlineTopicSlugs()) {
    const topic = slugToCityTopic(slug);
    if (!topic || topic.adsOnly) continue;
    const count = counts.count({ ...topic.filter, online: true });
    if (count >= MIN_ONLINE_TOPIC) {
      topicPages.push({
        url: `${BASE}/therapists/online/${topic.slug}`,
        priority: 0.6,
        changeFrequency: "weekly" as const,
      });
    }
  }

  const cityTopicSlugs = [
    ...CITY_TOPIC_SLUGS,
    ...CITY_TOPIC_APPROACHES.map((a) => a.replace(/\s+/g, "-")),
  ];
  for (const slug of cityTopicSlugs) {
    const topic = slugToCityTopic(slug);
    if (!topic || topic.adsOnly) continue;
    for (const city of PILOT_CITIES) {
      const count = counts.count({ ...topic.filter, city });
      if (count >= MIN_CITY_TOPIC) {
        topicPages.push({
          url: `${BASE}/therapists/city/${regionToSlug(city)}/${topic.slug}`,
          priority: 0.55,
          changeFrequency: "weekly" as const,
        });
      }
    }
  }

  // Public center pages (paid-plan benefit) - only active centers whose public
  // page is enabled.
  const centerPages: MetadataRoute.Sitemap = centers.map((c) => ({
    url: `${BASE}/centers/${c.slug}`,
    priority: 0.6,
    changeFrequency: "weekly" as const,
    lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
  }));

  // The code-generated landing families all share one copy revision - see
  // LANDING_COPY_REVISED above for why they get a lastmod at all.
  const landingPages: MetadataRoute.Sitemap = [...regionPages, ...topicPages].map((p) => ({
    ...p,
    lastModified: LANDING_COPY_REVISED,
  }));

  return [...staticPages, ...therapistPages, ...articlePages, ...sectionPages, ...landingPages, ...centerPages];
}
