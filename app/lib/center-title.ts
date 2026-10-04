// What a centre's public page calls the centre: in the <title>, and in the line
// above its name.
//
// Every centre used to be "מרכז טיפולי" - "<name> - מרכז טיפולי ב<city>". A centre
// whose name already says what it does ("... - טיפול רגשי ופרא רפואי") lost
// nothing by that. A centre whose name is only a name was left with a title
// that carries none of the words people search for: in the 90 days to 4/10/2026
// the page of a centre for couples and sex therapy appeared in Google for its
// own name, and twice for a search with "זוגי" in it.
//
// public_focus is the centre's field of work in a few words ("טיפול זוגי ומיני").
// When it is set it takes the place of the generic term; empty is as before.
// It is written from the admin only (app/admin/centers).

export const DEFAULT_CENTER_KIND = "מרכז טיפולי";

/** Long enough for "טיפול רגשי ופרא רפואי לילדים ולנוער", short enough to stay a title. */
export const CENTER_FOCUS_MAX = 40;

export function centerKind(focus: string | null | undefined): string {
  return focus?.trim() || DEFAULT_CENTER_KIND;
}

/** Without "| טיפול חכם": the root layout's title template adds the brand. */
export function centerPageTitle(
  name: string,
  focus: string | null | undefined,
  city: string | null | undefined,
): string {
  const where = city?.trim();
  return `${name} - ${centerKind(focus)}${where ? ` ב${where}` : ""}`;
}
