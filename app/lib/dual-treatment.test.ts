import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CBT, CBT_OR_DYNAMIC, DYNAMIC, OPTION_HINT, asOption, combinedSearch, groupCoverage, isBoth, offersChoice, optionOrder, sameKeys, searchFor, treatmentKeys } from "./dual-treatment";
import { scoreQuestionnaire } from "./questionnaire-score";
import { adultResultKeys } from "./quiz-result-facts";
import type { QuestionnaireAnswers } from "./questionnaire-types";

const bothCard = () =>
  scoreQuestionnaire({
    age: 30,
    gender: "x",
    domains: ["emotional"],
    emotional: { moodItems: [0, 1, 2, 3, 4, 5], therapistStyleQ1: 4, therapistStyleQ2: 4, therapistStyleQ3: 4 },
  } as unknown as QuestionnaireAnswers).recommendations[0];

describe("a 'both' card", () => {
  it("is what the scorer sends in the middle, under the joint key this module knows", () => {
    const card = bothCard();
    expect(card.treatment).toBe(CBT_OR_DYNAMIC);
    expect(card.treatmentOptions).toEqual([CBT, DYNAMIC]);
    expect(isBoth(card)).toBe(true);
    expect(isBoth({ treatmentOptions: undefined })).toBe(false);
    expect(isBoth(null)).toBe(false);
  });

  it("has a line for each of its choices", () => {
    for (const o of bothCard().treatmentOptions ?? []) expect(OPTION_HINT[o]).toBeTruthy();
  });

  it("offers the choice on screen, but never on an urgent card", () => {
    expect(offersChoice(bothCard(), false)).toBe(true);
    expect(offersChoice(bothCard(), true)).toBe(false);
    expect(offersChoice({ treatmentOptions: undefined }, false)).toBe(false);
  });

  it("a suicidality finding in the middle zone is urgent, so it never shows the choice", () => {
    const recs = scoreQuestionnaire({
      age: 30,
      gender: "x",
      domains: ["emotional"],
      emotional: { moodSuicidal: true, moodItems: [], therapistStyleQ1: 4, therapistStyleQ2: 4, therapistStyleQ3: 4 },
    } as unknown as QuestionnaireAnswers).recommendations;
    const urgent = recs.filter((r) => r.urgent);
    expect(urgent.length).toBeGreaterThan(0);
    for (const r of urgent) expect(offersChoice(r, r.urgent)).toBe(false);
  });
});

describe("optionOrder", () => {
  it("is fixed for a visit and does not change the list it was given", () => {
    const options = [CBT, DYNAMIC];
    expect(optionOrder(options, "abc123")).toEqual(optionOrder(options, "abc123"));
    expect(options).toEqual([CBT, DYNAMIC]);
  });

  it("puts each method first for about half of the visits", () => {
    let cbtFirst = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const id = Math.random().toString(36).slice(2, 18);
      if (optionOrder([CBT, DYNAMIC], id)[0] === CBT) cbtFirst++;
    }
    expect(cbtFirst / n).toBeGreaterThan(0.4);
    expect(cbtFirst / n).toBeLessThan(0.6);
  });

  it("an empty seed (storage blocked) still gives a valid order", () => {
    expect(optionOrder([CBT, DYNAMIC], "").sort()).toEqual([CBT, DYNAMIC].sort());
  });
});

describe("the search a card sends", () => {
  it("a 'both' card asks for either method: one group of two", () => {
    expect(searchFor(bothCard())).toEqual({ treatmentTypes: [CBT, DYNAMIC], treatmentGroups: [[CBT, DYNAMIC]] });
  });

  it("one chosen method is an ordinary single search", () => {
    const chosen = asOption(bothCard(), DYNAMIC);
    expect(chosen.treatment).toBe(DYNAMIC);
    expect(chosen.treatmentLabel).toBe(DYNAMIC);
    expect(chosen.treatmentOptions).toBeUndefined();
    expect(searchFor(chosen)).toEqual({ treatmentTypes: [DYNAMIC], treatmentGroups: [] });
  });

  it("nothing selected sends nothing", () => {
    expect(searchFor(null)).toEqual({ treatmentTypes: [], treatmentGroups: [] });
  });

  it("the match API scores groups with groupCoverage", () => {
    const src = readFileSync(join(process.cwd(), "app/api/match/route.ts"), "utf8");
    expect(src).toMatch(/const treatmentGroups: string\[\]\[\] = Array\.isArray\(body\.treatmentGroups\)/);
    expect(src).toMatch(/coverage = groupCoverage\(trainingAreas, \[\.\.\.input\.treatmentGroups, \.\.\.loose\], normalizeText\);/);
  });
});

describe("groupCoverage", () => {
  const id = (s: string) => s.toLowerCase();
  it("a group is met by any of its members", () => {
    expect(groupCoverage([DYNAMIC], [[CBT, DYNAMIC]], id)).toBe(1);
    expect(groupCoverage([CBT], [[CBT, DYNAMIC]], id)).toBe(1);
    expect(groupCoverage(["EMDR"], [[CBT, DYNAMIC]], id)).toBe(0);
  });

  it("(CBT or dynamic) and CBT: CBT alone meets both, dynamic alone one of two", () => {
    const groups = [[CBT, DYNAMIC], [CBT]];
    expect(groupCoverage([CBT], groups, id)).toBe(1);
    expect(groupCoverage([DYNAMIC], groups, id)).toBe(0.5);
  });

  it("no groups, no coverage", () => {
    expect(groupCoverage([CBT], [], id)).toBe(0);
  });
});

describe("combinedSearch", () => {
  const card = (treatment: string, treatmentLabel = treatment, treatmentOptions?: string[]) => ({
    treatmentLabel,
    recs: [{ treatment, treatmentOptions }],
  });

  it("one group per card, a 'both' card as its two methods", () => {
    const r = combinedSearch([card(CBT_OR_DYNAMIC, CBT_OR_DYNAMIC, [CBT, DYNAMIC]), card(CBT), card("DBT", "DBT / MBT")]);
    expect(r.groups).toEqual([[CBT, DYNAMIC], [CBT], ["DBT"]]);
    expect(r.treatments).toEqual([CBT, DYNAMIC, "DBT"]);
    expect(r.labels).toEqual([CBT, DYNAMIC, "DBT / MBT"]);
  });

  it("two cards asking the same thing are one group", () => {
    expect(combinedSearch([card(CBT), card(CBT)]).groups).toEqual([[CBT]]);
    expect(sameKeys([CBT, DYNAMIC], [DYNAMIC, CBT])).toBe(true);
    expect(sameKeys([CBT], [CBT, DYNAMIC])).toBe(false);
  });
});

describe("the recorded keys", () => {
  it("count a 'both' card as its two methods, never as the joint key", () => {
    const rec = bothCard();
    expect(treatmentKeys([rec, { treatment: "EMDR" }])).toEqual([CBT, DYNAMIC, "EMDR"]);
    const keys = adultResultKeys([rec]);
    expect(keys.treatments).toEqual([CBT, DYNAMIC]);
    expect(keys.treatments).not.toContain(CBT_OR_DYNAMIC);
  });

  it("the joint key is the scorer's own string", () => {
    const src = readFileSync(join(process.cwd(), "app/lib/questionnaire-score.ts"), "utf8");
    expect(src).toContain(`const CBT_OR_DYNAMIC = "${CBT_OR_DYNAMIC}";`);
  });
});
