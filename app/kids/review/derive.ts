/**
 * The facts the questionnaire writes back into its answers once it is scored,
 * for a state that did not get there by walking.
 *
 * In the real flow two things happen between the last question and the report:
 * KidsQuiz writes what the scoring found into the answers (_found,
 * _findingKeys), and the "מה כבר נעשה" screen decides on the way out whether a
 * committee route is open (_route), which is what shows or skips "מה קיים
 * בתיק". A review case is opened straight onto a screen, so neither has
 * happened yet. These are the same two computations, in one place, so the
 * review layer and the test of the case bank cannot disagree about them - and
 * neither can drift from the screens without the test saying so.
 */

import { aggregateForMatch, findingExternalKeys, foundDomains, parseKidsBoxes } from "@/app/lib/kids-recommendations";
import { schoolAsksDocs, isSchoolGrade } from "@/app/lib/school-report";
import type { Ans, KidsScoreResult } from "../quiz-logic";

const DOMAINS = ["emotional", "academic", "developmental", "behavioral", "social"] as const;

/** What PageRefine writes on the way out: a school asks about the file on a live route or from י', a kindergarten always asks. */
export function routeOf(A: Ans): boolean {
  return isSchoolGrade(A._grade) ? schoolAsksDocs(A) : true;
}

/** The answers as they stand on the report: the scored findings written in, then the route decided from them. */
export function withScoredFacts(A: Ans, score: KidsScoreResult): Ans {
  const parsed = DOMAINS.map(key => ({ key, result: parseKidsBoxes(score[key], key) }));
  const found = foundDomains(score);
  const agg = aggregateForMatch(parsed.map(d => d.result));
  const next: Ans = {
    ...A,
    _found: found,
    _findingKeys: { assessmentKeys: agg.assessmentKeys, treatmentKeys: agg.treatmentKeys, externalKeys: findingExternalKeys(agg) },
  };
  return { ...next, _route: routeOf(next) };
}
