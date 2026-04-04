import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.mentalytics.co.il";

  return [
    { url: base, priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/adults`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/kids`, priority: 0.9, changeFrequency: "monthly" },
    { url: `${base}/therapists`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${base}/research`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${base}/research/online-therapy`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/research/which-therapy`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/research/therapy-for-child`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/research/cbt-vs-dynamic`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/research/adhd-adults`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${base}/about`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${base}/terms`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/privacy`, priority: 0.3, changeFrequency: "yearly" },
    { url: `${base}/accessibility`, priority: 0.3, changeFrequency: "yearly" },
  ];
}
