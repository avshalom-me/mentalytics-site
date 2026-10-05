import { describe, it, expect } from "vitest";
import { scoreQuestionnaire, OCCUPATIONAL_ASSESSMENT_OFFERED } from "./questionnaire-score";
import type { QuestionnaireAnswers, Recommendation } from "./questionnaire-types";

// The functional / occupational domain of the adults questionnaire, after the
// owner's decisions of 5/10/2026:
//   - COG-FUN is an external referral, never a search (too few therapists);
//   - the occupational recommendation is the main one of its section;
//   - while nobody reachable assesses, the assessment verdict is the treatment.

const COGFUN = "טיפול COG-FUN לקשיי קשב וריכוז";

function functional(f: NonNullable<QuestionnaireAnswers["functional"]>): QuestionnaireAnswers {
  return { age: 35, gender: "f", domains: ["functional"], functional: f };
}

/** Attention block positive with two executive items - what used to earn a COG-FUN search. */
const ATTENTION_WITH_EF = {
  f1: true, f1Attention: true, adhd1Count: 4, adhd2Count: 0, adhdEfCount: 2,
  f2: true, f2Gate: true,
} as const;

const EXEC_FULL = [3, 3, 3, 3, 3, 3];   // 18: a finding
const EXEC_LOW = [1, 1, 1, 1, 1, 1];    // 6: answered, nothing found
const EXEC_BLANK = [0, 0, 0, 0, 0, 0];  // screen skipped

const cogfunRecs = (recs: Recommendation[]) => recs.filter((r) => r.treatment === COGFUN);
const searchable = (recs: Recommendation[]) => recs.filter((r) => !r.external);

describe("COG-FUN is an external referral", () => {
  it("never leaves the attention block as a search", () => {
    const { recommendations: recs } = scoreQuestionnaire(
      functional({ ...ATTENTION_WITH_EF, execScores: EXEC_LOW, f3: false }),
    );
    const cogfun = cogfunRecs(recs);
    expect(cogfun).toHaveLength(1);
    expect(cogfun[0].external).toBe(true);
    // The neurologist/psychiatrist referral and COG-FUN share the card, as one
    // referral outside the site.
    expect(cogfun[0].notes).toMatch(/נוירולוג או פסיכיאטר/);
    expect(cogfun[0].notes).toMatch(/COG-FUN/);
    // What the site can search for is still there.
    expect(searchable(recs).map((r) => r.treatment)).toContain("נוירופידבק");
  });

  it("is the whole result, and still external, when only the executive questionnaire fired", () => {
    const { recommendations: recs } = scoreQuestionnaire(
      functional({ f2: true, f2Gate: true, execScores: [2, 2, 2, 2, 2, 2], f3: false }),
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].treatment).toBe(COGFUN);
    expect(recs[0].external).toBe(true);
    expect(recs[0].notes).toMatch(/נוירולוג/);
    expect(recs[0].notes).toMatch(/COG-FUN/);
    expect(searchable(recs)).toHaveLength(0);
  });

  it("says each referral once when the attention block and the executive questionnaire both fire", () => {
    const { recommendations: recs } = scoreQuestionnaire(
      functional({ ...ATTENTION_WITH_EF, execScores: EXEC_FULL, f3: false }),
    );
    const cogfun = cogfunRecs(recs);
    expect(cogfun).toHaveLength(2);
    expect(cogfun.every((r) => r.external)).toBe(true);
    // The screen shows the distinct notes of a group; the COG-FUN sentence must
    // not appear in two of them.
    const notes = [...new Set(cogfun.map((r) => r.notes).filter(Boolean))].join(" ");
    expect(notes.match(/COG-FUN/g)).toHaveLength(1);
  });

  it("is external for the not-characterised case too, and not repeated after the attention block raised it", () => {
    const blank = scoreQuestionnaire(
      functional({ f2: true, f2Gate: true, execScores: EXEC_BLANK, f3: false }),
    ).recommendations;
    expect(blank).toHaveLength(1);
    expect(blank[0].external).toBe(true);
    expect(blank[0].notes).toMatch(/COG-FUN/);

    const withAttention = scoreQuestionnaire(
      functional({ ...ATTENTION_WITH_EF, execScores: EXEC_BLANK, f3: false }),
    ).recommendations;
    expect(cogfunRecs(withAttention)).toHaveLength(1);
  });

  it("no COG-FUN recommendation anywhere is a search", () => {
    const variants: QuestionnaireAnswers[] = [
      functional({ ...ATTENTION_WITH_EF, execScores: EXEC_FULL, f3: false }),
      functional({ f2: true, f2Gate: true, execScores: EXEC_FULL, f3: false }),
      functional({ f2: true, f2Gate: true, execScores: EXEC_BLANK, f3: false }),
      functional({
        f2: true, f2Bridge: true, execScores: EXEC_FULL,
        f3: true, employmentType: "burnout", empBItems: [true, false, false, false, true],
      }),
    ];
    for (const v of variants) {
      for (const r of cogfunRecs(scoreQuestionnaire(v).recommendations)) {
        expect(r.external).toBe(true);
      }
    }
  });
});

describe("the occupational recommendation leads its section", () => {
  it("comes before neurofeedback for someone with both findings", () => {
    const { recommendations: recs } = scoreQuestionnaire(
      functional({
        ...ATTENTION_WITH_EF, execScores: EXEC_LOW,
        f3: true, employmentType: "career-change", empBItems: [true, true, false, false, false],
      }),
    );
    const first = searchable(recs)[0];
    expect(first.treatment).toBe("טיפול תעסוקתי");
    expect(searchable(recs).map((r) => r.treatment)).toContain("נוירופידבק");
  });

  it("stays first when the planning item of the occupational checklist opens the executive questionnaire", () => {
    const { recommendations: recs } = scoreQuestionnaire(
      functional({
        f2: true, f2Bridge: true, execScores: EXEC_FULL,
        f3: true, employmentType: "burnout", empBItems: [true, false, false, false, true],
      }),
    );
    expect(recs[0].treatment).toBe("טיפול תעסוקתי");
    expect(recs[0].external).toBeFalsy();
    expect(cogfunRecs(recs)).toHaveLength(1);
  });

  it("does not move findings out of other domains", () => {
    const { recommendations: recs } = scoreQuestionnaire({
      age: 35, gender: "f", domains: ["relationship", "functional"],
      relationship: { rSingle: true },
      functional: { f3: true, employmentType: "disability" },
    });
    expect(recs[0].domain).toBe("סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים");
    expect(recs.find((r) => r.domain === "זוגיות ומשפחה")).toBeDefined();
  });
});

describe("the assessment verdict while nobody reachable assesses", () => {
  const verdictFor = (f: NonNullable<QuestionnaireAnswers["functional"]>) =>
    scoreQuestionnaire(functional(f)).recommendations.find((r) => r.id.startsWith("employment-assess"));

  const young = verdictFor({ f3: true, employmentType: "young", empAItems: [false, false, false, true, true] });
  const other = verdictFor({ f3: true, employmentType: "other", empBItems: [false, false, false, false] });

  it("is reached from both checklists", () => {
    expect(young).toBeDefined();
    expect(other).toBeDefined();
  });

  it("is the treatment card, with the note that says to seek an assessment, unless assessors are offered", () => {
    const expected = OCCUPATIONAL_ASSESSMENT_OFFERED ? "אבחון תעסוקתי" : "טיפול תעסוקתי";
    for (const r of [young!, other!]) {
      expect(r.treatment).toBe(expected);
      expect(r.treatmentLabel).toBe(expected);
      expect(r.external).toBeFalsy();
      expect(r.notes).toMatch(/אבחון תעסוקתי/);
    }
  });

  it("never produces an assessor search while the switch is off", () => {
    if (OCCUPATIONAL_ASSESSMENT_OFFERED) return;
    const all = [
      scoreQuestionnaire(functional({ f3: true, employmentType: "young", empAItems: [false, false, false, true, true] })),
      scoreQuestionnaire(functional({ f3: true, employmentType: "other", empBItems: [false, false, false, false] })),
      scoreQuestionnaire(functional({ f3: true, employmentType: "career-change", empBItems: [true, true, false, false, false] })),
      scoreQuestionnaire(functional({ f3: true, employmentType: "disability", disabilityNl: false })),
    ].flatMap((s) => s.recommendations);
    expect(all.some((r) => r.treatment === "אבחון תעסוקתי")).toBe(false);
  });

  it("leaves the verdict that was already a treatment alone", () => {
    const psy = scoreQuestionnaire(
      functional({ f3: true, employmentType: "career-change", empBItems: [true, true, false, false, false] }),
    ).recommendations[0];
    expect(psy.treatment).toBe("טיפול תעסוקתי");
    expect(psy.treatmentLabel).toBe("פסיכולוג תעסוקתי");
    const dis = scoreQuestionnaire(
      functional({ f3: true, employmentType: "disability", disabilityNl: true }),
    ).recommendations[0];
    expect(dis.treatment).toBe("טיפול תעסוקתי");
    expect(dis.treatmentLabel).toBe("טיפול תעסוקתי");
  });
});
