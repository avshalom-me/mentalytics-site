import { MetadataRoute } from "next";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

const BASE = "https://www.tipolchacham.co.il";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE}/adults`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${BASE}/kids`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${BASE}/therapists`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${BASE}/research`, priority: 0.7, changeFrequency: "monthly" },
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
    { url: `${BASE}/terms`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${BASE}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${BASE}/accessibility`, priority: 0.3, changeFrequency: "yearly" },
  ];

  const { data } = await supabaseAdmin
    .from("therapists")
    .select("id, updated_at")
    .eq("status", "approved");

  const therapistPages: MetadataRoute.Sitemap = (data ?? []).map((t) => ({
    url: `${BASE}/therapists/${t.id}`,
    priority: 0.7,
    changeFrequency: "monthly" as const,
    lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
  }));

  return [...staticPages, ...therapistPages];
}
