/**
 * The order of the therapist cards on a city page (/therapists/city/<city>).
 *
 * A city page lists up to three groups: therapists in the city itself, then -
 * when the city is thin - those in the adjacent cities, then the wider region.
 * Each group comes out of loadPublicTherapists already paid-first. Rendered one
 * after another, though, every free therapist in a thin city stood above every
 * paying one next door: on 4/11/2026 "פסיכולוג בגוש עציון" opened on three free
 * cards above twelve paying ones, and 28 city pages had that shape.
 *
 * So paid-first holds for the page as a whole (owner, 4/11/2026). Where a card
 * that does not lead comes before one that does, the leading cards of each
 * group stay where they are, under the group's usual heading, and every other
 * card follows them in one section, in the order the groups had. A page that
 * is already paid-first is left exactly as it was.
 *
 * Leading = paying and taking new patients. A paying therapist who is not
 * taking new patients sorts last everywhere else (therapist-directory.ts), and
 * goes with the rest here too.
 */

// `free` is optional on PublicTherapist; loadPublicTherapists always sets it.
export type ListingCard = { free?: boolean; accepting_new_patients: boolean };

export const leadsListing = (t: ListingCard): boolean => !t.free && t.accepting_new_patients !== false;

export type CityListingSections<T> = {
  /** Whether the groups were split: false = the page renders as before. */
  paidFirst: boolean;
  inCity: T[];
  nearby: T[];
  region: T[];
  /** Everyone moved below the leading cards; empty when paidFirst is false. */
  others: T[];
};

export function cityListingSections<T extends ListingCard>(
  inCity: T[],
  nearby: T[],
  region: T[]
): CityListingSections<T> {
  const listed = [...inCity, ...nearby, ...region];
  const firstOther = listed.findIndex((t) => !leadsListing(t));
  const paidFirst = firstOther >= 0 && listed.slice(firstOther + 1).some(leadsListing);
  if (!paidFirst) return { paidFirst, inCity, nearby, region, others: [] };
  return {
    paidFirst,
    inCity: inCity.filter(leadsListing),
    nearby: nearby.filter(leadsListing),
    region: region.filter(leadsListing),
    others: listed.filter((t) => !leadsListing(t)),
  };
}
