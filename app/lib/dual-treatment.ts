/**
 * A "both" recommendation: CBT and dynamic therapy offered side by side (30/10/2026).
 *
 * When the two style answers sit in the middle (or were skipped) on a finding
 * where the evidence does not put one method first, the adults questionnaire no
 * longer picks CBT for the person. It sends one recommendation whose `treatment`
 * is the joint key CBT_OR_DYNAMIC and whose `treatmentOptions` are the two
 * methods. The results screen shows the two as equal choices, in an order fixed
 * per visit, with a third way to search for either.
 *
 * Why: in the 537 emotional reports of 18/9-30/10/2026 the first card was CBT in
 * 89%, mostly because the style formula read Q1 backwards and every undecided
 * answer went to CBT. The research behind the change is in the company Dropbox,
 * "אלגוריתם ההמלצות - CBT ודינאמי".
 *
 * Pure, so the search, the research record and the screen read a "both" card the
 * same way, and so it can be tested without a browser.
 */

export const CBT = "CBT";
export const DYNAMIC = "טיפול דינאמי";
/** Same string as in questionnaire-score.ts (dual-treatment.test.ts checks it). */
export const CBT_OR_DYNAMIC = "CBT או טיפול דינאמי";

/** One line under each choice, in the patient's words rather than the method's. */
export const OPTION_HINT: Record<string, string> = {
  [CBT]: "כלים מעשיים ותוכנית עבודה",
  [DYNAMIC]: "הבנת השורשים והדפוסים",
};

type Rec = { treatment: string; treatmentOptions?: string[] };

export function isBoth(rec: Pick<Rec, "treatmentOptions"> | null | undefined): boolean {
  return (rec?.treatmentOptions?.length ?? 0) > 1;
}

/**
 * Whether the card shows the two methods as a choice. Not on an urgent card: a
 * suicidality finding is about getting help now, and a choice between styles of
 * therapy beside "see a psychiatrist soon" would make the method look like the
 * decision that matters (review of 30/10/2026). That card keeps one search
 * button, which still looks for either method.
 */
export function offersChoice(rec: Pick<Rec, "treatmentOptions"> | null | undefined, urgent: boolean): boolean {
  return isBoth(rec) && !urgent;
}

/** The same keys, in any order. */
export function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  const A = new Set(a);
  const B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

/**
 * The order the two choices are shown in. Half the visits see CBT first and half
 * dynamic therapy, decided by the session so a reload does not swap them, and so
 * the research record can measure how much the first place itself pulls.
 */
export function optionOrder(options: readonly string[], seed: string): string[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return h & 1 ? [...options].reverse() : [...options];
}

/** The recommendation as the one method the person chose from a "both" card. */
export function asOption<T extends Rec & { treatmentLabel: string }>(rec: T, option: string): T {
  const copy: T = { ...rec, treatment: option, treatmentLabel: option };
  delete copy.treatmentOptions;
  return copy;
}

/**
 * What a search for this recommendation sends to /api/match. A "both" card is
 * one group of alternatives: a therapist who does either method meets it in
 * full, where an ordinary two-treatment search gives half for one of two.
 */
export function searchFor(rec: Rec | null | undefined): { treatmentTypes: string[]; treatmentGroups: string[][] } {
  if (!rec) return { treatmentTypes: [], treatmentGroups: [] };
  if (isBoth(rec)) {
    const options = [...(rec.treatmentOptions ?? [])];
    return { treatmentTypes: options, treatmentGroups: [options] };
  }
  return { treatmentTypes: rec.treatment ? [rec.treatment] : [], treatmentGroups: [] };
}

/**
 * The combined search over several cards: one group per card, so that a "both"
 * card counts once and is met by either method. With low mood on "both" and
 * anxiety on CBT, the groups are (CBT or dynamic) and CBT, and a CBT-only
 * therapist meets both - flattened to [CBT, dynamic] they got half.
 */
export function combinedSearch(cards: { treatmentLabel: string; recs: Rec[] }[]): {
  treatments: string[];
  labels: string[];
  groups: string[][];
} {
  const groups: string[][] = [];
  const labels = new Set<string>();
  for (const card of cards) {
    const rec = card.recs[0];
    if (!rec) continue;
    const members = isBoth(rec) ? [...(rec.treatmentOptions ?? [])] : [rec.treatment];
    if (!groups.some((g) => sameKeys(g, members))) groups.push(members);
    for (const l of isBoth(rec) ? rec.treatmentOptions ?? [] : [card.treatmentLabel]) labels.add(l);
  }
  return { treatments: [...new Set(groups.flat())], labels: [...labels], groups };
}

/**
 * The share of the requested groups a therapist meets; a group is met by any of
 * its members. Used by /api/match for a search that sends groups.
 */
export function groupCoverage(areas: readonly string[], groups: readonly string[][], norm: (s: string) => string): number {
  if (groups.length === 0) return 0;
  const have = new Set(areas.map(norm));
  return groups.filter((g) => g.some((t) => have.has(norm(t)))).length / groups.length;
}

/**
 * The treatment keys a group of recommendations stands for, with a "both" card
 * counted as its two methods. Used by the combined search and by the research
 * record, whose demand reports compare these keys with therapists' training
 * areas - where the joint key would match nobody.
 */
export function treatmentKeys(recs: Rec[]): string[] {
  const keys = new Set<string>();
  for (const r of recs) {
    if (isBoth(r)) for (const o of r.treatmentOptions ?? []) keys.add(o);
    else if (r.treatment) keys.add(r.treatment);
  }
  return [...keys];
}
