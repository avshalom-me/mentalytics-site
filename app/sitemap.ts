import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { ALL_REGIONS, regionToSlug, ONLINE_SLUG, CITY_SEO_LIST } from "@/app/lib/regions";
import { therapistPath } from "@/app/lib/therapist-url";
import { countListedByRegionAndCity, MIN_LISTED_FOR_INDEX } from "@/app/lib/therapist-directory";

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
    { url: `${BASE}/research/faq`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE}/research/assessments`, priority: 0.6, changeFrequency: "monthly" },
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
    .eq("admin_approved", true);

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
  // Only region/city pages that have enough listed therapists are included —
  // near-empty ones are noindex, so listing them here would only produce
  // "submitted URL marked noindex" warnings and waste crawl budget. They rejoin
  // the sitemap automatically once they fill up (regenerated per request).
  const { regions: regionCounts, cities: cityCounts } = await countListedByRegionAndCity();
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
  ];

  return [...staticPages, ...therapistPages, ...articlePages, ...regionPages];
}
