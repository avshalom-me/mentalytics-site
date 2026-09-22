import type { Metadata } from "next";
import { EDITORIAL_ARTICLES } from "@/app/lib/article-taxonomy";

/**
 * OpenGraph + Twitter metadata for a shareable page (articles, hubs).
 *
 * Why a helper: Next.js REPLACES a page's `openGraph` block wholesale instead
 * of merging it with the root layout's. A page with no openGraph of its own
 * inherited the site default - og:url pointing at the HOMEPAGE and the square
 * logo - so Facebook shared every such article as the homepage. A page that set
 * its own openGraph but no `images` shared with no picture at all, and lost
 * siteName/locale too. Spreading `...shareMetadata({...})` into a page's
 * metadata sets all of it at once: own URL, own title/description, an image.
 */

const BASE_URL = "https://www.mentalytics.co.il";

/** Branded 1200x630 card (public/og-default.png) for pages without a photo. */
export const OG_FALLBACK_IMAGE = { url: `${BASE_URL}/og-default.png`, width: 1200, height: 630, alt: "טיפול חכם" };

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * Unsplash URLs are resized by query string, so any Unsplash photo (a 600x260
 * hub card, an admin-picked article image) is re-requested at the 1200x630
 * share size. Other URLs are used as-is, without claiming dimensions.
 */
export function ogImage(src: string, alt?: string): OgImage {
  try {
    const u = new URL(src, BASE_URL);
    if (u.hostname === "images.unsplash.com") {
      u.searchParams.set("w", "1200");
      u.searchParams.set("h", "630");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("auto", "format");
      u.searchParams.set("q", "80");
      return { url: u.toString(), width: 1200, height: 630, alt };
    }
    return { url: u.toString(), alt };
  } catch {
    return { ...OG_FALLBACK_IMAGE, alt: alt ?? OG_FALLBACK_IMAGE.alt };
  }
}

/** The photo an editorial guide carries on its /research hub card, if any. */
export function editorialImage(slug: string): string | undefined {
  return EDITORIAL_ARTICLES.find((a) => a.slug === slug)?.img;
}

export function shareMetadata(opts: {
  /** Site path ("/research/faq") or absolute URL - becomes og:url. */
  url: string;
  title: string;
  description: string;
  /** The page's own photo; the branded card is used when absent. */
  image?: string | null;
  imageAlt?: string | null;
  type?: "article" | "website";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const url = opts.url.startsWith("http") ? opts.url : `${BASE_URL}${opts.url}`;
  const img = opts.image ? ogImage(opts.image, opts.imageAlt || opts.title) : OG_FALLBACK_IMAGE;
  return {
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      type: opts.type ?? "article",
      locale: "he_IL",
      siteName: "טיפול חכם",
      images: [img],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [img.url],
    },
  };
}
