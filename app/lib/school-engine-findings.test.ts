/**
 * Findings the review mode surfaced on 1/10/2026 in the counsellor questionnaire
 * and its scorer, fixed on 27/10/2026. Each test drives the real scorer on a
 * bank case and states the behaviour the fix made true.
 */
import { describe, it, expect, vi } from "vitest";

// The scorer imports "server-only"; the cases drive it end to end.
vi.mock("server-only", () => ({}));

import { scoreKidsQuestionnaire } from "./kids-score.server";
import { eligibilityRoutes, schoolAsksDocs } from "./school-report";
import { foundDomains, parseKidsBoxes, type KidsBox } from "./kids-recommendations";
import { completeAnswers, pagesShown } from "../kids/review/case-builder";
import { shownOnReport } from "../kids/review/coverage";
import { REVIEW_CASES } from "../kids/review/cases";
import { withScoredFacts } from "../kids/review/derive";
import type { Ans } from "../kids/quiz-logic";

const TODAY = "2026-10-01";
const caseSpec = (id: string): Ans => REVIEW_CASES.find(c => c.id === id)!.spec(TODAY);
const scored = (spec: Ans) => {
  const A0 = completeAnswers(spec);
  const score = scoreKidsQuestionnaire(A0);
  return { A0, score, A: withScoredFacts(A0, score) };
};
const lines = (boxes: KidsBox[]) => boxes.flatMap(b => b.txt.split("\n"));

describe('"מה קיים בתיק" at school', () => {
  it("is asked from י' even when no committee route opened", () => {
    const { A, score } = scored(caseSpec("tomer-10"));
    expect(eligibilityRoutes(A).live).toEqual([]);
    expect(A._route).toBe(true);
    expect(pagesShown(A)).toContain("p-docs");
    // The card reads the file it was just told about: no request for an assessment it already holds.
    expect(shownOnReport(A, score, TODAY).tracks.map(t => t.key)).not.toContain("assessment");
  });

  it("stays skipped in the years where the accommodations are only background", () => {
    const { A } = scored({ ...caseSpec("tomer-10"), _grade: "ט", _age: "14" });
    expect(A._route).toBe(false);
    expect(pagesShown(A)).not.toContain("p-docs");
  });

  it("is decided by one function: a live route, or י' and up", () => {
    expect(schoolAsksDocs({ _grade: "י" })).toBe(true);
    expect(schoolAsksDocs({ _grade: "יב" })).toBe(true);
    expect(schoolAsksDocs({ _grade: "ט" })).toBe(false);
    expect(schoolAsksDocs({ _grade: "גן" })).toBe(false); // a kindergarten is decided in PageRefineGan
  });
});

describe("the emotional committee route and the default referral", () => {
  it("does not open on low-level tension alone", () => {
    const { score, A } = scored(caseSpec("noam-8"));
    // The premise: this child's only emotional result is the scorer's fallback.
    expect(score.emotional.some(b => b.isDefault)).toBe(true);
    expect(A._found).toEqual(["academic"]);
    expect(eligibilityRoutes(A).live).toEqual(["learning"]);
  });

  it("still counts a referral that a finding produced", () => {
    const low: KidsBox = { cls: "purple", txt: "📊 נמצאו סימפטומים של מתח ברמה נמוכה", isLowStress: true };
    const fallback: KidsBox = { cls: "info", txt: "✅ הפנייה: טיפול פסיכודינאמי", isDefault: true };
    const empty = { emotional: [], academic: [], developmental: [], behavioral: [], social: [] };
    expect(foundDomains({ ...empty, emotional: [low, fallback] })).toEqual([]);
    expect(foundDomains({ ...empty, emotional: [low, { ...fallback, isDefault: undefined }] })).toEqual(["emotional"]);
    // A real anxiety finding is a finding, whatever else was flagged.
    expect(scored(caseSpec("maya-10")).A._found).toContain("emotional");
  });
});

describe("social friction at the higher severity", () => {
  it("names the social group and the classroom tools, as at the lower severity", () => {
    const { score } = scored(caseSpec("yoav-5")); // severity 5, with a behavioural plan beside it
    expect(lines(score.social).join(" ")).toContain("קשיים חברתיים גבוהים - הפנייה לקבוצה חברתית + כלים לעבודה בכיתה");
    const keys = parseKidsBoxes(score.social, "social").groups.map(g => g.treatmentKey);
    expect(keys).toContain("קבוצה חברתית");
    // The card is not the empty one.
    expect(keys).not.toEqual(["_no_action"]);
  });

  it("keeps the therapy referral behind its own gate", () => {
    // Social alone, severity 6: the group referral AND the therapy line the scorer already gave.
    const alone: Ans = {
      _audience: "counselor", c_role: "school", _age: "11", _grade: "ה", c_duration: "over_year",
      a_soc: "הרבה", soc1: "לא", soc2: "כן", soc2_sev: 6, soc3: "לא", t_motiv: 4, t_prac: 4,
    };
    const text = lines(scored(alone).score.social).join(" ");
    expect(text).toContain("הפנייה לקבוצה חברתית");
    expect(text).toContain("יש להפנות לטיפול פסיכודינאמי משולב + CBT");
    // The sentence that used to carry both is gone: the therapy is not promised twice.
    expect(text).not.toContain("טיפול פסיכודינאמי ע\"פ מאפייני הילד");
    // Beside an emotional therapy referral the social card used to read "no action needed".
    const withEmotional = scored({ ...alone, a_emo: "הרבה", q1: 4, aq1: 3, aq2: 3, aq3: 3, aq4: 2, aq5: 3, aq6: 2, aq7: 3, aq8: 1, aq9: 1, aq10: 3, q2: 2, q3: 2 });
    expect(parseKidsBoxes(withEmotional.score.social, "social").groups.map(g => g.treatmentKey)).toContain("קבוצה חברתית");
  });

  it("matches the lower severity in shape", () => {
    const { score } = scored({ ...caseSpec("yoav-5"), soc2_sev: 3 });
    expect(lines(score.social).join(" ")).toContain("קשיים חברתיים מתונים - הפנייה לקבוצה חברתית + כלים לעבודה בכיתה");
  });
});

describe("kindergarten wording", () => {
  const ganCommunication = (): Ans => ({
    ...caseSpec("gan-autism"),
    a_soc: "הרבה", soc3: "כן", comm1: "כן", comm2: "כן", comm3: "כן", comm_rep: "כן",
  });

  it("sends a kindergarten to the teacher and the setting's psychologist, not to the school's", () => {
    const { score } = scored(ganCommunication());
    const text = lines(score.social).join(" ");
    expect(text).toContain("הגננת ופסיכולוג הגן");
    expect(text).not.toContain("בית הספר");
  });

  it("keeps the school wording at school", () => {
    const { score } = scored({ ...ganCommunication(), _audience: "counselor", c_role: "school", _grade: "ה", _age: "10" });
    expect(lines(score.social).join(" ")).toContain("יועצת ופסיכולוג בית הספר");
  });

  it("closes the behavioural plan with the teacher in a kindergarten, the counsellor at school", () => {
    const gan = scored(caseSpec("gan-behavior")).score;
    expect(lines(gan.behavioral).join(" ")).toContain("לפנות לגננת לתיאום בין הבית לגן");
    expect(JSON.stringify(gan)).not.toContain("לפנות ליועצת בית הספר");
    const school = scored(caseSpec("yoav-5")).score;
    expect(lines(school.behavioral).join(" ")).toContain("לפנות ליועצת בית הספר לתיאום בין הבית לבית הספר");
  });
});
