/**
 * The whole map: the mechanical tracks (dates, grades, documents) with the
 * approved clinical rules applied on top.
 *
 * Kept apart from school-tracks.ts so that the sourced engine never imports
 * the clinical layer, and the clinical layer only imports types. Anyone
 * reading school-tracks.ts can trust that nothing in it depends on a
 * judgement call.
 */

import { mechanicalTracks, type SchoolTrack, type SchoolTracksInput, type Relevance } from "./school-tracks";
import { CLINICAL_RULES, approvedRules, type ClinicalRule } from "./school-tracks-clinical";

const REL_RANK: Record<Relevance, number> = { primary: 0, consider: 1, info: 2 };

export function mapSchoolTracks(input: SchoolTracksInput, rules: ClinicalRule[] = CLINICAL_RULES): SchoolTrack[] {
  let tracks = mechanicalTracks(input);
  for (const rule of approvedRules(rules)) {
    if (rule.when(input)) tracks = rule.apply(tracks, input);
  }
  // Stable, so a rule that placed its track first among equals keeps it there.
  return tracks.sort((a, b) => REL_RANK[a.relevance] - REL_RANK[b.relevance]);
}
