/**
 * Turns a short description of a child into the full set of answers the
 * questionnaire would hold if a counsellor had clicked that child through it.
 *
 * A review case is written as the handful of answers that make it what it is -
 * "grade ח, reading in the bottom 5%, the ladder done" - and this file adds
 * everything a real walk would have added around them: each screen on the way
 * answered, every battery item rated, every running total kept. It walks the
 * page order of the questionnaire with its own skip rules, so a case can only
 * ever hold answers to screens that child would really have been shown.
 *
 * What is filled in is an explicit answer and never "לא ידוע": a blank that the
 * screens turn into "not known" would put the not-known notice on every report,
 * and the cases that are about that notice mark it themselves.
 *
 * Pure, and imports nothing but the questionnaire logic - the cases must not
 * be able to drift from it. See cases.test.ts for what is checked.
 */

import {
  PAGES, skipPage, acadGg, q9AdhdActive, traitNeeds,
  updAQ, updMQ, updOQ, updTQ, updPQ, updEQ, updBQ, updLSAS, updAddict, computeBehPlan,
  type Ans, type PageId,
} from "../quiz-logic";

// The battery items, by the keys the screens write. The same lists the
// updaters in quiz-logic.ts sum over; cases.test.ts holds them against the
// item definitions on the server, so a renamed item fails there and not in a
// report.
const seq = (prefix: string, n: number, from = 1) => Array.from({ length: n }, (_, i) => `${prefix}${i + from}`);
export const ITEM_KEYS = {
  aq: seq("aq", 10),
  mq: seq("mq", 9),
  as: seq("as", 6),
  ag: seq("ag", 7),
  ab: seq("agl", 7),
  oq: seq("oq", 6),
  tq: seq("tq", 10),
  pq: ["pq11", "pq13", "pq8"],
  bq: seq("bq", 7),
  lsas: seq("lsas_a", 8),
  eaUnder12: seq("ea", 8),
  ebOver12: seq("eb", 7),
  sensOver: seq("so", 10),
  sensUnder: seq("su", 8),
} as const;

type Upd = (a: Ans, k: string, v: never) => Ans;
const BATTERIES: [readonly string[], Upd][] = [
  [ITEM_KEYS.aq, updAQ as Upd],
  [ITEM_KEYS.mq, updMQ as Upd],
  [ITEM_KEYS.oq, updOQ as Upd],
  [ITEM_KEYS.tq, updTQ as Upd],
  [ITEM_KEYS.pq, updPQ as Upd],
  [ITEM_KEYS.bq, updBQ as Upd],
  [ITEM_KEYS.lsas, updLSAS as Upd],
  [ITEM_KEYS.as, ((a: Ans, k: string, v: string) => updAddict(a, k, v, "s")) as Upd],
  [ITEM_KEYS.ag, ((a: Ans, k: string, v: string) => updAddict(a, k, v, "g")) as Upd],
  [ITEM_KEYS.ab, ((a: Ans, k: string, v: string) => updAddict(a, k, v, "b")) as Upd],
  [[...ITEM_KEYS.eaUnder12, ...ITEM_KEYS.ebOver12], updEQ as Upd],
];

/**
 * Every running total recomputed through the updaters the screens use, so a
 * case that states its items never has to state - or get wrong - the sum the
 * skip rules read.
 */
export function retotal(A: Ans): Ans {
  let a = A;
  for (const [keys, upd] of BATTERIES) {
    const k = keys.find(x => a[x] !== undefined);
    if (k) a = upd(a, k, a[k] as never);
  }
  if (["beh1", "beh2", "beh3"].some(k => a[k] !== undefined)) a = computeBehPlan(a);
  return a;
}

/** Set whatever the case did not state. */
function fill(A: Ans, defaults: Ans): Ans {
  const out = { ...A };
  for (const [k, v] of Object.entries(defaults)) if (out[k] === undefined) out[k] = v;
  return out;
}
const fillAll = (A: Ans, keys: readonly string[], v: number | string) => fill(A, Object.fromEntries(keys.map(k => [k, v])));
const yesCount = (A: Ans, keys: string[]) => keys.filter(k => A[k] === "כן").length;

/** The reading sub-flow of א-ג and ד-ו: history, then motivation or the speech therapist. */
function readingFlow(A: Ans, p: "ag" | "dv", histKeys: string[]): Ans {
  let a = fillAll(A, histKeys, "לא");
  const hist = yesCount(a, histKeys);
  if (hist === 0) {
    a = fill(a, { [`${p}_read_motiv`]: "כן" });
    if (a[`${p}_read_motiv`] === "לא") a = fillAll(a, [`${p}_mot1`, `${p}_mot2`, `${p}_mot3`], 1);
  } else if (hist <= 3) {
    a = fill(a, { [`${p}_read_speech`]: "לא" });
    if (a[`${p}_read_speech`] === "כן") {
      a = fill(a, { [`${p}_speech_motiv`]: "כן" });
      if (a[`${p}_speech_motiv`] === "לא") a = fillAll(a, [`${p}_smot1`, `${p}_smot2`, `${p}_smot3`], 1);
    }
  }
  return a;
}

function visionHearing(A: Ans): Ans {
  let a = fill(A, { vision: "כן", hearing: "כן" });
  if (a.vision === "לא") a = fill(a, { vis_sym: "לא" });
  if (a.hearing === "לא") a = fill(a, { hear_sym: "לא" });
  return a;
}

function fillAcad(A: Ans): Ans {
  const band = acadGg(A);
  let a = visionHearing(A);
  if (band === "gan") {
    a = fillAll(a, ["gan_q1", "gan_q2", "gan_q3", "gan_q4", "gan_q5"], "לא");
    if (a.gan_q1 === "כן") a = fill(a, { gan_q1_speech: "לא" });
    if (a.gan_q2 === "כן") a = fill(a, { gan_q2_speech: "לא" });
    if (a.gan_q5 === "כן") a = fill(a, { gan_q5_ot: "לא" });
    return a; // The kindergarten screen carries no school block.
  }
  if (band === "ag" || band === "dv") {
    a = fill(a, { [`${band}_read`]: "לא", [`${band}_write`]: "לא", [`${band}_comp`]: "לא", [`${band}_math`]: "לא" });
    // ב-ו with a positive regulation gate were asked about attention there.
    if (!q9AdhdActive(a)) a = fill(a, { [`${band}_adhd_yn`]: "לא" });
    const reads = band === "ag" ? a.ag_read !== "לא" : a.dv_read === "כן";
    if (reads) a = readingFlow(a, band, band === "ag" ? ["ag_h1", "ag_h2", "ag_h3", "ag_h4", "ag_h5", "ag_h6"] : ["dv_h1", "dv_h2", "dv_h3", "dv_h4", "dv_h5"]);
    if (a[`${band}_write`] === "כן") a = fill(a, { [`${band}_write_ot`]: "לא" });
  } else {
    a = fill(a, { [`${band}_verbal`]: "לא", [`${band}_math`]: "לא", [`${band}_eng`]: "לא", [`${band}_adhd_yn`]: "לא", [`${band}_write`]: "לא", [`${band}_comp`]: "לא" });
  }
  // The school block under the learning questions.
  return fill(a, { c_org: 0 });
}

function fillSoc(A: Ans): Ans {
  let a = fillAll(A, ["soc1", "soc2", "soc3"], "לא");
  if (a.soc1 === "כן") a = fillAll(a, ITEM_KEYS.lsas, 0);
  if (a.soc2 === "כן") a = fill(a, { soc2_sev: 3 });
  if (a.soc3 === "כן") {
    a = fill(a, { soc3_early: "לא" });
    if (a.soc3_early === "כן") {
      a = fillAll(a, ["comm1", "comm2", "comm3"], "לא");
      if (a.comm1 === "כן" && a.comm2 === "כן" && a.comm3 === "כן") a = fillAll(a, ["comm_rep", "comm_rigid", "comm_interest", "comm_sens"], "לא");
    }
  }
  return fill(a, { c_isolation: 0, c_bully_victim: "no" });
}

function fillTraitsScreen(A: Ans): Ans {
  let a = A;
  if (traitNeeds(a).gaConsent) {
    a = fill(a, { ga_consent: "כן" });
    if (a.ga_consent === "לא") a = fill(a, { ga_consent_parent: "כן" });
  }
  if (traitNeeds(a).motiv) a = fill(a, { t_motiv: 4 });
  // Verbality and practice are asked only once motivation is given - see traitNeeds.
  const n = traitNeeds(a);
  if (n.verbal) a = fill(a, { t_verbal: 3 });
  if (n.prac) a = fill(a, { t_prac: 4 });
  return a;
}

function fillRefine(A: Ans): Ans {
  let a = fill(A, { c_fill: "with_parent", c_economic: "no" });
  if (a.c_role !== "gan") return fill(a, { c_team: "no" });
  const toddler = a._grade === "פעוט";
  a = fill(a, { c_setting: toddler ? "daycare" : "regular", c_devcenter: "none" });
  if (!toddler && a.c_setting !== "special_gan") a = fill(a, { c_team: "no" });
  return a;
}

/** What each screen leaves behind when it is answered and nothing on it is the point of the case. */
const FILL: Partial<Record<PageId, (A: Ans) => Ans>> = {
  "p-q1": A => fill(A, { q1: 1, c_attend: "regular", c_change: "לא" }),
  "p-q1-pain": A => {
    const a = fill(A, { q1_pain: "לא" });
    return a.q1_pain === "כן" ? fill(a, { q1_med_clear: "כן" }) : a;
  },
  "p-aq": A => fillAll(A, ITEM_KEYS.aq, 1),
  "p-q2": A => fill(A, { q2: 1 }),
  "p-q3": A => fill(A, { q3: 1 }),
  "p-mq": A => fillAll(A, ITEM_KEYS.mq, "לא"),
  "p-mq-sui": A => fill(A, { q3_sui: "לא" }),
  "p-q4": A => fill(A, { q4: "לא" }),
  "p-q4-s": A => fillAll(A, ITEM_KEYS.as, "לא"),
  "p-q4-g": A => fillAll(A, ITEM_KEYS.ag, "לא"),
  "p-q4-b": A => fillAll(A, ITEM_KEYS.ab, "לא"),
  "p-q4-ctrl": A => fill(A, { q4_ctrl: 3 }),
  "p-q5": A => fill(A, { q5: "לא" }),
  "p-oq": A => fillAll(A, ITEM_KEYS.oq, 1),
  "p-q6": A => fill(A, { q6: "לא" }),
  "p-tq": A => fillAll(A, ITEM_KEYS.tq, 0),
  "p-q7": A => fill(A, { q7a: "לא", q7b: "לא" }),
  "p-pq": A => fillAll(A, ITEM_KEYS.pq, "לא"),
  "p-q8": A => fill(A, { q8: "לא" }),
  "p-eq": A => fillAll(A, (parseInt(A._age) || 0) < 12 ? ITEM_KEYS.eaUnder12 : ITEM_KEYS.ebOver12, "לא"),
  "p-q9": A => fill(A, { q9: "לא" }),
  "p-bq": A => fillAll(A, ITEM_KEYS.bq, "לא"),
  "p-q10": A => fill(A, { q10: "לא" }),
  "p-q10-par": A => fill(A, { q10_par: "לא" }),
  "p-acad": fillAcad,
  "p-dev-toilet": A => {
    let a = fill(A, { dev_toilet: "לא" });
    if (a.dev_toilet === "כן") {
      a = fill(a, { dev_toilet_past: "לא", dev_toilet_type: "ב" });
      if (a.dev_toilet_type === "ב" || a.dev_toilet_type === "ד") a = fill(a, { dev_wet_type: "לילה" });
    }
    return a;
  },
  "p-dev-sensory": A => {
    const a = fill(A, { dev_sensory: "לא" });
    // 3 is "אף פעם" on these two scales.
    return a.dev_sensory === "כן" ? fillAll(fillAll(a, ITEM_KEYS.sensOver, 3), ITEM_KEYS.sensUnder, 3) : a;
  },
  "p-beh": A => fill(fillAll(A, ["beh1", "beh2", "beh3"], "לא"), { c_regulation: 0, c_bully_perp: "no" }),
  "p-soc": fillSoc,
  "p-traits": fillTraitsScreen,
  "p-refine": fillRefine,
};

/**
 * The answers a full walk would hold, from the ones the case states.
 *
 * p-docs is not filled: it is shown only once the scoring has opened a route
 * (see skipPage), and what the file holds is the point of every case that has
 * one - so those state it themselves.
 */
export function completeAnswers(spec: Ans): Ans {
  let A = retotal({ ...spec });
  for (const pid of PAGES) {
    if (skipPage(pid, A)) continue;
    const f = FILL[pid];
    if (f) A = retotal(f(A));
  }
  return A;
}

/** The screens this child is shown, in order - the walk the questionnaire itself would take. */
export function pagesShown(A: Ans): PageId[] {
  return PAGES.filter(pid => !skipPage(pid, A));
}

// ── Shorthand for writing a case ─────────────────────────────────────────────

/** Battery items from a list of ratings, in item order. */
export const rate = (keys: readonly string[], values: (number | string)[]): Ans =>
  Object.fromEntries(keys.map((k, i) => [k, values[i]] as const).filter(([, v]) => v !== undefined));
/** A yes/no battery: the listed item numbers are "כן", the rest "לא". */
export const yesOn = (keys: readonly string[], yes: number[]): Ans =>
  Object.fromEntries(keys.map((k, i) => [k, yes.includes(i + 1) ? "כן" : "לא"]));
/** The attention checklist under a prefix: which of the six inattention and six hyperactivity signs are ticked. */
export const adhd = (prefix: string, inatt: number[], hyper: number[] = []): Ans => ({
  ...Object.fromEntries(inatt.map(i => [`${prefix}_ad${i}`, true])),
  ...Object.fromEntries(hyper.map(i => [`${prefix}_ah${i}`, true])),
});
/** "לא ידוע / לא רלוונטי" on an item: its own "no", remembered as not known. */
export const unknown = (key: string, noValue: number | string): Ans => ({ [key]: noValue, [`${key}__unk`]: true });

/** ISO date `days` before `today`. */
export function daysAgo(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - days * 86_400_000).toISOString().slice(0, 10);
}
