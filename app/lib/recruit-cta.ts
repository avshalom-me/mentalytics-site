// What counts as a click on a "register" call to action of a therapist
// recruitment page, and how far down the page it happened.
//
// The recruitment page (/therapists/join) is a server component full of plain
// links, and the only thing measured on it was the page view: of the people
// an ad brought, nobody could say how many pressed "open a free profile" and
// left at the next screen. This is the definition of that press, kept apart
// from the hook so a test can pin it.

/**
 * The register button: the login screen opened on its register tab. Anything
 * else (the login link of an existing therapist, a patient page, a link to
 * another site) is not a press on the call to action.
 */
export function isRecruitRegisterHref(href: string | null | undefined, origin: string): boolean {
  if (!href) return false;
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }
  if (url.origin !== new URL(origin).origin) return false;
  const path = url.pathname.replace(/\/+$/, "");
  return path === "/therapists/login" && url.searchParams.get("mode") === "register";
}

/**
 * Whole percent of the page above the viewport's bottom edge at the moment of
 * the click: 0 at the top, 100 at the end. 0 when the page fits the screen,
 * because there is nothing to scroll.
 */
export function scrollPercent(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const scrollable = scrollHeight - viewportHeight;
  if (!(scrollable > 0)) return 0;
  return Math.max(0, Math.min(100, Math.round((scrollY / scrollable) * 100)));
}
