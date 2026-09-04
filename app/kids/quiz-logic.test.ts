/**
 * Characterization tests for the kids questionnaire's routing logic.
 *
 * These do not assert what the questionnaire *should* do - they pin what it
 * does today, so a refactor that changes behaviour fails loudly instead of
 * silently. The failure mode being guarded against is specific: a screen
 * skipped by mistake leaves its field at 0, and the scoring engine reads 0 as
 * a real answer rather than a missing one, so the report changes without any
 * error being raised.
 *
 * When one of these fails the question is "did I mean to change this?", not
 * "how do I make the test pass".
 */

import { describe, it, expect } from "vitest";
import {
  PAGES,
  gg,
  acadGg,
  devAgeOk,
  pqThresholdFor,
  traitNeeds,
  skipPage,
  nextPid,
  prevPid,
  updAQ,
  updPQ,
  isUnknown,
  markUnknown,
  markKnown,
  schoolWording,
  sw,
  type Ans,
} from "./quiz-logic";

const EMO: Ans = { a_emo: "הרבה" };

describe("PAGES", () => {
  it("opens on consent and ends on the report", () => {
    expect(PAGES[0]).toBe("p-consent");
    expect(PAGES[PAGES.length - 1]).toBe("p-result");
  });

  it("has no duplicate screen ids", () => {
    expect(new Set(PAGES).size).toBe(PAGES.length);
  });
});

describe("gg - general grade track", () => {
  it("reads the grade when there is one", () => {
    expect(gg({ _grade: "א" })).toBe("ga");
    expect(gg({ _grade: "ג" })).toBe("bv");
    expect(gg({ _grade: "י" })).toBe("zy");
  });

  it("falls back to age when no grade was given", () => {
    expect(gg({ _age: "5" })).toBe("ga");
    expect(gg({ _age: "10" })).toBe("bv");
    expect(gg({ _age: "15" })).toBe("zy");
  });

  it("lets the grade win over a contradicting age", () => {
    expect(gg({ _grade: "ג", _age: "16" })).toBe("bv");
  });

  it("returns empty when it knows neither", () => {
    expect(gg({})).toBe("");
  });
});

describe("acadGg - academic grade track", () => {
  it("splits the grades into the five teaching bands", () => {
    expect(acadGg({ _grade: "גן" })).toBe("gan");
    expect(acadGg({ _grade: "ב" })).toBe("ag");
    expect(acadGg({ _grade: "ה" })).toBe("dv");
    expect(acadGg({ _grade: "ח" })).toBe("zh");
    expect(acadGg({ _grade: "יא" })).toBe("tyb");
  });

  it("falls back to age", () => {
    expect(acadGg({ _age: "6" })).toBe("gan");
    expect(acadGg({ _age: "9" })).toBe("ag");
    expect(acadGg({ _age: "12" })).toBe("dv");
    expect(acadGg({ _age: "14" })).toBe("zh");
    expect(acadGg({ _age: "17" })).toBe("tyb");
  });

  it("falls all the way back to gan when it knows neither age nor grade", () => {
    // An unparseable age becomes 0, and 0 clears the first band. Unreachable
    // from the questionnaire itself - p-demo will not advance without an age -
    // but worth pinning: unlike gg, which returns "" when it knows nothing,
    // acadGg always commits to a band, and the band it commits to is the
    // youngest one.
    expect(acadGg({})).toBe("gan");
    expect(acadGg({ _age: "" })).toBe("gan");
  });
});

describe("devAgeOk - sensory screen eligibility", () => {
  it("opens under 7 or on the ga track", () => {
    expect(devAgeOk({ _age: "5" })).toBe(true);
    expect(devAgeOk({ _grade: "א" })).toBe(true);
  });

  it("closes for older children", () => {
    expect(devAgeOk({ _age: "9" })).toBe(false);
    expect(devAgeOk({ _grade: "ג" })).toBe(false);
  });
});

describe("pqThresholdFor - psychosis referral gate", () => {
  it("needs no confirming item once hallucinations were reported", () => {
    expect(pqThresholdFor({ q7a: "כן" })).toBe(0);
  });

  it("needs 2 of 3 on the beliefs-only path", () => {
    expect(pqThresholdFor({ q7b: "כן" })).toBe(2);
  });

  it("is unreachable when neither gate was endorsed, so a skipped section never counts", () => {
    expect(pqThresholdFor({})).toBe(Infinity);
    expect(0 >= pqThresholdFor({})).toBe(false);
  });
});

describe("skipPage", () => {
  it("closes the whole emotional block when the area was not flagged", () => {
    expect(skipPage("p-q1", {})).toBe(true);
    expect(skipPage("p-aq", { q1: 3 })).toBe(true);
    expect(skipPage("p-q1", EMO)).toBe(false);
  });

  it("opens the anxiety items only above the gate", () => {
    expect(skipPage("p-aq", { ...EMO, q1: 2 })).toBe(true);
    expect(skipPage("p-aq", { ...EMO, q1: 3 })).toBe(false);
  });

  it("asks about suicidal thoughts only once the mood score clears 4", () => {
    expect(skipPage("p-mq-sui", { ...EMO, mq_tot: 3 })).toBe(true);
    expect(skipPage("p-mq-sui", { ...EMO, mq_tot: 4 })).toBe(false);
  });

  it("asks the addiction control question of grades ב-ו only", () => {
    expect(skipPage("p-q4-ctrl", { ...EMO, q4: "כן", _grade: "ג" })).toBe(false);
    expect(skipPage("p-q4-ctrl", { ...EMO, q4: "כן", _grade: "י" })).toBe(true);
    expect(skipPage("p-q4-ctrl", { ...EMO, _grade: "ג" })).toBe(true);
  });

  it("routes ב-ו regulation to the attention items and everyone else to BQ", () => {
    expect(skipPage("p-bq", { ...EMO, q9: "כן", _grade: "ג" })).toBe(true);
    expect(skipPage("p-q9-adhd", { ...EMO, q9: "כן", _grade: "ג" })).toBe(false);
    expect(skipPage("p-bq", { ...EMO, q9: "כן", _grade: "י" })).toBe(false);
    expect(skipPage("p-q9-adhd", { ...EMO, q9: "כן", _grade: "י" })).toBe(true);
  });

  it("drops the psychosis follow-up once hallucinations carry the referral alone", () => {
    expect(skipPage("p-pq", { ...EMO, q7b: "כן" })).toBe(false);
    expect(skipPage("p-pq", { ...EMO, q7b: "כן", q7a: "כן" })).toBe(true);
    expect(skipPage("p-pq", EMO)).toBe(true);
  });

  it("shows the general-distress screen only when nothing else came back positive", () => {
    expect(skipPage("p-q10", EMO)).toBe(false);
    expect(skipPage("p-q10", { ...EMO, q1: 3 })).toBe(true);
    // q7a sets the threshold to 0, so an untouched pq_tot of 0 already clears it.
    expect(skipPage("p-q10", { ...EMO, q7a: "כן" })).toBe(true);
  });

  it("gates the sensory screen on both the area and the age", () => {
    expect(skipPage("p-dev-sensory", { a_dev: "הרבה", _age: "5" })).toBe(false);
    expect(skipPage("p-dev-sensory", { a_dev: "הרבה", _age: "9" })).toBe(true);
    expect(skipPage("p-dev-sensory", { _age: "5" })).toBe(true);
  });

  it("gates each remaining domain on its own area answer", () => {
    expect(skipPage("p-acad", { a_aca: "מעט" })).toBe(false);
    expect(skipPage("p-acad", {})).toBe(true);
    expect(skipPage("p-beh", { a_beh: "הרבה מאוד" })).toBe(false);
    expect(skipPage("p-soc", {})).toBe(true);
  });
});

describe("nextPid / prevPid", () => {
  it("walks straight past every domain the parent did not flag", () => {
    expect(nextPid("p-areas", { a_soc: "הרבה" })).toBe("p-soc");
    expect(nextPid("p-areas", EMO)).toBe("p-q1");
  });

  it("lands on the report when nothing is left to ask", () => {
    expect(nextPid("p-soc", { a_soc: "הרבה" })).toBe("p-result");
  });

  it("stops at the traits screen once the scoring will actually read a trait", () => {
    // socTherapyPossible: a social finding that needs a treatment recommendation.
    expect(nextPid("p-soc", { a_soc: "הרבה", soc3: "כן" })).toBe("p-traits");
  });

  it("goes back to the last screen that was shown, not the previous index", () => {
    expect(prevPid("p-result", { a_soc: "הרבה" })).toBe("p-soc");
    expect(prevPid("p-q1", EMO)).toBe("p-areas");
  });

  it("never walks off either end", () => {
    expect(prevPid("p-consent", {})).toBe("p-consent");
    expect(nextPid("p-result", {})).toBe("p-result");
  });

  it("opens the emotional block with a word to the counsellor, and only to her", () => {
    const emo: Ans = { a_emo: "הרבה" };
    expect(skipPage("p-emo-intro", emo)).toBe(true);
    expect(skipPage("p-emo-intro", { ...emo, _audience: "counselor" })).toBe(false);
    // Not flagged the emotional area at all: nobody sees it.
    expect(skipPage("p-emo-intro", { _audience: "counselor" })).toBe(true);
    expect(nextPid("p-areas", { ...emo, _audience: "counselor" })).toBe("p-emo-intro");
    expect(nextPid("p-emo-intro", { ...emo, _audience: "counselor" })).toBe("p-q1");
    expect(nextPid("p-areas", emo)).toBe("p-q1");
  });

  it("shows the refinement screen to a counsellor only, right before the report", () => {
    const parent: Ans = { a_soc: "הרבה" };
    const counselor: Ans = { ...parent, _audience: "counselor" };
    expect(skipPage("p-refine", parent)).toBe(true);
    expect(skipPage("p-refine", counselor)).toBe(false);
    expect(nextPid("p-soc", parent)).toBe("p-result");
    expect(nextPid("p-soc", counselor)).toBe("p-refine");
    expect(nextPid("p-refine", counselor)).toBe("p-result");
    expect(prevPid("p-result", counselor)).toBe("p-refine");
    expect(prevPid("p-result", parent)).toBe("p-soc");
  });
});

describe("traitNeeds", () => {
  const anxiousBv: Ans = { _grade: "ג", a_emo: "הרבה", q1: 3, aq_tot: 18 };

  it("asks ב-ו for motivation on the anxiety path", () => {
    expect(traitNeeds(anxiousBv).motiv).toBe(true);
  });

  it("holds verbality back until motivation is known and high enough", () => {
    expect(traitNeeds(anxiousBv).verbal).toBe(false);
    expect(traitNeeds({ ...anxiousBv, t_motiv: 2 }).verbal).toBe(false);
    expect(traitNeeds({ ...anxiousBv, t_motiv: 3 }).verbal).toBe(true);
  });

  it("asks about practice only on the high-anxiety branch that reads it", () => {
    expect(traitNeeds({ ...anxiousBv, t_motiv: 5 }).prac).toBe(false);
    expect(traitNeeds({ ...anxiousBv, aq_tot: 21, t_motiv: 5 }).prac).toBe(true);
  });

  it("asks ז-יב for interests only when a branch reads them", () => {
    const anxiousZy: Ans = { _grade: "י", a_emo: "הרבה", q1: 3, aq_tot: 22, t_motiv: 4 };
    expect(traitNeeds(anxiousZy).interests).toBe(false);
    expect(traitNeeds({ ...anxiousZy, q10_par: "כן" }).interests).toBe(true);
  });

  it("covers the social-treatment path in every age group, deliberately over-inclusively", () => {
    expect(traitNeeds({ a_soc: "הרבה", soc3: "כן" }).motiv).toBe(true);
    expect(traitNeeds({ a_soc: "הרבה", soc2: "כן", soc2_sev: 5 }).motiv).toBe(true);
    expect(traitNeeds({ a_soc: "הרבה", soc2: "כן", soc2_sev: 4 }).motiv).toBe(false);
  });

  it("asks the ga track for the child's own consent on any positive finding", () => {
    expect(traitNeeds({ _grade: "א", a_emo: "הרבה", q1: 3 }).gaConsent).toBe(true);
    expect(traitNeeds({ _grade: "א" }).gaConsent).toBe(false);
  });

  it("asks ז-יב about practice on the sub-clinical regulation finding", () => {
    const regModerate: Ans = { _grade: "י", q9: "כן", bq_tot: 4, t_motiv: 3 };
    expect(traitNeeds(regModerate).motiv).toBe(true);
    expect(traitNeeds(regModerate).prac).toBe(true);
    // bq_tot 5 is the clinical finding, not the sub-clinical one this branch reads.
    expect(traitNeeds({ ...regModerate, bq_tot: 5 }).motiv).toBe(false);
  });

  it("leaves verbal and prac out of the decision to show the screen at all", () => {
    // Both depend on the motivation answer given on this very screen, so they
    // are always false while deciding whether to show it - except the zy
    // verbality path, which stands on its own.
    const zyVerbalOnly: Ans = { _grade: "י", a_soc: "הרבה", soc1: "כן", lsas_tot: 8 };
    expect(traitNeeds(zyVerbalOnly).verbal).toBe(true);
    expect(skipPage("p-traits", zyVerbalOnly)).toBe(false);
  });
});

describe('"לא ידוע / לא רלוונטי"', () => {
  it("remembers the click without putting anything the scoring reads into the answers", () => {
    const A = markUnknown({ q5: "לא" }, "q5");
    expect(isUnknown(A, "q5")).toBe(true);
    expect(A.q5).toBe("לא");
    expect(Object.keys(A).filter(k => !k.endsWith("__unk"))).toEqual(["q5"]);
  });

  it("is cleared by a real answer", () => {
    const A = markKnown(markUnknown({ q5: "לא" }, "q5"), "q5");
    expect(isUnknown(A, "q5")).toBe(false);
  });

  it("is per item", () => {
    const A = markUnknown({ q5: "לא", q6: "כן" }, "q5");
    expect(isUnknown(A, "q6")).toBe(false);
  });

  it("keeps a battery total inside its own scale, never below the floor", () => {
    // The anxiety scale runs 1-3, so its "כלל לא" is 1. Ten unknown items give
    // 10, the legal floor - not 0, which is below anything the scale can produce
    // and would drag the total under the threshold that names the finding.
    let A: Ans = {};
    for (let i = 1; i <= 10; i++) A = markUnknown(updAQ(A, `aq${i}`, 1), `aq${i}`);
    expect(A.aq_tot).toBe(10);
    expect(A.aq_tot).toBeLessThan(16); // still below the finding threshold, as "no" should be
    expect(countMissingKeys(A, 10)).toBe(0);
  });

  it("counts an unknown item as answered, so the screen is not blocked", () => {
    const A = markUnknown(updAQ({}, "aq1", 1), "aq1");
    expect(A.aq1).toBe(1);
    expect(A.aq1 === undefined).toBe(false);
  });
});

/** Mirrors countMissing in ui.tsx: undefined, null and "" are unanswered. */
function countMissingKeys(A: Ans, n: number): number {
  return Array.from({ length: n }, (_, i) => `aq${i + 1}`)
    .filter(k => A[k] === undefined || A[k] === null || A[k] === "").length;
}

describe("schoolWording", () => {
  it("turns the child into the student, keeping any Hebrew prefix", () => {
    expect(schoolWording("ילדך חש דאגות")).toBe("התלמיד/ה חש דאגות");
    expect(schoolWording("האם הילד/ה סובל/ת מכאבים?")).toBe("האם התלמיד/ה סובל/ת מכאבים?");
    expect(schoolWording("שקשה לילד/ה להפסיק")).toBe("שקשה לתלמיד/ה להפסיק");
    expect(schoolWording("התרשמותך מהילד באותה תקופה")).toBe("התרשמותך מהתלמיד/ה באותה תקופה");
    expect(schoolWording("האם הילד מסכים?")).toBe("האם התלמיד/ה מסכים?");
    expect(schoolWording("ילדכם מתמודדים")).toBe("התלמיד/ה מתמודדים");
  });

  it("leaves the plural alone, because there it means the class", () => {
    expect(schoolWording("בין הילדים הכי מתקשים בכיתה")).toBe("בין הילדים הכי מתקשים בכיתה");
  });

  it("applies only to a counsellor, and an explicit text wins", () => {
    const parent: Ans = {};
    const counselor: Ans = { _audience: "counselor" };
    expect(sw(parent, "ילדך חש דאגות")).toBe("ילדך חש דאגות");
    expect(sw(counselor, "ילדך חש דאגות")).toBe("התלמיד/ה חש דאגות");
    expect(sw(counselor, "ילדך חש דאגות", "התלמיד/ה חש/ה דאגות")).toBe("התלמיד/ה חש/ה דאגות");
    expect(sw(parent, "ילדך חש דאגות", "התלמיד/ה חש/ה דאגות")).toBe("ילדך חש דאגות");
  });
});

describe("score updaters - the totals the server trusts", () => {
  it("recomputes the anxiety total across all ten items", () => {
    let A: Ans = {};
    for (let i = 1; i <= 10; i++) A = updAQ(A, `aq${i}`, 2);
    expect(A.aq_tot).toBe(20);
  });

  it("counts only the three surviving thought-disturbance items", () => {
    const A = updPQ(updPQ(updPQ({}, "pq11", "כן"), "pq13", "כן"), "pq8", "לא");
    expect(A.pq_tot).toBe(2);
  });

  it("treats an unanswered item as zero, which is what the scoring also does", () => {
    const A = updAQ({}, "aq1", 3);
    expect(A.aq_tot).toBe(3);
  });
});
