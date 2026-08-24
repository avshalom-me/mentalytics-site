"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ALL_REGIONS, REGION_CITIES, CITY_TO_REGION } from "@/app/lib/regions";
import { getFingerprint } from "@/app/lib/fingerprint";
import { QUESTIONNAIRE_ITEMS_VERSION } from "@/app/lib/questionnaire-items-version";
import { downloadResultsPDF } from "@/app/lib/download-pdf";
import { trackQuizStep, trackQuizComplete, trackQuizTreatments, trackTherapistExplain, trackMatchingClick, trackMatchSearch } from "@/app/lib/useTrack";
import { getAttribution } from "@/app/lib/attribution";
import QuizPaymentBlock from "@/app/components/QuizPaymentBlock";
import { CrisisResources } from "@/app/components/CrisisResources";
import QuizFeedbackBox from "@/app/components/QuizFeedbackBox";
import SaveMatchesButton from "@/app/components/SaveMatchesButton";
import MatchCardWhatsApp from "@/app/components/MatchCardWhatsApp";
import {
  parseKidsBoxes,
  aggregateForMatch,
  type KidsRecommendationGroup,
  type KidsDomainResult,
} from "@/app/lib/kids-recommendations";
import { buildKidsFacts } from "@/app/lib/explain-facts";
import { therapistPath } from "@/app/lib/therapist-url";
import { getTreatmentArticle, getTreatmentArticleHref } from "@/app/lib/treatment-articles";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { useScreenHistory } from "@/app/lib/useScreenHistory";

function getOrCreateSessionId(): string | null {
  try {
    let id = localStorage.getItem("mnt_session_id");
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem("mnt_session_id", id);
    }
    return id;
  } catch {
    return null;
  }
}

function normalizeKidsRegionKey(r: string, online: boolean): string | null {
  if (online && !r) return "online";
  if (!r) return null;
  if (r.includes("גוש דן") || r.includes("שפלה")) return "center";
  if (r.includes("שרון")) return "sharon";
  if (r.includes("ירושלים")) return "jerusalem";
  if (r.includes("חיפה") || r.includes("קריות")) return "haifa";
  if (r.includes("גליל") || r.includes("עמק")) return "north";
  if (r.includes("דרום")) return "south";
  return null;
}

// ── Types ────────────────────────────────────────────────────────────────────
type Ans = Record<string, any>;
type BoxCls = "info" | "warn" | "danger" | "purple" | "ok";
interface Box { cls: BoxCls; txt: string; isLowStress?: boolean; }
interface KidsScoreResult {
  emotional: Box[];
  academic: Box[];
  developmental: Box[];
  behavioral: Box[];
  social: Box[];
}

// ── Grade groups ─────────────────────────────────────────────────────────────
const GA_GRADES = ["פעוט","גן3","גן-טרום","גן","א"];
const BV_GRADES = ["ב","ג","ד","ה","ו"];
const ZY_GRADES = ["ז","ח","ט","י","יא","יב"];

function gg(A: Ans): "ga"|"bv"|"zy"|"" {
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

function acadGg(A: Ans): "gan"|"ag"|"dv"|"zh"|"tyb" {
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

function devAgeOk(A: Ans): boolean {
  const age = parseInt(A._age) || 0;
  return (age > 0 && age < 7) || gg(A) === "ga";
}

// Q9 (regulation/impulsivity) for grades ב׳–ו׳ is re-routed to the ADHD
// questionnaire (prefix "q9") instead of BQ. Kept in sync with kids-score.server.ts.
function q9AdhdActive(A: Ans): boolean { return A.q9 === "כן" && gg(A) === "bv"; }
// Must stay equal to ADHD_BLOCK_THRESHOLD in kids-score.server.ts. This copy
// only decides whether the general-distress screen is shown; if the two drift,
// a child flagged positive by the scoring is still asked "is there anything
// else?", or the reverse - asked nothing while the report says ADHD.
const ADHD_BLOCK_THRESHOLD = 3;

function q9AdhdPositive(A: Ans): boolean {
  const inatt = ["q9_ad1","q9_ad2","q9_ad3","q9_ad4","q9_ad5","q9_ad6"].filter(k => A[k]).length;
  const hyper = ["q9_ah1","q9_ah2","q9_ah3","q9_ah4","q9_ah5","q9_ah6"].filter(k => A[k]).length;
  return inatt >= ADHD_BLOCK_THRESHOLD || hyper >= ADHD_BLOCK_THRESHOLD;
}

// ── Page order ───────────────────────────────────────────────────────────────
// p-aq-grade, p-q1-ga, p-q2-grade, p-q10-grade and p-ga-traits are gone; between
// them they asked the same four things over and over (see traitNeeds below) and
// p-traits now asks each once, at the end.
const PAGES = [
  "p-consent","p-demo","p-areas",
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
  "p-result",
] as const;
type PageId = (typeof PAGES)[number];

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

function socDetailsShown(A: Ans): boolean {
  return A.soc1 === "כן" && (A.lsas_tot || 0) >= 8 && gg(A) !== "ga";
}

/** The conditions under which p-aq-grade used to carry the trait questions. */
function anxietyGradeActive(A: Ans): boolean {
  return ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "")
    && (A.q1 || 0) >= 3
    && (A.aq_tot || 0) >= 16;
}

/** GA-track children reach the consent question only on a positive finding. */
function hasGaPositive(A: Ans): boolean {
  return (A.q1||0) >= 3 || (A.q2||0) >= 3
    || ((A.q3||0) >= 3 && (A.mq_tot||0) >= 4)
    || (A.q5 === "כן" && (A.oq_tot||0) >= 10)
    || (A.q9 === "כן" && (A.bq_tot||0) >= 4)
    || (A.q10 === "כן" && A.q10_par === "כן");
}

type TraitNeeds = { motiv: boolean; verbal: boolean; prac: boolean; interests: boolean; gaConsent: boolean };

/**
 * Which characteristics the scoring will actually read for this child.
 *
 * Mirrors the read sites in kids-score.server.ts one for one, so nothing is
 * asked that will be discarded and nothing the scoring needs goes uncollected.
 * verbal and prac depend on the motivation answer, so they appear inside the
 * step once motivation is given rather than gating whether the step shows.
 */
function traitNeeds(A: Ans): TraitNeeds {
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

// ── Skip logic ───────────────────────────────────────────────────────────────
function skipPage(pid: string, A: Ans): boolean {
  const emoOn = ["מעט","הרבה","הרבה מאוד"].includes(A.a_emo || "");
  const emoPages = [
    "p-q1","p-q1-pain","p-aq","p-q2","p-q3","p-mq","p-mq-sui",
    "p-q4","p-q4-types","p-q4-s","p-q4-g","p-q4-b","p-q4-ctrl",
    "p-q5","p-oq","p-q6","p-tq","p-q7","p-pq","p-q8","p-eq",
    "p-q9","p-bq","p-q9-adhd","p-q10","p-q10-par",
  ];
  if (emoPages.includes(pid) && !emoOn) return true;

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

  return false;
}

// ── Navigation ───────────────────────────────────────────────────────────────
function nextPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) + 1;
  while (i < PAGES.length && skipPage(PAGES[i], A)) i++;
  return i < PAGES.length ? PAGES[i] : "p-result";
}
function prevPid(cur: string, A: Ans): string {
  let i = PAGES.indexOf(cur as PageId) - 1;
  while (i >= 0 && skipPage(PAGES[i], A)) i--;
  return i >= 0 ? PAGES[i] : PAGES[0];
}

// ── Score updaters ────────────────────────────────────────────────────────────
function updAQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.aq_tot = ["aq1","aq2","aq3","aq4","aq5","aq6","aq7","aq8","aq9","aq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updMQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.mq_tot = ["mq1","mq2","mq3","mq4","mq5","mq6","mq7","mq8","mq9"]
    .filter(x => n[x] === "כן").length;
  return n;
}
function updOQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.oq_tot = ["oq1","oq2","oq3","oq4","oq5","oq6"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updTQ(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  n.tq_tot = ["tq1","tq2","tq3","tq4","tq5","tq6","tq7","tq8","tq9","tq10"]
    .reduce((s, x) => s + (n[x] || 0), 0);
  return n;
}
function updPQ(A: Ans, k: string, v: string): Ans {
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
function pqThresholdFor(A: Ans): number {
  if (A.q7a === "כן") return 0;
  if (A.q7b === "כן") return 2;
  return Infinity;
}
function updEQ(A: Ans, k: string, v: string): Ans {
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
function updBQ(A: Ans, k: string, v: string): Ans {
  const n = { ...A, [k]: v };
  n.bq_tot = ["bq1","bq2","bq3","bq4","bq5","bq6","bq7"]
    .filter(x => n[x] === "כן").length;
  return n;
}
function updLSAS(A: Ans, k: string, v: number): Ans {
  const n = { ...A, [k]: v };
  let tot = 0;
  for (let i = 1; i <= 8; i++) tot += (n[`lsas_a${i}`] || 0);
  n.lsas_tot = tot;
  return n;
}
function computeBehPlan(A: Ans): Ans {
  function sev(v: string) { return v === "הרבה" ? 2 : v === "מעט" ? 1 : 0; }
  const s1 = sev(A.beh1||""), s2 = sev(A.beh2||""), s3 = sev(A.beh3||"");
  let ml = 0;
  if (s1===1) ml = Math.max(ml,1); if (s1===2) ml = Math.max(ml,2);
  if (s2===1) ml = Math.max(ml,3); if (s2===2) ml = Math.max(ml,4);
  if (s3===1) ml = Math.max(ml,5); if (s3===2) ml = Math.max(ml,6);
  const plan = ml===0 ? "" : ml<=3 ? "חיובי" : ml<=5 ? "חיובי_שלילי" : "חיובי_שלילי_פסיכולוגי";
  return { ...A, beh_max_level: ml, beh_plan: plan };
}
function updAddict(A: Ans, k: string, v: string, type: "s"|"g"|"b"): Ans {
  const n = { ...A, [k]: v };
  if (type === "s") n.add_s_tot = ["as1","as2","as3","as4","as5","as6"].filter(x => n[x]==="כן").length;
  if (type === "g") n.add_g_tot = ["ag1","ag2","ag3","ag4","ag5","ag6","ag7"].filter(x => n[x]==="כן").length;
  if (type === "b") n.add_b_tot = ["agl1","agl2","agl3","agl4","agl5","agl6","agl7"].filter(x => n[x]==="כן").length;
  return n;
}



// ── Shared UI helpers ─────────────────────────────────────────────────────────
// min-h-[44px] on every tappable control: the option pills were 27-32px tall,
// well under the 44px minimum touch target, which is a big part of why the quiz
// felt fiddly on a phone.
const BTN_BASE  = "px-5 py-2 min-h-[44px] border-2 rounded-full font-medium text-sm transition-all cursor-pointer";
const BTN_SEL   = "bg-[var(--teal)] text-white border-[var(--teal)]";
const BTN_DEF   = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
// min-w-0 instead of min-w-[40px]: the fixed floor meant a 7-point scale needed
// 316px and only 282px were available inside a card on a 375px phone, so every
// one of them wrapped onto a second line. flex-1 alone divides the row evenly.
const SB_BASE   = "min-w-0 h-11 border-2 rounded-lg font-semibold text-sm transition-all cursor-pointer flex-1";
const SB_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
const SB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
// flex-1 + min-w-0: these pills sit in plain `flex gap-2` rows with no wrap, so a
// 7-point scale used to run off the side of a phone. Sharing the row width keeps
// every scale on one line at any width instead of overflowing or breaking in two.
const SO_BASE   = "flex-1 min-w-0 px-2 py-1.5 min-h-[44px] border-2 rounded-2xl text-sm font-medium transition-all cursor-pointer";
const SO_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
const SO_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";
const CB_BASE   = "px-4 py-2 min-h-[44px] border-2 rounded-full text-sm font-medium transition-all cursor-pointer";
const CB_SEL    = "bg-[var(--teal)] text-white border-[var(--teal)]";
const CB_DEF    = "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]";

function ob(selected: boolean) { return `${BTN_BASE} ${selected ? BTN_SEL : BTN_DEF}`; }
function sb(selected: boolean) { return `${SB_BASE} ${selected ? SB_SEL : SB_DEF}`; }
function so(selected: boolean) { return `${SO_BASE} ${selected ? SO_SEL : SO_DEF}`; }
function cb(selected: boolean) { return `${CB_BASE} ${selected ? CB_SEL : CB_DEF}`; }

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">{children}</div>;
}
function StepTag({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{children}</div>;
}
function StepQ({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-[#1a2a3a] mb-1 leading-snug">{children}</h2>;
}
function StepHint({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-400 mb-5 leading-relaxed">{children}</p>;
}
function EqNum({ n }: { n: number }) {
  return <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--teal)] text-white text-sm font-bold mb-3">{n}</div>;
}
// showBack defaults to true now: the parent passes onBack only while a step back
// is actually available (see pageProps), so the presence of the handler is the
// switch. It used to be wired up at every call site and rendered at none.
// nextDisabled greys the button out; passing onNext={undefined} removes it
// entirely. On a screen with unanswered required questions the second reads as
// "the questionnaire ended here" - especially on the last screen - so anything
// waiting for an answer should stay visible and disabled.
function NavRow({ onBack, onNext, backLabel = "→ חזרה", nextLabel = "המשך ←", showBack = true, nextDisabled = false }: {
  onBack?: () => void; onNext?: () => void; backLabel?: string; nextLabel?: string; showBack?: boolean; nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-7 flex-wrap">
      {onNext && (
        <button onClick={onNext} disabled={nextDisabled} className="px-8 py-3 bg-gradient-to-r from-[#2c3e7a] to-[#4a6fa5] text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">{nextLabel}</button>
      )}
      {showBack && onBack && (
        <button onClick={onBack} className="px-6 py-3 border-2 border-[var(--teal)] text-[var(--teal)] rounded-full font-semibold text-sm hover:bg-blue-50 transition-all">{backLabel}</button>
      )}
    </div>
  );
}
/**
 * "You still have N unanswered items" under a blocked Continue.
 *
 * Every screen that uses this sits behind a gate the parent already answered
 * yes to, so tapping past the detail questionnaire scores that section 0 and
 * the report then contradicts what they just said: it stays silent about a
 * difficulty they flagged, or - on the anxiety screen - states low stress
 * outright. Blocking is the fix at source; the informed fallbacks in the scorer
 * are the second line, for a client that malfunctions rather than a parent who
 * skips.
 */
/**
 * How many of `keys` carry no answer.
 *
 * Tests for undefined rather than falsiness on purpose: the trauma scale starts
 * at 0, so a genuine "כלל לא" is falsy and would otherwise be counted as
 * unanswered and block a screen the parent had in fact completed.
 */
function countMissing(A: Ans, keys: string[]): number {
  return keys.filter(k => A[k] === undefined || A[k] === null || A[k] === "").length;
}
function IncompleteHint({ missing }: { missing: number }) {
  if (missing <= 0) return null;
  return (
    <p className="text-red-500 text-sm font-semibold mt-3">
      ⛔ {missing === 1 ? "נותר סעיף אחד ללא מענה" : `נותרו ${missing} סעיפים ללא מענה`} - יש לענות על כולם כדי להמשיך
    </p>
  );
}
function SubCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-5 mt-2 border border-[var(--line)] space-y-4">{children}</div>;
}
function GradeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#fdf8ff] border-2 border-purple-300 rounded-xl p-3 sm:p-4 mt-3">
      <div className="text-sm font-bold text-purple-700 mb-3">{title}</div>
      {children}
    </div>
  );
}

// Scale 1–N (auto-advance on click)
function ScaleRow({ max, val, onChange }: { max: number; val: number; onChange: (v: number) => void }) {
  return (
    <div className="scale-grid mt-1" style={{ ["--scale-cols" as string]: max }}>
      {Array.from({length: max}, (_, i) => i + 1).map(n => (
        <button key={n} className={sb(val === n)} onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
  );
}
// Yes/No row
function YNRow({ val, onChange }: { val: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-3 mt-1">
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="כן" ? "bg-[var(--teal)] text-white border-[var(--teal)]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`} onClick={() => onChange("כן")}>כן</button>
      <button className={`flex-1 text-center py-3 text-base font-bold rounded-xl border-2 transition-all ${val==="לא" ? "bg-[var(--teal)] text-white border-[var(--teal)]" : "bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`} onClick={() => onChange("לא")}>לא</button>
    </div>
  );
}

// ── Age/grade mismatch helper ─────────────────────────────────────────────────
const GRADE_AGE: Record<string, [number, number]> = {
  "פעוט":[1,2],"גן3":[3,3],"גן-טרום":[4,4],"גן":[5,6],
  "א":[6,7],"ב":[7,8],"ג":[8,9],"ד":[9,10],"ה":[10,11],"ו":[11,12],
  "ז":[12,13],"ח":[13,14],"ט":[14,15],"י":[15,16],"יא":[16,17],"יב":[17,18],
};
// ── Grade derived from age ────────────────────────────────────────────────────
// The grade used to be a 16-option dropdown on the opening screen, which a third
// of parents never got past. It is still needed - two separate groupings branch
// on it - but the age almost always settles which grouping the child falls in,
// so it is derived, and the parent is only asked when it genuinely doesn't.

const GRADE_LABEL: Record<string, string> = {
  "פעוט": "פעוט", "גן3": "גן גיל 3", "גן-טרום": "גן טרום חובה", "גן": "גן חובה",
  "א": "כיתה א׳", "ב": "כיתה ב׳", "ג": "כיתה ג׳", "ד": "כיתה ד׳", "ה": "כיתה ה׳", "ו": "כיתה ו׳",
  "ז": "כיתה ז׳", "ח": "כיתה ח׳", "ט": "כיתה ט׳", "י": "כיתה י׳", "יא": 'כיתה י"א', "יב": 'כיתה י"ב',
};

function gradesForAge(age: number): string[] {
  return Object.keys(GRADE_AGE).filter(g => age >= GRADE_AGE[g][0] && age <= GRADE_AGE[g][1]);
}
function ggOfGrade(g: string): string {
  if (GA_GRADES.includes(g)) return "ga";
  if (BV_GRADES.includes(g)) return "bv";
  if (ZY_GRADES.includes(g)) return "zy";
  return "";
}
function acadGgOfGrade(g: string): string {
  if (["פעוט","גן3","גן-טרום","גן"].includes(g)) return "gan";
  if (["א","ב","ג"].includes(g)) return "ag";
  if (["ד","ה","ו"].includes(g)) return "dv";
  if (["ז","ח"].includes(g)) return "zh";
  return "tyb";
}

/**
 * The grades a child of this age could be in, but only when the choice between
 * them changes which question track they get - i.e. the candidates disagree on
 * gg() or on acadGg(). Returns null when the age is enough on its own, which is
 * every age except 6, 7, 9, 12 and 14.
 */
function ambiguousGrades(age: number): string[] | null {
  const cands = gradesForAge(age);
  if (cands.length < 2) return null;
  const sameTrack =
    new Set(cands.map(ggOfGrade)).size === 1 &&
    new Set(cands.map(acadGgOfGrade)).size === 1;
  return sameTrack ? null : cands;
}

/** Grade to store for an age that needs no question; "" when the parent must pick. */
function derivedGrade(age: number): string {
  if (age <= 0) return "";
  if (ambiguousGrades(age)) return "";
  return gradesForAge(age)[0] || "";
}
function calcBMI(h: number, w: number): number | null {
  if (!h || !w) return null;
  return w / ((h / 100) ** 2);
}
function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return "תת משקל";
  if (bmi < 25)   return "תקין";
  if (bmi < 30)   return "עודף משקל";
  return "השמנה";
}

// ── p-consent ─────────────────────────────────────────────────────────────────
function PageConsent({ onNext }: { onNext: () => void }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div>
      <h1 className="mb-2 text-xl font-black leading-snug" style={{ color: "var(--text)" }}>נעזור לכם להבין מה יעזור לילד/ה שלכם</h1>
      <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        כמה שאלות על מה שקורה אצלכם בבית, ובסוף תקבלו המלצה על סוג הטיפול המתאים ורשימת מטפלים שעובדים עם ילדים בדיוק בתחום הזה.
      </p>
      <ul className="mb-5 flex flex-col gap-2">
        {[
          ["🔒", "אנונימי לחלוטין", "בלי שם, בלי פרטים מזהים, בלי הרשמה"],
          ["⏱️", "כ-6 דקות", "זה הזמן שלוקח לרוב ההורים"],
          ["↩️", "עונים רק על מה שרלוונטי", "כל תחום שלא נוגע לילד/ה פשוט מדלגים עליו"],
        ].map(([icon, title, desc]) => (
          <li key={title} className="flex items-start gap-3 rounded-xl p-3 text-sm" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)" }}>
            <span aria-hidden className="text-base leading-none">{icon}</span>
            <span>
              <strong style={{ color: "var(--teal-dark)" }}>{title}</strong>
              <span className="block text-xs" style={{ color: "var(--text-2)" }}>{desc}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
        חשוב שנאמר את זה מראש: השאלון עוזר להתאים סוג טיפול, אבל הוא <strong>אינו אבחון</strong> פסיכולוגי, פסיכיאטרי או רפואי, ואינו מחליף בדיקה של איש מקצוע.
      </p>
      <details className="mb-5 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <summary className="cursor-pointer select-none text-sm font-bold" style={{ color: "var(--teal-dark)" }}>
          לנוסח המשפטי המלא
        </summary>
        <div className="mt-3 leading-relaxed" style={{ color: "var(--text-2)" }}>
          <p className="mb-3 text-sm">שאלון זה נועד אך ורק לסייע בהתאמה של סוג הטיפול לקושי המדווח ואינו מהווה אבחון פסיכולוגי, פסיכיאטרי או רפואי מכל סוג שהוא.</p>
          <p className="mb-3 text-sm">המידע המוצג בשאלון הינו כללי בלבד ואינו מחליף ייעוץ מקצועי, אבחון או טיפול על ידי גורמים מוסמכים. השאלון אינו מתיימר לאבחן הפרעות נפשיות, מחלות או כל מצב בריאותי אחר.</p>
          <p className="text-sm">המשתמש/ת בשאלון זה מצהיר/ה כי הוא/היא מבין/ה שהתשובות המתקבלות אינן מחייבות מבחינה קלינית, ואין לסמוך עליהן כתחליף לאבחון מקצועי. הגורמים המפעילים את השאלון אינם נושאים בכל אחריות לנזק, ישיר או עקיף, שייגרם כתוצאה מהשימוש בו.</p>
        </div>
      </details>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl p-4 text-sm hover:opacity-90" style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#2e7d8c]" />
        <span>קראתי את ההצהרה, הבנתי את תנאיה ואני מסכים/ה להמשיך</span>
      </label>
      <div className="mt-5">
        <button
          disabled={!agreed}
          onClick={onNext}
          className="w-full rounded-xl bg-[var(--teal-dark)] py-4 text-base font-bold text-white disabled:opacity-40 hover:bg-[#0f2540]"
        >
          מתחילים ←
        </button>
      </div>
    </div>
  );
}

// ── p-demo ────────────────────────────────────────────────────────────────────
function PageDemo({ A, setA, onNext, onBack }: { A: Ans; setA: (a: Ans) => void; onNext: (a: Ans) => void; onBack?: () => void }) {
  const [showErr, setShowErr] = useState(false);

  const age = parseInt(A._age) || 0;
  // Only surfaced for the five ages where the grade actually changes the track.
  const gradeChoices = age > 0 ? ambiguousGrades(age) : null;
  // min/max on the input are not enforced outside a form submit, and the grade
  // dropdown that used to catch a nonsense age is gone. An out-of-range age
  // leaves _grade empty, and every grp === "ga" | "bv" | "zy" chain in the
  // scoring then falls through to its else - the adolescent track - so a typo
  // silently routes a toddler through teenage questions.
  const ageValid = age >= 1 && age <= 18;

  function upd(key: string, val: any) {
    const next = { ...A, [key]: val };
    // Keep the derived grade in step with the age: settled ages get one silently,
    // ambiguous ages get it cleared so the follow-up below is answered afresh.
    if (key === "_age") next._grade = derivedGrade(parseInt(val) || 0);
    setA(next);
  }

  function handleNext() {
    if (!ageValid || !A.gender || (gradeChoices && !A._grade)) { setShowErr(true); return; }
    setShowErr(false);
    onNext(A);
  }

  return (
    <div>
      <Card>
        <StepTag>שלב 1 מתוך 2</StepTag>
        <StepQ>קצת על הילד/ה</StepQ>
        <StepHint>{gradeChoices ? "שלוש שאלות קצרות, ומתחילים" : "שתי שאלות קצרות, ומתחילים"}</StepHint>

        <div className="mb-5">
          <label className="text-sm font-semibold text-gray-600 block mb-2">בן/בת כמה?</label>
          <input type="number" min={1} max={18} placeholder="גיל"
            value={A._age || ""}
            onChange={e => upd("_age", e.target.value)}
            className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 w-24 focus:border-[#4a6fa5] outline-none" />
        </div>

        {gradeChoices && (
          <div className="mb-5">
            <label className="text-sm font-semibold text-gray-600 block mb-2">באיזו כיתה?</label>
            <div className="flex gap-2 flex-wrap">
              {gradeChoices.map(g => (
                <button key={g} className={ob(A._grade === g)} onClick={() => upd("_grade", g)}>{GRADE_LABEL[g]}</button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">בגיל הזה שתי האפשרויות שכיחות, וזה משנה אילו שאלות נשאל בהמשך.</p>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-2">מין</label>
          <div className="flex gap-2 flex-wrap">
            {["זכר","נקבה"].map(g => (
              <button key={g} className={ob(A.gender === g)} onClick={() => upd("gender", g)}>{g}</button>
            ))}
          </div>
        </div>
      </Card>

      <NavRow onBack={onBack} onNext={handleNext} />
      {showErr && (
        <p className="text-red-500 text-sm font-semibold mt-3">
          {!ageValid ? "⛔ יש למלא גיל בין 1 ל-18"
            : gradeChoices && !A._grade ? "⛔ יש לבחור כיתה ומין לפני המשך"
            : "⛔ יש למלא גיל ומין לפני המשך"}
        </p>
      )}
    </div>
  );
}

// ── p-areas ───────────────────────────────────────────────────────────────────
const AREA_OPTS = ["כלל לא","מעט","הרבה","הרבה מאוד"];

function PageAreas({ A, setA, onNext, onBack }: { A: Ans; setA: (a: Ans) => void; onNext: (a: Ans) => void; onBack?: () => void }) {
  const age   = parseInt(A._age) || 0;
  const grpV  = gg(A);
  // Was also unlocked by the toilet question on the opening screen, which is gone.
  // The window widens to 12 instead: bed-wetting and encopresis referrals stay
  // clinically relevant well past 7, and that gate was the only way to reach them.
  const showDev = (age > 0 && age < 12) || grpV === "ga";
  // Ages 1–2: only developmental + behavioral domains are relevant - hide the
  // emotional / learning / social options entirely.
  const onlyDevBeh = age >= 1 && age <= 2;

  function selArea(key: string, val: string) {
    setA({ ...A, [key]: val });
  }

  const areas = [
    {
      key: "a_emo",
      title: "בעיות רגשיות",
      desc: "חרדות, לחצים, דימוי עצמי, מצב רוח, שימוש יתר",
      detail:
        "תחום שעוסק בעולם הפנימי של הילד/ה: חרדה, פחדים, דאגות חוזרות, קושי להירגע, מתח גופני; דימוי עצמי נמוך וביקורת עצמית; מצב רוח ירוד, חוסר עניין או הנאה, רגישות יתר וקושי בוויסות רגשי; מחשבות חודרניות או טקסים אובססיביים-קומפולסיביים; טראומה ואירועים מעוררי חרדה; וכן סוגי שימוש יתר (חומרים, מסכים, הימורים) ובעיות אכילה. אם בני הנוער או ילדכם מתמודדים עם תחושות פנימיות שמקשות עליהם בתפקוד היומיומי או בקשרים - סמנו כאן.",
    },
    // Two descriptions, because the questions behind them differ by age. The
    // sensory screen is gated on devAgeOk (under 7, or the gan/א track), so for
    // 7-11 the only developmental question actually asked is toilet difficulty.
    // Promising motor skills and sensory regulation to those parents and then
    // asking about neither is how a domain ends up feeling broken.
    ...(showDev
      ? [devAgeOk(A)
        ? {
            key: "a_dev",
            title: "בעיות התפתחותיות",
            desc: "גמילה, הרטבה, מוטוריקה, ויסות חושי",
            detail:
              "תחום שעוסק באבני דרך התפתחותיות: גמילה מחיתולים (יום ולילה), הרטבה לאחר גיל הגמילה, עצירות או אנקופרזיס; מוטוריקה גסה (תיאום, שיווי משקל, חוסר בטחון בתנועה) ומוטוריקה עדינה (אחיזת עיפרון, גזירה, כתיבה, איכות ציור); ויסות חושי - תגובות מוגזמות לקולות, מגע, בדים, אורות, או דווקא חיפוש מוגבר של גירויים. בקשיים אלה מעורבים לעיתים רופא ילדים, מרפאה בעיסוק, פיזיותרפיסטית רצפת אגן או קלינאית תקשורת.",
          }
        : {
            key: "a_dev",
            title: "גמילה והרטבה",
            desc: "הרטבת לילה או יום, עצירות, בריחת צואה",
            detail:
              "תחום שעוסק בשליטה על הסוגרים בגיל שבו כבר מצופה שליטה מלאה: הרטבת לילה או יום, עצירות כרונית, ובריחת צואה (אנקופרזיס). ברוב המקרים הגורם הראשוני הוא דווקא עצירות, וניתן לטפל בכך. בקשיים אלה מעורבים לעיתים רופא ילדים, אורולוג או גסטרואנטרולוג ילדים, ופיזיותרפיסטית רצפת אגן לילדים.",
          }]
      : []),
    {
      key: "a_aca",
      title: "בעיות לימודיות",
      desc: "קריאה, כתיבה, ריכוז, לקויות למידה",
      detail:
        "תחום שעוסק בתפקוד הלימודי: קשיי קשב וריכוז (חוסר ריכוז, היסחות, היפראקטיביות, אימפולסיביות); לקויות למידה בקריאה (דיסלקציה), בכתיבה (דיסגרפיה), בחשבון (דיסקלקוליה) או באנגלית; קשיים בהבנת הנקרא, ברבי מלל ובהפקת טקסט כתוב; קשיים ארגוניים בלמידה - תכנון זמן, הכנת שיעורי בית, הכנה למבחנים. בתחום זה עשויות להידרש פניות לאבחון פסיכו-דידקטי, נוירו-פסיכולוגי, קלינאית תקשורת או הוראה מתקנת.",
    },
    {
      key: "a_beh",
      title: "בעיות התנהגותיות",
      desc: "התנגדויות, הצקות, אלימות",
      detail:
        'תחום שעוסק בהתנהגויות חיצוניות וביחסים עם סמכות: התקפי זעם, התנגדות עיקשת, ויכוחים ומשא ומתן בלתי-פוסק; הפרת חוקים בבית או במסגרת החינוכית; אלימות מילולית או פיזית, הצקות לאחים או לחברים; שקרים, גניבות, בריחה ממסגרת; קושי לשאת תסכול או לקבל "לא". התחום קשור לעיתים גם להדרכת הורים טיפולית, לתוכנית התנהגותית במסגרת ולעבודה משותפת עם בית הספר.',
    },
    {
      key: "a_soc",
      title: "בעיות חברתיות",
      desc: "קושי בחברה, ביישנות, דחייה חברתית",
      detail:
        "תחום שעוסק בקשרים עם בני הגיל: קושי ליצור חברויות, להישאר בקבוצה ולשמור על קשרים לאורך זמן; ביישנות, הימנעות חברתית, חרדה חברתית ופחד מהערכה; דחייה, בריונות או חרם - בין אם בכיתה או ברשתות החברתיות; קשיים בקריאת רמזים חברתיים ובקבלת ביקורת. כאן רלוונטיים לעיתים קבוצות חברתיות, טיפול CBT לחרדה חברתית, וייעוץ עם יועצת בית הספר.",
    },
  ];

  // For 1–2 year-olds, show only the developmental + behavioral domains.
  const visibleAreas = onlyDevBeh
    ? areas.filter(a => a.key === "a_dev" || a.key === "a_beh")
    : areas;

  return (
    <div>
      <Card>
        <StepTag>שלב 2 מתוך 2</StepTag>
        <StepQ>תחומי הקושי העיקריים</StepQ>
        <StepHint>דרג את רמת הקושי בכל תחום. ניתן ללחוץ על "הסבר מפורט" כדי לקרוא יותר על כל תחום.</StepHint>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleAreas.map(({ key, title, desc, detail }) => (
            <div key={key}
              className={`bg-[var(--surface)] border-2 rounded-xl p-4 transition-all ${A[key] && A[key] !== "כלל לא" ? "border-[var(--teal)]" : "border-[var(--line)]"}`}>
              <div className="text-sm font-bold text-[#1a2a3a] mb-1">{title}</div>
              <div className="text-xs text-gray-400 mb-2 leading-relaxed">{desc}</div>
              <details className="mb-3 area-details">
                <summary className="text-xs font-semibold text-[var(--teal)] cursor-pointer hover:underline list-none flex items-center gap-1 select-none">
                  <span className="inline-block transition-transform area-plus text-base leading-none">+</span>
                  הסבר מפורט
                </summary>
                <div className="mt-2 text-xs leading-6 text-gray-600 bg-white border border-[var(--line)] rounded-lg p-3">
                  {detail}
                </div>
              </details>
              <div className="flex gap-1.5 flex-wrap">
                {AREA_OPTS.map(opt => (
                  <button key={opt}
                    className={`flex-1 min-w-[68px] min-h-[44px] px-2 py-1 border-[1.5px] rounded-2xl text-sm font-medium transition-all cursor-pointer ${A[key] === opt ? "bg-[var(--teal)] text-white border-[var(--teal)]" : "bg-white text-[#3a4a5a] border-[#d0dae8] hover:border-[var(--teal)]"}`}
                    onClick={() => selArea(key, opt)}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <style>{`
          .area-details summary::-webkit-details-marker { display: none; }
          .area-details[open] .area-plus { transform: rotate(45deg); }
        `}</style>
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── Shared: GA interests ──────────────────────────────────────────────────────
const GA_INT_LIST = [
  { key:"ga_int_art",    label:"🎨 אומנות" },
  { key:"ga_int_music",  label:"🎵 מוזיקה" },
  { key:"ga_int_move",   label:"🏃 תנועה" },
  { key:"ga_int_drama",  label:"🎭 דרמה" },
  { key:"ga_int_biblio", label:"📖 ביבליותרפיה - סיפור" },
  { key:"ga_int_garden", label:"🌱 גינון" },
  { key:"ga_int_animal", label:"🐾 בע\"ח" },
];

// Used once, inside p-traits. It used to appear on three screens with two
// separate implementations, kept from firing twice by three different guards.
// onDone is optional now: inside a step that has its own Continue button there
// is nothing to auto-advance to.
function GaConsentBlock({ A, setA, onDone }: {
  A: Ans; setA:(a:Ans)=>void; onDone?:(a:Ans)=>void;
}) {
  const emoLvl = A.a_emo || "";
  const veryHigh = emoLvl === "הרבה מאוד";
  function pick(key: string, val: any) { const n={...A,[key]:val}; setA(n); return n; }
  return (
    <div>
      <p className="text-base font-bold text-[#1a2a3a] mb-3">האם הילד מסכים לטיפול?</p>
      <div className="flex gap-3 mb-4">
        <button className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent==="כן"?"bg-[var(--teal)] text-white border-[var(--teal)]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`}
          onClick={() => { const n=pick("ga_consent","כן"); if(veryHigh) onDone?.(n); }}>כן</button>
        <button className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent==="לא"?"bg-[var(--teal)] text-white border-[var(--teal)]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`}
          onClick={() => pick("ga_consent","לא")}>לא</button>
      </div>

      {A.ga_consent === "לא" && (
        <div>
          <p className="text-sm font-semibold text-[#1a2a3a] mb-3">האם הילד יסכים לטיפול יחד עם אחד ההורים?</p>
          <div className="flex gap-3">
            {["כן","לא"].map(v=>(
              <button key={v} className={`flex-1 py-3 text-base font-bold rounded-xl border-2 transition-all ${A.ga_consent_parent===v?"bg-[var(--teal)] text-white border-[var(--teal)]":"bg-white border-[#d0dae8] text-[#3a4a5a] hover:border-[var(--teal)]"}`}
                onClick={() => { const n={...A,ga_consent_parent:v}; setA(n); onDone?.(n); }}>{v}</button>
            ))}
          </div>
        </div>
      )}

      {A.ga_consent === "כן" && !veryHigh && (
        <div>
          <p className="text-sm font-semibold text-[#1a2a3a] mb-3">סמן את כל התחומים בהם ייתכן שילדך יתעניין:</p>
          <div className="flex gap-2 flex-wrap mb-5">
            {GA_INT_LIST.map(({key,label})=>(
              <button key={key} className={cb(!!A[key])}
                onClick={()=>setA({...A,[key]:A[key]?undefined:true})}>{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── p-q1 ─────────────────────────────────────────────────────────────────────
function PageQ1({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  function pickScale(v: number) {
    const n = {...A, q1:v};
    setA(n);
    onNext(n);
  }
  return (
    <div>
      <Card>
        <EqNum n={1}/>
        <StepTag>שאלה 1 מתוך 10 - רגשי</StepTag>
        <StepQ>ילדך חש דאגות/לחצים מתמשכים</StepQ>
        <StepHint>1 = כלל לא  |  5 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n=>(
            <button key={n} className={sb(A.q1===n)} onClick={()=>pickScale(n)}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q1-pain ────────────────────────────────────────────────────────────────
function PageQ1Pain({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>שאלה משלימה - חרדה וגוף</StepTag>
        <StepQ>האם הילד/ה סובל/ת מכאבים כרוניים?</StepQ>
        <StepHint>למשל: כאבי בטן או כאבי ראש חוזרים</StepHint>
        <YNRow val={A.q1_pain||""} onChange={v=>setA({...A,q1_pain:v})} />
        {A.q1_pain === "כן" && (
          <div className="mt-4 pt-4 border-t border-dashed border-[#d0dae8]">
            <p className="text-sm font-semibold text-[#1a2a3a] mb-2">האם נשללו בעיות רפואיות כגורם לכאבים?</p>
            <YNRow val={A.q1_med_clear||""} onChange={v=>setA({...A,q1_med_clear:v})} />
          </div>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-aq ─────────────────────────────────────────────────────────────────────
function PageAQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const aqItems = (items?.aq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, aqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>🔍 שאלות משלימות</StepTag>
        <StepQ>10 סעיפים - 1 = כלל לא | 2 = לפעמים | 3 = לעיתים קרובות</StepQ>
        <SubCard>
          {aqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[1,2,3].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updAQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q2 ─────────────────────────────────────────────────────────────────────
function PageQ2({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={2}/>
        <StepTag>שאלה 2 מתוך 10 - רגשי</StepTag>
        <StepQ>הילד/ה חש/ה כי "אינו/ה שווה" או אינו/ה מוערך/ת</StepQ>
        <StepHint>1 = כלל לא  |  5 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n=>(
            <button key={n} className={sb(A.q2===n)} onClick={()=>{ const nA={...A,q2:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q3 ─────────────────────────────────────────────────────────────────────
function PageQ3({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={3}/>
        <StepTag>שאלה 3 מתוך 10 - רגשי</StepTag>
        <StepQ>מצב רוח ירוד או עצוב</StepQ>
        <StepHint>1 = כלל לא  |  5 = בעוצמה גבוהה מאוד</StepHint>
        <div className="flex justify-between text-xs text-gray-400 mb-2"><span>כלל לא</span><span>בעוצמה גבוהה</span></div>
        <div className="flex gap-1.5">
          {[1,2,3,4,5].map(n=>(
            <button key={n} className={sb(A.q3===n)} onClick={()=>{ const nA={...A,q3:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-mq ─────────────────────────────────────────────────────────────────────
function PageMQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const mqItems = (items?.mq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, mqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון מצב רוח</StepTag>
        <StepQ>שאלון מצב רוח - 9 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {mqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updMQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-mq-sui ─────────────────────────────────────────────────────────────────
function PageMQSui({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>מצב רוח - אובדנות</StepTag>
        <StepQ>האם קיימות מחשבות אובדניות חוזרות?</StepQ>
        <StepHint>או ניסיונות אובדניים בעבר</StepHint>
        <YNRow val={A.q3_sui||""} onChange={v=>{ const nA={...A,q3_sui:v}; setA(nA); if (v !== "כן") onNext(nA); }} />
        {A.q3_sui === "כן" && <CrisisResources className="mt-4" />}
      </Card>
      {/* Answered at all, not answered "כן": a parent who chose "לא" and then
          stepped back onto this screen found no way forward either, and of all
          the screens to strand someone on, the suicidality one is the worst. */}
      <NavRow onBack={onBack} onNext={A.q3_sui ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-q4 ─────────────────────────────────────────────────────────────────────
function PageQ4({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={4}/>
        <StepTag>שאלה 4 מתוך 10 - רגשי</StepTag>
        <StepQ>סימנים להתמכרות לחומרים / התנהגויות</StepQ>
        <StepHint>משחקי מחשב, אלכוהול, סמים, הימורים, פורנו</StepHint>
        <YNRow val={A.q4||""} onChange={v=>{ const nA={...A,q4:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q4 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-q4-types ────────────────────────────────────────────────────────────────
function PageQ4Types({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  function toggle(key: string) { setA({...A,[key]:A[key]?undefined:true}); }
  return (
    <div>
      <Card>
        <StepTag>סוג ההתמכרות</StepTag>
        <StepQ>אילו סוגי התמכרות קיימים?</StepQ>
        <StepHint>ניתן לבחור יותר מאחד, לאחר מכן לחץ המשך</StepHint>
        <div className="flex gap-2 flex-wrap">
          <button className={cb(!!A.ad_s)} onClick={()=>toggle("ad_s")}>💊 חומרים (סמים/אלכוהול)</button>
          <button className={cb(!!A.ad_g)} onClick={()=>toggle("ad_g")}>🎮 משחקי מחשב</button>
          <button className={cb(!!A.ad_b)} onClick={()=>toggle("ad_b")}>🎰 הימורים</button>
          <button className={cb(!!A.ad_o)} onClick={()=>toggle("ad_o")}>📱 אחר</button>
        </div>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q4-s ────────────────────────────────────────────────────────────────────
function PageQ4S({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const asItems = (items?.as ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, asItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון חומרים ממכרים</StepTag>
        <StepQ>שאלון חומרים - 6 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {asItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"s"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q4-g ────────────────────────────────────────────────────────────────────
function PageQ4G({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const agItems = (items?.ag ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, agItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון גיימינג</StepTag>
        <StepQ>שאלון משחקי מחשב - 7 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {agItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"g"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q4-b ────────────────────────────────────────────────────────────────────
function PageQ4B({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const abItems = (items?.ab ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, abItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון הימורים</StepTag>
        <StepQ>שאלון הימורים - 7 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {abItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updAddict(A,key,v,"b"))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q4-ctrl ─────────────────────────────────────────────────────────────────
function PageQ4Ctrl({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>התמכרות - שליטה</StepTag>
        <StepQ>עד כמה הילד/ה בשליטה על ההתנהגות?</StepQ>
        <StepHint>1 = כלל לא בשליטה  |  5 = בשליטה מלאה</StepHint>
        <div className="flex gap-2 flex-wrap">
          {[1,2,3,4,5].map(n=>(
            <button key={n} className={sb(A.q4_ctrl===n)}
              onClick={()=>{ const nA={...A,q4_ctrl:n}; setA(nA); onNext(nA); }}>{n}</button>
          ))}
        </div>
      </Card>
      {/* Required: this single answer decides between parent guidance and CBT
          for addictions, and skipping it used to fall through to a default of 5
          - the far end of the scale, indistinguishable from a parent who chose
          it deliberately. */}
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={!A.q4_ctrl} />
      <IncompleteHint missing={A.q4_ctrl ? 0 : 1} />
    </div>
  );
}

// ── p-q5 ─────────────────────────────────────────────────────────────────────
function PageQ5({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={5}/>
        <StepTag>שאלה 5 מתוך 10 - רגשי</StepTag>
        <StepQ>מחשבות חוזרות שקשה לילד/ה להפסיק, או טקסים שחוזרים על עצמם?</StepQ>
        <StepHint>למשל: שטיפת ידיים מרובה, ספירה, צורך לסדר דברים בצורה מסוימת. ברוב הימים, שבועיים רצופים לפחות.</StepHint>
        <YNRow val={A.q5||""} onChange={v=>{ const nA={...A,q5:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q5 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-oq ─────────────────────────────────────────────────────────────────────
function PageOQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const oqItems = (items?.oq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, oqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון</StepTag>
        <StepQ>שאלון - 6 סעיפים</StepQ>
        <StepHint>1 = אף פעם  |  2 = לפעמים  |  3 = תמיד</StepHint>
        <SubCard>
          {oqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[1,2,3].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updOQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q6 ─────────────────────────────────────────────────────────────────────
function PageQ6({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={6}/>
        <StepTag>שאלה 6 מתוך 10 - רגשי</StepTag>
        <StepQ>חווה אירוע טראומטי</StepQ>
        <StepHint>תאונה, פיגוע, שוד, רעידת אדמה וכד׳</StepHint>
        <YNRow val={A.q6||""} onChange={v=>{ const nA={...A,q6:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q6 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-tq ─────────────────────────────────────────────────────────────────────
function PageTQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const tqItems = (items?.tq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, tqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון טראומה</StepTag>
        <StepQ>שאלון טראומה - 10 סעיפים</StepQ>
        <p className="text-sm font-bold text-red-800 mb-1">ענו על השאלות הבאות בהתייחס לחודש האחרון:</p>
        <StepHint>0 = כלל לא  |  4 = כמעט תמיד (חודש אחרון)</StepHint>
        <SubCard>
          {tqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {[0,1,2,3,4].map(n=>(
                  <button key={n} className={so(A[key]===n)} onClick={()=>setA(updTQ(A,key,n))}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q7 ─────────────────────────────────────────────────────────────────────
// שאלה 7 - הזיות (7א) ואמונות יוצאות דופן / חשדות (7ב), על אותו מסך
function PageQ7({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  const canContinue = !!A.q7a && !!A.q7b;
  function setKey(k: "q7a" | "q7b", v: string) {
    const nA = { ...A, [k]: v };
    setA(nA);
  }
  return (
    <div>
      <Card>
        <EqNum n={7}/>
        <StepTag>שאלה 7 מתוך 10 - רגשי</StepTag>
        <StepQ>חוויות פנימיות חריגות</StepQ>
        <StepHint>שתי שאלות קצרות - נא לענות על שתיהן כדי להמשיך.</StepHint>
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-800 mb-2">א. האם הילד/ה ראה/תה או שמע/ה דברים שאחרים אמרו שאינם קיימים?</p>
          <YNRow val={A.q7a||""} onChange={v => setKey("q7a", v)} />
        </div>
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-800 mb-2">ב. האם יש לילד/ה אמונות או חשדות יוצאי דופן שאחרים סביבו/ה לא חולקים?</p>
          <YNRow val={A.q7b||""} onChange={v => setKey("q7b", v)} />
        </div>
        {!canContinue && (
          <p className="text-xs text-amber-700 mt-3">יש לענות על שתי השאלות.</p>
        )}
      </Card>
      {/* Disabled rather than absent - a missing Continue reads as a dead end. */}
      <NavRow onBack={onBack} onNext={() => onNext(A)} nextDisabled={!canContinue} />
    </div>
  );
}

// ── p-pq ─────────────────────────────────────────────────────────────────────
// Shortened prodromal questionnaire - 3 items (from PQ-16), yes/no. Covers the
// CAARMS/PACE domains the two gate questions on p-q7 do not: reality-testing
// confusion, thought broadcasting and loss of control over thoughts. Reached
// only on the beliefs-only path; reporting hallucinations skips straight past.
function PagePQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const pqItems = (items?.pq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, pqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון</StepTag>
        <StepQ>שאלון - 3 סעיפים</StepQ>
        <StepHint>כן / לא לכל סעיף, על סמך מה שהבחנתם</StepHint>
        <SubCard>
          {pqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updPQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q8 ─────────────────────────────────────────────────────────────────────
function PageQ8({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={8}/>
        <StepTag>שאלה 8 מתוך 10 - רגשי</StepTag>
        <StepQ>דפוסי אכילה מדאיגים</StepQ>
        <StepHint>קשיים סביב אוכל, משקל או דימוי גוף</StepHint>
        <YNRow val={A.q8||""} onChange={v=>{ const nA={...A,q8:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q8 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-eq ─────────────────────────────────────────────────────────────────────
function PageEQ({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  const age = parseInt(A._age) || 0;
  const under12 = age === 0 || age < 12;
  const bmi = calcBMI(parseFloat(A._h) || 0, parseFloat(A._w) || 0);
  // Only the item block actually rendered for this age is required; height and
  // weight stay optional, which is why they are not in this list.
  const missing = countMissing(A, under12
    ? ["ea1","ea2","ea3","ea4","ea5","ea6","ea7","ea8"]
    : ["eb1","eb2","eb3","eb4","eb5","eb6","eb7"]);

  // Height and weight moved here from the opening screen. BMI is only ever read
  // by the eating-disorder scoring, so asking every parent for it up front cost
  // two fields on the screen with the worst dropout in the questionnaire and
  // bought nothing for the ones who never reach this branch.
  //
  // This does narrow the BMI screening, deliberately: the out-of-range-BMI
  // warning and its dietitian and GP referrals now only reach parents who
  // flagged an eating concern. Before, any parent who happened to fill in height
  // and weight could get them. Widen it again by asking here and on p-demo both.
  function updMeasure(key: "_h" | "_w", val: string) {
    const next = { ...A, [key]: val };
    const b = calcBMI(
      parseFloat(key === "_h" ? val : A._h) || 0,
      parseFloat(key === "_w" ? val : A._w) || 0,
    );
    // Assign unconditionally: keeping the previous value when the new one is
    // incomplete left a stale BMI behind after clearing the height field, and
    // the scoring went on referring the child to a dietitian over it.
    next._bmi = b ?? undefined;
    setA(next);
  }

  return (
    <div>
      <Card>
        <StepTag>🍽️ שאלות על הרגלי אכילה</StepTag>
        <StepHint>לפי גיל הילד/ה</StepHint>

        <div className="bg-[var(--surface)] rounded-xl p-3 sm:p-4 mb-4 border border-[var(--line)]">
          <div className="text-sm font-semibold text-[#2a3a4a] mb-1">📏 גובה ומשקל</div>
          <p className="text-xs text-gray-400 mb-3">לא חובה, אבל עוזר לדייק את ההמלצה בתחום האכילה.</p>
          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">גובה (ס"מ)</label>
              <input type="number" placeholder='ס"מ' value={A._h || ""}
                onChange={e => updMeasure("_h", e.target.value)}
                className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 w-28 focus:border-[#4a6fa5] outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">משקל (ק"ג)</label>
              <input type="number" placeholder='ק"ג' value={A._w || ""}
                onChange={e => updMeasure("_w", e.target.value)}
                className="border-2 border-[#d0dae8] rounded-xl px-3 py-2 w-28 focus:border-[#4a6fa5] outline-none" />
            </div>
          </div>
          {bmi && (
            <div className="text-xs text-gray-500 mt-2">BMI: <strong>{bmi.toFixed(1)}</strong> - {bmiLabel(bmi)}</div>
          )}
        </div>

        {under12 ? (
          <>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה - הגבלה (עד גיל 12)</div>
              {[
                {key:"ea1", label:"1. ירידה משמעותית במשקל"},
                {key:"ea2", label:"2. סירוב לאכול / הגבלת אכילה"},
                {key:"ea3", label:"3. דפוסי אכילה טקסיים"},
                {key:"ea4", label:"4. עיכוב בצמיחה"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה - אכילה מוגזמת (עד גיל 12)</div>
              {[
                {key:"ea5", label:"1. אפיזודות חוזרות של אכילה מוגזמת"},
                {key:"ea6", label:"2. התנהגויות מפצות (הקאה, משלשלים, צום)"},
                {key:"ea7", label:"3. אכילה מוגזמת לפחות פעם בשבוע במשך 3 חודשים"},
                {key:"ea8", label:"4. הערכה עצמית תלויה במשקל/צורת גוף"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
          </>
        ) : (
          <>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה - הגבלה (12+)</div>
              {[
                {key:"eb1", label:"1. הגבלה חמורה בצריכת מזון → משקל נמוך"},
                {key:"eb2", label:"2. פחד עז מעלייה במשקל"},
                {key:"eb3", label:"3. תפיסת גוף מעוותת / הכחשת חומרת המשקל"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
            <SubCard>
              <div className="text-sm font-semibold text-[#2a3a4a] mb-3">🍽️ קשיי אכילה - אכילה מוגזמת (12+)</div>
              {[
                {key:"eb4", label:"1. אכילה מוגזמת חוזרת בפרק זמן קצר"},
                {key:"eb5", label:"2. התנהגויות מפצות (הקאה, משלשלים)"},
                {key:"eb6", label:"3. אכילה מוגזמת לפחות פעם בשבוע במשך 3 חודשים"},
                {key:"eb7", label:"4. הערכה עצמית תלויה במשקל / צורת גוף"},
              ].map(({key,label})=>(
                <div key={key}>
                  <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
                  <div className="flex gap-2">
                    {["כן","לא"].map(v=>(
                      <button key={v} className={so(A[key]===v)} onClick={()=>setA(updEQ(A,key,v))}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}
            </SubCard>
          </>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q9 ─────────────────────────────────────────────────────────────────────
function PageQ9({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={9}/>
        <StepTag>שאלה 9 מתוך 10 - רגשי</StepTag>
        <StepQ>סימנים לחוסר יציבות ביחסים, קושי בוויסות רגשות ואימפולסיביות</StepQ>
        <YNRow val={A.q9||""} onChange={v=>{ const nA={...A,q9:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q9 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-bq ─────────────────────────────────────────────────────────────────────
function PageBQ({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const bqItems = (items?.bq ?? []) as {key: string; label: string}[];
  const missing = countMissing(A, bqItems.map(it => it.key));
  return (
    <div>
      <Card>
        <StepTag>שאלון ויסות רגשות ויחסים בינאישיים</StepTag>
        <StepQ>שאלון ויסות רגשות ויחסים בינאישיים</StepQ>
        <StepHint>כן / לא לכל סעיף</StepHint>
        <SubCard>
          {bqItems.map(({key,label})=>(
            <div key={key}>
              <div className="text-sm font-medium text-[#2a3a4a] mb-2">{label}</div>
              <div className="flex gap-2">
                {["כן","לא"].map(v=>(
                  <button key={v} className={so(A[key]===v)} onClick={()=>setA(updBQ(A,key,v))}>{v}</button>
                ))}
              </div>
            </div>
          ))}
        </SubCard>
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-q9-adhd - Q9 re-route to the ADHD questionnaire for grades ב׳–ו׳ ────────
function PageQ9Adhd({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  return (
    <div>
      <Card>
        <StepTag>שאלה 9 - קשב וריכוז</StepTag>
        <StepQ>שאלון קשב (ADHD)</StepQ>
        <StepHint>בגיל זה, קושי בוויסות ובאימפולסיביות נבדק דרך שאלון הקשב</StepHint>
        <AcadAdhdBlock prefix="q9" A={A} setA={setA} items={items} />
      </Card>
      <NavRow onBack={onBack} onNext={()=>onNext(A)} />
    </div>
  );
}

// ── p-q10 ────────────────────────────────────────────────────────────────────
function PageQ10({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <EqNum n={10}/>
        <StepTag>שאלה 10 מתוך 10 - רגשי</StepTag>
        <StepQ>קשיים רגשיים אחרים שלא עלו בשאלון</StepQ>
        {/* The old hint told the parent to answer only if nothing earlier came
            back positive - which skipPage now enforces on its own, so the
            screen is only ever shown in exactly that case. */}
        <StepHint>שאלה אחרונה - כדי לוודא שלא פספסנו משהו</StepHint>
        <YNRow val={A.q10||""} onChange={v=>{ const nA={...A,q10:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q10 ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-q10-par ────────────────────────────────────────────────────────────────
function PageQ10Par({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  return (
    <div>
      <Card>
        <StepTag>קשיים כלליים</StepTag>
        <StepQ>האם הקושי קשור לקשר עם אחד ההורים?</StepQ>
        <YNRow val={A.q10_par||""} onChange={v=>{ const nA={...A,q10_par:v}; setA(nA); onNext(nA); }} />
      </Card>
      {/* Continue appears once the gate is answered. These screens advance on the
          pill itself, so on the way forward it is never seen - but arriving here
          via back left NavRow rendering an empty div: the previous answer
          highlighted and no control at all except re-tapping a selected pill. */}
      <NavRow onBack={onBack} onNext={A.q10_par ? () => onNext(A) : undefined} />
    </div>
  );
}

// ── p-dev-toilet ──────────────────────────────────────────────────────────────
function PageDevToilet({ A, setA, onNext, onBack }: PageProps) {
  const ttype   = A.dev_toilet_type || "";
  const showWet = (ttype === "ב" || ttype === "ד");
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים התפתחותיים</StepTag>
        <StepQ>1. האם כיום ישנם קשיים בגמילה / התרוקנות?</StepQ>
        <StepHint>כולל עצירות, בריחת שתן, בריחת צואה</StepHint>
        <YNRow val={A.dev_toilet||""} onChange={v => setA({...A, dev_toilet:v, dev_toilet_type:undefined, dev_wet_type:undefined})} />

        {A.dev_toilet === "כן" && (
          <SubCard>
            <p className="text-sm font-bold text-purple-900 mb-3">האם הייתה גמילה מלאה בעבר של לפחות 3 חודשים?</p>
            <YNRow val={A.dev_toilet_past||""} onChange={v => setA({...A, dev_toilet_past:v})} />
            <div className="mt-4">
              <p className="text-sm font-bold text-purple-900 mb-3">מהו סוג הקושי בגמילה?</p>
              <div className="flex flex-col gap-2">
                {[{v:"א",l:"א. עצירות"},{v:"ב",l:"ב. בריחת שתן"},{v:"ג",l:"ג. בריחת צואה"},{v:"ד",l:"ד. בריחת שתן וצואה"}].map(({v,l}) => (
                  <button key={v} className={ob(ttype === v)} onClick={() => setA({...A, dev_toilet_type:v, dev_wet_type:undefined})}>{l}</button>
                ))}
              </div>
            </div>
            {showWet && (
              <div className="mt-4">
                <p className="text-sm font-bold text-purple-900 mb-3">האם מדובר על הרטבת יום / לילה / גם וגם?</p>
                <div className="flex flex-col gap-2">
                  {[{v:"יום",l:"הרטבת יום בלבד"},{v:"לילה",l:"הרטבת לילה בלבד"},{v:"גם וגם",l:"גם יום וגם לילה"}].map(({v,l}) => (
                    <button key={v} className={ob(A.dev_wet_type === v)} onClick={() => setA({...A, dev_wet_type:v})}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </SubCard>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-dev-sensory ─────────────────────────────────────────────────────────────

function PageDevSensory({ A, setA, onNext, onBack, items }: PageProps) {
  const showQs = A.dev_sensory === "כן";
  const sensOverItems = (items?.sensOver ?? []) as string[];
  const sensUnderItems = (items?.sensUnder ?? []) as string[];
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים התפתחותיים</StepTag>
        <StepQ>2. האם ישנם קשיים של ויסות חושי?</StepQ>
        <StepHint>תגובות חריגות לגירויים יומיומיים - רתיעה קיצונית מרעשים/מגע (רגישות-יתר) או חיפוש מתמיד אחר תנועה ועוצמה (תת-רגישות)</StepHint>
        <YNRow val={A.dev_sensory||""} onChange={v => setA({...A, dev_sensory:v})} />

        {showQs && (
          <>
            <GradeBlock title="א. שאלון רגישות יתר תחושתית">
              <div className="text-xs text-gray-500 mb-3">לכל שאלה: <strong>1 = תמיד</strong> | <strong>2 = לפעמים</strong> | <strong>3 = אף פעם</strong></div>
              {sensOverItems.map((label, i) => {
                const k = `so${i+1}`;
                return (
                  <div key={k} className="mb-4">
                    <p className="text-sm text-gray-700 mb-1">{i+1}. {label}</p>
                    <div className="flex gap-2">
                      {[{v:1,l:"תמיד (1)"},{v:2,l:"לפעמים (2)"},{v:3,l:"אף פעם (3)"}].map(({v,l}) => (
                        <button key={v} className={so(A[k]===v)} onClick={() => setA({...A,[k]:v})}>{l}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </GradeBlock>
            <GradeBlock title="ב. שאלון תת-תגובתיות תחושתית">
              <div className="text-xs text-gray-500 mb-3">לכל שאלה: <strong>1 = תמיד</strong> | <strong>2 = לפעמים</strong> | <strong>3 = אף פעם</strong></div>
              {sensUnderItems.map((label, i) => {
                const k = `su${i+1}`;
                return (
                  <div key={k} className="mb-4">
                    <p className="text-sm text-gray-700 mb-1">{i+1}. {label}</p>
                    <div className="flex gap-2">
                      {[{v:1,l:"תמיד (1)"},{v:2,l:"לפעמים (2)"},{v:3,l:"אף פעם (3)"}].map(({v,l}) => (
                        <button key={v} className={so(A[k]===v)} onClick={() => setA({...A,[k]:v})}>{l}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </GradeBlock>
          </>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-acad ────────────────────────────────────────────────────────────────────
type PageProps = { A: Ans; setA: (a: Ans) => void; onNext: (a?: Ans) => void; onBack?: () => void; items?: Record<string, any[]> | null };


function AcadAdhdBlock({ prefix, A, setA, items }: { prefix: string; A: Ans; setA: (a: Ans) => void; items?: Record<string, any[]> | null }) {
  function toggle(k: string) { setA({ ...A, [k]: !A[k] }); }
  const adhdInatt = items?.adhdInatt ?? [];
  const adhdHyper = items?.adhdHyper ?? [];
  return (
    <SubCard>
      <div className="text-sm font-bold text-amber-800 mb-2">📋 שאלון קשב (ADHD) - סמן את הסימנים הקיימים</div>
      <div className="text-xs font-semibold text-amber-700 mb-1">קשב:</div>
      {adhdInatt.map((label, i) => {
        const k = `${prefix}_ad${i+1}`;
        return <label key={k} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer"><input type="checkbox" checked={!!A[k]} onChange={() => toggle(k)} className="w-4 h-4" />{label}</label>;
      })}
      <div className="text-xs font-semibold text-amber-700 mt-3 mb-1">היפראקטיביות:</div>
      {adhdHyper.map((label, i) => {
        const k = `${prefix}_ah${i+1}`;
        return <label key={k} className="flex items-center gap-2 text-sm text-gray-700 py-1 cursor-pointer"><input type="checkbox" checked={!!A[k]} onChange={() => toggle(k)} className="w-4 h-4" />{label}</label>;
      })}
    </SubCard>
  );
}

function VisionHearingBlock({ A, setA }: { A: Ans; setA: (a: Ans) => void }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-bold text-[var(--teal)] mb-3 pb-1 border-b-2 border-[#e8eef6]">👁️ ראייה ושמיעה</div>
      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-2">האם נעשתה בדיקת ראייה?</p>
        <div className="flex gap-2 mb-2">
          {["כן","לא"].map(v => <button key={v} className={ob(A.vision === v)} onClick={() => setA({...A, vision:v})}>{v}</button>)}
        </div>
        {A.vision === "לא" && (
          <div className="pr-4 border-r-2 border-blue-200 mt-2">
            <p className="text-sm text-gray-500 mb-2">האם יש סימנים לקשיי ראייה?</p>
            <div className="flex gap-2">
              {["כן","לא"].map(v => <button key={v} className={ob(A.vis_sym === v)} onClick={() => setA({...A, vis_sym:v})}>{v}</button>)}
            </div>
          </div>
        )}
      </div>
      <div className="mb-2">
        <p className="text-sm text-gray-500 mb-2">האם נעשתה בדיקת שמיעה?</p>
        <div className="flex gap-2 mb-2">
          {["כן","לא"].map(v => <button key={v} className={ob(A.hearing === v)} onClick={() => setA({...A, hearing:v})}>{v}</button>)}
        </div>
        {A.hearing === "לא" && (
          <div className="pr-4 border-r-2 border-blue-200 mt-2">
            <p className="text-sm text-gray-500 mb-2">האם יש סימנים לקשיי שמיעה?</p>
            <div className="flex gap-2">
              {["כן","לא"].map(v => <button key={v} className={ob(A.hear_sym === v)} onClick={() => setA({...A, hear_sym:v})}>{v}</button>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageAcad({ A, setA, onNext, onBack, items }: PageProps) {
  const grp = acadGg(A);

  // ── גן ──────────────────────────────────────────────────────────────────────
  if (grp === "gan") {
    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי בגן</StepQ>
          <VisionHearingBlock A={A} setA={setA} />
          <GradeBlock title="🏫 גילאי גן">
            {[
              {k:"gan_q1", q:"1. האם הגננת דיווחה/מזהה קשיים בזיהוי אותיות ומספרים ביחס לבני גילו?", subKey:"gan_q1_speech", subQ:"האם עבר אבחון קלינאית תקשורת?"},
              {k:"gan_q2", q:"2. האם ניכרים קשיים בזכירת צורות וצבעים ביחס לבני גילו?", subKey:"gan_q2_speech", subQ:"האם עבר אבחון קלינאית תקשורת?"},
            ].map(({k,q,subKey,subQ}) => (
              <div key={k} className="mb-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">{q}</p>
                <YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} />
                {A[k]==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">{subQ}</p><YNRow val={A[subKey]||""} onChange={v => setA({...A,[subKey]:v})} /></SubCard>}
              </div>
            ))}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם ניכרים קשיים בחריזה או זיהוי צליל פותח ביחס לבני גילו?</p>
              <YNRow val={A.gan_q3||""} onChange={v => setA({...A, gan_q3:v})} />
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם ניכרים קשיים בביטוי עצמי, שליפת מילים ואוצר מילים ביחס לבני גילו?</p>
              <YNRow val={A.gan_q4||""} onChange={v => setA({...A, gan_q4:v})} />
            </div>
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">5. האם הגננת דיווחה על קשיים באחזקת עיפרון או איכות ציור?</p>
              <YNRow val={A.gan_q5||""} onChange={v => setA({...A, gan_q5:v})} />
              {A.gan_q5==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון ריפוי בעיסוק?</p><YNRow val={A.gan_q5_ot||""} onChange={v => setA({...A, gan_q5_ot:v})} /></SubCard>}
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── א-ג ──────────────────────────────────────────────────────────────────────
  if (grp === "ag") {
    const read = A.ag_read || "";
    const histYes = ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].filter(k => A[k]==="כן").length;
    const showReadFlow = read !== "" && read !== "לא";
    const showHist0 = showReadFlow && histYes === 0 && ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].every(k => A[k] !== undefined);
    // 1-3, matching the scoring band. At exactly 3 the screen used to stop
    // asking while the scorer still expected an answer, so neither the "כן" nor
    // the "לא" arm could fire and the reading difficulty was reported with no
    // referral under it at all - 4+ (which does refer) was never reached either.
    const showHist12 = showReadFlow && histYes >= 1 && histYes <= 3 && ["ag_h1","ag_h2","ag_h3","ag_h4","ag_h5","ag_h6"].every(k => A[k] !== undefined);
    const showMotivRg = showHist0 && A.ag_read_motiv === "לא";
    const agMotTot = (A.ag_mot1||1)+(A.ag_mot2||1)+(A.ag_mot3||1);
    const showAgAdhd = showMotivRg && agMotTot <= 5 && !q9AdhdActive(A);
    const speechMotiv = A.ag_speech_motiv || "";
    const speechMotivNo = showHist12 && A.ag_read_speech === "כן" && speechMotiv === "לא";
    const smotTot = (A.ag_smot1||1)+(A.ag_smot2||1)+(A.ag_smot3||1);
    const showSpeechAdhd = speechMotivNo && smotTot <= 5 && !q9AdhdActive(A);

    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
          <VisionHearingBlock A={A} setA={setA} />
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
            💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
          </div>
          <GradeBlock title="📖 כיתות א׳–ג׳">
            {/* שאלה 1: קריאה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">1. האם יש קושי בקריאה?</p>
              <div className="flex gap-2 flex-wrap">
                {["לא","5% הכי מתקשה בכיתה","10% הכי מתקשה בכיתה","30% הכי מתקשה בכיתה"].map(opt => (
                  <button key={opt} className={ob(A.ag_read===opt)} onClick={() => setA({...A, ag_read:opt})}>{opt}</button>
                ))}
              </div>
              {showReadFlow && (
                <SubCard>
                  <div className="text-sm font-bold text-blue-900 mb-2">📋 שאלון רקע התפתחותי</div>
                  <div className="text-xs text-gray-500 mb-2">ענה כן/לא על כל סעיף.</div>
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded p-2 mb-3">💡 אם אינך זוכר/ת פרטים מדויקים מהגן או הכיתה הצעירה, ניתן לענות על פי התרשמותך הכוללת מהילד באותה תקופה.</div>
                  {[
                    {k:"ag_h1",q:"א. האם היה קושי בהתפתחות השפתית בגילאי שנה–שנתיים?"},
                    {k:"ag_h2",q:"ב. האם דווח על קשיים בזיהוי אותיות ומספרים בגן או בכיתה א'?"},
                    {k:"ag_h3",q:"ג. האם דווח על קשיים בזכירת צורות וצבעים בגן?"},
                    {k:"ag_h4",q:"ד. האם דווח על קשיים בחריזה או זיהוי צליל פותח בגן?"},
                    {k:"ag_h5",q:"ה. האם דווח על קשיים בביטוי עצמי ואוצר מילים בגן?"},
                    {k:"ag_h6",q:"ו. האם ישנו קושי או לקות בדיבור?"},
                  ].map(({k,q}) => (
                    <div key={k} className="mb-3">
                      <p className="text-sm text-gray-700 mb-1">{q}</p>
                      <YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} />
                    </div>
                  ))}
                  {/* hist=0 → מוטיבציה */}
                  {showHist0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                      <YNRow val={A.ag_read_motiv||""} onChange={v => setA({...A, ag_read_motiv:v})} />
                      {showMotivRg && (
                        <div className="mt-3 space-y-3">
                          <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                          <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                          {[{k:"ag_mot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"ag_mot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"ag_mot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                            <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                          ))}
                          {showAgAdhd && <AcadAdhdBlock prefix="ag" A={A} setA={setA} items={items} />}
                        </div>
                      )}
                    </div>
                  )}
                  {/* hist=1-2 → קלינאית */}
                  {showHist12 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-indigo-900 mb-2">האם עבר אבחון/טיפול קלינאית תקשורת?</p>
                      <YNRow val={A.ag_read_speech||""} onChange={v => setA({...A, ag_read_speech:v})} />
                      {A.ag_read_speech==="כן" && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                          <YNRow val={speechMotiv} onChange={v => setA({...A, ag_speech_motiv:v})} />
                          {speechMotiv==="לא" && (
                            <div className="mt-3 space-y-3">
                              <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                              <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                              {[{k:"ag_smot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"ag_smot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"ag_smot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                                <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                              ))}
                              {showSpeechAdhd && <AcadAdhdBlock prefix="ag" A={A} setA={setA} items={items} />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SubCard>
              )}
            </div>
            {/* שאלה 2: קשב (עצמאית) - מדולג לכיתות ב׳–ו׳ עם q9=כן (נאסף כבר ב-Q9) */}
            {!q9AdhdActive(A) && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">2. האם את/ה רואה סימנים לקשיי קשב, ריכוז, היפראקטיביות או חולמנות?</p>
              <YNRow val={A.ag_adhd_yn||""} onChange={v => setA({...A, ag_adhd_yn:v})} />
              {A.ag_adhd_yn==="כן" && <AcadAdhdBlock prefix="ag" A={A} setA={setA} items={items} />}
            </div>
            )}
            {/* שאלה 3: כתב יד */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם יש קושי בכתב היד עצמו?</p>
              <p className="text-xs text-gray-500 mb-2">למשל: אחיזת עיפרון, צורת אותיות, איטיות חריגה, לחץ רב על הדף. <strong>לא הכוונה לשגיאות כתיב.</strong></p>
              <YNRow val={A.ag_write||""} onChange={v => setA({...A, ag_write:v})} />
              {A.ag_write==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון/טיפול בריפוי בעיסוק?</p><YNRow val={A.ag_write_ot||""} onChange={v => setA({...A, ag_write_ot:v})} /></SubCard>}
            </div>
            {/* שאלה 4: הבנה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש קושי בהבנה בע"פ בשיעור?</p>
              <YNRow val={A.ag_comp||""} onChange={v => setA({...A, ag_comp:v})} />
            </div>
            {/* שאלה 5: חשבון */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">5. האם יש קושי בחשבון?</p>
              <p className="text-xs text-gray-500 mb-2">דירוג ביחס לבני הכיתה: <strong>5%</strong> = בין הילדים הכי מתקשים בכיתה (1–2 ילדים בכיתה ממוצעת). <strong>10%</strong> = בין 10% הכי מתקשים (כ-3 ילדים בכיתה). <strong>30%</strong> = בקבוצה החלשה יותר אך לא הכי. אם לא בטוח/ה - אפשר להיוועץ עם המחנכ/ת.</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  ["לא","ללא קושי"],
                  ["5% הכי מתקשה בכיתה","קושי חמור (5% הכי מתקשים)"],
                  ["10% הכי מתקשה בכיתה","קושי משמעותי (10% הכי מתקשים)"],
                  ["30% הכי מתקשה בכיתה","קושי קל-בינוני (30% הכי מתקשים)"],
                ].map(([val, label]) => (
                  <button key={val} className={ob(A.ag_math===val)} onClick={() => setA({...A, ag_math:val})}>{label}</button>
                ))}
              </div>
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── ד-ו ──────────────────────────────────────────────────────────────────────
  if (grp === "dv") {
    const histYes = ["dv_h1","dv_h2","dv_h3","dv_h4","dv_h5"].filter(k => A[k]==="כן").length;
    const showReadFlow = A.dv_read === "כן";
    const histAllAnswered = showReadFlow && ["dv_h1","dv_h2","dv_h3","dv_h4","dv_h5"].every(k => A[k] !== undefined);
    const showHist0 = histAllAnswered && histYes === 0;
    // 1-3, matching the scoring band - see the same fix in the א-ג block above.
    const showHist12 = histAllAnswered && histYes >= 1 && histYes <= 3;
    const showMotivRg = showHist0 && A.dv_read_motiv === "לא";
    const dvMotTot = (A.dv_mot1||1)+(A.dv_mot2||1)+(A.dv_mot3||1);
    const showDvReadAdhd = showMotivRg && dvMotTot <= 5 && !q9AdhdActive(A);
    const smotivNo = showHist12 && A.dv_read_speech === "כן" && A.dv_speech_motiv === "לא";
    const dvSmotTot = (A.dv_smot1||1)+(A.dv_smot2||1)+(A.dv_smot3||1);
    const showDvSpeechAdhd = smotivNo && dvSmotTot <= 5 && !q9AdhdActive(A);

    return (
      <div>
        <Card>
          <StepTag>📚 קשיים לימודיים</StepTag>
          <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
          <VisionHearingBlock A={A} setA={setA} />
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
            💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
          </div>
          <GradeBlock title="📗 כיתות ד׳–ו׳">
            {/* שאלה 1: קריאה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">1. האם יש קושי בקריאה?</p>
              <YNRow val={A.dv_read||""} onChange={v => setA({...A, dv_read:v})} />
              {showReadFlow && (
                <SubCard>
                  <div className="text-sm font-bold text-blue-900 mb-2">📋 שאלון רקע התפתחותי</div>
                  <div className="text-xs text-gray-500 mb-2">ענה כן/לא על כל סעיף.</div>
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-300 rounded p-2 mb-3">💡 אם אינך זוכר/ת פרטים מדויקים מהגן או הכיתות הראשונות, ניתן לענות על פי התרשמותך הכוללת מהילד באותה תקופה.</div>
                  {[{k:"dv_h1",q:"א. האם היה קושי בהתפתחות השפתית בגילאי שנה–שנתיים?"},{k:"dv_h2",q:"ב. האם דווח על קשיים בזיהוי אותיות ומספרים בגן או בכיתה א'?"},{k:"dv_h3",q:"ג. האם דווח על קשיים בזכירת צורות וצבעים בגן?"},{k:"dv_h4",q:"ד. האם דווח על קשיים בחריזה או זיהוי צליל פותח בגן?"},{k:"dv_h5",q:"ה. האם דווח על קשיים בביטוי עצמי ואוצר מילים בגן?"}].map(({k,q}) => (
                    <div key={k} className="mb-3"><p className="text-sm text-gray-700 mb-1">{q}</p><YNRow val={A[k]||""} onChange={v => setA({...A,[k]:v})} /></div>
                  ))}
                  {showHist0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                      <YNRow val={A.dv_read_motiv||""} onChange={v => setA({...A, dv_read_motiv:v})} />
                      {showMotivRg && (
                        <div className="mt-3 space-y-3">
                          <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                          <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                          {[{k:"dv_mot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"dv_mot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"dv_mot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                            <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                          ))}
                          {showDvReadAdhd && <AcadAdhdBlock prefix="dv_read" A={A} setA={setA} items={items} />}
                        </div>
                      )}
                    </div>
                  )}
                  {showHist12 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-indigo-900 mb-2">האם עבר אבחון/טיפול קלינאית תקשורת?</p>
                      <YNRow val={A.dv_read_speech||""} onChange={v => setA({...A, dv_read_speech:v})} />
                      {A.dv_read_speech==="כן" && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-emerald-900 mb-2">האם יש מוטיבציה ללמידה ומוכנות לתרגול קריאה?</p>
                          <YNRow val={A.dv_speech_motiv||""} onChange={v => setA({...A, dv_speech_motiv:v})} />
                          {A.dv_speech_motiv==="לא" && (
                            <div className="mt-3 space-y-3">
                              <div className="text-sm font-bold text-rose-800">📋 שאלון מוטיבציה וקשיים רגשיים בלמידה</div>
                              <div className="text-xs text-gray-500">דרג: 1=ללא קושי | 2=קושי בינוני | 3=קושי משמעותי</div>
                              {[{k:"dv_smot1",q:"א. הילד/ה מתקשה להאמין ביכולתו להצליח בלמידה"},{k:"dv_smot2",q:"ב. חרדה ופחד מכישלון במהלך למידה או מבחנים"},{k:"dv_smot3",q:"ג. חוסר מוטיבציה ואי-נכונות להתמודד עם אתגרי למידה"}].map(({k,q}) => (
                                <div key={k}><div className="text-sm text-gray-700 mb-1">{q}</div><div className="flex gap-2">{[1,2,3].map(n => <button key={n} className={so(A[k]===n)} onClick={() => setA({...A,[k]:n})}>{n}</button>)}</div></div>
                              ))}
                              {showDvSpeechAdhd && <AcadAdhdBlock prefix="dv_read" A={A} setA={setA} items={items} />}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SubCard>
              )}
            </div>
            {/* שאלה 2: קשב עצמאי - מדולג לכיתות ב׳–ו׳ עם q9=כן (נאסף כבר ב-Q9) */}
            {!q9AdhdActive(A) && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">2. האם יש סימנים לקשיי קשב, ריכוז, היפראקטיביות או חולמנות?</p>
              <YNRow val={A.dv_adhd_yn||""} onChange={v => setA({...A, dv_adhd_yn:v})} />
              {A.dv_adhd_yn==="כן" && <AcadAdhdBlock prefix="dv" A={A} setA={setA} items={items} />}
            </div>
            )}
            {/* שאלה 3: כתב יד */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">3. האם יש קושי בכתב היד עצמו?</p>
              <p className="text-xs text-gray-500 mb-2">למשל: אחיזת עיפרון, צורת אותיות, איטיות חריגה, לחץ רב על הדף. <strong>לא הכוונה לשגיאות כתיב.</strong></p>
              <YNRow val={A.dv_write||""} onChange={v => setA({...A, dv_write:v})} />
              {A.dv_write==="כן" && <SubCard><p className="text-sm font-semibold text-blue-900 mb-2">האם עבר אבחון/טיפול בריפוי בעיסוק?</p><YNRow val={A.dv_write_ot||""} onChange={v => setA({...A, dv_write_ot:v})} /></SubCard>}
            </div>
            {/* שאלה 4: הבנה */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש קושי בהבנה בשיעור?</p>
              <YNRow val={A.dv_comp||""} onChange={v => setA({...A, dv_comp:v})} />
            </div>
            {/* שאלה 5: חשבון */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">5. האם יש קושי בחשבון?</p>
              <p className="text-xs text-gray-500 mb-2">דירוג ביחס לבני הכיתה: <strong>5%</strong> = בין הילדים הכי מתקשים בכיתה (1–2 ילדים בכיתה ממוצעת). <strong>10%</strong> = בין 10% הכי מתקשים (כ-3 ילדים בכיתה). <strong>30%</strong> = בקבוצה החלשה יותר אך לא הכי. אם לא בטוח/ה - אפשר להיוועץ עם המחנכ/ת.</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  ["לא","ללא קושי"],
                  ["5% הכי נמוכים בכיתה","קושי חמור (5% הכי מתקשים)"],
                  ["10% הכי נמוכים בכיתה","קושי משמעותי (10% הכי מתקשים)"],
                  ["30% הכי נמוכים בכיתה","קושי קל-בינוני (30% הכי מתקשים)"],
                ].map(([val, label]) => (
                  <button key={val} className={ob(A.dv_math===val)} onClick={() => setA({...A, dv_math:val})}>{label}</button>
                ))}
              </div>
            </div>
          </GradeBlock>
        </Card>
        <NavRow onBack={onBack} onNext={() => onNext(A)} />
      </div>
    );
  }

  // ── ז-ח / ט-יב ───────────────────────────────────────────────────────────────
  const p = grp;
  const gradeLabel = grp === "zh" ? "🎓 כיתות ז׳–ח׳" : "🏫 כיתות ט׳–י\"ב";
  const verbalOpts: [string, string][] = [
    ["לא","ללא קושי"],
    ["5%","קושי חמור (5% הכי מתקשים)"],
    ["20%","קושי משמעותי (20% הכי מתקשים)"],
    ["מעל 20%","קושי קל-בינוני (מעל 20%)"],
  ];
  const mathEngOpts: [string, string][] = [
    ["לא","ללא קושי"],
    ["10%","קושי משמעותי (10% הכי מתקשים)"],
    ["20%","קושי בינוני (20% הכי מתקשים)"],
    ["מעל 20%","קושי קל (מעל 20%)"],
  ];
  return (
    <div>
      <Card>
        <StepTag>📚 קשיים לימודיים</StepTag>
        <StepQ>שאלות לגבי התפקוד הלימודי</StepQ>
        <VisionHearingBlock A={A} setA={setA} />
        <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-4 text-sm font-bold text-amber-900">
          💡 כדאי להתייעץ עם המחנכ/ת של הכיתה לפני המענה, או לענות יחד בטלפון.
        </div>
        <GradeBlock title={gradeLabel}>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-900 leading-6">
            <strong>איך לדרג כל מקצוע:</strong> דירוג ביחס לבני הכיתה.
            <br />• <strong>5%</strong> = בין הילדים הכי מתקשים בכיתה (1–2 ילדים בכיתה ממוצעת).
            <br />• <strong>10%</strong> = בין 10% הכי מתקשים (כ-3 ילדים בכיתה).
            <br />• <strong>20%</strong> = בקבוצה החלשה - לא הכי, אך מתקשה משמעותית.
            <br />• <strong>מעל 20%</strong> = קושי קל-בינוני.
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">1. רבי מלל (קריאה והבנת הנקרא) - רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{verbalOpts.map(([val, label]) => <button key={val} className={ob(A[p+"_verbal"]===val)} onClick={() => setA({...A, [p+"_verbal"]:val})}>{label}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">2. מתמטיקה - רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{mathEngOpts.map(([val, label]) => <button key={val} className={ob(A[p+"_math"]===val)} onClick={() => setA({...A, [p+"_math"]:val})}>{label}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">3. אנגלית - רמת ביצוע ביחס לכיתה</p>
            <div className="flex gap-2 flex-wrap">{mathEngOpts.map(([val, label]) => <button key={val} className={ob(A[p+"_eng"]===val)} onClick={() => setA({...A, [p+"_eng"]:val})}>{label}</button>)}</div>
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">4. האם יש סימנים לקשיי קשב, ריכוז, היפראקטיביות או חולמנות?</p>
            <YNRow val={A[p+"_adhd_yn"]||""} onChange={v => setA({...A, [p+"_adhd_yn"]:v})} />
            {A[p+"_adhd_yn"]==="כן" && <AcadAdhdBlock prefix={p} A={A} setA={setA} items={items} />}
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">5. האם יש קושי בכתב היד עצמו?</p>
            <p className="text-xs text-gray-500 mb-2">למשל: אחיזת עיפרון, צורת אותיות, איטיות חריגה. <strong>לא הכוונה לשגיאות כתיב.</strong></p>
            <YNRow val={A[p+"_write"]||""} onChange={v => setA({...A, [p+"_write"]:v})} />
          </div>
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">6. האם יש קושי בהבנה בשיעור?</p>
            <YNRow val={A[p+"_comp"]||""} onChange={v => setA({...A, [p+"_comp"]:v})} />
          </div>
        </GradeBlock>
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} />
    </div>
  );
}

// ── p-beh ─────────────────────────────────────────────────────────────────────
function PageBeh({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  function behSet(key: string, val: string) { setA(computeBehPlan({ ...A, [key]: val })); }
  const opts = ["לא","מעט","הרבה"];
  // Leaving all three blank gives beh_max_level 0, and the scorer then returns
  // an empty array - no output and no note - for a parent who flagged
  // behavioural difficulties on the areas screen.
  const missing = countMissing(A, ["beh1","beh2","beh3"]);
  return (
    <div>
      <Card>
        <StepTag>🟠 קשיים התנהגותיים</StepTag>
        <StepQ>שאלות על קשיים התנהגותיים</StepQ>
        <StepHint>ענה על 3 השאלות - הפלט יינתן לפי רמת הקושי הגבוהה ביותר שסומנה</StepHint>
        {[
          { key:"beh1", label:"1. חוסר רצון להשתתף בלמידה ו/או הפרעות ודיבורים בשיעור" },
          { key:"beh2", label:"2. חוצפה כלפי צוות ההוראה" },
          { key:"beh3", label:"3. אלימות פיסית / מילולית מול חברים ו/או צוות ההוראה" },
        ].map(({ key, label }) => (
          <div key={key} className="mb-5 bg-[#e8f7ee] border-2 border-[#52b788] rounded-xl p-4">
            <p className="text-sm font-bold text-[#1b4332] mb-3">{label}</p>
            <div className="flex gap-2">
              {opts.map(o => (
                <button key={o} className={ob(A[key]===o)} onClick={() => behSet(key, o)}>{o}</button>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-soc ─────────────────────────────────────────────────────────────────────
// Shortened social anxiety screen - 8 items, single scale 0–3
// Items selected to cover key DSM-5 domains for childhood social anxiety

function PageSoc({ A, setA, onNext, onBack, items }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void; items?: Record<string, any[]> | null }) {
  const soc3Early = A.soc3_early || "";
  const allComm = A.comm1 === "כן" && A.comm2 === "כן" && A.comm3 === "כן";
  const grp = gg(A);
  const lsasItems = (items?.lsas ?? []) as string[];
  // Progressive screen, so the required set follows whatever is actually on
  // display: the three base questions always, and each follow-up only once the
  // answer that reveals it has been given. lsas_tot is what the social-anxiety
  // severity is read from, so a half-filled LSAS block understates it.
  const required = ["soc1", "soc2", "soc3"];
  if (A.soc1 === "כן") required.push(...lsasItems.map((_, i) => `lsas_a${i + 1}`));
  if (A.soc2 === "כן") required.push("soc2_sev");
  if (A.soc3 === "כן") required.push("soc3_early");
  if (soc3Early === "כן") required.push("comm1", "comm2", "comm3");
  if (soc3Early === "כן" && allComm) required.push("comm_rep", "comm_rigid", "comm_interest", "comm_sens");
  const missing = countMissing(A, required);
  return (
    <div>
      <Card>
        <StepTag>🟣 קשיים חברתיים</StepTag>
        <StepQ>שאלות על קשיים חברתיים</StepQ>
        <StepHint>ענה על 3 השאלות - שאלות נוספות יפתחו לפי הצורך</StepHint>

        {/* soc1 - ביישנות / חרדה חברתית */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">1. האם מגלה סימנים של ביישנות, הימנעות וחשש מאינטראקציות חברתיות?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc1===o)} onClick={() => setA({...A, soc1:o})}>{o}</button>
            ))}
          </div>
          {A.soc1 === "כן" && (
            <div className="mt-4 bg-[#ede0f7] rounded-xl p-4 border border-[#9b59b6]">
              <p className="text-xs text-[#6a3a8a] mb-1 font-semibold">דרג/י את עוצמת החרדה/מצוקה בכל מצב:</p>
              <p className="text-xs text-[#6a3a8a] mb-4">0 = כלל לא · 1 = מעט · 2 = הרבה · 3 = מאוד</p>
              <div className="space-y-4">
                {lsasItems.map((item, i) => {
                  const n = i + 1;
                  return (
                    <div key={n} className="pb-3 border-b border-[#ddd6f3] last:border-0">
                      <p className="text-xs font-semibold text-[#2a1a4a] mb-2">{n}. {item}</p>
                      <div className="flex gap-2">
                        {[0,1,2,3].map(v => (
                          <button key={v} className={so(A[`lsas_a${n}`]===v)} onClick={() => setA(updLSAS(A,`lsas_a${n}`,v))}>{v}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(A.lsas_tot || 0) > 0 && (
                <p className="text-xs text-[#6a3a8a] font-bold mt-3">ציון כולל: {A.lsas_tot || 0} / 24</p>
              )}
            </div>
          )}
        </div>

        {/* soc2 - חיכוכים / מריבות */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">2. האם מגלה סימנים של חיכוכים ומריבות עם בני/בנות גילו?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc2===o)} onClick={() => setA({...A, soc2:o})}>{o}</button>
            ))}
          </div>
          {A.soc2 === "כן" && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-[#4a1a6a] mb-2">מה חומרת הקשיים? [1–6]</p>
              <div className="flex gap-1.5 flex-wrap">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} className={sb(A.soc2_sev===n)} onClick={() => setA({...A, soc2_sev:n})}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* soc3 - קשיי תקשורת */}
        <div className="mb-5 bg-[#f3e8ff] border-2 border-[#9b59b6] rounded-xl p-4">
          <p className="text-sm font-bold text-[#4a1a6a] mb-3">3. האם ישנם סימנים לקשיים בתקשורת בינו/ה לבין חבריו/הוריו?</p>
          <div className="flex gap-3">
            {["לא","כן"].map(o => (
              <button key={o} className={ob(A.soc3===o)}
                onClick={() => setA(o==="לא"
                  ? {...A, soc3:"לא", soc3_early:"", comm1:"", comm2:"", comm3:"", comm_rep:"", comm_rigid:"", comm_interest:"", comm_sens:""}
                  : {...A, soc3:"כן"})}>{o}</button>
            ))}
          </div>
          {A.soc3 === "כן" && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-[#4a1a6a] mb-2">האם חלק מהסימנים החלו בגיל צעיר (3–4 ואילך)?</p>
                <div className="flex gap-3">
                  {["כן","לא"].map(o => (
                    <button key={o} className={ob(A.soc3_early===o)}
                      onClick={() => setA(o==="לא"
                        ? {...A, soc3_early:"לא", comm1:"", comm2:"", comm3:"", comm_rep:"", comm_rigid:"", comm_interest:"", comm_sens:""}
                        : {...A, soc3_early:"כן"})}>{o}</button>
                  ))}
                </div>
              </div>
              {soc3Early === "כן" && (
                <div className="bg-[#ede0f7] rounded-xl p-4 border border-[#9b59b6] space-y-3">
                  {[
                    { key:"comm1", label:"א. האם יש קושי בתגובה רגשית מותאמת לסיטואציה?", hint:"(למשל, תגובות מוגזמות או מוזרות ולא מתאימות למצב)" },
                    { key:"comm2", label:"ב. האם יש קושי בשימוש בתקשורת שאינה מילולית?", hint:"(קשר עין מוגבל, שפת גוף, מחוות, קריאת הבעות פנים של אחרים)" },
                    { key:"comm3", label:"ג. האם יש קושי ביצירה ותחזוקה של קשרים חברתיים?" },
                  ].map(({ key, label, hint }) => (
                    <div key={key}>
                      <p className="text-xs font-semibold text-[#2a1a4a] mb-1">{label}</p>
                      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
                      <div className="flex gap-2">
                        {["כן","לא"].map(o => (
                          <button key={o} className={so(A[key]===o)} onClick={() => setA({...A, [key]:o})}>{o}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {allComm && (
                    <div className="border-t border-[#c084fc] pt-3">
                      <p className="text-xs font-bold text-[#4a1a6a] mb-3">במידה וכל 3 הסימנים קיימים - בדוק גם:</p>
                      {[
                        { key:"comm_rep",      label:"1. האם ישנה התנהגות חזרתית? (תנועות חוזרות, דיבור חזרתי)" },
                        { key:"comm_rigid",    label:"2. האם יש הצמדות לשגרה נוקשה וקושי להתמודד עם שינויים?" },
                        { key:"comm_interest", label:"3. האם יש תחומי עניין מוגזמים או מצומצמים מעבר לרגיל?" },
                        { key:"comm_sens",     label:"4. האם יש תגובתיות חריגה לגירויים חושיים? (רעש, מגע, אור וכד׳)" },
                      ].map(({ key, label }) => (
                        <div key={key} className="mb-2">
                          <p className="text-xs font-semibold text-[#2a1a4a] mb-1">{label}</p>
                          <div className="flex gap-2">
                            {["כן","לא"].map(o => (
                              <button key={o} className={so(A[key]===o)} onClick={() => setA({...A, [key]:o})}>{o}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} nextDisabled={missing > 0} />
      <IncompleteHint missing={missing} />
    </div>
  );
}

// ── p-traits ──────────────────────────────────────────────────────────────────
// The single "child characteristics" step. Replaces p-aq-grade, p-q1-ga,
// p-q2-grade, p-q10-grade and p-ga-traits, which between them asked motivation
// four times, verbality three and interests twice. See traitNeeds for which
// sub-questions apply to a given child.
function PageTraits({ A, setA, onNext, onBack }: { A:Ans; setA:(a:Ans)=>void; onNext:(a:Ans)=>void; onBack?:()=>void }) {
  const needs = traitNeeds(A);
  const set = (k: string, v: any) => setA({ ...A, [k]: v });

  // Whatever is on screen has to be answered before continuing. Skipping leaves
  // the field at 0, and 0 is not treated as "unknown" downstream - the anxiety
  // branch reads it as "motivation of 3 or more" and goes on to read verbality,
  // also 0, and lands on a specific recommendation nobody asked for. Interests
  // stay optional; they only add a preference line when ticked.
  const ready =
    (!needs.motiv  || (A.t_motiv  || 0) > 0) &&
    (!needs.verbal || (A.t_verbal || 0) > 0) &&
    (!needs.prac   || (A.t_prac   || 0) > 0) &&
    // "לא" opens a follow-up about attending with a parent, and leaving that one
    // blank is not neutral: buildGaRef reads a missing answer the same as "כן"
    // and hands back a dyadic-therapy referral nobody asked for.
    (!needs.gaConsent || (A.ga_consent !== undefined && (A.ga_consent !== "לא" || A.ga_consent_parent !== undefined)));

  const INTERESTS = [
    { key:"int_art",    label:"אומנות" },
    { key:"int_music",  label:"מוזיקה" },
    { key:"int_move",   label:"תנועה" },
    { key:"int_drama",  label:"פסיכודרמה" },
    { key:"int_biblio", label:"ביבליותרפיה" },
    { key:"int_animal", label:'טיפול בבע"ח' },
  ];

  return (
    <div>
      <Card>
        <StepTag>מאפייני הילד/ה</StepTag>
        <StepQ>כמה שאלות אחרונות</StepQ>
        <StepHint>אלה לא שאלות על הקושי אלא על מה שיעזור להתאים את סוג הטיפול.</StepHint>

        {needs.gaConsent && (
          <div className="mb-4">
            <GaConsentBlock A={A} setA={setA} />
          </div>
        )}

        {needs.motiv && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">מה רמת המוטיבציה של הילד/ה לטיפול?</p>
            <p className="text-xs text-gray-400 mb-2">1 = כלל לא &nbsp;·&nbsp; 7 = מוטיבציה גבוהה מאוד</p>
            <ScaleRow max={7} val={A.t_motiv || 0} onChange={(v) => set("t_motiv", v)} />
          </div>
        )}

        {needs.verbal && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">עד כמה ילדך ורבאלי/ת ויודע/ת לשתף אחרים בשיחה, ביחס לבני גילו/ה?</p>
            <p className="text-xs text-gray-400 mb-2">1 = מעט מאוד &nbsp;·&nbsp; 5 = הרבה מאוד</p>
            <ScaleRow max={5} val={A.t_verbal || 0} onChange={(v) => set("t_verbal", v)} />
          </div>
        )}

        {needs.prac && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-gray-700 mb-2">עד כמה יש לילד/ה יכולת ומוטיבציה לתרגל כלים בזמן הפנוי?</p>
            <p className="text-xs text-gray-400 mb-2">1 = כלל לא &nbsp;·&nbsp; 7 = הרבה מאוד</p>
            <ScaleRow max={7} val={A.t_prac || 0} onChange={(v) => set("t_prac", v)} />
          </div>
        )}

        {needs.interests && (
          <div className="mb-2">
            <p className="text-sm font-semibold text-gray-700 mb-2">תחומי עניין לטיפול (ניתן לבחור כמה):</p>
            <div className="flex gap-2 flex-wrap">
              {INTERESTS.map(({key,label}) => (
                <button key={key} className={cb(!!A[key])} onClick={() => set(key, !A[key])}>{label}</button>
              ))}
            </div>
          </div>
        )}
        {!ready && (
          <p className="text-xs text-amber-700 mt-4">יש לענות על השאלות שלמעלה כדי להמשיך.</p>
        )}
      </Card>
      <NavRow onBack={onBack} onNext={() => onNext(A)} nextDisabled={!ready} />
    </div>
  );
}

// ── p-result ──────────────────────────────────────────────────────────────────
const GRADE_LABELS: Record<string, string> = {
  "פעוט":"פעוט","גן3":"גן גיל 3","גן-טרום":"גן טרום חובה","גן":"גן חובה",
  "א":"כיתה א","ב":"כיתה ב","ג":"כיתה ג","ד":"כיתה ד","ה":"כיתה ה","ו":"כיתה ו",
  "ז":"כיתה ז","ח":"כיתה ח","ט":"כיתה ט","י":"כיתה י","יא":"כיתה יא","יב":"כיתה יב",
};
const AREA_LABELS: Record<string, string> = {
  a_emo:"רגשי", a_dev:"התפתחותי", a_aca:"לימודי", a_beh:"התנהגותי", a_soc:"חברתי",
};

// ── Kids matching helpers ─────────────────────────────────────────────────────

const EXPRESSIVE_MODALITY_MAP: Record<string, string> = {
  "אומנות": "טיפול באומנות",
  "מוזיקה": "טיפול במוזיקה",
  "תנועה": "טיפול בתנועה",
  "דרמה": "דרמה תרפיה",
  "פסיכודרמה": "פסיכודרמה",
  'בע"ח': 'טיפול בעזרת בע"ח',
};

function extractExpressivePrefs(score: KidsScoreResult): string[] {
  const allBoxes = [
    ...score.emotional, ...score.academic, ...score.developmental,
    ...score.behavioral, ...score.social,
  ];
  const found = new Set<string>();
  for (const box of allBoxes) {
    if (!box.txt.includes("📌")) continue;
    for (const [keyword, modality] of Object.entries(EXPRESSIVE_MODALITY_MAP)) {
      if (box.txt.includes(keyword)) found.add(modality);
    }
  }
  return Array.from(found);
}

function getKidsAgeGroups(A: Ans): string[] {
  const grp = gg(A);
  if (grp === "ga") return ["גיל הרך", "ילדים"];
  if (grp === "bv") return ["ילדים"];
  return ["נוער"];
}

const KIDS_ARRANGEMENTS = ["קופות החולים", "משרד הביטחון", "ביטוח לאומי", "ביטוחים פרטיים"] as const;
const KIDS_CULTURAL = ["היכרות עם העולם הדתי", "היכרות עם העולם החרדי", 'היכרות עם עולם הלהט"ב'] as const;

type KidsMatchResult = {
  id: string;
  full_name: string | null;
  gender: string | null;
  online: unknown;
  therapist_types: unknown;
  /** התואר הציבורי מ-/api/match (ראו publicTherapistTitle). */
  public_title?: string | null;
  training_areas: unknown;
  regions: unknown;
  arrangements: unknown;
  bio: string | null;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  entity_type: string | null; // 'center' = מרכז טיפולי כישות (מסלול 2)
  profile_slug: string | null; // עמוד הפרופיל הציבורי של המרכז (מסלול 2)
  match_score: number;
  personality_score: number | null;
  combined_score: number | null;
  match_reasons: string[];
};

type MatchSelection = {
  keys: string[];
  labels: string[];
  kind: "treatment" | "assessment" | "professional";
};

function KidsMatchSection({ A, score, selection }: {
  A: Ans;
  score: KidsScoreResult | null;
  selection: MatchSelection;
}) {
  const [open, setOpen]               = useState(false);
  const [region, setRegion]           = useState("");
  const [online, setOnline]           = useState(false);
  const [gender, setGender]           = useState("");
  const [arrangements, setArrangements] = useState<string[]>([]);
  const [cultural, setCultural]       = useState<string[]>([]);
  const [language, setLanguage]       = useState("עברית");
  const [city, setCity]               = useState("");
  const [loading, setLoading]         = useState(false);
  const [results, setResults]         = useState<KidsMatchResult[]>([]);
  const [error, setError]             = useState("");
  const [searched, setSearched]       = useState(false);
  const [explainData, setExplainData] = useState<Record<string, { title: string; explanation: string; tone_note: string } | null>>({});
  const [explainLoading, setExplainLoading] = useState<Record<string, boolean>>({});

  const selectionKey = selection.keys.join("|") + "::" + selection.kind;

  // Reset results when the selection changes (e.g. user clicked a different recommendation card),
  // but skip the reset when we are restoring saved state for the same selection on mount.
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) {
      didRestoreRef.current = false;
      return;
    }
    setResults([]);
    setSearched(false);
    setError("");
  }, [selectionKey]);

  // Restore the active match block when navigating back from a therapist profile,
  // but only for the recommendation card that originally produced the results.
  useEffect(() => {
    try {
      const referrer = document.referrer || "";
      const cameFromProfile = /\/therapists\/[^/]+/.test(referrer);
      // בניווט "אחורה" אמיתי (בלי bfcache) הרפרר נשאר המקורי - לא הפרופיל -
      // ולכן בודקים גם את סוג הניווט, אחרת המשתמש נזרק לתחילת השאלון.
      const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      if (!cameFromProfile && navType !== "back_forward") return;
      const raw = sessionStorage.getItem("kids_match_block_v1");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.ts !== "number") return;
      if (Date.now() - saved.ts > 60 * 60_000) return;
      if (saved.selectionKey !== selectionKey) return;
      didRestoreRef.current = true;
      if (typeof saved.region === "string") setRegion(saved.region);
      if (typeof saved.online === "boolean") setOnline(saved.online);
      if (typeof saved.gender === "string") setGender(saved.gender);
      if (Array.isArray(saved.arrangements)) setArrangements(saved.arrangements);
      if (Array.isArray(saved.cultural)) setCultural(saved.cultural);
      if (typeof saved.language === "string") setLanguage(saved.language);
      if (typeof saved.city === "string") setCity(saved.city);
      if (Array.isArray(saved.results)) setResults(saved.results);
      if (saved.searched) setSearched(true);
      setOpen(false);
    } catch {}
  }, [selectionKey]);

  // Persist the current match block (form + results) so the user lands back here
  // after browser-back from a therapist profile.
  useEffect(() => {
    if (!searched || results.length === 0) return;
    try {
      sessionStorage.setItem("kids_match_block_v1", JSON.stringify({
        ts: Date.now(),
        selectionKey,
        region, online, gender, arrangements, cultural, language, city,
        results, searched: true,
      }));
    } catch {}
  }, [searched, results, selectionKey, region, online, gender, arrangements, cultural, language, city]);

  // Track impressions for every card shown in the match-results list (source="match_card").
  // The profile page fires its own track-view with source="match" on entry, so the user gets
  // counted both as a card-impression and as a profile-entry.
  useEffect(() => {
    if (!results || results.length === 0) return;
    const sessionId = getOrCreateSessionId();
    const viewer = {
      viewer_region: normalizeKidsRegionKey(region, online),
      viewer_issue: "child",
      viewer_age_band: "child",
      viewer_gender: null,
      session_id: sessionId,
    };
    // Attribution rides along so match-card impressions stop landing under the
    // "unknown" channel in the attribution report (they carried no channel/utm).
    const attribution = getAttribution() ?? {};
    // הבדיקה מעל הלולאה - ראו ההערה המקבילה בשאלון המבוגרים.
    if (trackingOptedOut()) return;
    for (const t of results) {
      fetch("/api/track-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: t.id,
          source: "match_card",
          match_score: t.combined_score ?? t.match_score ?? null,
          ...viewer,
          ...attribution,
        }),
      }).catch(() => {});
    }
  }, [results, region, online]);

  const treatments = selection.keys.length > 0 ? selection.keys : ["טיפול דינאמי"];
  const treatmentLabels = selection.labels.length > 0 ? selection.labels : ["טיפול דינאמי"];
  const isAssessment = selection.kind === "assessment";
  const isProfessional = selection.kind === "professional";
  const personLabel = isAssessment ? "מאבחן/ת" : isProfessional ? "איש/ת מקצוע" : "מטפל/ת";
  const ageGroups  = getKidsAgeGroups(A);
  const expressivePrefs = score ? extractExpressivePrefs(score) : [];

  async function fetchExplanation(t: KidsMatchResult) {
    if (explainLoading[t.id] || explainData[t.id]) return;
    trackTherapistExplain(t.id, "kids");
    setExplainLoading(prev => ({ ...prev, [t.id]: true }));
    try {
      const res = await fetch("/api/explain-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "child",
          user_summary: {
            gender: A.gender || undefined,
            region_preference: city || region || undefined,
            online_preference: online || undefined,
            therapist_gender_preference: gender || undefined,
            recommended_treatment_types: isAssessment ? [] : treatments,
            recommended_assessment_types: isAssessment ? treatments : undefined,
            cultural_preferences: cultural.length ? cultural : undefined,
          },
          therapist: {
            id: t.id,
            full_name: t.full_name ?? "",
            // מגיע ממנוע ההתאמה - כדי שההסבר ינקוב באותו תואר שמופיע
            // בכותרת הפרופיל שאליו המטופל יגיע.
            public_title: t.public_title ?? null,
            therapist_types: t.therapist_types ?? [],
            training_areas: t.training_areas ?? [],
            regions: toArr(t.regions),
            online: t.online ?? false,
            gender: t.gender ?? null,
            bio: t.bio ?? null,
            entity_type: t.entity_type ?? null,
          },
          match_result: {
            match_score: t.match_score,
            match_reasons: t.match_reasons ?? [],
          },
        }),
      });
      const data = await res.json();
      setExplainData(prev => ({ ...prev, [t.id]: data }));
    } catch {
      setExplainData(prev => ({ ...prev, [t.id]: null }));
    } finally {
      setExplainLoading(prev => ({ ...prev, [t.id]: false }));
    }
  }

  function toggleArr(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function doMatch() {
    setLoading(true);
    setError("");
    // אותה נקודה בדיוק כמו במבוגרים - שליחת החיפוש, עם המיקום שנבחר.
    trackMatchSearch("kids", { region: region || null, city: city || null, online: !!online });
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentTypes: isAssessment || isProfessional ? [] : treatments,
          diagnosisTypes: isAssessment ? treatments : [],
          requiredTherapistTypes: isProfessional ? treatments : undefined,
          ageGroups,
          genderPreference: gender || null,
          city: city || null,
          region: city ? (CITY_TO_REGION[city] ?? region ?? null) : (region || null),
          onlineRequired: online,
          culturalPreferences: cultural,
          arrangements,
          languages: [language || "עברית"],
          expressiveModalities: isAssessment || isProfessional || expressivePrefs.length === 0 ? undefined : expressivePrefs,
          limit: 10,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "שגיאה בחיפוש");
      setResults(data.matches || []);
      setSearched(true);
      setOpen(false);
    } catch (e: any) {
      setError(e.message || "שגיאה בחיפוש");
    } finally {
      setLoading(false);
    }
  }

  function toArr(v: unknown): string[] {
    return Array.isArray(v) ? (v as string[]) : [];
  }

  return (
    <div>
      {/* The way back and the switch between recommendations both live in
          KidsRecommendationsStrip above this component now, so the old
          scroll-up button here would be a second, weaker copy. */}
      {!open ? (
        <button
          onClick={() => {
            setOpen(true);
            // נורה בפתיחת הטופס, לא בשליחתו - כדי למדוד את אותה נקודה כמו
            // במבוגרים (שם האירוע נורה במעבר ל-match-form). קודם לכן הוא נורה
            // ב-doMatch, ולכן לא ניתן היה להשוות בין שתי הזרימות, וגם לא לדעת
            // אם מי שנשר בילדים פתח את הטופס ונטש או לא פתח אותו כלל.
            trackMatchingClick(
              "kids",
              isAssessment ? `assessment:${treatments[0] ?? ""}` : isProfessional ? `professional:${treatments[0] ?? ""}` : treatments.join("+"),
            );
          }}
          className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-md transition hover:opacity-90 active:scale-95"
          style={{ background: isAssessment ? "linear-gradient(135deg,#5a3e7a,#7a4a9a)" : "linear-gradient(135deg,#2c3e7a,#4a6fa5)" }}
        >
          {isAssessment ? "🔎" : "🔍"} מציאת {personLabel} מתאים/ה - {treatmentLabels.join(" + ")}
        </button>
      ) : (
        <div className={`rounded-2xl border p-5 ${isAssessment ? "border-purple-200 bg-purple-50" : "border-[#c8d8f0] bg-[#f0f5ff]"}`}>
          <h3 className="font-bold text-[var(--teal-dark)] text-lg mb-1">מציאת {personLabel} מתאים/ה</h3>
          {treatmentLabels.length > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              על בסיס הממצאים: {treatmentLabels.join(", ")}
            </p>
          )}

          {/* Online */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2a3a5a] cursor-pointer">
              <input type="checkbox" checked={online} onChange={e => setOnline(e.target.checked)} className="w-4 h-4" />
              פתוח/ה גם לטיפול אונליין
            </label>
          </div>

          {/* Region + City */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">אזור מגורים</label>
            <select
              value={region}
              onChange={e => { setRegion(e.target.value); setCity(""); }}
              className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm mb-2"
            >
              <option value="">-- בחר אזור --</option>
              {ALL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {region && (
              <>
                <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">עיר</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm"
                >
                  <option value="">-- כל האזור --</option>
                  {(REGION_CITIES[region] ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            )}
            {/* Same disclosure as the adults flow: with no region and no online box the
                scorer skips the location block entirely, so distance stops counting. */}
            {!region && !online && (
              <p className="mt-2 rounded-xl bg-[var(--teal-pale)] px-3 py-2 text-xs leading-relaxed text-[#3E5250]">
                בלי אזור וללא סימון אונליין, ההתאמה מתבצעת לפי התאמה מקצועית בלבד - יוצגו מטפלים מכל הארץ, ללא התחשבות במרחק.
              </p>
            )}
          </div>

          {/* Language */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-[#2a3a5a] mb-1">שפת הטיפול</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-[#c8d0e8] bg-white px-3 py-2 text-sm">
              {["עברית","אנגלית","ערבית","רוסית","צרפתית","ספרדית","פורטוגזית","אמהרית"].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Gender */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפת מגדר מטפל/ת</div>
            <div className="flex gap-4">
              {(["", "זכר", "נקבה"] as const).map(g => (
                <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={gender === g} onChange={() => setGender(g)} />
                  {g || "ללא העדפה"}
                </label>
              ))}
            </div>
          </div>

          {/* Arrangements */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">הסדרי תשלום</div>
            <div className="flex flex-wrap gap-3">
              {KIDS_ARRANGEMENTS.map(a => (
                <label key={a} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={arrangements.includes(a)} onChange={() => toggleArr(arrangements, setArrangements, a)} />
                  {a}
                </label>
              ))}
            </div>
          </div>

          {/* Cultural */}
          <div className="mb-5">
            <div className="text-sm font-semibold text-[#2a3a5a] mb-2">העדפות תרבותיות</div>
            <div className="flex flex-wrap gap-3">
              {KIDS_CULTURAL.map(c => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={cultural.includes(c)} onChange={() => toggleArr(cultural, setCultural, c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={doMatch}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90 disabled:opacity-50"
            style={{ background: isAssessment ? "linear-gradient(135deg,#5a3e7a,#7a4a9a)" : "linear-gradient(135deg,#2c3e7a,#4a6fa5)" }}
          >
            {loading ? "מחפש..." : `חיפוש ${personLabel}`}
          </button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="mt-5">
          {results.length === 0 ? (
            <div className="text-center py-6 text-[#4a6fa5] text-sm bg-blue-50 rounded-2xl">
              לא נמצאו {isAssessment ? "מאבחנים" : "מטפלים"} מתאימים לפי הפרמטרים שנבחרו.
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-[var(--teal-dark)] mb-3">נמצאו {results.length} {isAssessment ? "מאבחנים" : "מטפלים"}:</div>
              <SaveMatchesButton matches={results} quizType="kids" treatmentLabel={treatmentLabels.join(" + ") || null} />
              <div className="space-y-4">
                {results.map(t => {
                  const regionsArr = toArr(t.regions);
                  const combined = t.combined_score ?? t.match_score;
                  const profileHref = (() => {
                    const params = new URLSearchParams({ from: "match" });
                    const score = t.combined_score ?? t.match_score;
                    if (typeof score === "number") params.set("s", String(score));
                    params.set("i", "child");
                    params.set("a", "child");
                    const r = normalizeKidsRegionKey(region, online);
                    if (r) params.set("r", r);
                    // Which treatment/assessment recommendation sent this visitor -
                    // feeds the therapist dashboard's "מה הוביל אותם אליך" breakdown.
                    if (treatmentLabels.length > 0) params.set("t", treatmentLabels.join(" + ").slice(0, 80));
                    // מרכז: לעמוד המרכז עם from=match; בלי slug - null והכפתור מוסתר
                    // (עמוד-מטפל חוסם ישויות ב-404, אסור ליפול אליו).
                    if (t.entity_type === "center") return t.profile_slug ? `/centers/${t.profile_slug}?from=match` : null;
                    return `${therapistPath(t.id, t.full_name)}?${params.toString()}`;
                  })();
                  return (
                    <div
                      key={t.id}
                      className="rounded-[18px] border border-[var(--line)] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-stretch gap-4">
                        {t.entity_type === "center" && !t.profile_photo_url ? (
                          // מרכז בלי לוגו - סמל ניטרלי (לא אווטאר מגדרי; gender של ישות ריק)
                          <div className="flex h-[78px] w-[78px] flex-shrink-0 items-center justify-center self-start rounded-2xl border border-[var(--teal-mid)] bg-[var(--teal-pale)] text-3xl" aria-hidden>
                            🏢
                          </div>
                        ) : (
                          <img
                            src={t.profile_photo_url || (t.gender === "נקבה" ? "/avatar-female.svg" : "/avatar-male.svg")}
                            alt={t.full_name ?? ""}
                            className={`h-[78px] w-[78px] flex-shrink-0 self-start rounded-2xl ${
                              t.entity_type === "center"
                                ? "border border-[var(--line)] bg-white object-contain p-1" // לוגו מרכז - לא לחתוך
                                : "object-cover"
                            }`}
                          />
                        )}
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-extrabold text-[var(--text)]">{t.full_name || "ללא שם"}</h3>
                            {t.entity_type === "center" && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--gold-dark)]">🏢 מרכז טיפולי</span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-pale)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--teal-dark)]">✓ מאומת</span>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">{t.entity_type === "center" ? "מרכז טיפולי" : t.gender} • {t.online ? "אונליין" : "פנים אל פנים"}</p>
                          {t.bio && <p className="mt-1.5 line-clamp-2 text-sm text-[var(--text-2)]">{t.bio}</p>}
                          {regionsArr.length > 0 && (
                            <p className="mt-1.5 text-xs text-[var(--muted)]">📍 {regionsArr.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex w-[110px] flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-[var(--teal-pale)] px-2 py-3 text-center">
                          <div className="text-[2.4rem] font-black leading-none tracking-tight text-[var(--teal-dark)]">
                            {combined}<span className="align-super text-base font-extrabold">%</span>
                          </div>
                          <div className="mt-1 text-[10.5px] font-bold text-[var(--teal)]">{t.personality_score != null ? "התאמה כוללת" : "התאמה מקצועית"}</div>
                          {t.personality_score != null && (
                            <>
                              <div className="my-2 h-px w-2/3 bg-[var(--teal-mid)]" />
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10.5px] text-[var(--muted)]">מקצועי <b className="font-extrabold text-[var(--teal-dark)]">{t.match_score}%</b></span>
                                <span className="text-[10.5px] text-[var(--muted)]">אישיותי <b className="font-extrabold text-[var(--teal-dark)]">{t.personality_score}%{t.entity_type === "center" && "*"}</b></span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {t.entity_type === "center" && t.personality_score != null && (
                        <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
                          * במרכז פועל מספר רב של מטפלים - צוות המרכז יתאים לכם מתוכו את המטפל/ת המתאים/ה גם אישיותית.
                        </p>
                      )}
                      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                        {/* אותה היררכיה כמו במבוגרים - ראו ההערה שם ובקומפוננטה. */}
                        {t.entity_type !== "center" && <MatchCardWhatsApp therapistId={t.id} phone={t.phone} />}
                        <button
                          onClick={() => fetchExplanation(t)}
                          disabled={explainLoading[t.id]}
                          className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#EAD9B0] bg-white px-4 py-2 text-[13px] font-bold text-[var(--gold-dark)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)] disabled:opacity-60"
                        >
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white"
                            style={{ background: "linear-gradient(135deg,var(--teal),var(--gold))" }}
                          >✦</span>
                          {explainLoading[t.id] ? "טוען..." : "למה הותאמ/ה לי?"}
                        </button>
                        {profileHref && (
                          <a
                            href={profileHref}
                            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-2 text-[13px] font-bold transition-colors hover:bg-[var(--teal-pale)]"
                            style={{ borderColor: "var(--teal-mid)", color: "var(--teal-dark)" }}
                          >
                            פרופיל מלא ←
                          </a>
                        )}
                      </div>
                      {explainData[t.id] && (
                        <div
                          className="mt-3 rounded-2xl bg-[var(--gold-pale)] p-3.5 text-right"
                          style={{ borderInlineStart: "3px solid var(--gold)" }}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[13px] text-white shadow-sm"
                              style={{ background: "linear-gradient(135deg,var(--teal),var(--gold))" }}
                            >✦</span>
                            <span className="text-[12.5px] font-extrabold text-[var(--gold-dark)]">{explainData[t.id]!.title}</span>
                            <span
                              className="rounded-full border border-[#EAD9B0] bg-white px-2 py-[1px] text-[9.5px] font-bold text-[var(--gold-dark)]"
                              style={{ marginInlineStart: "auto" }}
                            >ניתוח AI</span>
                          </div>
                          <p className="whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-2)]">{explainData[t.id]!.explanation}</p>
                          <p className="mt-2 text-[10.5px] text-[var(--faint)]">{explainData[t.id]!.tone_note}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// Detect bare or full URLs in free text and render them as clickable links.
// Used for "anpar.org.il" style pointers inside tools/notes.
function renderWithLinks(text: string): React.ReactNode[] {
  const urlRx = /(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
  const out: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRx.exec(text)) !== null) {
    if (m.index > lastIdx) out.push(text.slice(lastIdx, m.index));
    const url = m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
    out.push(
      <a
        key={`u-${m.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-700 underline hover:text-blue-900"
      >
        {m[0]}
      </a>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push(text.slice(lastIdx));
  return out;
}

function hasSameSymptoms(a: KidsRecommendationGroup, b: KidsRecommendationGroup): boolean {
  const aS = [...new Set(a.recs.flatMap(r => r.symptoms))].sort();
  const bS = [...new Set(b.recs.flatMap(r => r.symptoms))].sort();
  return aS.length === bS.length && aS.every((s, i) => s === bS[i]);
}

function GroupCard({
  group,
  onSelect,
  selected,
  onExplain,
  explanation,
  explanationLoading,
  siblings,
  onSelectSiblings,
}: {
  group: KidsRecommendationGroup & { domainLabel: string };
  onSelect: (() => void) | null;
  selected: boolean;
  // AI explanation hooks - when onExplain is omitted, the explain button is hidden
  // (used for "informational" and "external" cards that don't have an actionable treatment).
  onExplain?: () => void;
  explanation?: { title: string; explanation: string; evidence_note: string } | null;
  explanationLoading?: boolean;
  siblings?: (KidsRecommendationGroup & { domainLabel: string })[];
  onSelectSiblings?: (() => void)[];
}) {
  const allSymptoms = uniq(group.recs.flatMap(r => r.symptoms));
  const allTools = group.recs.flatMap(r => r.tools);
  const allNotes = uniq(group.recs.map(r => r.notes).filter(Boolean) as string[]);

  // Notes >200 chars move to the accordion so they don't overwhelm the card.
  const NOTE_INLINE_LIMIT = 200;
  const inlineNotes = allNotes.filter(n => n.length <= NOTE_INLINE_LIMIT);
  const expandedNotes = allNotes.filter(n => n.length > NOTE_INLINE_LIMIT);

  // Group tools by their source symptom (best-effort) so the user sees why each tool is recommended.
  const toolsBySymptom = new Map<string, string[]>();
  for (const t of allTools) {
    const key = t.sourceSymptom || "כללי";
    const list = toolsBySymptom.get(key) ?? [];
    if (!list.includes(t.text)) list.push(t.text);
    toolsBySymptom.set(key, list);
  }

  const isAssessment = group.kind === "assessment";
  const isExternal = group.kind === "external";
  const isProfessional = group.kind === "professional";
  const noAction = group.treatmentKey === "_no_action";

  // Color theme per kind
  const accent = group.urgent
    ? "border-red-300 bg-red-50"
    : noAction
      ? "border-gray-200 bg-gray-50"
      : isAssessment
        ? "border-purple-200 bg-purple-50/70"
        : isProfessional
          ? "border-emerald-200 bg-emerald-50/70"
          : isExternal
            ? "border-amber-200 bg-amber-50/70"
            : "border-[var(--teal-mid)] bg-white";

  const labelTone = group.urgent ? "text-red-700"
    : noAction ? "text-gray-500"
    : isAssessment ? "text-purple-700"
    : isProfessional ? "text-emerald-700"
    : isExternal ? "text-amber-800"
    : "text-[var(--teal)]";

  return (
    <div className={`rounded-2xl border p-5 mb-3 ${accent} ${selected ? "ring-2 ring-[var(--teal)]" : ""}`}>
      <div className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${labelTone}`}>
        {group.domainLabel}
        {group.urgent && " ⚠️"}
      </div>

      {allSymptoms.length === 1 ? (
        <p className="font-semibold text-[#1a2a3a] text-sm leading-relaxed">{allSymptoms[0]}</p>
      ) : (
        <ul className="space-y-1">
          {allSymptoms.map(s => (
            <li key={s} className="flex items-start gap-2 text-sm font-semibold text-[#1a2a3a] leading-relaxed">
              <span className={`mt-1 ${labelTone}`}>•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      {inlineNotes.length > 0 && (
        <div className="mt-2 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {renderWithLinks(inlineNotes.join("\n"))}
        </div>
      )}

      {!noAction && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 ${
                isAssessment
                  ? "bg-purple-700"
                  : isProfessional
                    ? "bg-emerald-700"
                    : "bg-[var(--teal-dark)]"
              }`}
            >
              {isAssessment ? "🔎 חיפוש מאבחן/ת" : isProfessional ? "👩‍⚕️ חיפוש איש/ת מקצוע" : "🔍 חיפוש מטפל/ת"} - {group.treatmentLabel} ←
            </button>
          ) : (
            <div className="inline-block rounded-xl bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
              → {group.treatmentLabel}
            </div>
          )}
          {(siblings ?? []).map((s, i) => {
            const cb = onSelectSiblings?.[i];
            if (!cb) return null;
            const sAssessment = s.kind === "assessment";
            const sProfessional = s.kind === "professional";
            return (
              <button
                key={s.treatmentKey}
                type="button"
                onClick={cb}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 ${
                  sAssessment ? "bg-purple-700" : sProfessional ? "bg-emerald-700" : "bg-[var(--teal-dark)]"
                }`}
              >
                {sAssessment ? "🔎 חיפוש מאבחן/ת" : sProfessional ? "👩‍⚕️ חיפוש איש/ת מקצוע" : "🔍 חיפוש מטפל/ת"} - {s.treatmentLabel} ←
              </button>
            );
          })}
          {onExplain && (
            <button
              type="button"
              onClick={onExplain}
              disabled={explanationLoading}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-400 hover:opacity-90 transition-all disabled:opacity-60"
            >
              {explanationLoading ? "טוען..." : "✦ למה הוצע לי?"}
            </button>
          )}
        </div>
      )}

      {explanation && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 text-right">
          <p className="text-xs font-bold text-violet-900 mb-2">✦ {explanation.title}</p>
          <p className="text-xs text-gray-700 mb-2 leading-relaxed whitespace-pre-line">{explanation.explanation}</p>
          <p className="text-[10px] text-gray-400 mb-3">{explanation.evidence_note}</p>
          {(() => {
            const href = getTreatmentArticleHref(group.treatmentKey);
            const article = getTreatmentArticle(group.treatmentKey);
            if (href) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 hover:underline"
                >
                  📖 קרא עוד על {group.treatmentLabel} ←
                </a>
              );
            }
            if (article.status === "pending") {
              return (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                  📖 מאמר בהכנה
                </span>
              );
            }
            return null;
          })()}
        </div>
      )}

      {allTools.length > 0 && (
        <details className="mt-3" open={group.urgent}>
          <summary className="cursor-pointer select-none list-none rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 transition hover:bg-amber-100">
            🛠 {allTools.length} כלים מעשיים להתמודדות - אפשר להתחיל כבר עכשיו »
          </summary>
          <div className="mt-2 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
            {Array.from(toolsBySymptom.entries()).map(([symptom, tools]) => (
              <div key={symptom}>
                {symptom !== "כללי" && allSymptoms.length > 1 && (
                  <div className="text-xs font-bold text-amber-800 mb-1">▸ {symptom}</div>
                )}
                {tools.map((t, i) => (
                  <div key={i} className="text-xs leading-relaxed text-gray-700 whitespace-pre-line">
                    {renderWithLinks(t.replace(/^📌\s*/, ""))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}

      {expandedNotes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-gray-500 hover:text-[var(--teal-dark)] select-none">
            📋 הסבר מורחב - לחץ להרחיב
          </summary>
          <div className="mt-3 space-y-3 rounded-xl bg-white/60 p-3 border border-gray-200">
            {expandedNotes.map((n, i) => (
              <div key={`note-${i}`} className="text-xs leading-relaxed text-gray-700 whitespace-pre-line border-r-2 border-gray-300 pr-2">
                {renderWithLinks(n)}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const DOMAIN_LABELS: Record<string, string> = {
  emotional: "🧠 תחום רגשי",
  academic: "📚 תחום לימודי",
  developmental: "🌱 תחום התפתחותי",
  behavioral: "⚡ תחום התנהגותי",
  social: "🤝 תחום חברתי",
};

/**
 * The strip that sits above the kids match screen, mirroring the adults'
 * RecommendationsStrip: a way back to the full report plus one-tap switching
 * between every recommendation, so a parent is never locked into the referral
 * they happened to tap first.
 *
 * Kids differ from adults in one way that matters here: recommendations are
 * spread across up to five domains (emotional / academic / developmental /
 * behavioural / social), so the chips are grouped under their domain label
 * instead of listed flat. A parent who marked several areas sees which domain
 * each option belongs to rather than an undifferentiated row of treatments.
 */
function KidsRecommendationsStrip({
  options,
  activeKey,
  onSelect,
  onBack,
}: {
  options: { key: string; label: string; domainLabel: string; urgent: boolean; combined: boolean }[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  onBack?: () => void;
}) {
  const byDomainLabel: { domainLabel: string; items: typeof options }[] = [];
  for (const o of options) {
    const bucket = byDomainLabel.find(b => b.domainLabel === o.domainLabel);
    if (bucket) bucket.items.push(o);
    else byDomainLabel.push({ domainLabel: o.domainLabel, items: [o] });
  }

  return (
    <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--teal-dark)] hover:underline"
      >
        ◂ חזרה לדוח הממצאים
      </button>
      {options.length > 1 && (
        <>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">מעבר בין ההמלצות שלך</p>
          <div className="space-y-2">
            {byDomainLabel.map(b => (
              <div key={b.domainLabel}>
                <div className="mb-1 text-[10px] font-semibold text-stone-400">{b.domainLabel}</div>
                <div className="flex flex-wrap gap-2">
                  {b.items.map(o => {
                    const isActive = activeKey === o.key;
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => onSelect(o.key)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isActive
                            ? "bg-[var(--teal-dark)] text-white shadow-sm"
                            : o.combined
                              ? "border border-[var(--teal)] bg-[var(--teal-pale)] text-[var(--teal-dark)] hover:bg-white"
                              : o.urgent
                                ? "border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
                                : "border border-stone-300 bg-white text-stone-700 hover:border-[var(--teal-dark)] hover:text-[var(--teal-dark)]"
                        }`}
                      >
                        {o.urgent && "⚠️ "}{o.combined && "✦ "}{o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PageResult({ A, score, scoreError, onRetryScore, onRestart }: { A: Ans; score: KidsScoreResult | null; scoreError: boolean; onRetryScore: () => void; onRestart: () => void }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // "report" = the findings report; "match" = the therapist search, on its own
  // screen. Mirrors the adults flow, where picking a recommendation swaps the
  // whole screen (results → match-form) instead of revealing a panel further
  // down a long document. Measured: 70% of adults completers reach a therapist
  // card against 44% on kids.
  const [view, setView] = useState<"report" | "match">("report");

  // Coming back from a therapist profile should return to the match screen the
  // parent left, not to the top of the report. Same gate the page-level restore
  // uses. KidsMatchSection then restores its own form and results off the
  // matching selectionKey, so the screen comes back whole.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cameFromProfile = /\/therapists\/[^/]+/.test(document.referrer || "");
      const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      if (!cameFromProfile && navType !== "back_forward") return;
      const raw = sessionStorage.getItem("kids_view_v1");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.ts !== "number") return;
      if (Date.now() - saved.ts > 60 * 60_000) return;
      if (saved.view === "match" && typeof saved.selectedKey === "string") {
        setSelectedKey(saved.selectedKey);
        setView("match");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem("kids_view_v1", JSON.stringify({ ts: Date.now(), view, selectedKey }));
    } catch {}
  }, [view, selectedKey]);
  // Per-recommendation AI explanation state. Keyed on `${domainKey}::${treatmentKey}`
  // so two cards for the same treatment in different domains don't collide.
  const [recExplain, setRecExplain] = useState<Record<string, { title: string; explanation: string; evidence_note: string } | null>>({});
  const [recExplainLoading, setRecExplainLoading] = useState<Record<string, boolean>>({});

  async function fetchRecExplain(
    domainKey: string,
    domainLabel: string,
    g: KidsRecommendationGroup,
  ) {
    const key = `${domainKey}::${g.treatmentKey}`;
    if (recExplainLoading[key] || recExplain[key]) return;
    setRecExplainLoading(prev => ({ ...prev, [key]: true }));

    // Fire-and-forget analytics event - admin sees who clicks and on what.
    //
    // התנאי עוטף את השליחה ואינו יוצא מהפונקציה - ראו ההערה המקבילה
    // בשאלון המבוגרים: `return` כאן השאיר את הכרטיס על "טוען" לנצח.
    try {
      if (!trackingOptedOut()) {
      fetch("/api/track-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "child",
          treatment_key: g.treatmentKey,
          treatment_label: g.treatmentLabel,
          domain: domainLabel,
          urgent: g.urgent,
          session_id: getOrCreateSessionId(),
          viewer_issue: "child",
          viewer_age_band: "child",
          viewer_gender: A.gender === "זכר" ? "m" : A.gender === "נקבה" ? "f" : undefined,
        }),
      }).catch(() => {});
      }
    } catch {}

    try {
      const symptoms = g.recs.flatMap(r => r.symptoms).filter(Boolean);
      const facts = buildKidsFacts(A, domainLabel);
      const factsWithSymptoms = {
        ...facts,
        summary: [
          ...(symptoms.length ? [`ממצאי השאלון: ${symptoms.slice(0, 3).join("; ")}`] : []),
          ...(facts.summary ?? []),
        ],
      };
      const res = await fetch("/api/explain-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionnaire_type: "child",
          recommendation: {
            treatment: g.treatmentKey,
            treatment_label: g.treatmentLabel,
            domain: domainLabel,
            urgent: g.urgent,
            symptom_text: symptoms[0],
          },
          user_facts: factsWithSymptoms,
        }),
      });
      const data = await res.json();
      setRecExplain(prev => ({ ...prev, [key]: data }));
    } catch {
      setRecExplain(prev => ({ ...prev, [key]: null }));
    } finally {
      setRecExplainLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  const domainResults: { key: string; label: string; result: KidsDomainResult }[] = useMemo(() => {
    if (!score) return [];
    return [
      { key: "emotional", label: DOMAIN_LABELS.emotional, result: parseKidsBoxes(score.emotional, "emotional") },
      { key: "academic", label: DOMAIN_LABELS.academic, result: parseKidsBoxes(score.academic, "academic") },
      { key: "developmental", label: DOMAIN_LABELS.developmental, result: parseKidsBoxes(score.developmental, "developmental") },
      { key: "behavioral", label: DOMAIN_LABELS.behavioral, result: parseKidsBoxes(score.behavioral, "behavioral") },
      { key: "social", label: DOMAIN_LABELS.social, result: parseKidsBoxes(score.social, "social") },
    ];
  }, [score]);

  // Reported once per scored questionnaire, from the same aggregate the search
  // uses - so the analytics answer the question the search would answer, not a
  // parallel derivation of it. See trackQuizTreatments for why this is not part
  // of quiz_complete on the kids side.
  const treatmentsReported = useRef(false);
  useEffect(() => {
    if (!score || treatmentsReported.current) return;
    treatmentsReported.current = true;
    const agg = aggregateForMatch(domainResults.map(d => d.result));
    trackQuizTreatments("kids", {
      treatments: agg.treatmentKeys,
      assessments: agg.assessmentKeys,
      professionals: agg.professionalKeys,
    });
  }, [score, domainResults]);

  type DomainGroup = KidsRecommendationGroup & { domainLabel: string; domainKey: string };
  type DomainBucket = {
    key: string;
    label: string;
    treatments: DomainGroup[];
    assessments: DomainGroup[];
    professionals: DomainGroup[];
    externals: DomainGroup[];
    informational: DomainGroup[]; // symptoms with no actionable referral (low-stress etc.)
    standaloneWarnings: typeof domainResults[number]["result"]["standaloneWarnings"];
    externalNotes: string[];
  };

  const byDomain: DomainBucket[] = useMemo(() => {
    return domainResults.map(d => {
      const groups = d.result.groups.map(g => ({ ...g, domainLabel: d.label, domainKey: d.key }));
      return {
        key: d.key,
        label: d.label,
        treatments: groups.filter(g => g.kind === "treatment" && g.treatmentKey !== "_no_action"),
        assessments: groups.filter(g => g.kind === "assessment"),
        professionals: groups.filter(g => g.kind === "professional"),
        externals: groups.filter(g => g.kind === "external" && g.treatmentKey !== "_no_action"),
        informational: groups.filter(g => g.treatmentKey === "_no_action"),
        standaloneWarnings: d.result.standaloneWarnings,
        externalNotes: d.result.externalNotes,
      };
    });
  }, [domainResults]);

  const hasAnyFindings = byDomain.some(b =>
    b.treatments.length > 0 || b.assessments.length > 0 || b.professionals.length > 0 || b.externals.length > 0 || b.informational.length > 0 || b.standaloneWarnings.length > 0
  );

  /**
   * Every selectable referral, flattened for the match-screen strip. Keys are
   * built with the exact same grammar activeSelection parses, so a chip and the
   * card it came from resolve to one selection.
   *
   * Externals and _no_action are excluded: they have no search button on the
   * card either (there is no practitioner to look up).
   */
  const stripOptions = useMemo(() => {
    const out: { key: string; label: string; domainLabel: string; urgent: boolean; combined: boolean }[] = [];
    for (const b of byDomain) {
      const seen = new Set<string>();
      for (const g of [...b.treatments, ...b.assessments, ...b.professionals]) {
        const key = `${b.key}::${g.kind}::${g.treatmentKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, label: g.treatmentLabel, domainLabel: b.label, urgent: g.urgent, combined: false });
      }
      // Combined search exists for the emotional domain only - see showCombinedT.
      const tKeys = uniq(b.treatments.map(g => g.treatmentKey));
      const aKeys = uniq(b.assessments.map(g => g.treatmentKey));
      if (b.key === "emotional" && tKeys.length >= 2) {
        out.push({ key: `${b.key}::__combined::treatment`, label: "מטפל/ת שמשלב כמה גישות", domainLabel: b.label, urgent: false, combined: true });
      }
      if (b.key === "emotional" && aKeys.length >= 2) {
        out.push({ key: `${b.key}::__combined::assessment`, label: "אבחון משולב", domainLabel: b.label, urgent: false, combined: true });
      }
    }
    return out;
  }, [byDomain]);

  // Active selection for the matching panel.
  //  selectedKey format:
  //    "{domainKey}::{kind}::{treatmentKey}"      for individual group
  //    "{domainKey}::__combined::{kind}"          for per-domain combined search
  //    "_dynamic_fallback_"                       for the no-findings dynamic-therapist click
  //  null  → matching panel hidden (no auto-fallback to טיפול דינאמי)
  const activeSelection: MatchSelection | null = useMemo(() => {
    if (!selectedKey) return null;
    if (selectedKey === "_dynamic_fallback_") {
      return { keys: ["טיפול דינאמי"], labels: ["טיפול דינאמי"], kind: "treatment" };
    }
    const combMatch = selectedKey.match(/^(.+)::__combined::(treatment|assessment)$/);
    if (combMatch) {
      const domainKey = combMatch[1];
      const kindStr = combMatch[2] as "treatment" | "assessment";
      const bucket = byDomain.find(b => b.key === domainKey);
      if (!bucket) return null;
      const groups = kindStr === "treatment" ? bucket.treatments : bucket.assessments;
      const seen = new Set<string>();
      const keys: string[] = [];
      const labels: string[] = [];
      for (const g of groups) {
        if (seen.has(g.treatmentKey)) continue;
        seen.add(g.treatmentKey);
        keys.push(g.treatmentKey);
        labels.push(g.treatmentLabel);
      }
      return { keys, labels, kind: kindStr };
    }
    const indMatch = selectedKey.match(/^(.+?)::(treatment|assessment|external|professional)::(.+)$/);
    if (indMatch) {
      const [, domainKey, , treatmentKey] = indMatch;
      const bucket = byDomain.find(b => b.key === domainKey);
      if (!bucket) return null;
      const all = [...bucket.treatments, ...bucket.assessments, ...bucket.professionals];
      const group = all.find(g => g.treatmentKey === treatmentKey);
      if (!group) return null;
      const apiKind: MatchSelection["kind"] =
        group.kind === "assessment" ? "assessment" :
        group.kind === "professional" ? "professional" :
        "treatment";
      return { keys: [group.treatmentKey], labels: [group.treatmentLabel], kind: apiKind };
    }
    return null;
  }, [selectedKey, byDomain]);

  /** Opens the match screen. Jumps to the top because it is a new screen, not
   *  a panel appended to the report the parent was already reading. */
  function openMatch(key: string) {
    setSelectedKey(key);
    setView("match");
    if (typeof window !== "undefined") {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 0);
    }
  }

  function backToReport() {
    setView("report");
    if (typeof window === "undefined") return;
    setTimeout(() => {
      const el = document.getElementById("kids-recommendations-top");
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
      else window.scrollTo({ top: 0, behavior: "auto" });
    }, 0);
  }

  function selectGroup(domainKey: string, g: KidsRecommendationGroup) {
    openMatch(`${domainKey}::${g.kind}::${g.treatmentKey}`);
  }

  function selectCombined(domainKey: string, kind: "treatment" | "assessment") {
    openMatch(`${domainKey}::__combined::${kind}`);
  }

  function selectDynamicFallback() {
    openMatch("_dynamic_fallback_");
  }

  const bmiNum = A._bmi ? Number(A._bmi) : null;
  const bmiVal = bmiNum ? bmiNum.toFixed(1) : null;
  const bmiAbnormal = bmiNum != null && (bmiNum < 18.5 || bmiNum > 24.9);

  if (scoreError) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-4xl mb-4">⚠️</div>
      <p className="text-stone-700 font-semibold mb-2">שגיאה בחישוב התוצאות</p>
      <p className="text-stone-500 text-sm mb-6">בדוק את חיבור האינטרנט ונסה שוב.</p>
      <button
        onClick={onRetryScore}
        className="px-6 py-3 bg-[var(--teal)] text-white rounded-full font-semibold text-sm hover:opacity-90 transition-all"
      >נסה שוב</button>
    </div>
  );

  if (!score) return (
    <div className="flex items-center justify-center py-20 text-gray-500 text-sm">מחשב תוצאות…</div>
  );

  const allExternalNotes = uniq(byDomain.flatMap(b => b.externalNotes));

  // Match screen - a full screen swap, not a panel below the report. The report
  // is unmounted, so the parent has one thing in front of them and a labelled
  // way back, exactly like the adults match-form.
  if (view === "match" && activeSelection) {
    return (
      <div>
        <div className="mb-4 flex justify-center">
          <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "46px", width: "auto" }} />
        </div>
        <KidsRecommendationsStrip
          options={stripOptions}
          activeKey={selectedKey}
          onSelect={openMatch}
          onBack={backToReport}
        />
        <KidsMatchSection A={A} score={score} selection={activeSelection} />
      </div>
    );
  }

  return (
    <div id="kids-results-card">
      {/* Logo - included in the captured PDF report */}
      <div className="mb-4 flex justify-center">
        <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "46px", width: "auto" }} />
      </div>
      {/* Demographics card */}
      <Card>
        <StepTag>סיכום שאלון</StepTag>
        <h2 className="text-xl font-bold text-[#1a2a3a] mb-4">דוח ממצאים</h2>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-sm space-y-1.5 text-[#2a3a4a]">
          <div className="flex justify-between">
            <span className="font-semibold">גיל:</span>
            <span>{A._age || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">כיתה:</span>
            <span>{GRADE_LABELS[A._grade] || A._grade || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold">מגדר:</span>
            <span>{A.gender || "-"}</span>
          </div>
          {bmiVal && (
            <div className="flex justify-between">
              <span className="font-semibold">BMI:</span>
              <span>{bmiVal} {bmiAbnormal && <span className="text-amber-700">(אינו תקין)</span>}</span>
            </div>
          )}
          <div className="pt-1 border-t border-gray-200">
            <div className="font-semibold mb-1">תחומי קושי שסומנו:</div>
            {Object.entries(AREA_LABELS).map(([k, label]) =>
              A[k] && A[k] !== "כלל לא" ? (
                <div key={k} className="flex justify-between">
                  <span>{label}:</span>
                  <span>{A[k]}</span>
                </div>
              ) : null
            )}
          </div>
        </div>
      </Card>

      {/* "What now?" orientation strip */}
      {hasAnyFindings && (
        <div className="mt-4 rounded-2xl border p-5" style={{ background: "var(--teal-pale)", borderColor: "var(--teal-mid)" }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--teal-dark)]">מה עכשיו?</p>
          <div className="flex flex-col gap-2.5 text-sm text-[#2a3a4a]">
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">1</span>
              <span>עברו על דוח הממצאים, מסודר לפי תחומים</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">2</span>
              <span>בכל ממצא - פתחו את <span className="font-semibold text-amber-700">🛠 הכלים המעשיים</span> שאפשר להתחיל ליישם כבר עכשיו</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[var(--teal-dark)] border border-[var(--teal-mid)]">3</span>
              <span>כשמוכנים - לחצו על <span className="font-semibold text-[var(--teal-dark)]">"חיפוש מטפל/מאבחן"</span> בממצא הרלוונטי ביותר עבורכם</span>
            </div>
          </div>
        </div>
      )}

      {/* BMI banner */}
      <div className="mt-4">
        {bmiAbnormal && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            ⚕️ ה-BMI של הילד/ה אינו בטווח הרגיל למבוגרים. מאחר שאצל ילדים BMI נקבע לפי גיל ומגדר, מומלץ לפנות לרופא/ת הילדים לבירור רפואי בנפרד מהבירור הנפשי.
          </div>
        )}

        {!hasAnyFindings && (
          <Card>
            <div className="py-4">
              <p className="font-bold text-[#1a2a3a] text-base mb-2">לא נמצאו ממצאים משמעותיים בתחומים שנבדקו</p>
              <p className="text-sm text-gray-600 mb-3">
                ✅ מומלץ לפנות לטיפול פסיכודינאמי לצורך עיבוד והבנת הקשיים.
              </p>
              <button
                type="button"
                onClick={selectDynamicFallback}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--teal-dark)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--teal-dark)]"
              >
                🔍 חיפוש מטפל/ת לטיפול דינאמי
              </button>
            </div>
          </Card>
        )}

        {/* Anchor target for the "back to recommendations" button in the match section. */}
        <div id="kids-recommendations-top" className="scroll-mt-4" />

        {/*
          Signposts the hidden next step. The matching panel renders only once a
          recommendation is picked (activeSelection), and nothing on the page said
          so - measured over 60 days, only 44% of kids-quiz completers ever reached
          a therapist card, against 70% on the adults flow, whose match form is a
          separate full screen and therefore impossible to miss. One traced parent
          read the recommendation, then navigated BACK to the city directory to
          browse manually rather than clicking a card.
        */}
        {hasAnyFindings && !selectedKey && (
          <div
            className="mb-4 flex items-start gap-2 rounded-xl p-3 text-sm leading-relaxed"
            style={{ background: "var(--teal-pale)", border: "1px solid var(--teal-mid)", color: "var(--teal-dark)" }}
          >
            <span aria-hidden="true">👇</span>
            <span>
              <b>השלב הבא:</b> בחרו סוג טיפול מהמלצות שלמטה, ונציג לכם מטפלים מתאימים באזורכם.
            </span>
          </div>
        )}

        {/* Per-domain sections */}
        {byDomain.map(b => {
          const hasAny =
            b.treatments.length > 0 ||
            b.assessments.length > 0 ||
            b.professionals.length > 0 ||
            b.externals.length > 0 ||
            b.informational.length > 0 ||
            b.standaloneWarnings.length > 0;
          if (!hasAny) return null;

          const domainTreatmentKeys = uniq(b.treatments.map(g => g.treatmentKey));
          const domainAssessmentKeys = uniq(b.assessments.map(g => g.treatmentKey));
          // Combined search is reserved for the emotional domain only - combining e.g. an
          // academic-LD treatment with a behavioral one doesn't map to a real-world practitioner.
          const showCombinedT = b.key === "emotional" && domainTreatmentKeys.length >= 2;
          const showCombinedA = b.key === "emotional" && domainAssessmentKeys.length >= 2;
          const combinedTLabels = uniq(b.treatments.map(g => g.treatmentLabel));
          const combinedALabels = uniq(b.assessments.map(g => g.treatmentLabel));

          return (
            <section key={b.key} className="mt-7">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm font-bold text-[var(--teal-dark)] px-3 py-1 rounded-full bg-[var(--teal-pale)] border border-[var(--teal-mid)] whitespace-nowrap">
                  {b.label}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Standalone warnings for this domain (vision/hearing/suicidal/etc.) */}
              {b.standaloneWarnings.map((w, i) => (
                <div
                  key={`w-${i}`}
                  className={`mb-3 rounded-xl border p-4 text-sm leading-relaxed ${
                    w.urgent
                      ? "border-red-400 bg-red-50 text-red-900"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  {w.text}
                </div>
              ))}

              {/* Treatments */}
              {b.treatments.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)] mb-2 pr-1">💙 טיפולים מומלצים</div>
                  {b.treatments.map((g, idx) => {
                    if (b.treatments.slice(0, idx).some(prev => hasSameSymptoms(prev, g))) return null;
                    const explainKey = `${b.key}::${g.treatmentKey}`;
                    const siblings = b.treatments.slice(idx + 1).filter(s => hasSameSymptoms(g, s));
                    return (
                      <GroupCard
                        key={g.recs[0].id}
                        group={g}
                        onSelect={() => selectGroup(b.key, g)}
                        selected={
                          selectedKey === `${b.key}::${g.kind}::${g.treatmentKey}` ||
                          siblings.some(s => selectedKey === `${b.key}::${s.kind}::${s.treatmentKey}`)
                        }
                        onExplain={() => fetchRecExplain(b.key, b.label, g)}
                        explanation={recExplain[explainKey]}
                        explanationLoading={recExplainLoading[explainKey]}
                        siblings={siblings.length > 0 ? siblings : undefined}
                        onSelectSiblings={siblings.length > 0 ? siblings.map(s => () => selectGroup(b.key, s)) : undefined}
                      />
                    );
                  })}
                  {showCombinedT && (
                    <button
                      type="button"
                      onClick={() => selectCombined(b.key, "treatment")}
                      className={`mt-2 w-full rounded-2xl p-4 text-right transition hover:opacity-95 ${
                        selectedKey === `${b.key}::__combined::treatment` ? "ring-2 ring-offset-2 ring-[var(--teal-dark)]" : ""
                      }`}
                      style={{ background: "linear-gradient(120deg, var(--teal-dark), var(--teal))", border: "1px solid #5AADAB" }}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-[#C2DFDE] mb-1">חיפוש מתקדם ✦</div>
                      <div className="font-bold text-sm text-white">חפש/י מטפל/ת שמשלב כמה גישות ←</div>
                      <div className="mt-1 text-xs text-white/75">{combinedTLabels.join(" · ")}</div>
                    </button>
                  )}
                </div>
              )}

              {/* Assessments */}
              {b.assessments.length > 0 && (
                <div className={b.treatments.length > 0 ? "mt-5" : ""}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-purple-600 mb-2 pr-1">🔎 אבחונים מומלצים</div>
                  {b.assessments.map((g, idx) => {
                    if (b.assessments.slice(0, idx).some(prev => hasSameSymptoms(prev, g))) return null;
                    const explainKey = `${b.key}::${g.treatmentKey}`;
                    const siblings = b.assessments.slice(idx + 1).filter(s => hasSameSymptoms(g, s));
                    return (
                      <GroupCard
                        key={g.recs[0].id}
                        group={g}
                        onSelect={() => selectGroup(b.key, g)}
                        selected={
                          selectedKey === `${b.key}::${g.kind}::${g.treatmentKey}` ||
                          siblings.some(s => selectedKey === `${b.key}::${s.kind}::${s.treatmentKey}`)
                        }
                        onExplain={() => fetchRecExplain(b.key, b.label, g)}
                        explanation={recExplain[explainKey]}
                        explanationLoading={recExplainLoading[explainKey]}
                        siblings={siblings.length > 0 ? siblings : undefined}
                        onSelectSiblings={siblings.length > 0 ? siblings.map(s => () => selectGroup(b.key, s)) : undefined}
                      />
                    );
                  })}
                  {showCombinedA && (
                    <button
                      type="button"
                      onClick={() => selectCombined(b.key, "assessment")}
                      className={`mt-2 w-full rounded-2xl bg-purple-700 p-4 text-right transition hover:bg-purple-800 ${
                        selectedKey === `${b.key}::__combined::assessment` ? "ring-2 ring-offset-2 ring-purple-700" : ""
                      }`}
                    >
                      <div className="text-xs font-bold uppercase tracking-wider text-purple-200 mb-1">חיפוש מתקדם ✦</div>
                      <div className="font-bold text-sm text-white">חפש/י מאבחן/ת שמשלב כמה אבחונים ←</div>
                      <div className="mt-1 text-xs text-white/75">{combinedALabels.join(" · ")}</div>
                    </button>
                  )}
                </div>
              )}

              {/* Professionals - hard-filtered search by therapist type */}
              {b.professionals.length > 0 && (
                <div className={b.treatments.length > 0 || b.assessments.length > 0 ? "mt-5" : ""}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2 pr-1">👩‍⚕️ אנשי מקצוע מומלצים</div>
                  {b.professionals.map((g, idx) => {
                    if (b.professionals.slice(0, idx).some(prev => hasSameSymptoms(prev, g))) return null;
                    const explainKey = `${b.key}::${g.treatmentKey}`;
                    const siblings = b.professionals.slice(idx + 1).filter(s => hasSameSymptoms(g, s));
                    return (
                      <GroupCard
                        key={g.recs[0].id}
                        group={g}
                        onSelect={() => selectGroup(b.key, g)}
                        selected={
                          selectedKey === `${b.key}::${g.kind}::${g.treatmentKey}` ||
                          siblings.some(s => selectedKey === `${b.key}::${s.kind}::${s.treatmentKey}`)
                        }
                        onExplain={() => fetchRecExplain(b.key, b.label, g)}
                        explanation={recExplain[explainKey]}
                        explanationLoading={recExplainLoading[explainKey]}
                        siblings={siblings.length > 0 ? siblings : undefined}
                        onSelectSiblings={siblings.length > 0 ? siblings.map(s => () => selectGroup(b.key, s)) : undefined}
                      />
                    );
                  })}
                </div>
              )}

              {/* Externals - no search button */}
              {b.externals.length > 0 && (
                <div className={b.treatments.length > 0 || b.assessments.length > 0 || b.professionals.length > 0 ? "mt-5" : ""}>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2 pr-1">🩺 פניות נוספות</div>
                  <p className="text-xs text-gray-500 mb-2 px-1">פניות לאנשי מקצוע שאינם נכללים במערכת ההתאמה - יש לפנות אליהם בנפרד.</p>
                  {b.externals.map(g => (
                    <GroupCard
                      key={g.recs[0].id}
                      group={g}
                      onSelect={null}
                      selected={false}
                    />
                  ))}
                </div>
              )}

              {/* Informational symptoms (no actionable referral) */}
              {b.informational.length > 0 && (
                <div className={b.treatments.length > 0 || b.assessments.length > 0 || b.externals.length > 0 ? "mt-5" : ""}>
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 pr-1">📊 ממצאים נוספים</div>
                  {b.informational.map(g => (
                    <GroupCard
                      key={g.recs[0].id}
                      group={g}
                      onSelect={null}
                      selected={false}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* Cross-domain notes */}
        {allExternalNotes.length > 0 && (
          <div className="mt-6 space-y-2">
            {allExternalNotes.map((n, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-700 whitespace-pre-line">
                {renderWithLinks(n)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Matching now lives on its own screen (view === "match"), so nothing is
          appended here. Keeping it out of the report also keeps the PDF capture
          to the findings, which is what parents actually save. */}

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs leading-6 text-stone-500">
        התוצאות מבוססות על תשובותיך לשאלון ומהוות הערכה כללית בלבד.<br />
        אין לראות בתוצאות אלו אבחון, המלצה טיפולית מחייבת או תחליף לייעוץ מקצועי.<br />
        מומלץ לפנות לאיש מקצוע מוסמך לצורך הערכה מלאה.
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-3 justify-end print:hidden" data-html2canvas-ignore="true">
        <button
          onClick={() => downloadResultsPDF("kids-results-card", "תוצאות-השאלון-ילדים", "#ffffff")}
          data-pdf-trigger="kids-results-card"
          className="px-5 py-2 rounded-xl border-2 border-[var(--teal)] text-[var(--teal)] text-sm font-semibold hover:bg-[var(--teal)] hover:text-white transition-all disabled:opacity-60"
        >
          💾 שמירה כ-PDF
        </button>
        <button
          onClick={onRestart}
          className="px-5 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all"
        >
          ← שאלון חדש
        </button>
      </div>

      {/* Anonymous feedback - why did you stop / what was unclear */}
      <div className="print:hidden" data-html2canvas-ignore="true">
        <QuizFeedbackBox quizType="kids" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function KidsPage() {
  const [step, setStep] = useState<string>("p-consent");
  const [A, setA]       = useState<Ans>({});
  const [usageAllowed, setUsageAllowed] = useState<boolean | null>(null);
  const [paymentRequired, setPaymentRequired] = useState(false);

  useEffect(() => {
    const idx = PAGES.indexOf(step as typeof PAGES[number]);
    const pct = idx >= 0 ? Math.round(((idx + 1) / PAGES.length) * 100) : 0;
    (window as any).gtag?.("event", "quiz_step", { quiz_type: "kids", step, progress: pct });
    trackQuizStep("kids", step, pct);
  }, [step]);

  // Reset scroll to the top on every step change. Without this, advancing from a
  // scrolled-down (tall) page on mobile leaves the next page scrolled to the
  // bottom, with the question off-screen. behavior:"instant" overrides the
  // global scroll-behavior:smooth so there's no visible scroll animation.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [step]);
  const [kidsItems, setKidsItems] = useState<Record<string, any[]> | null>(null);
  const [kidsScore, setKidsScore] = useState<KidsScoreResult | null>(null);
  const [itemsError, setItemsError] = useState(false);
  const [scoreError, setScoreError] = useState(false);

  function fetchKidsItems() {
    setItemsError(false);
    fetch(`/api/questionnaire/kids/questions?v=${QUESTIONNAIRE_ITEMS_VERSION}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setKidsItems)
      .catch(() => setItemsError(true));
  }

  useEffect(() => { fetchKidsItems(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Staff bypass token - validated server-side; not shipped in the bundle.
    const staffParam = params.get("staff");
    if (staffParam) localStorage.setItem("staff_token", staffParam);
    if (localStorage.getItem("staff_token")) { setUsageAllowed(true); return; }
    getFingerprint()
      .then(fp => fetch(`/api/usage/check?type=kids&fp=${fp}`))
      .then(r => r.json())
      .then(d => setUsageAllowed(d.allowed))
      .catch(() => setUsageAllowed(true));
  }, []);

  // Restore the kids questionnaire state when the user navigates back from a therapist profile.
  // Gated on referrer so a fresh /kids visit always starts at the consent step.
  useEffect(() => {
    try {
      const referrer = document.referrer || "";
      const cameFromProfile = /\/therapists\/[^/]+/.test(referrer);
      // בניווט "אחורה" אמיתי (בלי bfcache) הרפרר נשאר המקורי - לא הפרופיל -
      // ולכן בודקים גם את סוג הניווט, אחרת המשתמש נזרק לתחילת השאלון.
      const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
      if (!cameFromProfile && navType !== "back_forward") return;
      const raw = sessionStorage.getItem("kids_state_v1");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.ts !== "number") return;
      if (Date.now() - saved.ts > 60 * 60_000) return;
      if (saved.A) setA(saved.A);
      if (saved.step) setStep(saved.step);
      if (saved.kidsScore) setKidsScore(saved.kidsScore);
    } catch {}
  }, []);

  // Persist state so back-navigation from a profile page restores the results screen.
  useEffect(() => {
    if (step !== "p-result") return;
    try {
      sessionStorage.setItem("kids_state_v1", JSON.stringify({
        ts: Date.now(),
        step,
        A,
        kidsScore,
      }));
    } catch {}
  }, [step, A, kidsScore]);

  useEffect(() => {
    if (step === "p-result") {
      // trackQuizComplete already reports quiz_complete to GA4 - the inline
      // "quiz_completed" duplicate (a second GA4 name for the same action) is gone.
      //
      // Fires here, before scoring, deliberately: the kids funnel has always
      // counted "reached the result screen" as a completion, and moving it into
      // the success path would silently redefine the metric mid-series and put
      // a step in the admin's monthly chart that no one could explain later.
      // The cost is that the domain profile is not available yet, so kids
      // events carry the demographic facts only - the treatment side of the
      // question is answered by the adults flow, which scores before it fires.
      trackQuizComplete("kids", {
        issue: "child",
        age_band: "child",
        gender: A.gender === "זכר" ? "m" : A.gender === "נקבה" ? "f" : null,
      });
      fetchScore(A);
    }
  }, [step]);

  // Scoring consumes one free-tier credit server-side and refuses (402) once
  // the limit is reached, so the result itself is gated - not just the UI.
  async function fetchScore(answers: Ans) {
    setScoreError(false);
    setKidsScore(null);
    const fp = await getFingerprint().catch(() => null);
    const staffToken = localStorage.getItem("staff_token") || undefined;
    try {
      const r = await fetch("/api/questionnaire/kids/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...answers, _fp: fp, _staffToken: staffToken }),
      });
      if (r.status === 402) { setPaymentRequired(true); return; }
      if (!r.ok) throw new Error();
      const d = await r.json();
      if (d.ok) setKidsScore({
        emotional: d.emotional,
        academic: d.academic,
        developmental: d.developmental,
        behavioral: d.behavioral,
        social: d.social,
      }); else throw new Error();
    } catch {
      setScoreError(true);
    }
  }

  // ההיסטוריה מנוהלת בדפדפן (useScreenHistory): עד 21/8/2026 מעבר שאלה לא
  // נגע בהיסטוריה, ולכן "חזור" של הדפדפן עזב את השאלון וקפץ לדף הבית עם כל
  // התשובות. כאן די בשחזור step - prevPid/nextPid גוזרים את ההסתעפות
  // מהתשובות עצמן, שאינן משתנות בניווט.
  const [canGoBack, setCanGoBack] = useState(false);
  const { pushScreen, goBack: browserBack } = useScreenHistory(
    { step },
    (snap: { step: PageId | string }) => {
      setStep(snap.step as typeof step);
      setCanGoBack(snap.step !== PAGES[0]);
    },
  );

  // Refresh/close guard for the question screens. Answers deliberately live in
  // memory only - nothing mid-quiz is persisted, so the branching and scoring
  // cannot be replayed step by step from a saved state - which means leaving
  // the page really does discard everything. The browser's native confirm is
  // the whole protection. Off at the consent screen and at the report, whose
  // own back-from-profile restore is handled separately.
  // The payment block replaces the whole page while `step` still names a
  // question screen, so the guard has to know about it too - otherwise someone
  // who hit the paywall gets warned about losing answers they cannot submit.
  useEffect(() => {
    const onPaywall = paymentRequired || (usageAllowed === false && step !== "p-result");
    const guarded = !onPaywall && step !== "p-consent" && step !== "p-result";
    if (!guarded) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step, paymentRequired, usageAllowed]);

  function goNext(newA: Ans = A) {
    setA(newA);
    pushScreen();
    setStep(s => nextPid(s, newA));
    setCanGoBack(true);
  }
  // כפתור החזרה שבעמוד וכפתור הדפדפן הם אותו מסלול, כדי שלא ייפרדו.
  function goBack() {
    browserBack();
  }

  const progress = Math.round(((PAGES.indexOf(step as PageId) + 1) / PAGES.length) * 100);
  const pageProps = { A, setA, onNext: goNext, onBack: canGoBack ? goBack : undefined, items: kidsItems };

  // paymentRequired is set when the server refused to score (limit reached) -
  // blocks the result too, unlike the pre-quiz usageAllowed gate below.
  if (paymentRequired || (usageAllowed === false && step !== "p-result")) return (
    <main className="quiz-shell min-h-screen mx-auto max-w-2xl px-4 py-8 pb-20" style={{ background: "var(--surface)" }} dir="rtl">
      <QuizPaymentBlock quizType="kids" />
    </main>
  );

  if (itemsError) return (
    <main className="quiz-shell min-h-screen mx-auto max-w-2xl px-4 py-8 pb-20" style={{ background: "var(--surface)" }} dir="rtl">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: "var(--text)" }}>לא ניתן לטעון את השאלון</h2>
        <p className="mb-6 max-w-sm" style={{ color: "var(--muted)" }}>בדוק את חיבור האינטרנט ונסה שוב.</p>
        <button
          onClick={fetchKidsItems}
          style={{ background: "var(--teal)", borderRadius: "50px", padding: "12px 24px", color: "white", fontWeight: 700, border: "none", cursor: "pointer" }}
        >נסה שוב</button>
      </div>
    </main>
  );

  // Every item-driven screen reads `items?.xx ?? []`, so before the fetch
  // resolves they rendered their heading ("10 סעיפים…") over an empty box with
  // a live Continue: a parent on a slow connection could walk the whole
  // questionnaire and be scored all-negative. The consent and result screens
  // need no items and are exempt - consent is where most of the dropout is, and
  // it must never wait on a network round-trip. A failed fetch is handled by
  // itemsError above, so this cannot become a permanent spinner.
  if (!kidsItems && step !== "p-consent" && step !== "p-result") return (
    <main className="quiz-shell min-h-screen mx-auto max-w-2xl px-4 py-8 pb-20" style={{ background: "var(--surface)" }} dir="rtl">
      <div className="flex justify-center py-20" style={{ color: "var(--muted)" }}>טוען שאלון…</div>
    </main>
  );

  return (
    <main className="quiz-shell min-h-screen mx-auto max-w-2xl px-4 py-8 pb-20" style={{ background: "var(--surface)" }} dir="rtl">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          {step === "p-consent" ? (
            <div className="w-full text-center mb-1">
              <img src="/logo-temp.png" alt="טיפול חכם" style={{ height: "52px", width: "auto", margin: "0 auto 8px", display: "block" }} />
              <p className="text-sm" style={{ color: "var(--muted)" }}>שאלון הפניה לטיפול - ילדים ונוער</p>
            </div>
          ) : (
            <>
              <span className="text-xl font-extrabold" style={{ color: "var(--teal)" }}>טיפול חכם</span>
              {step !== "p-result" && (
                <span className="text-xs px-3 py-1 rounded-full" style={{ color: "var(--muted)", background: "var(--surface-2)" }}>שאלון ילדים / מתבגרים</span>
              )}
            </>
          )}
        </div>
        {step !== "p-consent" && step !== "p-result" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#6b7280]">{progress}% הושלם</span>
              {progress > 5 && (
                <span className="text-xs font-semibold text-[var(--teal)] animate-pulse">
                  {progress <= 25 ? "יופי, ממשיכים! 💪"
                    : progress <= 45 ? "באמצע הדרך, כל הכבוד!"
                    : progress <= 65 ? "יותר ממחצית מאחוריך!"
                    : progress <= 80 ? "כמעט שם, עוד קצת!"
                    : progress <= 92 ? "עוד מעט סיימת! 🎉"
                    : "שאלה אחרונה! 🏁"}
                </span>
              )}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--teal), var(--teal-dark))" }} />
            </div>
          </div>
        )}
      </header>

      {/* Routing */}
      {step === "p-consent"   && <Card><PageConsent onNext={()=>goNext()} /></Card>}
      {step === "p-demo"      && <PageDemo    {...pageProps} />}
      {step === "p-areas"     && <PageAreas   {...pageProps} />}
      {step === "p-q1"        && <PageQ1      {...pageProps} />}
      {step === "p-q1-pain"   && <PageQ1Pain  {...pageProps} />}
      {step === "p-aq"        && <PageAQ      {...pageProps} />}
      {step === "p-q2"        && <PageQ2      {...pageProps} />}
      {step === "p-q3"        && <PageQ3      {...pageProps} />}
      {step === "p-mq"        && <PageMQ      {...pageProps} />}
      {step === "p-mq-sui"    && <PageMQSui   {...pageProps} />}
      {step === "p-q4"        && <PageQ4      {...pageProps} />}
      {step === "p-q4-types"  && <PageQ4Types {...pageProps} />}
      {step === "p-q4-s"      && <PageQ4S     {...pageProps} />}
      {step === "p-q4-g"      && <PageQ4G     {...pageProps} />}
      {step === "p-q4-b"      && <PageQ4B     {...pageProps} />}
      {step === "p-q4-ctrl"   && <PageQ4Ctrl  {...pageProps} />}
      {step === "p-q5"         && <PageQ5       {...pageProps} />}
      {step === "p-oq"          && <PageOQ       {...pageProps} />}
      {step === "p-q6"          && <PageQ6       {...pageProps} />}
      {step === "p-tq"          && <PageTQ       {...pageProps} />}
      {step === "p-q7"          && <PageQ7       {...pageProps} />}
      {step === "p-pq"          && <PagePQ       {...pageProps} />}
      {step === "p-q8"          && <PageQ8       {...pageProps} />}
      {step === "p-eq"          && <PageEQ       {...pageProps} />}
      {step === "p-q9"          && <PageQ9       {...pageProps} />}
      {step === "p-bq"          && <PageBQ       {...pageProps} />}
      {step === "p-q9-adhd"     && <PageQ9Adhd   {...pageProps} />}
      {step === "p-q10"         && <PageQ10      {...pageProps} />}
      {step === "p-q10-par"     && <PageQ10Par   {...pageProps} />}
      {step === "p-acad"         && <PageAcad      {...pageProps} />}
      {step === "p-dev-toilet"   && <PageDevToilet  {...pageProps} />}
      {step === "p-dev-sensory"  && <PageDevSensory {...pageProps} />}
      {step === "p-beh"          && <PageBeh        {...pageProps} />}
      {step === "p-soc"          && <PageSoc        {...pageProps} />}
      {step === "p-traits"       && <PageTraits     {...pageProps} />}

      {step === "p-result" && <PageResult A={A} score={kidsScore} scoreError={scoreError} onRetryScore={()=>fetchScore(A)} onRestart={()=>{ setA({}); setStep("p-consent"); setKidsScore(null); }} />}
    </main>
  );
}
