/**
 * Meta descriptions for the directory landing pages.
 *
 * Why this exists: four route families built their description as
 * `intro.slice(0, 130) + "… מטפלים מאומתים בטיפול חכם."`. Hebrew is not
 * hyphenated, so a fixed-length slice lands mid-word - the live SERP text on
 * 10/8/2026 read "הגישות המובילות מחקרית הן CBT (עב…" on the anxiety page and
 * "רשימת מטפל" on the psychodynamic one.
 *
 * The rules here, in priority order:
 *  1. Never cut mid-word, and never exceed the budget. Google truncates a long
 *     description cleanly by itself; a broken cut baked into the tag is ours
 *     forever.
 *  2. Say what the page offers - credentials that were checked, and a quiz
 *     built by clinicians for people who don't want to choose alone. Never a
 *     supply count: see CREDENTIALS/QUIZ below for why.
 *  3. Keep the page's own editorial opening, because 27 specialty pages that
 *     all open with the same sentence is a duplicate-description smell.
 *
 * When 2 and 3 collide - some intros are a single 155-character sentence - the
 * opening wins and the offer is dropped, rather than cutting the opening
 * mid-thought. A complete sentence with no call to action still reads like
 * something a person wrote.
 */

/** Roughly what Google renders before truncating. Hebrew glyphs run wide. */
export const META_MAX = 158;

/**
 * The longest run of WHOLE sentences from `text` that fits in `max`, or null
 * if not even the first one does.
 */
export function wholeSentencesWithin(text: string, max: number): string | null {
  const trimmed = text.trim();
  const chars = [...trimmed]; // code points: slicing UTF-16 units can split a pair
  if (chars.length <= max) return trimmed;
  const head = chars.slice(0, max).join("");
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  return stop > 0 ? head.slice(0, stop + 1) : null;
}

/** Word-boundary trim with an ellipsis, guaranteed to fit inside `max`. */
export function clampWords(text: string, max: number): string {
  const chars = [...text.trim()];
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max - 3).join(""); // leave room for the ellipsis
  let cut = head.slice(0, head.lastIndexOf(" "));
  // An unclosed "(" reads as a typo in a SERP - drop back to before it.
  const open = cut.lastIndexOf("(");
  if (open > -1 && cut.indexOf(")", open) === -1) cut = cut.slice(0, open);
  return `${cut.replace(/[\s,;:.\-–]+$/u, "")}...`;
}

/**
 * The editorial opening plus the richest `offer` that still leaves room for
 * whole sentences. Offers are given richest-first; whichever combination uses
 * the most of the budget wins.
 */
export function introPlusOffer(intro: string, ...offers: string[]): string {
  if (offers.length === 0) return clampWords(intro, META_MAX);
  let best = "";
  for (const offer of offers) {
    const head = wholeSentencesWithin(intro, META_MAX - [...offer.trim()].length - 1);
    if (!head) continue;
    const candidate = `${head} ${offer.trim()}`;
    if ([...candidate].length > [...best].length) best = candidate;
  }
  if (best) return best;
  // A handful of intros open with a single sentence longer than the budget
  // itself. Keep the offer and cut the opening at a word boundary instead of
  // dropping the offer: a searcher who reads "...שתעודותיהם אומתו" learns what
  // the page is, which a truncated definition alone never tells them - and that
  // is the whole complaint this file exists to answer.
  const shortest = offers[offers.length - 1].trim();
  return `${clampWords(intro, META_MAX - [...shortest].length - 1)} ${shortest}`;
}

/**
 * The two things the shop window says, per the owner's decision on 14/8/2026:
 * not how many therapists we hold, but that their credentials were checked and
 * that the matching quiz was built by clinicians. Supply counts are gone from
 * every SERP-facing string - they read as inventory data, and on a thin city
 * page a small number argues against us.
 *
 * The wording is deliberate. The site verifies certificates and training
 * ("עברו אימות תעודות והכשרה"), which is not the same as holding a licence:
 * psychologists and clinical social workers are licensed, but several of the
 * professions listed here have no licence at all, so "מטפלים מורשים" would
 * overclaim. "שתעודותיהם אומתו" says exactly what we actually do.
 */
export const CREDENTIALS = "מטפלים ופסיכולוגים שתעודותיהם אומתו";
export const QUIZ = "שאלון שנבנה על ידי פסיכולוגים קליניים ומבוסס מחקר";

/** Offer tiers for a therapist listing page, richest first. */
export function therapistOffers(): string[] {
  return [`${CREDENTIALS}, ו${QUIZ} להתאמה אישית.`, `${CREDENTIALS}, ו${QUIZ}.`];
}
