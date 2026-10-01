/**
 * The review case bank, held against the real questionnaire.
 *
 * A reviewer is told "open these cases and you will have seen everything". That
 * is only true while the bank still reaches every screen, every committee card
 * and every tip - and the questionnaire changes weekly. So every case is
 * walked with the skip rules the screens use and scored with the engine the
 * server runs, and the bank fails here the day a branch appears that no case
 * goes down.
 *
 * It also checks that a case is something a counsellor could really have
 * produced: no answer to a screen that child is never shown, no file contents
 * stated for a child whose route never opened the "מה קיים בתיק" screen.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";

vi.mock("server-only", () => ({}));

import { scoreKidsQuestionnaire } from "@/app/lib/kids-score.server";
import {
  KIDS_AQ_ITEMS, KIDS_MQ_ITEMS, KIDS_AS_ITEMS, KIDS_AG_ITEMS, KIDS_AB_ITEMS, KIDS_OQ_ITEMS, KIDS_TQ_ITEMS,
  KIDS_PQ_ITEMS, KIDS_BQ_ITEMS, KIDS_LSAS_ITEMS, KIDS_EA_RESTRICT, KIDS_EA_BINGE_UNDER12, KIDS_EB_RESTRICT,
  KIDS_EB_BINGE_OVER12, KIDS_SENS_OVER_ITEMS, KIDS_SENS_UNDER_ITEMS,
} from "@/app/lib/questionnaire-items.server";
import { SCHOOL_TIPS } from "@/app/lib/school-report";
import { SCHOOL_GRADES } from "@/app/lib/school-tracks";
import { GAN_TIPS } from "@/app/lib/gan-report";
import { GAN_GRADES } from "@/app/lib/gan-tracks";
import { PAGES, gg, skipPage, traitKeys, traitNeeds, type Ans, type PageId } from "../quiz-logic";
import { ITEM_KEYS, completeAnswers, pagesShown } from "./case-builder";
import { REVIEW_CASES, caseAnswers } from "./cases";
import {
  PAGE_UNIVERSE, REFERRAL_UNIVERSE, TRACK_UNIVERSE, pageKey, pageVariant, refKey, seenKeys, shownOnReport, tipKey, trackKey,
} from "./coverage";
import { withScoredFacts } from "./derive";

const TODAY = "2026-10-01";

/** A case as it stands on its report: completed, scored, the scored facts written in. */
function scored(spec: Ans) {
  const A0 = completeAnswers(spec);
  const score = scoreKidsQuestionnaire(A0);
  return { A: withScoredFacts(A0, score), score };
}
const ALL = REVIEW_CASES.map(c => ({ c, ...scored(c.spec(TODAY)) }));

describe("the item keys the cases are written in", () => {
  const keys = (items: readonly { key: string }[]) => items.map(i => i.key);
  it("are the items the server scores", () => {
    expect(ITEM_KEYS.aq).toEqual(keys(KIDS_AQ_ITEMS));
    expect(ITEM_KEYS.mq).toEqual(keys(KIDS_MQ_ITEMS));
    expect(ITEM_KEYS.as).toEqual(keys(KIDS_AS_ITEMS));
    expect(ITEM_KEYS.ag).toEqual(keys(KIDS_AG_ITEMS));
    expect(ITEM_KEYS.ab).toEqual(keys(KIDS_AB_ITEMS));
    expect(ITEM_KEYS.oq).toEqual(keys(KIDS_OQ_ITEMS));
    expect(ITEM_KEYS.tq).toEqual(keys(KIDS_TQ_ITEMS));
    expect(ITEM_KEYS.pq).toEqual(keys(KIDS_PQ_ITEMS));
    expect(ITEM_KEYS.bq).toEqual(keys(KIDS_BQ_ITEMS));
    expect(ITEM_KEYS.eaUnder12).toEqual([...keys(KIDS_EA_RESTRICT), ...keys(KIDS_EA_BINGE_UNDER12)]);
    expect(ITEM_KEYS.ebOver12).toEqual([...keys(KIDS_EB_RESTRICT), ...keys(KIDS_EB_BINGE_OVER12)]);
    expect(ITEM_KEYS.lsas).toHaveLength(KIDS_LSAS_ITEMS.length);
    expect(ITEM_KEYS.sensOver).toHaveLength(KIDS_SENS_OVER_ITEMS.length);
    expect(ITEM_KEYS.sensUnder).toHaveLength(KIDS_SENS_UNDER_ITEMS.length);
  });
});

describe("every case", () => {
  it("has its own id and something to look at", () => {
    const ids = REVIEW_CASES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of REVIEW_CASES) {
      expect(c.title, c.id).toBeTruthy();
      expect(c.story.length, c.id).toBeGreaterThan(20);
      expect(c.focus.length, c.id).toBeGreaterThan(1);
    }
  });

  it("carries no em dash in what the reviewer reads", () => {
    for (const c of REVIEW_CASES) {
      for (const text of [c.title, c.story, ...c.focus, ...(c.tryAlso ?? [])]) expect(text, c.id).not.toMatch(/[—–]/);
    }
  });

  it("is a child of the role it is filed under", () => {
    for (const { c, A } of ALL) {
      const age = parseInt(A._age);
      expect(A._audience, c.id).toBe("counselor");
      expect(A.c_role, c.id).toBe(c.role);
      if (c.role === "gan") {
        expect(GAN_GRADES as readonly string[], c.id).toContain(A._grade);
        expect(age >= 1 && age <= 7, c.id).toBe(true);
      } else {
        expect(SCHOOL_GRADES as readonly string[], c.id).toContain(A._grade);
        expect(age >= 5 && age <= 19, c.id).toBe(true);
      }
      expect(A.c_duration, c.id).toBeTruthy();
    }
  });

  it("is complete: filling it in again changes nothing", () => {
    for (const { c } of ALL) {
      const once = caseAnswers(c, TODAY);
      expect(completeAnswers(once), c.id).toEqual(once);
    }
  });

  it("walks from the consent screen to the report", () => {
    for (const { c, A } of ALL) {
      const pages = pagesShown(A);
      expect(pages.slice(0, 3), c.id).toEqual(["p-consent", "p-demo", "p-areas"]);
      expect(pages.at(-1), c.id).toBe("p-result");
      expect(pages, c.id).toContain("p-refine");
    }
  });

  it("rates only the areas its opening screen offers", () => {
    for (const { c, A } of ALL) {
      const age = parseInt(A._age);
      if (age <= 2) for (const k of ["a_emo", "a_aca", "a_soc"]) expect(A[k], `${c.id} ${k}`).toBeUndefined();
      // A school counsellor is offered the developmental area in א-ב only.
      if (c.role === "school" && !["א", "ב"].includes(A._grade)) expect(A.a_dev, c.id).toBeUndefined();
    }
  });

  it("answers no screen the child is never shown", () => {
    // The screens with answers of their own, and the keys each one writes.
    const OWNED: Partial<Record<PageId, string[]>> = {
      "p-q1-pain": ["q1_pain", "q1_med_clear"],
      "p-aq": [...ITEM_KEYS.aq],
      "p-mq": [...ITEM_KEYS.mq],
      "p-mq-sui": ["q3_sui"],
      "p-q4-types": ["ad_s", "ad_g", "ad_b", "ad_o"],
      "p-q4-s": [...ITEM_KEYS.as],
      "p-q4-g": [...ITEM_KEYS.ag],
      "p-q4-b": [...ITEM_KEYS.ab],
      "p-q4-ctrl": ["q4_ctrl"],
      "p-oq": [...ITEM_KEYS.oq],
      "p-tq": [...ITEM_KEYS.tq],
      "p-pq": [...ITEM_KEYS.pq],
      "p-eq": [...ITEM_KEYS.eaUnder12, ...ITEM_KEYS.ebOver12, "_h", "_w", "_bmi"],
      "p-bq": [...ITEM_KEYS.bq],
      "p-q10": ["q10"],
      "p-q10-par": ["q10_par"],
      "p-dev-toilet": ["dev_toilet", "dev_toilet_past", "dev_toilet_type", "dev_wet_type"],
      "p-dev-sensory": ["dev_sensory", ...ITEM_KEYS.sensOver, ...ITEM_KEYS.sensUnder],
      "p-beh": ["beh1", "beh2", "beh3", "c_regulation", "c_bully_perp"],
      "p-soc": ["soc1", "soc2", "soc3", "soc2_sev", "soc3_early", "comm1", "comm2", "comm3", ...ITEM_KEYS.lsas, "c_isolation", "c_bully_victim"],
      "p-acad": ["vision", "hearing", "c_support", "c_org", "c_aca_steps"],
      "p-docs": ["c_diag", "c_zakaut", "c_zakaut_on", "c_hatamot", "c_hatamot_on", "c_daycare", "c_extra_year"],
    };
    for (const { c, A } of ALL) {
      for (const [pid, keys] of Object.entries(OWNED) as [PageId, string[]][]) {
        if (!skipPage(pid, A)) continue;
        for (const k of keys) expect(A[k], `${c.id}: ${k} is answered, but ${pid} is not shown`).toBeUndefined();
      }
      // The eating items follow the age: only the block for this child's age.
      const under12 = parseInt(A._age) < 12;
      for (const k of under12 ? ITEM_KEYS.ebOver12 : ITEM_KEYS.eaUnder12) expect(A[k], `${c.id}: ${k}`).toBeUndefined();
    }
  });

  it("answers the characteristics screen only where it asks", () => {
    for (const { c, A } of ALL) {
      const needs = traitNeeds(A);
      const asked = traitKeys(A, needs);
      for (const k of ["t_motiv", "t_verbal", "t_prac", "ga_consent", "ga_consent_parent"]) {
        if (A[k] !== undefined) expect(asked, `${c.id}: ${k} is answered but not asked`).toContain(k);
      }
      for (const k of asked) expect(A[k], `${c.id}: ${k} is asked but not answered`).toBeDefined();
      const zyInterests = ["int_art", "int_music", "int_move", "int_drama", "int_biblio", "int_animal"].some(k => A[k]);
      if (zyInterests) expect(needs.interests, c.id).toBe(true);
      const gaInterests = Object.keys(A).some(k => k.startsWith("ga_int_") && A[k]);
      if (gaInterests) expect(gg(A) === "ga" && A.ga_consent === "כן" && A.a_emo !== "הרבה מאוד", c.id).toBe(true);
    }
  });

  it("states what the file holds only when that screen opens", () => {
    for (const { c, A } of ALL) {
      const stated = ["c_diag", "c_zakaut", "c_hatamot", "c_daycare", "c_extra_year"].some(k => A[k] !== undefined);
      if (stated) expect(A._route, `${c.id}: the file is described but "מה קיים בתיק" is skipped`).toBe(true);
    }
  });

  it("is scored without an error box and without a dead-end referral", () => {
    for (const { c, score } of ALL) {
      const texts = Object.values(score).flat().map(b => b.txt);
      expect(texts.some(t => t.includes("יש לענות על שאלת המוטיבציה")), c.id).toBe(false);
    }
  });
});

describe("the bank as a whole", () => {
  const seen = new Set<string>();
  for (const { A, score } of ALL) {
    for (const pid of pagesShown(A)) for (const k of seenKeys(pid, A, pid === "p-result" ? score : null, TODAY)) seen.add(k);
  }

  it("shows every screen, in every version of it", () => {
    const missing = PAGE_UNIVERSE.flatMap(p => p.variants.map(v => pageKey(p.pid, v))).filter(k => !seen.has(k));
    expect(missing).toEqual([]);
  });

  it("lists no screen version the questionnaire does not have", () => {
    const listed = new Set(PAGE_UNIVERSE.flatMap(p => p.variants.map(v => pageKey(p.pid, v))));
    const unlisted = [...seen].filter(k => k.startsWith("page:") && !listed.has(k));
    expect(unlisted).toEqual([]);
    // And the variant of a screen is always one the universe names.
    for (const { A } of ALL) for (const pid of PAGES) expect(PAGE_UNIVERSE.find(p => p.pid === pid)!.variants).toContain(pageVariant(pid, A));
  });

  it("puts every committee card on a map, at school and in a kindergarten", () => {
    for (const role of ["school", "gan"] as const) {
      const missing = TRACK_UNIVERSE[role].map(t => trackKey(role, t.key)).filter(k => !seen.has(k));
      expect(missing, role).toEqual([]);
    }
  });

  it("names every card the maps can show", () => {
    for (const { c, A, score } of ALL) {
      const shown = shownOnReport(A, score, TODAY);
      const known = TRACK_UNIVERSE[shown.role].map(t => t.key);
      for (const t of shown.tracks) expect(known, `${c.id}: ${t.key}`).toContain(t.key);
    }
  });

  it("triggers every tip for the team", () => {
    const missing = [
      ...SCHOOL_TIPS.map(t => tipKey("school", t.key)),
      ...GAN_TIPS.map(t => tipKey("gan", t.key)),
    ].filter(k => !seen.has(k));
    expect(missing).toEqual([]);
  });

  it("produces exactly the kinds of referral the coverage list names", () => {
    const produced = [...seen].filter(k => k.startsWith("ref:")).sort();
    expect(produced).toEqual(REFERRAL_UNIVERSE.map(r => refKey(r.key)).sort());
  });

  it("covers each state a committee can be in", () => {
    const of = (k: string) => new Set(ALL.map(x => x.A[k]).filter(Boolean));
    expect([...of("c_zakaut")].sort()).toEqual(["considering", "decided", "in_process", "none"]);
    expect([...of("c_hatamot")].sort()).toEqual(["considering", "district_decided", "district_submitted", "none", "school_level"]);
    expect([...of("c_team")].sort()).toEqual(["no", "unknown", "yes"]);
    expect([...of("c_fill")].sort()).toEqual(["counselor_alone", "phone_parent", "with_parent"]);
    expect([...of("c_duration")].sort()).toEqual(["over_year", "this_year", "years"]);
    expect([...of("c_attend")].sort()).toEqual(["frequent", "refusal", "regular", "some", "unknown"]);
    expect([...of("c_support")].sort()).toEqual(["improves", "none", "not_given", "partial", "unknown"]);
    expect([...of("c_devcenter")].sort()).toEqual(["done", "in_process", "none", "unknown", "waiting"]);
    expect([...of("c_daycare")].sort()).toEqual(["attends", "considering"]);
    expect([...of("c_extra_year")].sort()).toEqual(["considering", "requested"]);
  });

  it("opens a route, leaves one pending, and leaves one closed - in both settings", () => {
    const relevance = (role: string, key: string) =>
      new Set(ALL.filter(x => x.c.role === role).flatMap(x => shownOnReport(x.A, x.score, TODAY).tracks.filter(t => t.key === key).map(t => t.relevance)));
    expect([...relevance("school", "zakaut")].sort()).toEqual(["consider", "info"]);
    expect([...relevance("school", "school_team")].sort()).toEqual(["info", "primary"]);
    expect([...relevance("school", "attendance")].sort()).toEqual(["consider", "primary"]);
    expect([...relevance("gan", "dev_center")].sort()).toEqual(["consider", "info", "primary"]);
    expect([...relevance("gan", "zakaut_appeal")]).toEqual(["info"]);
    expect([...relevance("school", "zakaut_appeal")]).toEqual(["primary"]);
    // The deciding aid, on both committees.
    const decisions = ALL.flatMap(x => shownOnReport(x.A, x.score, TODAY).tracks.filter(t => t.decision).map(t => `${x.c.role}:${t.key}`));
    expect(new Set(decisions)).toEqual(new Set(["school:zakaut", "school:hatamot", "gan:zakaut"]));
  });
});

describe("the map from a thing to the cases that show it", () => {
  // The coverage list tells a reviewer where to find what they have not seen
  // yet. That needs the scoring engine, which the browser does not have, so the
  // answer is computed here and shipped as a file. After a change that moves a
  // card or a referral between cases, regenerate it:
  //   UPDATE_REVIEW_MAP=1 npx vitest run app/kids/review/cases.test.ts
  const FILE = "app/kids/review/where.generated.json";
  it("is the one the bank produces", () => {
    const where: Record<string, string[]> = {};
    for (const { c, A, score } of ALL) {
      for (const pid of pagesShown(A)) {
        for (const k of seenKeys(pid, A, pid === "p-result" ? score : null, TODAY)) {
          const list = (where[k] ??= []);
          if (!list.includes(c.id) && list.length < 4) list.push(c.id);
        }
      }
    }
    const sorted = Object.fromEntries(Object.keys(where).sort().map(k => [k, where[k]]));
    if (process.env.UPDATE_REVIEW_MAP) writeFileSync(FILE, JSON.stringify(sorted, null, 2) + "\n", "utf8");
    expect(JSON.parse(readFileSync(FILE, "utf8"))).toEqual(sorted);
  });
});
