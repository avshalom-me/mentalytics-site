/**
 * Is this route part of the English section (/en and anything under it)?
 * The site chrome (NavBar, footer) switches language on it. Not a bare
 * startsWith("/en"): that would also catch any future Hebrew route that
 * happens to begin with those letters.
 */
export function isEnglishPath(pathname: string | null | undefined): boolean {
  return pathname === "/en" || (pathname ?? "").startsWith("/en/");
}
