/**
 * What a scored questionnaire recommended, reduced to the keys that get recorded.
 *
 * Pure and shared by both questionnaires so the recorded result has one shape and
 * one set of rules, and so those rules can be tested without a browser.
 *
 * Two defects in the old recording are the reason this exists:
 *
 * 1. The adults event listed one entry PER RECOMMENDATION and was then cut to
 *    five. Someone with anxiety, OCD and sleep findings was recorded as
 *    "CBT, CBT, CBT", and whatever came sixth - usually טיפול דינאמי, which sorts
 *    late - was dropped. 46% of adult records hit the cap holding on average 1.9
 *    distinct treatments, so the share of people recommended a dynamic therapy
 *    was understated by an unknown amount (51% recorded, 66% among the records
 *    that were not cut). Keys are de-duplicated here, before any cap.
 *
 * 2. A recommendation made because nothing was found is indistinguishable, in a
 *    list of keys, from one made because something was. Both scorers fall back
 *    to a therapy recommendation when the emotional domain was chosen and no
 *    finding fired; `defaultTreatments` names the keys that are present ONLY for
 *    that reason, so "recommended X because of a finding" = in treatments and not
 *    in defaultTreatments.
 */
import type { Recommendation } from "./questionnaire-types";
import type { KidsDomainResult } from "./kids-recommendations";

export type ResultKeys = {
  treatments: string[];
  assessments: string[];
  professionals: string[];
  /** Subset of `treatments` that no finding-driven recommendation also produced. */
  defaultTreatments: string[];
  /** Recommendations before de-duplication. 0 = the questionnaire found nothing. */
  nRecs: number;
};

// The adults scorer's "emotional domain chosen, nothing triggered" recommendation.
const ADULT_DEFAULT_ID = /^emotional-default-/;
// The kids scorer's equivalent is a referral box flagged isDefault, always to this key.
const KIDS_DEFAULT_KEY = "טיפול דינאמי";

type AdultRec = Pick<Recommendation, "id" | "treatment" | "professionalType">;

export function adultResultKeys(recs: AdultRec[]): ResultKeys {
  const treatments = new Set<string>();
  const assessments = new Set<string>();
  const professionals = new Set<string>();
  const fromFinding = new Set<string>();
  const fromDefault = new Set<string>();

  for (const r of recs) {
    if (r.professionalType) { professionals.add(r.professionalType); continue; }
    if (!r.treatment) continue;
    // The adults vocabulary marks an assessment by name ("אבחון תעסוקתי"); there
    // is no separate field for it.
    if (r.treatment.startsWith("אבחון")) { assessments.add(r.treatment); continue; }
    treatments.add(r.treatment);
    (ADULT_DEFAULT_ID.test(r.id) ? fromDefault : fromFinding).add(r.treatment);
  }

  return {
    treatments: [...treatments],
    assessments: [...assessments],
    professionals: [...professionals],
    defaultTreatments: [...fromDefault].filter((t) => !fromFinding.has(t)),
    nRecs: recs.length,
  };
}

/**
 * `keys` is the aggregate the match search already uses (aggregateForMatch), so
 * what is recorded is what the search would look for rather than a second
 * derivation of it. `defaultReferralEmitted` is whether the scorer added its
 * nothing-else-fired referral (a box flagged isDefault).
 */
export function kidsResultKeys(
  domains: KidsDomainResult[],
  keys: { treatmentKeys: string[]; assessmentKeys: string[]; professionalKeys: string[] },
  defaultReferralEmitted: boolean,
): ResultKeys {
  let nRecs = 0;
  let recsNamingDefaultKey = 0;
  for (const d of domains) {
    for (const g of d.groups) {
      // "_no_action" groups are findings with no referral under them, not
      // recommendations.
      if (g.treatmentKey === "_no_action") continue;
      for (const rec of g.recs) {
        nRecs++;
        if (rec.treatmentKey === KIDS_DEFAULT_KEY || rec.extraTreatmentKeys?.includes(KIDS_DEFAULT_KEY)) {
          recsNamingDefaultKey++;
        }
      }
    }
  }
  // The default referral accounts for exactly one recommendation naming the key.
  // Any further one means a finding asked for the same treatment, and then the
  // key is not there "only by default".
  const onlyByDefault = defaultReferralEmitted && recsNamingDefaultKey === 1;

  return {
    treatments: [...new Set(keys.treatmentKeys)],
    assessments: [...new Set(keys.assessmentKeys)],
    professionals: [...new Set(keys.professionalKeys)],
    defaultTreatments: onlyByDefault && keys.treatmentKeys.includes(KIDS_DEFAULT_KEY) ? [KIDS_DEFAULT_KEY] : [],
    nRecs,
  };
}
