const BASE_URL = "https://www.mentalytics.co.il";

/**
 * BreadcrumbList JSON-LD for a /research page: בית › מאמרים ומידע שימושי › <title>.
 *
 * Without it a search result shows a bare URL instead of a trail, and the
 * article has no structural parent. Six of the static research pages hand-rolled
 * this block; the rest had none, so it lives here once instead of seventeen
 * times.
 *
 * `slug` is the path segment under /research (e.g. "psychodidactic").
 */
export function ResearchBreadcrumbLd({ slug, title }: { slug: string; title: string }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "מאמרים ומידע שימושי", item: `${BASE_URL}/research` },
      { "@type": "ListItem", position: 3, name: title, item: `${BASE_URL}/research/${slug}` },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
    />
  );
}
