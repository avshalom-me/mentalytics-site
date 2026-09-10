/**
 * The kids questionnaire's pure logic: grade tracks, page order, skip rules,
 * navigation and the score updaters.
 *
 * Lifted verbatim out of app/kids/page.tsx, which is a 4,000-line client
 * component. Nothing here touches React, the DOM or the network, so it can be
 * exercised directly by tests - and these are exactly the functions a refactor
 * breaks silently: skipPage decides which of 36 screens a child is asked,
 * traitNeeds mirrors read sites in kids-score.server.ts by hand, and a screen
 * skipped by mistake leaves its field at 0, which the scoring reads as a real
 * answer rather than a missing one.
 *
 * Behaviour is unchanged by the move. See app/kids/quiz-logic.test.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ans = Record<string, any>;
export type BoxCls = "info" | "warn" | "danger" | "purple" | "ok";
export interface Box { cls: BoxCls; txt: string; isLowStress?: boolean; }
export interface KidsScoreResult {
  emotional: Box[];
  academic: Box[];
  developmental: Box[];
  behavioral: Box[];
  social: Box[];
}

// ── Grade groups ─────────────────────────────────────────────────────────────
export const GA_GRADES = ["פעוט","גן3","גן-טרום","גן","א"];
export const BV_GRADES = ["ב","ג","ד","ה","ו"];
export const ZY_GRADES = ["ז","ח","ט","י","יא","יב"];

export function gg(A: Ans): "ga"|"bv"|"zy"|"" {
  const g = A._grade || "";
  if (GA_GRADES.includes(g)) return "ga";
  if (BV_GRADES.includes(g)) return "bv";
  if (ZY_GRADES.includes(g)) return "zy";
  const age = parseInt(A._age) || 0;
  if (age > 0 && age <= 7)  return "ga";
  if (age >= 8 && age <= 12) return "bv";
  if (age >= 13)             return "zy";
  return "";
}

export function acadGg(A: Ans): "gan"|"ag"|"dv"|"zh"|"tyb" {
  const g = A._grade || "";
  if (["פעוט","גן3","גן-טרום","גן"].includes(g) || g.startsWith("גן")) return "gan";
  if (["א","ב","ג"].includes(g)) return "ag";
  if (["ד","ה","ו"].includes(g)) return "dv";
  if (["ז","ח"].includes(g)) return "zh";
  if (["ט","י","יא","יב"].includes(g)) return "tyb";
  const age = parseInt(A._age) || 0;
  if (age <= 6) return "gan";
  if (age <= 9) return "ag";
  if (age <= 12) return "dv";
  if (age <= 14) return "zh";
  return "tyb";
}

export function devAgeOk(A: Ans): boolean {
  const age = parseInt(A._age) || 0;
  return (age > 0 && age < 7) || gg(A) === "ga";
}

// Q9 (regulation/impulsivity) for grades ב׳–ו׳ is re-routed to the ADHD
// questionnaire (prefix "q9") instead of BQ. Kept in sync with kids-score.server.ts.
export function q9AdhdActive(A: Ans): boolean { return A.q9 === "כן" && gg(A) === "bv"; }
// Must stay equal to ADHD_BLOCK_THRESHOLD in kids-score.server.ts. This copy
// only decides whether the general-distress screen is shown; if the two drift,
// a child flagged positive by the scoring is still asked "is there anything
// else?", or the reverse - asked nothing while the report says ADHD.
export const ADHD_BLOCK_THRESHOLD = 3;

export function q9AdhdPositive(A: Ans): boolean {
  const inatt = ["q9_ad1","q9_ad2","q9_ad3","q9_ad4","q9_ad5","q9_ad6"].filter(k => A[k]).length;
  const hyper = ["q9_ah1","q9_ah2","q9_ah3","q9_ah4","q9_ah5","q9_ah6"].filter(k => A[k]).length;
  return inatt >= ADHD_BLOCK_THRESHOLD || hyper >= ADHD_BLOCK_THRESHOLD;
}

// ── Page order ───────────────────────────────────────────────────────────────
// p-aq-grade, p-q1-ga, p-q2-grade, p-q10-grade and p-ga-traits are gone; between
// them they asked the same four things over and over (see traitNeeds below) and
// p-traits now asks each once, at the end.
export const PAGES = [
  "p-consent","p-demo","p-areas",
  // Counsellor only: the emotional domain is the one a school sees least of,
  // so it opens with a word about filling it together with the parents.
  "p-emo-intro",
  "p-q1","p-q1-pain","p-aq",
  "p-q2",
  "p-q3","p-mq","p-mq-sui",
  "p-q4","p-q4-types","p-q4-s","p-q4-g","p-q4-b","p-q4-ctrl",
  "p-q5","p-oq",
  "p-q6","p-tq",
  "p-q7","p-pq",
  "p-q8","p-eq",
  "p-q9","p-bq","p-q9-adhd",
  "p-q10","p-q10-par",
  "p-acad",
  "p-dev-toilet",
  "p-dev-sensory",
  "p-beh",
  "p-soc",
  "p-traits",
  // The counsellor's closing screens. Only ever shown when the answers carry
  // _audience: "counselor"; see skipPage.
  //
  // p-refine is what the school did, and it feeds the computation. p-docs is
  // what the file holds, and it comes AFTER the questionnaire has been scored:
  // the documents worth asking about are the ones that answer the finding, and
  // until the scoring has run there is no finding to answer. It used to sit
  // inside p-refine, before the score existed, and had to guess from the raw
  // answers which route the report would end up naming.
  "p-refine",
  "p-docs",
  "p-result",
] as const;
export type PageId = (typeof PAGES)[number];

// ── Child characteristics ────────────────────────────────────────────────────
// Motivation for therapy, verbality, willingness to practise between sessions
// and areas of interest are not findings - they shape which treatment fits a
// finding. Each was collected on whichever screen happened to need it first:
// motivation on four separate screens, verbality on three, interests on two,
// every one of them guarded by an "unless it was already answered somewhere
// else" check. Skipping the first occurrence left it to be answered later into a
// different variable, and the branches that only read the first one carried on
// seeing 0 - so the anxiety section could conclude low motivation and recommend
// expressive arts in the same report where the self-esteem section read the same
// parent's 7 and recommended psychodynamic therapy. One step, one field each,
// every branch reading the same answer. The thresholds themselves are untouched.

export function socDetailsShown(A: Ans): boolean {
  return A.soc1 === "כן" && (A.lsas_tot || 0) >= 8 && gg(A) !== "ga";
}

/** The conditions under which p-aq-grade used to carry the trait questions. */
export function anxietyGradeActive(A: Ans): boolean {
  return ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "")
    && (A.q1 || 0) >= 3
    && (A.aq_tot || 0) >= 16;
}

/** GA-track children reach the consent question only on a positive finding. */
export function hasGaPositive(A: Ans): boolean {
  return (A.q1||0) >= 3 || (A.q2||0) >= 3
    || ((A.q3||0) >= 3 && (A.mq_tot||0) >= 4)
    || (A.q5 === "כן" && (A.oq_tot||0) >= 10)
    || (A.q9 === "כן" && (A.bq_tot||0) >= 4)
    || (A.q10 === "כן" && A.q10_par === "כן");
}

export type TraitNeeds = { motiv: boolean; verbal: boolean; prac: boolean; interests: boolean; gaConsent: boolean };

/**
 * Which characteristics the scoring will actually read for this child.
 *
 * Mirrors the read sites in kids-score.server.ts one for one, so nothing is
 * asked that will be discarded and nothing the scoring needs goes uncollected.
 * verbal and prac depend on the motivation answer, so they appear inside the
 * step once motivation is given rather than gating whether the step shows.
 */
export function traitNeeds(A: Ans): TraitNeeds {
  const grp = gg(A);
  const emoOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "");
  const socDomainOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_soc || "");
  const aqTot = A.aq_tot || 0;
  const anx = anxietyGradeActive(A);
  const q10On = A.q10_par === "כן";
  const socOn = socDetailsShown(A);
  const m = A.t_motiv || 0;

  // A second social path reads motivation, and it is NOT the one socDetailsShown
  // describes: the block that turns social therapy referrals into a
  // recommendation fires off soc2 severity or soc3 alone, with no soc1/LSAS gate
  // and no age-group gate. Leaving it out meant a parent whose child had social
  // findings but no social-anxiety score was never asked, scored 0, and was told
  // "please answer the motivation question in the questionnaire" about a
  // question they had never been shown. Deliberately over-inclusive: it covers
  // soc3 as a whole rather than its three sub-branches, and asks in the ga track
  // too, where the same block could otherwise print that same dead-end message.
  const socTherapyPossible = socDomainOn &&
    ((A.soc2 === "כן" && (A.soc2_sev || 0) >= 5) || A.soc3 === "כן");

  // The sub-clinical regulation finding (q9 positive, bq_tot exactly 4) picks
  // its referral from motivation and practice ability. It is emitted for ga and
  // zy only - ב-ו routes to the attention questionnaire instead - and ga is
  // already covered through gaConsent, since hasGaPositive counts bq_tot >= 4.
  const regModerate = grp === "zy" && A.q9 === "כן" && (A.bq_tot || 0) === 4;

  return {
    motiv:
      (grp === "bv" && (anx || (emoOn && (A.q2 || 0) >= 3) || q10On || socOn)) ||
      (grp === "zy" && anx) ||
      regModerate ||
      socTherapyPossible,
    // The bv scoring returns early at motivation 1 and 2 and never reads these
    // two, so asking below 3 collected answers straight into the bin.
    // bv verbality also serves the general-distress and social branches since
    // 13/8/2026, when their "לטיפול ע\"פ מאפייני הילד" placeholder became a real
    // verbality-based decision (expressive arts vs psychodynamic).
    verbal:
      (grp === "bv" && m >= 3 && ((anx && aqTot <= 20) || q10On || socOn)) ||
      (grp === "zy" && (q10On || socOn)),
    prac:
      (grp === "bv" && anx && aqTot > 20 && m >= 3) ||
      (grp === "zy" && anx && m >= 2) ||
      // Same shape as the zy anxiety branch: practice ability is only consulted
      // once motivation is above the "reach them through the parents" answer.
      (regModerate && m >= 2),
    interests: grp === "zy" && (q10On || socOn),
    // The social branch routes ga children through buildGaRef too, off soc1 plus
    // an LSAS of 8, which hasGaPositive knows nothing about. An unanswered
    // ga_consent there is not blank - buildGaRef has a default that looks exactly
    // like a real answer. Reachable before this refactor as well, but p-traits
    // runs after p-soc, so now there is somewhere to ask it.
    gaConsent: grp === "ga" &&
      (hasGaPositive(A) || (A.soc1 === "כן" && (A.lsas_tot || 0) >= 8)),
  };
}

// ── "לא ידוע / לא רלוונטי" ───────────────────────────────────────────────────
/**
 * A counsellor answers about a child she sees for six hours a day and never at
 * home, so on the emotional questions "I do not know" is an honest answer that
 * the parent questionnaire never needed.
 *
 * It is stored as the item's OWN "no" answer - 1 on a 1-5 scale, "לא" on a
 * yes/no, the floor of whatever scale the item uses - and never as 0 or as a
 * hole. That is what "treat it as if they answered no" has to mean here: the
 * scoring sums these items against absolute thresholds, so a value below the
 * scale's floor would drag the total under the threshold and turn a real
 * finding into a reassuring silence. The click itself is remembered in a
 * sidecar key, which the scoring never reads, so the screen can show which
 * button was pressed and the report can say the answer was not known.
 */
export const unkKey = (key: string) => `${key}__unk`;
export function isUnknown(A: Ans, key: string): boolean { return A[unkKey(key)] === true; }
/** Record that `key` was answered "not known"; pass the object already carrying the item's own "no" value. */
export function markUnknown(A: Ans, key: string): Ans { return { ...A, [unkKey(key)]: true }; }
/** Record that `key` was answered for real. */
export function markKnown(A: Ans, key: string): Ans { return { ...A, [unkKey(key)]: false }; }

/**
 * How many items carry an explicit "not known".
 *
 * The scoring cannot tell them from a real "not at all" - both are the scale's
 * floor, deliberately, so a partly-filled battery can only ever under-report
 * and never invent a finding. That is the right rule for a parent, whose blank
 * means the symptom is absent. For a counsellor it is not: she pressed
 * "לא ידוע" because she has no information, and a report that answers her with
 * "low stress" is asserting something she did not say. The count is what the
 * report needs to say so, and it is the only place the sidecar is read.
 */
export function unknownCount(A: Ans): number {
  return Object.keys(A).filter(k => k.endsWith("__unk") && A[k] === true).length;
}

/**
 * Anyone may move on with items unanswered. Each one is then stored as its own
 * "no" - the value "לא ידוע" would have written - and remembered as not known,
 * so the report can say so. This was a counsellor-only escape until 9/9/2026,
 * when the owner opened it to parents too: answer as much or as little as you
 * like, and a blank is scored exactly as if the symptom had been said to be
 * absent.
 *
 * p-traits is the one exception and still blocks - see traitKeys for why.
 */
export function fillMissing(
  A: Ans,
  keys: string[],
  noValue: number | string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upd: (a: Ans, k: string, v: any) => Ans,
): Ans {
  let out = A;
  for (const k of keys) {
    const v = out[k];
    if (v === undefined || v === null || v === "") out = markUnknown(upd(out, k, noValue), k);
  }
  return out;
}

// ── p-traits: the one screen that still asks ─────────────────────────────────
/**
 * The items on p-traits that must carry an answer before Continue lights up.
 *
 * Everywhere else in the questionnaire a blank means "the difficulty is
 * absent". That is a real answer, and for a symptom it is the safe one: it can
 * only ever under-report. p-traits does not ask about symptoms. It asks how the
 * child engages - motivation, verbality, willingness to practise between
 * sessions, consent to come - and the bottom of those scales is a statement in
 * its own right, not a neutral. Read as one it moves the recommendation off
 * direct therapy and onto reaching the child through the parents, which is a
 * clinical decision nobody made. So here it is asked rather than assumed: at
 * most three questions, on the last screen, after everything else is answered.
 *
 * Interests are left out on purpose - nothing ticked is itself an answer there.
 *
 * The blankness test is countMissing's, repeated in the screen rather than
 * imported: ui.tsx imports this file, so the arrow cannot point back.
 */
export function traitKeys(A: Ans, needs: TraitNeeds = traitNeeds(A)): string[] {
  return [
    ...(needs.motiv     ? ["t_motiv"]  : []),
    ...(needs.verbal    ? ["t_verbal"] : []),
    ...(needs.prac      ? ["t_prac"]   : []),
    ...(needs.gaConsent ? ["ga_consent"] : []),
    ...(needs.gaConsent && A.ga_consent === "לא" ? ["ga_consent_parent"] : []),
  ];
}

/**
 * The fallback behind that gate, for the one way past it: a saved draft from
 * before the gate existed, restored straight onto a later screen. Each item the
 * scoring will read is stored at its scale's lowest value - never 0, which the
 * anxiety branch reads as "3 or more" and walks on into a recommendation nobody
 * asked for - and marked not known, so the report says the answer was missing.
 */
export function fillTraits(A: Ans, needs: TraitNeeds = traitNeeds(A)): Ans {
  const plain = (a: Ans, k: string, v: number | string) => ({ ...a, [k]: v });
  let out = A;
  if (needs.motiv)  out = fillMissing(out, ["t_motiv"], 1, plain);
  if (needs.verbal) out = fillMissing(out, ["t_verbal"], 1, plain);
  if (needs.prac)   out = fillMissing(out, ["t_prac"], 1, plain);
  if (needs.gaConsent) {
    out = fillMissing(out, ["ga_consent"], "לא", plain);
    if (out.ga_consent === "לא") out = fillMissing(out, ["ga_consent_parent"], "לא", plain);
  }
  return out;
}

// ── Wording ──────────────────────────────────────────────────────────────────
/**
 * Parent phrasing to school phrasing, for the labels a counsellor reads.
 *
 * Applied to display text only. The stored answers, the emoji prefixes and the
 * referral strings the scoring engine parses are untouched - rewriting those is
 * what would break the recommendation parser.
 *
 * The generic rule rewrites the noun and leaves any Hebrew prefix attached to
 * it, so "הילד/ה" becomes "התלמיד/ה" and "לילד/ה" becomes "לתלמיד/ה" without a
 * rule of their own.
 */
const SCHOOL_WORDING: [RegExp, string][] = [
  [/הילד\/ה שלכם/g, "התלמיד/ה"],
  [/ילדכם/g, "התלמיד/ה"],
  [/ילדך/g, "התלמיד/ה"],
  [/ילד\/ה/g, "תלמיד/ה"],
  // "הילד מסכים", "מהילד באותה תקופה" - the masculine singular, but not the
  // plural "הילדים", which is right as it is when it means the class.
  [/הילד(?![א-ת/])/g, "התלמיד/ה"],
];

export function schoolWording(text: string): string {
  return SCHOOL_WORDING.reduce((s, [rx, to]) => s.replace(rx, to), text);
}

/**
 * Label text for whoever is answering: as written for a parent, rewritten for a
 * counsellor. `counselorText` overrides the automatic rewrite where verb
 * agreement needs a human. Takes the answers rather than a flag so a screen can
 * call it inline without a setup line, and so nothing is stored per module.
 */
export function sw(A: Ans, parentText: string, counselorText?: string): string {
  if (A._audience !== "counselor") return parentText;
  return counselorText ?? schoolWording(parentText);
}

// ── Skip logic ───────────────────────────────────────────────────────────────
export function skipPage(pid: string, A: Ans): boolean {
  const emoOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "");
  const emoPages = [
    "p-emo-intro",
    "p-q1","p-q1-pain","p-aq","p-q2","p-q3","p-mq","p-mq-sui",
    "p-q4","p-q4-types","p-q4-s","p-q4-g","p-q4-b","p-q4-ctrl",
    "p-q5","p-oq","p-q6","p-tq","p-q7","p-pq","p-q8","p-eq",
    "p-q9","p-bq","p-q9-adhd","p-q10","p-q10-par",
  ];
  if (emoPages.includes(pid) && !emoOn) return true;

  // Parents live with the child; the intro is advice only a counsellor needs.
  if (pid === "p-emo-intro") return A._audience !== "counselor";

  if (pid === "p-q1-pain")    return (A.q1 || 0) < 3;
  if (pid === "p-aq")         return (A.q1 || 0) < 3;
  if (pid === "p-mq")         return (A.q3 || 0) < 3;
  if (pid === "p-mq-sui")     return (A.mq_tot || 0) < 4;
  if (pid === "p-q4-types")   return A.q4 !== "כן";
  if (pid === "p-q4-s")       return !A.ad_s;
  if (pid === "p-q4-g")       return !A.ad_g;
  if (pid === "p-q4-b")       return !A.ad_b;
  // Only ב-ו branch on this answer; gan-א always goes to therapeutic parent
  // guidance and ז-יב always to specialist CBT, so asking them was collecting a
  // reply straight into the bin - on the questionnaire whose main problem is
  // its length.
  if (pid === "p-q4-ctrl")    return A.q4 !== "כן" || gg(A) !== "bv";
  if (pid === "p-oq")         return A.q5 !== "כן";
  if (pid === "p-tq")         return A.q6 !== "כן";
  // Only the beliefs-only path still needs the follow-up items: reporting
  // hallucinations carries the referral on its own (pqThresholdFor).
  if (pid === "p-pq")         return A.q7b !== "כן" || A.q7a === "כן";
  if (pid === "p-eq")         return A.q8 !== "כן";
  if (pid === "p-bq")         return A.q9 !== "כן" || gg(A) === "bv";
  if (pid === "p-q9-adhd")    return !q9AdhdActive(A);

  if (pid === "p-q10") {
    const pqThr = pqThresholdFor(A);
    const anyPositive =
      (A.q1 || 0) >= 3 ||
      (A.q2 || 0) >= 3 ||
      ((A.q3 || 0) >= 3 && (A.mq_tot || 0) >= 4) ||
      (A.q4 === "כן" && ((A.add_s_tot||0)>=3||(A.add_g_tot||0)>=4||(A.add_b_tot||0)>=4||A.ad_o)) ||
      (A.q5 === "כן" && (A.oq_tot || 0) >= 10) ||
      (A.q6 === "כן" && (A.tq_tot || 0) >= 13) ||
      ((A.pq_tot || 0) >= pqThr) ||
      (A.q8 === "כן" && ((A.eq_ano||0)>=2||(A.eq_bul||0)>=2)) ||
      (A.q9 === "כן" && (A.bq_tot || 0) >= 4) ||
      (q9AdhdActive(A) && q9AdhdPositive(A));
    return anyPositive;
  }
  if (pid === "p-q10-par")   return A.q10 !== "כן";

  if (pid === "p-acad") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_aca || "");

  const devOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_dev || "");
  // The opening screen used to ask about toilet difficulties purely as a gate for
  // this screen, duplicating the question it gates. Flagging the developmental
  // area on p-areas is the gate now; the question itself is asked once, here.
  if (pid === "p-dev-toilet")  return !devOn;
  if (pid === "p-dev-sensory") return !devOn || !devAgeOk(A);

  if (pid === "p-beh") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_beh || "");
  if (pid === "p-soc") return !["מעט","הרבה","הרבה מאוד"].includes(A.a_soc || "");

  if (pid === "p-traits") {
    const n = traitNeeds(A);
    // verbal and prac are left out of this test on purpose: both depend on the
    // motivation answer, which is given on this very screen, so they are always
    // false while deciding whether to show it. Every case that reaches them has
    // motiv true as well - except the zy verbal path, which stands on its own.
    return !n.motiv && !n.verbal && !n.interests && !n.gaConsent;
  }

  // The refinement screen belongs to the counsellor rubric alone. Parents never
  // see it, and the flag travels inside the answers so this stays a pure
  // function of A like every other rule here.
  if (pid === "p-refine") return A._audience !== "counselor";

  // Same trick for the documents screen, one step further: whether a committee
  // route is open depends on the scored findings and on what the school tried,
  // and neither belongs in a pure routing rule. p-refine computes it on the way
  // out and writes the answer here, exactly as the audience flag travels.
  if (pid === "p-docs") return A._audience !== "counselor" || A._route !== true;

  return false;
}

// ── Navigation ───────────────────────────────────────────────────────────────
export function nextPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) + 1;
  while (i < PAGES.length && skipPage(PAGES[i], A)) i++;
  return i < PAGES.length ? PAGES[i] : "p-result";
}
export function prevPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) - 1;
  while (i >= 0 && skipPage(PAGES[i], A)) i--;
  return i >= 0 ? PAGES[i] : PAGES[0];
}

// ── Score updaters ────────────────────────────────────────────────────────────
export function updAQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.aq_tot = ["aq1","aq2","aq3","aq4","aq5","aq6","aq7","aq8","aq9","aq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
export function updMQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.mq_tot = ["mq1","mq2","mq3","mq4","mq5","mq6","mq7","mq8","mq9"]
    .filter(x => n[x] === "כן").length;
  return n;
}
export function updOQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.oq_tot = ["oq1","oq2","oq3","oq4","oq5","oq6"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
export function updTQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.tq_tot = ["tq1","tq2","tq3","tq4","tq5","tq6","tq7","tq8","tq9","tq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
export function updPQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  // pq5 / pq16 / pq7 dropped with the gate-restating items - see KIDS_PQ_ITEMS.
  n.pq_tot = ["pq11","pq13","pq8"]
    .filter(x => n[x] === "כן").length;
  return n;
}

/**
 * Threshold the thought-disturbance items must clear for a psychosis referral.
 *
 * Gate 7א (the child reported seeing or hearing things that were not there) is
 * the serious sign, and the two items that used to confirm it were restatements
 * of it, so in practice it always cleared the old 1-of-6 on its own: it now
 * needs no confirming item at all. Gate 7ב alone used to need 3 of 6, one of
 * which restated the gate, leaving two informative ones - so 2 of 3 now.
 * Infinity when neither gate was endorsed, so an untouched section never counts
 * as positive. Must stay identical to the copy in kids-score.server.ts.
 */
export function pqThresholdFor(A: Ans): number {
  if (A.q7a === "כן") return 0;
  if (A.q7b === "כן") return 2;
  return Infinity;
}
export function updEQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  const age = parseInt(n._age) || 0;
  if (age === 0 || age < 12) {
    n.eq_ano = ["ea1","ea2","ea3","ea4"].filter(x => n[x] === "כן").length;
    n.eq_bul = ["ea5","ea6","ea7","ea8"].filter(x => n[x] === "כן").length;
  } else {
    n.eq_ano = ["eb1","eb2","eb3"].filter(x => n[x] === "כן").length;
    n.eq_bul = ["eb4","eb5","eb6","eb7"].filter(x => n[x] === "כן").length;
  }
  return n;
}
export function updBQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.bq_tot = ["bq1","bq2","bq3","bq4","bq5","bq6","bq7"]
    .filter(x => n[x] === "כן").length;
  return n;
}
export function updLSAS(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  let tot = 0;
  for (let i = 1; i <= 8; i++) tot += (n[`lsas_a${i}`] || 0);
  n.lsas_tot = tot;
  return n;
}
export function computeBehPlan(A: Ans): Ans {
  function sev(v: string) { return v === "הרבה" ? 2 : v === "מעט" ? 1 : 0; }
  const s1 = sev(A.beh1||""), s2 = sev(A.beh2||""), s3 = sev(A.beh3||"");
  let ml = 0;
  if (s1===1) ml = Math.max(ml,1); if (s1===2) ml = Math.max(ml,2);
  if (s2===1) ml = Math.max(ml,3); if (s2===2) ml = Math.max(ml,4);
  if (s3===1) ml = Math.max(ml,5); if (s3===2) ml = Math.max(ml,6);
  const plan = ml===0 ? "" : ml<=3 ? "חיובי" : ml<=5 ? "חיובי_שלילי" : "חיובי_שלילי_פסיכולוגי";
  return { ...A, beh_max_level: ml, beh_plan: plan };
}
export function updAddict(A: Ans, k: string, v: string, type: "s"|"g"|"b"): Ans {
  const n = { ...A, [k]: v };
  if (type === "s") n.add_s_tot = ["as1","as2","as3","as4","as5","as6"].filter(x => n[x]==="כן").length;
  if (type === "g") n.add_g_tot = ["ag1","ag2","ag3","ag4","ag5","ag6","ag7"].filter(x => n[x]==="כן").length;
  if (type === "b") n.add_b_tot = ["agl1","agl2","agl3","agl4","agl5","agl6","agl7"].filter(x => n[x]==="כן").length;
  return n;
}



