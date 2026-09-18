/**
 * Findings that must never be recorded against an individual visitor.
 *
 * A suicidality finding is the one questionnaire result that is stored only as
 * general information: per visitor it is folded into the generic
 * emotional-domain finding, and the fact that it occurred survives solely as a
 * weekly count with nothing attached to it (research_weekly_counts - no session,
 * no timestamp, no age, gender or region).
 *
 * Why this file exists rather than a check at one call site: the finding text
 * used to travel in the profile URL (?sy=) and from there into
 * therapist_profile_views.viewer_symptom, which also feeds the therapist
 * dashboard's "what led them to you" breakdown - so a therapist could read
 * "signs of suicidality" as a traffic source. The client now generalises before
 * the URL is built, and the server generalises again on the way in, because a
 * cached bundle or a link sitting in someone's history keeps sending the old
 * text long after a deploy.
 */

/**
 * The pooled label. Deliberately an EXISTING finding (the generic emotional one
 * the adults scorer already emits) and not a new phrase: a label used for
 * nothing but suicidality would just be suicidality under another name,
 * recoverable by exclusion.
 */
export const GENERAL_EMOTIONAL_FINDING = "נמצאו סימנים כלליים בתחום הרגשי.";

// Every suicidality wording in both scorers contains this stem ("אובדנות",
// "אובדניות", "אובדני"). Matching the stem rather than a list of sentences means
// a reworded finding cannot slip through.
const SUICIDALITY_RX = /אובדנ/;

export function isSuicidalityText(text: string | null | undefined): boolean {
  return typeof text === "string" && SUICIDALITY_RX.test(text);
}

/** The finding as it may be stored per visitor: unchanged, or pooled. */
export function generalizeFinding<T extends string | null | undefined>(text: T): T | string {
  return isSuicidalityText(text) ? GENERAL_EMOTIONAL_FINDING : text;
}
