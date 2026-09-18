import { describe, it, expect, vi } from "vitest";

// The contract that keeps a suicidality finding off every per-visitor record.
//
// Nothing marks such a finding structurally on its way out of the scorers - the
// kids scorer emits plain text boxes - so both the pooling (generalizeFinding)
// and the weekly counter recognise it by wording. That is only safe while every
// suicidality finding either scorer can produce actually contains the stem. A
// finding reworded without it ("מחשבות על מוות", say) would be stored against the
// visitor again with nothing failing anywhere. These tests make that loud: they
// drive each scorer into every suicidality branch and fail if any of the
// resulting findings would not be recognised.
//
// When one fails, the fix is almost never in the test: either keep the stem in
// the new wording, or extend isSuicidalityText in sensitive-findings.ts.

vi.mock("server-only", () => ({}));

import { scoreQuestionnaire } from "./questionnaire-score";
import { scoreKidsQuestionnaire } from "./kids-score.server";
import { isSuicidalityText, generalizeFinding, GENERAL_EMOTIONAL_FINDING } from "./sensitive-findings";
import type { QuestionnaireAnswers } from "./questionnaire-types";

function adultRecs(emotional: Record<string, unknown>) {
  const answers = { age: 30, gender: "x", domains: ["emotional"], emotional } as unknown as QuestionnaireAnswers;
  return scoreQuestionnaire(answers).recommendations;
}

describe("adults: every suicidality branch produces a recognisable finding", () => {
  const cases: [string, Record<string, unknown>][] = [
    ["mood", { moodSuicidal: true, moodItems: [] }],
    ["mania", { maniaItems: [0, 1, 2], maniaDeath: true }],
    ["prodrome", { e3a: true, prodromeItems: [], prodromeSuicidal: true }],
    ["trauma", { traumaSuicidal: true, traumaScores: [] }],
  ];

  for (const [name, emotional] of cases) {
    it(`${name}: the suicidal recommendation is recognised, and pooled to the generic finding`, () => {
      const suicidal = adultRecs(emotional).filter((r) => r.id.includes("suicidal"));
      // Guards the harness as much as the contract: if the branch stops firing
      // for these answers, the assertion below would pass vacuously.
      expect(suicidal.length).toBe(1);
      expect(isSuicidalityText(suicidal[0].symptomText)).toBe(true);
      expect(generalizeFinding(suicidal[0].symptomText)).toBe(GENERAL_EMOTIONAL_FINDING);
    });
  }

  it("the same branches with the suicidality answer off produce nothing that is recognised", () => {
    for (const [, emotional] of cases) {
      const off = Object.fromEntries(
        Object.entries(emotional).map(([k, v]) => [k, /Suicidal|Death/.test(k) ? false : v]),
      );
      for (const r of adultRecs(off)) expect(isSuicidalityText(r.symptomText)).toBe(false);
    }
  });
});

describe("kids: the suicidality answer produces a recognisable box", () => {
  const base = { _grade: "ט", _age: "15", a_emo: "הרבה", q3: 4, mq1: "כן", mq2: "כן", mq3: "כן", mq4: "כן" };
  const boxes = (extra: Record<string, unknown>) =>
    Object.values(scoreKidsQuestionnaire({ ...base, ...extra })).flat();

  it("q3_sui = כן is recognised - the signal the kids counter reads", () => {
    expect(boxes({ q3_sui: "כן" }).some((b) => isSuicidalityText(b.txt))).toBe(true);
  });

  it("with q3_sui = לא no box is recognised, so the counter is not inflated", () => {
    expect(boxes({ q3_sui: "לא" }).some((b) => isSuicidalityText(b.txt))).toBe(false);
  });
});
