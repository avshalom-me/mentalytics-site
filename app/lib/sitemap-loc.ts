/**
 * The <loc> form of a sitemap URL.
 *
 * Next writes a sitemap entry's url exactly as given, so every city, topic and
 * profile URL went out with its Hebrew path raw ("/therapists/city/תל-אביב"),
 * while the same page's canonical - which Next resolves against metadataBase
 * through the URL parser - is percent-encoded ("/therapists/city/%D7%AA%D7%9C-...").
 * Google reads the two as different addresses: Search Console could not pair
 * the sitemap's URLs with the pages it had indexed, and reported the Hebrew
 * pages as having no sitemap at all. The sitemap protocol asks for the escaped
 * form.
 *
 * The same parser as the canonical, so the two cannot drift apart again. An
 * all-ASCII URL is returned untouched: the parser would add a trailing slash
 * to the bare origin (the homepage entry), and nothing else there needs
 * changing.
 */
export function sitemapLoc(url: string): string {
  if (/^[\x00-\x7F]*$/.test(url)) return url;
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}
