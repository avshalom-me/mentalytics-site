/**
 * The line of a therapist's own words shown on directory and match cards.
 *
 * Both cards render this inside `line-clamp-2`, so the design budget is two
 * lines. The previous implementation, `bio.split(/[.\n]/)[0].trim()`, usually
 * delivered far less than that and sometimes nothing at all. Measured against
 * production data it broke for 35 of 146 listed therapists (24%):
 *
 *   - A bio starting with a newline produced an EMPTY string, because the split
 *     returns "" before the leading separator. Five listed therapists had a
 *     blank line on their card.
 *   - Credentials cut the line mid-word: "M.A.", "MSW." and "m.s.w" all contain
 *     a period, so "מטפלת באמנויות (M.A.) בעלת קליניקה" rendered as
 *     "מטפלת באמנויות (M".
 *   - A greeting opener produced a line that says nothing: "שלום," (5 chars),
 *     "היי, אני דנה" (12 chars).
 *
 * The fix: normalise whitespace first, treat a sentence as ending only at
 * .!? FOLLOWED BY whitespace (which is what leaves abbreviations intact), and
 * keep appending sentences until there is something worth reading.
 */

/** Below this the line carries no information and we pull in the next sentence. */
const MIN_USEFUL = 30;
/** Roughly two rendered lines; the CSS clamp is the real visual limit. */
const MAX_LEN = 180;

/**
 * Marks sentence breaks before splitting. Must be a character that cannot occur
 * in a bio - a space would re-create the very bug this replaces by splitting
 * the text into individual words.
 */
const SENTINEL = "\u0000";

export function bioSnippet(bio: string | null | undefined): string {
  if (!bio) return "";
  const text = bio.replace(/\s+/g, " ").trim();
  if (!text) return "";

  const parts = text.replace(/([.!?])\s+/g, `$1${SENTINEL}`).split(SENTINEL);

  // Keep appending until the line says something. Deliberately NO length guard
  // here: bailing out on overflow left `out` at the useless greeting it was
  // trying to escape (a 192-char bio opening "שלום!" rendered as just "שלום!"),
  // and because that result is under MAX_LEN the truncation below never ran.
  // Overshooting is fine - the truncation is what the budget is for.
  let out = parts[0] ?? text;
  for (let i = 1; i < parts.length && out.length < MIN_USEFUL; i++) {
    out = `${out} ${parts[i]}`.trim();
  }

  if (out.length <= MAX_LEN) return out;
  const cut = out.lastIndexOf(" ", MAX_LEN);
  return `${out.slice(0, cut > 0 ? cut : MAX_LEN).trim()}…`;
}
