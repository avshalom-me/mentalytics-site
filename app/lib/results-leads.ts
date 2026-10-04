// Which findings get a search button above the report, on the adults results
// screen.
//
// One button was the rule since 3/9/2026: the urgent finding, otherwise the
// first finding of the first section. The sections come in a fixed order with
// the emotional domain first, so whoever marked both that domain and
// "זוגיות ומשפחה" was offered the emotional finding up there and had to scroll
// past the whole report for the other one.
//
// Measured 18/9-4/10/2026, 47 questionnaires that recommended couples therapy:
// of the 22 who marked the relationship domain alone, 15 went on to search for
// a couples therapist; of the 25 who marked another domain as well, none did.
//
// So the relationship finding now stands beside the emotional one, with the
// same button (the owner's decision, 4/10/2026). An urgent finding still leads
// alone, and every other combination is as it was.

export const EMOTIONAL_DOMAIN = "מורכבויות בתחום הרגשי/האישי";
export const RELATIONSHIP_DOMAIN = "זוגיות ומשפחה";

type Group = { urgent: boolean };
type Section<G extends Group> = { key: string; groups: G[] };

export function leadingGroups<G extends Group>(groups: G[], sections: Section<G>[]): G[] {
  const urgent = groups.find((g) => g.urgent);
  if (urgent) return [urgent];
  const first = sections[0]?.groups[0];
  if (!first) return [];
  if (sections[0].key !== EMOTIONAL_DOMAIN) return [first];
  const relationship = sections.find((s) => s.key === RELATIONSHIP_DOMAIN)?.groups[0];
  return relationship ? [first, relationship] : [first];
}
