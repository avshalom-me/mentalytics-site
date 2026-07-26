import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ALL_REGIONS, regionToSlug, ONLINE_SLUG, CITY_SEO_LIST } from "@/app/lib/regions";
import { therapistPath } from "@/app/lib/therapist-url";
import { countListedByRegionAndCity, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";
import { SPECIALTY_LIST, specialtyToSlug } from "@/app/lib/specialties";
import { TOPICS, PILOT_CITIES, MIN_CITY_TOPIC, CITY_TOPIC_SLUGS, CITY_TOPIC_APPROACHES, slugToCityTopic } from "@/app/lib/topics";
import { countListed } from "@/app/lib/therapist-directory";
import { listPublicCenters } from "@/app/lib/center-public";

const BASE = "https://www.mentalytics.co.il";

// Regenerate per request so newly-approved therapists enter the sitemap without
// waiting for a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE}/adults`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${BASE}/kids`, priority: 0.9, changeFrequency: "monthly" },
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

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, created_at, full_name")
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .neq("entity_type", "center"); // ישות-מרכז אינה עמוד מטפל ציבורי

  const therapistPages: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
    url: `${BASE}${therapistPath(t.id, t.full_name)}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
    lastModified: t.created_at ? new Date(t.created_at) : undefined,
  }));

  const { data: articles } = await supabaseAdmin
    .from("therapist_articles")
    .select("slug, updated_at")
    .eq("status", "approved");

  const articlePages: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${BASE}/research/community/${a.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
    lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
  }));

  // Region + online landing pages (and the region hub) + the para-medical rubric.
  // Only region/city pages that have enough listed therapists are included -
  // near-empty ones are noindex, so listing them here would only produce
  // "submitted URL marked noindex" warnings and waste crawl budget. They rejoin
  // the sitemap automatically once they fill up (regenerated per request).
  const { regions: regionCounts, cities: cityCounts, specialties: specialtyCounts } = await countListedByRegionAndCity();
  const regionPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/therapists/para-medical`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/region`, priority: 0.7, changeFrequency: "weekly" as const },
    { url: `${BASE}/therapists/region/${ONLINE_SLUG}`, priority: 0.7, changeFrequency: "weekly" as const },
    ...ALL_REGIONS.filter((region) => (regionCounts[region] ?? 0) >= MIN_LISTED_FOR_INDEX).map((region) => ({
      url: `${BASE}/therapists/region/${regionToSlug(region)}`,
      priority: 0.7,
      changeFrequency: "weekly" as const,
    })),
    ...CITY_SEO_LIST.filter((city) => (cityCounts[city] ?? 0) >= MIN_LISTED_FOR_INDEX).map((city) => ({
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
    const count = await countListed(topic.filter);
    if (count >= MIN_LISTED_FOR_INDEX) {
      topicPages.push({
        url: `${BASE}/therapists/topic/${topic.slug}`,
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
    if (!topic) continue;
    for (const city of PILOT_CITIES) {
      const count = await countListed({ ...topic.filter, city });
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
  const centers = await listPublicCenters();
  const centerPages: MetadataRoute.Sitemap = centers.map((c) => ({
    url: `${BASE}/centers/${c.slug}`,
    priority: 0.6,
    changeFrequency: "weekly" as const,
    lastModified: c.updated_at ? new Date(c.updated_at) : undefined,
  }));

  return [...staticPages, ...therapistPages, ...articlePages, ...regionPages, ...topicPages, ...centerPages];
}
