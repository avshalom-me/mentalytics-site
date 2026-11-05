/**
 * Paths where no third-party measurement or advertising tag may run.
 *
 * The counsellors' questionnaire (/school) is offered to schools as a tool that
 * passes nothing to third parties: the Ministry of Education's privacy
 * procedure for technology products (§2.2) forbids handing information
 * collected in the product to any third party without written approval, and
 * the Ministry's product approval checks exactly that. Until 5/11/2026 the root
 * layout loaded Google's tag (GA4 and Google Ads), the Taboola pixel and Vercel
 * Analytics on every page, /school included. They are now loaded through
 * app/components/ThirdPartyTags.tsx, which asks this module first.
 *
 * Nothing measurable was lost: no /school session has ever arrived from a paid
 * campaign, and the questionnaire's own first-party events (/api/track) are
 * unaffected. The landing page for counsellors (/counselors) keeps its tags.
 */
export const TAG_FREE_PREFIXES = ["/school"] as const;

export function isTagFreePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return TAG_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * The same test for a full URL, as Vercel Analytics hands it to beforeSend.
 * An unparsable URL is treated as tag-free: dropping one event is cheaper than
 * reporting a page that should never have been reported.
 */
export function isTagFreeUrl(url: string): boolean {
  try {
    return isTagFreePath(new URL(url, "https://www.mentalytics.co.il").pathname);
  } catch {
    return true;
  }
}
