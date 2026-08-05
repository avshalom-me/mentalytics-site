import { siteAuthorRef } from "@/app/lib/author";

const BASE_URL = "https://www.mentalytics.co.il";

/**
 * Article (or CollectionPage) JSON-LD for a /research page.
 *
 * The hand-written guides each build this inline because they carry extra
 * fields; this covers the pages that only need the standard block. Without it
 * a page has no author in the structured data at all - which on YMYL content is
 * exactly the signal Google's quality raters look for and the reason several of
 * these pages sat unattributed.
 */
export function ResearchArticleLd({
  slug,
  headline,
  description,
  type = "Article",
  section,
  datePublished = "2026-08-05",
  dateModified = "2026-08-05",
}: {
  slug: string;
  headline: string;
  description: string;
  type?: "Article" | "CollectionPage";
  section?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const url = `${BASE_URL}/research/${slug}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": type,
    headline,
    description,
    inLanguage: "he",
    datePublished,
    dateModified,
    author: siteAuthorRef(),
    publisher: { "@type": "Organization", name: "טיפול חכם", url: BASE_URL },
    url,
    ...(section ? { articleSection: section } : {}),
    isPartOf: { "@type": "WebSite", name: "טיפול חכם", url: BASE_URL },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
    />
  );
}
