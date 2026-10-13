import { META_MAX, clampWords, wholeSentencesWithin } from "./meta-description";

/**
 * The meta description of a therapist profile.
 *
 * Until 13/10/2026 it was the first 140 characters of the bio and nothing
 * else. Hebrew is not hyphenated, so the cut landed mid-word (a live profile
 * read "...חרדה חברתית, אילמות סל"), and the name, the profession and the city
 * appeared nowhere in it - on the pages that rank best of all, because a third
 * of the site's organic clicks are searches for a therapist's name. The
 * description is what that searcher reads under the title.
 *
 * Shape: who and where, then the areas they treat, then as much of the bio as
 * fits in whole sentences - or a word-boundary cut when even its first sentence
 * is longer than the room left. Never over META_MAX and never mid-word, the two
 * rules meta-description.ts set for the landing pages.
 */
export type ProfileMetaInput = {
  name: string;
  /** The public title, already in the therapist's gender (publicTherapistTitle). */
  title: string;
  regions?: string[] | null;
  online?: boolean | null;
  trainingAreas?: string[] | null;
  bio?: string | null;
};

/** Fewer characters than this of the bio would be an ellipsis and three words. */
const MIN_BIO_ROOM = 30;
const MAX_PLACES = 2;
const MAX_AREAS = 3;

export function profileMetaDescription(t: ProfileMetaInput): string {
  const places = (t.regions ?? []).filter(Boolean).slice(0, MAX_PLACES).map((place) => `ב${place}`);
  let where = places.join(" ו");
  if (t.online) where = where ? `${where} וגם אונליין` : "אונליין";
  const lead = `${t.name}, ${t.title}${where ? ` ${where}` : ""}.`;

  const areas = (t.trainingAreas ?? []).filter(Boolean).slice(0, MAX_AREAS);
  const head = areas.length ? `${lead} תחומי טיפול: ${areas.join(", ")}.` : lead;
  if ([...head].length > META_MAX) return clampWords(head, META_MAX);

  const bio = (t.bio ?? "").replace(/\s+/g, " ").trim();
  const room = META_MAX - [...head].length - 1;
  if (!bio || room < MIN_BIO_ROOM) return head;
  return `${head} ${wholeSentencesWithin(bio, room) ?? clampWords(bio, room)}`;
}
