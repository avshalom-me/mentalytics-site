/**
 * The counsellor rubric on top of the kids questionnaire: the extra answer keys
 * (all prefixed c_), their labels, the conversion into the tracks engine's
 * input, and the summary a counsellor pastes into her referral document.
 *
 * The clinical answers are the kids questionnaire's own and are scored by its
 * engine; nothing here touches them. This file only knows the counsellor's
 * angle - what the school sees that home does not, what was tried, what the
 * file already holds - and none of it is free text, which is how the rubric
 * stays anonymous by construction rather than by warning.
 */

import { unknownCount } from "../kids/quiz-logic";
import type { KidsDomainResult } from "./kids-recommendations";
import {
  DIAGNOSIS_KINDS,
  SCHOOL_GRADES,
  formatDateHe,
  hatamotApplies,
  type Diagnosis,
  type DiagnosisKind,
  type EligibilityDirection,
  type SchoolGrade,
  type SchoolTrack,
  type SchoolTracksInput,
} from "./school-tracks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ans = Record<string, any>;

/**
 * "לא יודע/ת" on a counsellor's own observation.
 *
 * Different from the emotional items' "לא ידוע / לא רלוונטי", which stores a
 * real "no" because the scoring sums those against thresholds. Nothing scores
 * these fields, so here not knowing simply means the question was not answered:
 * it is left out of the summary and out of the tracks engine, rather than being
 * reported as an absence of difficulty.
 */
export const UNKNOWN = "unknown";
export type Unknown = typeof UNKNOWN;

export type FillMode = "counselor_alone" | "with_parent" | "phone_parent";
export type Parents = "aware_consent" | "aware_no_consent" | "not_aware";
export type Duration = "this_year" | "over_year" | "years";
/** כלל לא / מעט / הרבה / הרבה מאוד - the four-point scale the questionnaire uses for its areas. */
export type Level = 0 | 1 | 2 | 3;
export type Outcome = "helped" | "partial" | "no_help";

/**
 * What the school already put in front of the difficulty, across every rubric.
 *
 * Remedial teaching used to sit here too and was moved into ACA_STEPS: it is
 * the first rung of the learning ladder, and a counsellor was answering the
 * same question twice on two different screens.
 *
 * Split into two kinds because a committee expects both. One attempt at
 * treating the child and one at changing what the system around them does is
 * the floor under any referral - see missingAttempts.
 */
export const INTERVENTIONS = [
  { key: "talks", label: "שיחות פרטניות עם מחנכ/ת או יועצת", kind: "system" },
  { key: "plan", label: "תוכנית התנהגותית או רגשית בית-ספרית", kind: "system" },
  { key: "tachi", label: "תוכנית אישית (תח\"י)", kind: "system" },
  { key: "parents", label: "תיווך ושיחות עם ההורים", kind: "system" },
  { key: "therapy_school", label: "טיפול רגשי בבית הספר (סל שילוב, טיפול באמנויות)", kind: "treatment" },
  { key: "shach", label: "מעורבות שפ\"ח או פסיכולוג/ית בית הספר", kind: "treatment" },
  { key: "external", label: "הפניה קודמת לגורם חוץ", kind: "treatment" },
] as const;
export type InterventionKey = (typeof INTERVENTIONS)[number]["key"];
export type AttemptKind = "treatment" | "system";
export const ATTEMPT_LABELS: Record<AttemptKind, string> = {
  treatment: "ניסיון טיפולי אחד (טיפול רגשי בבית הספר, מעורבות שפ\"ח או פסיכולוג/ית, או הפניה לגורם חוץ)",
  system: "התערבות מערכתית אחת (שיחות פרטניות, תוכנית התנהגותית או רגשית, תוכנית אישית, או עבודה עם ההורים)",
};

/**
 * מיצוי אפשרויות - what the school already put in front of a learning
 * difficulty before anyone says the word "committee".
 *
 * The two core rows are the school's own to give and a committee expects to
 * see them tried; the three below them are only asked about because a
 * counsellor knows whether they were called for at all, which is why each can
 * be answered "לא נדרש" without counting against anything.
 *
 * Separate from INTERVENTIONS on purpose. That list is the whole school file,
 * across every rubric, and it is what the summary reports as "סיכום
 * התערבויות"; this one is the learning ladder specifically, and it is the
 * thing that decides whether an eligibility route opens at all.
 */
export const ACA_STEPS = [
  { key: "remedial", label: "הוראה מתקנת או תגבור לימודי", core: true },
  { key: "inclusion", label: "תמיכה מסל השילוב", core: true },
  { key: "speech", label: "קלינאי/ת תקשורת", core: false },
  { key: "ot", label: "ריפוי בעיסוק", core: false },
  { key: "adhd_doc", label: "בירור קשב אצל רופא/ה", core: false },
] as const;
export type AcaStepKey = (typeof ACA_STEPS)[number]["key"];
export type AcaStepState = "done" | "in_progress" | "not_needed" | "not_done";
export const ACA_STEP_LABELS: Record<AcaStepState, string> = {
  done: "נעשה", in_progress: "בתהליך", not_needed: "לא נדרש", not_done: "טרם נעשה",
};

/** The keys the counsellor screens write into the questionnaire's answers. */
export interface CounselorFields {
  _audience?: "parent" | "counselor";
  _age?: string;
  _grade?: SchoolGrade;
  c_duration?: Duration;
  // in the emotional branch (p-q1)
  c_attend?: "regular" | "some" | "frequent" | "refusal" | Unknown;
  c_change?: "כן" | "לא" | Unknown;
  // in the academic branch (p-acad)
  c_support?: "improves" | "partial" | "none" | "not_given" | Unknown;
  c_org?: Level | Unknown;
  // in the behavioural branch (p-beh)
  c_regulation?: Level | Unknown;
  c_bully_perp?: "no" | "suspected" | "known" | Unknown;
  // in the social branch (p-soc)
  c_isolation?: Level | Unknown;
  c_bully_victim?: "no" | "suspected" | "known" | Unknown;
  // the refinement screen (p-refine)
  c_fill?: FillMode;
  c_parents?: Parents;
  c_tried?: Partial<Record<InterventionKey, Outcome>>;
  /** מיצוי אפשרויות, asked inside the academic branch. See ACA_STEPS. */
  c_aca_steps?: Partial<Record<AcaStepKey, AcaStepState>>;
  c_diag?: Diagnosis[];
  c_team?: "yes" | "no" | "unknown";
  c_zakaut?: "none" | "in_process" | "decided";
  c_zakaut_on?: string;
  c_hatamot?: "none" | "school_level" | "district_submitted" | "district_decided";
  c_hatamot_on?: string;
  c_economic?: "no" | "yes" | "unknown";
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const FILL_MODE_LABELS: Record<FillMode, string> = {
  counselor_alone: "מילוי עצמאי, ללא ההורים", with_parent: "מילוי יחד עם ההורים", phone_parent: "מילוי בשיחת טלפון עם הורה",
};
export const PARENTS_LABELS: Record<Parents, string> = {
  aware_consent: "ההורים מודעים לפנייה והסכימו לתהליך",
  aware_no_consent: "ההורים מודעים, טרם התקבלה הסכמה",
  not_aware: "ההורים טרם יודעו",
};
export const DURATION_LABELS: Record<Duration, string> = { this_year: "מהשנה", over_year: "מעל שנה", years: "מספר שנים" };
export const LEVEL_LABELS = ["כלל לא", "מעט", "הרבה", "הרבה מאוד"] as const;
export const ATTEND_LABELS = {
  regular: "סדיר", some: "היעדרויות או איחורים מדי פעם", frequent: "היעדרויות תכופות", refusal: "סרבנות בית ספר",
} as const;
export const YN_LABELS = { "כן": "כן", "לא": "לא" } as const;
export const SUPPORT_RESPONSE_LABELS = {
  improves: "משתפר/ת", partial: "שיפור חלקי", none: "ללא שיפור", not_given: "לא ניתנה תמיכה",
} as const;
export const BULLY_LABELS = { no: "לא", suspected: "חשד", known: "ידוע" } as const;
export const OUTCOME_LABELS: Record<Outcome, string> = { helped: "הועיל", partial: "הועיל חלקית", no_help: "לא הועיל" };
export const TEAM_LABELS = { yes: "התכנס", no: "לא התכנס", unknown: "לא ידוע" } as const;
export const ZAKAUT_LABELS = { none: "לא הופנה/תה", in_process: "בתהליך", decided: "התקבלה החלטה" } as const;
export const HATAMOT_LABELS = {
  none: "לא נדון", school_level: "אושרו התאמות בסמכות בית הספר", district_submitted: "הוגש לוועדה המחוזית", district_decided: "התקבלה תשובת הוועדה המחוזית",
} as const;
export const YES_NO_UNKNOWN_LABELS = { no: "לא", yes: "כן", unknown: "לא ידוע" } as const;

/** What a counsellor may say the student already has - the questionnaire's own keys, minus the two with no school meaning. */
export const SCHOOL_DIAGNOSIS_KINDS: DiagnosisKind[] = DIAGNOSIS_KINDS.filter(k => k !== "אבחון תעסוקתי" && k !== "הערכת בשלות לגן");

export const DIAGNOSIS_KIND_LABELS: Record<DiagnosisKind, string> = {
  "פסיכו-דידקטי": "אבחון פסיכו-דידקטי",
  "פסיכו-דיאגנוסטי": "אבחון פסיכו-דיאגנוסטי",
  "נוירו-פסיכולוגי": "אבחון נוירו-פסיכולוגי",
  "אבחון תעסוקתי": "אבחון תעסוקתי",
  "הערכה פסיכולוגית": "הערכה פסיכולוגית",
  "הערכת בשלות לגן": "הערכת בשלות לגן",
  "אבחון קשיי תקשורת ASD": "אבחון תקשורת / ASD",
  "נוירולוג קשב": "אבחנה של נוירולוג/ית ילדים (קשב)",
  "פסיכיאטר ילדים": "אבחנה של פסיכיאטר/ית ילדים ונוער",
  "פסיכולוג חינוכי": "חוות דעת של פסיכולוג/ית חינוכי/ת או התפתחותי/ת",
  "פסיכולוג קליני": "חוות דעת של פסיכולוג/ית קליני/ת",
};

export const RELEVANCE_LABELS = { primary: "לטיפול עכשיו", consider: "לשיקול", info: "מידע" } as const;

export const KIND_LABELS = { treatment: "טיפול", assessment: "אבחון", professional: "איש מקצוע", external: "פנייה" } as const;

// ── Which eligibility route, if any ──────────────────────────────────────────

/** The four-point area flags the questionnaire opens each rubric with. */
const areaOn = (v: unknown, from: "מעט" | "הרבה" = "מעט") =>
  (from === "מעט" ? ["מעט", "הרבה", "הרבה מאוד"] : ["הרבה", "הרבה מאוד"]).includes(String(v ?? ""));

export const academicOn = (A: Ans) => areaOn(A.a_aca);

/**
 * True once the school has actually worked the learning difficulty: both of
 * its own steps taken, and nothing it said was needed still waiting.
 *
 * An unanswered optional row does not block - the counsellor simply did not
 * say - but one answered "טרם נעשה" does, which is the whole point: a
 * committee asked to look at a child whose attention was never checked is
 * being asked the wrong question.
 */
export function acaExhaustionAdequate(A: Ans): boolean {
  const s = (A as CounselorFields).c_aca_steps ?? {};
  return ACA_STEPS.filter(x => x.core).every(x => s[x.key] === "done") &&
    ACA_STEPS.filter(x => !x.core).every(x => s[x.key] !== "not_done");
}

/**
 * The class-percentile answers, by subject and by age band.
 *
 * The questionnaire words each option differently per band - "5% מהכי מתקשים
 * בכיתה", "5% מהכי נמוכים בכיתה", or a bare "5%" - so the leading token is
 * what is read, exactly as the scoring engine's own pctTier does.
 */
export const ACA_SUBJECTS = {
  read: ["ag_read", "dv_read", "zh_verbal", "tyb_verbal"],
  write: ["ag_write", "dv_write", "zh_write", "tyb_write"],
  math: ["ag_math", "dv_math", "zh_math", "tyb_math"],
  eng: ["zh_eng", "tyb_eng"],
} as const;
/** Comprehension is a yes/no in every band, never a percentile. */
const ACA_COMP = ["ag_comp", "dv_comp", "zh_comp", "tyb_comp"];

export type AcaTier = "5%" | "10%" | "20%" | "none";
const TIER_RANK: Record<AcaTier, number> = { "5%": 3, "10%": 2, "20%": 1, none: 0 };

export function acaTier(v: unknown): AcaTier {
  const t = String(v ?? "").trim();
  if (t.startsWith("5%")) return "5%";
  if (t.startsWith("10%")) return "10%";
  if (t.startsWith("20%")) return "20%";
  return "none";
}
export function subjectTier(A: Ans, subject: keyof typeof ACA_SUBJECTS): AcaTier {
  return ACA_SUBJECTS[subject].reduce<AcaTier>((best, k) => {
    const t = acaTier(A[k]);
    return TIER_RANK[t] > TIER_RANK[best] ? t : best;
  }, "none");
}

/**
 * Whether the learning profile is the kind a committee looks at.
 *
 * Reading is the anchor: at the bottom 5% it stands on its own. Any other
 * subject at 5% needs a second affected domain beside it, because the
 * disability the committee recognises is לקות למידה רב-בעייתית - multi-domain
 * by name. Reading at the 10% tier is that second domain.
 *
 * So is a reported comprehension difficulty, and that is the one judgement
 * here rather than a rule from the brief: comprehension is a yes/no and a
 * non-specific one - attention, language and hearing all produce it - so it
 * carries the weight of a second domain and never the weight of an anchor.
 * Flip COMP_COUNTS to false to require the reading tier alone.
 */
const COMP_COUNTS = true;
export function acaProfileQualifies(A: Ans): boolean {
  const read = subjectTier(A, "read");
  if (read === "5%") return true;
  const otherAt5 = (["write", "math", "eng"] as const).some(x => subjectTier(A, x) === "5%");
  if (!otherAt5) return false;
  return read === "10%" || (COMP_COUNTS && ACA_COMP.some(k => A[k] === "כן"));
}

/**
 * The severity that makes the psychiatric route (57) a question at all.
 *
 * 55 and 57 are different disabilities with different admissible diagnosers -
 * a school psychologist's opinion answers 55 and answers nothing at all for
 * 57, which only a child and adolescent psychiatrist can sign. So 57 is raised
 * only where the questionnaire found what it is for: suicidality, psychotic
 * features, a mood finding, or anxiety at the engine's own high tier.
 */
export function psychiatricSeverity(A: Ans): boolean {
  return A.q3_sui === "כן"
    || A.q7a === "כן" || A.q7b === "כן"
    || (A.aq_tot || 0) > 20
    || ((A.q3 || 0) >= 3 && (A.mq_tot || 0) >= 4);
}

/**
 * The floor under any committee referral: one attempt at treating the child
 * and one at changing what the system around them does.
 *
 * On the learning route the ladder's own two core rungs are that treatment -
 * remedial teaching and inclusion support are what treating a learning
 * difficulty in a school looks like - so asking for school counselling on top
 * of them would block a route the ladder has already earned.
 */
export function missingAttempts(A: Ans, candidates: EligibilityDirection[]): AttemptKind[] {
  const f = A as CounselorFields;
  const tried = f.c_tried ?? {};
  const out: AttemptKind[] = [];
  const ladderDone = candidates.includes("learning") &&
    ACA_STEPS.filter(x => x.core).every(x => f.c_aca_steps?.[x.key] === "done");
  if (!INTERVENTIONS.some(i => i.kind === "treatment" && tried[i.key]) && !ladderDone) out.push("treatment");
  if (!INTERVENTIONS.some(i => i.kind === "system" && tried[i.key])) out.push("system");
  return out;
}

export function exhaustionMessage(missing: AttemptKind[]): string {
  return `מומלץ להשלים ${missing.map(m => ATTEMPT_LABELS[m]).join(" ו")} כדי לסיים מיצוי אפשרויות, ולאחר מכן מומלץ לשקול פנייה לוועדת זכאות ואפיון.`;
}

export interface RouteState {
  /** Routes the map may name. */
  live: EligibilityDirection[];
  /** Routes the findings support, waiting only on the attempts below. */
  pending: EligibilityDirection[];
  missing: AttemptKind[];
}

/**
 * Which route to ועדת זכאות ואפיון the questionnaire's own rubrics opened.
 *
 * Emotional: the rubric was marked as a real difficulty, which is the finding
 * codes 55 and 57 are about. Learning: not on the difficulty alone, but only
 * once the school has exhausted what it can give AND one subject sits in the
 * bottom 5% of the class - a committee is the end of that ladder, not its
 * first rung.
 *
 * Social and behavioural are deliberately absent. They lead to treatment and
 * to the school's own team, and the map says nothing about committees for
 * them.
 *
 * Read from the raw answers rather than from the scored findings so that the
 * refinement screen, which runs before scoring, asks exactly the questions the
 * report will use.
 */
export function eligibilityRoutes(A: Ans): RouteState {
  const candidates: EligibilityDirection[] = [];
  if (areaOn(A.a_emo, "הרבה")) candidates.push("emotional");
  // Not gated on the area level: suicidality and psychotic features are the
  // finding whatever was ticked on the opening screen.
  if (areaOn(A.a_emo) && psychiatricSeverity(A)) candidates.push("psychiatric");
  if (academicOn(A) && acaExhaustionAdequate(A) && acaProfileQualifies(A)) candidates.push("learning");
  if (!candidates.length) return { live: [], pending: [], missing: [] };
  const missing = missingAttempts(A, candidates);
  return missing.length
    ? { live: [], pending: candidates, missing }
    : { live: candidates, pending: [], missing: [] };
}

export function eligibilityDirections(A: Ans): EligibilityDirection[] {
  return eligibilityRoutes(A).live;
}

// ── What the school can do with what it reported ─────────────────────────────

/**
 * Two lines of practical guidance beside each school observation.
 *
 * These answers used to produce a line of prose in the summary and nothing
 * else: the rubrics they belong to lead to treatment and to the school's own
 * team, never to a committee, so nothing downstream read them. A counsellor
 * who reports weekly dysregulation should get something back for it.
 *
 * Conventional school practice, not a protocol - phrased as what tends to help
 * rather than as what must be done, and always beside the referral rather than
 * instead of it.
 */
export const SCHOOL_TIPS: { key: string; title: string; when: (f: CounselorFields) => boolean; lines: [string, string] }[] = [
  {
    key: "regulation",
    title: "ויסות בכיתה ובהפסקות",
    when: f => typeof f.c_regulation === "number" && f.c_regulation >= 2,
    lines: [
      "כדאי לקבוע מראש סימן מוסכם ומקום יציאה מוסדר לרגיעה, ולהשתמש בו לפני שהעומס מגיע לשיא ולא כתגובה להתפרצות.",
      "תיעוד קצר של מה שקדם לאירועים החוזרים מגלה לרוב שעה, מקצוע או מעבר שחוזרים על עצמם, ומשם אפשר לשנות את הסידור ולא רק את התגובה.",
    ],
  },
  {
    key: "isolation",
    title: "בידוד או דחייה חברתית",
    when: f => typeof f.c_isolation === "number" && f.c_isolation >= 2,
    lines: [
      "עבודה בקבוצות קטנות שהמורה מרכיב/ה, ולא בבחירה חופשית, מורידה את החשיפה לדחייה ומייצרת הזדמנויות לקשר.",
      "כדאי לאתר תלמיד/ה אחד/ת שאיתו/ה יש בסיס לקשר ולבסס אותו לפני שמרחיבים לקבוצה - קשר אחד יציב מועיל יותר מניסיון לשלב בכיתה כולה.",
    ],
  },
  {
    key: "bully_victim",
    title: "נפגע/ת מהצקות או מחרם",
    when: f => f.c_bully_victim === "suspected" || f.c_bully_victim === "known",
    lines: [
      "הטיפול בהצקות הוא מערכתי ולא שיחה בין הנפגע/ת לפוגע/ת: תיעוד, יידוע ההורים, עבודה עם הכיתה ומעקב לאורך זמן.",
      "חשוב לוודא שהתלמיד/ה יודע/ת למי לפנות ומתי, ושהמענה אינו תלוי ביוזמה שלו/ה - מי שנפגע/ת לרוב מפסיק/ה לדווח.",
    ],
  },
  {
    key: "bully_perp",
    title: "מעורבות כפוגע/ת",
    when: f => f.c_bully_perp === "suspected" || f.c_bully_perp === "known",
    lines: [
      "עבודה עם הפוגע/ת מתמקדת באחריות ובתיקון ולא בענישה בלבד, לצד בירור מה מחזיק את ההתנהגות.",
      "כדאי לבדוק אם מדובר בקושי בוויסות, במאבק על מעמד חברתי, או בדפוס שנלמד מחוץ לבית הספר - לכל אחד מהם מענה אחר.",
    ],
  },
  {
    key: "org",
    title: "התארגנות",
    when: f => typeof f.c_org === "number" && f.c_org >= 2,
    lines: [
      "עזרים חיצוניים - צ'קליסט קבוע, צילום הלוח, תיק שנארז בבית הספר - עובדים טוב יותר מתזכורות מילוליות.",
      "כדאי שגורם אחד קבוע יבדוק את ההתארגנות בזמן קבוע ביום, ולא כל מורה בנפרד; העקביות היא מה שעושה את ההבדל.",
    ],
  },
];

/** When money is the constraint, the public route is named before the private one. */
export const ECONOMIC_NOTE =
  "קיימת מגבלה כלכלית מוכרת - מומלץ למצות אפשרויות ציבוריות (שפ\"ח, מרפאות בריאות הנפש, קופות החולים) לפני הפניה פרטית.";

// ── Engine input ─────────────────────────────────────────────────────────────

export function interventionsTried(A: Ans): number {
  return Object.values((A.c_tried ?? {}) as Record<string, Outcome | undefined>).filter(Boolean).length;
}

export function isSchoolGrade(g: unknown): g is SchoolGrade {
  return typeof g === "string" && (SCHOOL_GRADES as readonly string[]).includes(g);
}

export function toTracksInput(A: Ans, today: string): SchoolTracksInput | null {
  const f = A as CounselorFields;
  if (!isSchoolGrade(f._grade)) return null;
  const routes = eligibilityRoutes(A);
  return {
    grade: f._grade,
    today,
    diagnoses: f.c_diag ?? [],
    // "not known" is not "did not convene" - the engine must see no answer.
    schoolTeam: f.c_team && f.c_team !== "unknown" ? { convened: f.c_team === "yes" } : undefined,
    zakaut: f.c_zakaut ? { status: f.c_zakaut, decisionReceivedOn: f.c_zakaut_on || undefined } : undefined,
    hatamot: f.c_hatamot ? { status: f.c_hatamot, districtAnswerReceivedOn: f.c_hatamot_on || undefined } : undefined,
    interventionsTried: interventionsTried(A),
    directions: routes.live,
    pendingDirections: routes.pending,
    exhaustionNote: routes.missing.length ? exhaustionMessage(routes.missing) : undefined,
    economicConstraint: f.c_economic === "yes",
    risk: {
      // Read from the questionnaire's own screen. An item the counsellor marked
      // "not known" stored "לא" there, so it never reads as a risk.
      suicidality: A.q3_sui === "כן",
      schoolRefusal: f.c_attend === "refusal",
    },
  };
}

// ── The summary a counsellor pastes ──────────────────────────────────────────

export interface SchoolSummary {
  /** Plain text with line breaks - what lands in a plain editor. */
  text: string;
  /** The same content as simple HTML - what lands in Word or Google Docs. */
  html: string;
  /**
   * The same content again, still structured.
   *
   * The PDF lays the report out itself - real pages, real margins, a heading
   * that cannot be cut in half by a page break - and to do that it needs the
   * parts, not a string it would have to parse back apart.
   */
  doc: SummaryDoc;
}

export interface SummaryDoc {
  head: string;
  meta: string;
  sections: Section[];
  foot: string;
}

export interface SummaryDomain { label: string; result: KidsDomainResult }

export type Section = { title: string; lines: string[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
const stripPrefix = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

function levelLine(label: string, v: Level | Unknown | undefined): string | null {
  return v === undefined || v === UNKNOWN || v === 0 ? null : `${label}: ${LEVEL_LABELS[v]}`;
}
/** A counsellor answer worth reporting: given, and not "I do not know". */
function said<T extends string>(v: T | Unknown | undefined, ...excluded: T[]): v is T {
  return v !== undefined && v !== UNKNOWN && !excluded.includes(v as T);
}

export function buildSchoolSummary(A: Ans, tracks: SchoolTrack[], today: string, domains: SummaryDomain[] = []): SchoolSummary {
  const f = A as CounselorFields;
  const sections: Section[] = [];

  // רקע
  const bg: string[] = [];
  if (f._grade) bg.push(`כיתה ${f._grade}${f._age ? `, גיל ${f._age}` : ""}`);
  if (f.c_duration) bg.push(`משך הקושי: ${DURATION_LABELS[f.c_duration]}`);
  if (f.c_parents) bg.push(PARENTS_LABELS[f.c_parents]);
  if (bg.length) sections.push({ title: "רקע", lines: bg });

  // ממצאי השאלון לפי תחום
  for (const d of domains) {
    const lines: string[] = [];
    const symptoms = uniq(d.result.groups.flatMap(g => g.recs.flatMap(r => r.symptoms))).map(stripPrefix).filter(Boolean);
    if (symptoms.length) lines.push(`ממצאים: ${symptoms.join("; ")}`);
    const referrals = uniq(
      d.result.groups
        // "Consult the school counsellor" is the engine talking to parents; in a
        // counsellor's own summary it is noise.
        .filter(g => g.treatmentKey !== "_no_action" && g.treatmentKey !== "יועצת בית ספר")
        .map(g => `${g.treatmentLabel} (${KIND_LABELS[g.kind]})${g.urgent ? " - דחוף" : ""}`),
    );
    if (referrals.length) lines.push(`הפניה מומלצת: ${referrals.join("; ")}`);
    for (const w of d.result.standaloneWarnings) lines.push(stripPrefix(w.text));
    if (lines.length) sections.push({ title: stripPrefix(d.label), lines });
  }

  // זווית בית הספר
  const school: string[] = [];
  if (said(f.c_attend, "regular")) school.push(`ביקור סדיר: ${ATTEND_LABELS[f.c_attend]}`);
  if (f.c_change === "כן") school.push("שינוי חד בהתנהגות או במצב הרוח השנה");
  const org = levelLine("קושי בהתארגנות (ציוד, שיעורי בית, זמנים)", f.c_org);
  if (org) school.push(org);
  if (said(f.c_support)) school.push(`תגובה לתמיכה לימודית שניתנה: ${SUPPORT_RESPONSE_LABELS[f.c_support]}`);
  const reg = levelLine("קושי בוויסות בכיתה ובהפסקות", f.c_regulation);
  if (reg) school.push(reg);
  if (said(f.c_bully_perp, "no")) school.push(`מעורבות כפוגע/ת בהצקות: ${BULLY_LABELS[f.c_bully_perp]}`);
  const iso = levelLine("בידוד או דחייה חברתית בכיתה", f.c_isolation);
  if (iso) school.push(iso);
  if (said(f.c_bully_victim, "no")) school.push(`נפגע/ת מהצקות או חרם: ${BULLY_LABELS[f.c_bully_victim]}`);
  if (A.q3_sui === "כן") school.push("דווח על מחשבות אובדניות - הדיווח לגורמים המוסמכים בבית הספר נעשה לפי הנוהל");
  if (school.length) sections.push({ title: "כפי שנצפה בבית הספר", lines: school });

  // התערבויות
  if (f.c_tried) {
    const tried: string[] = [];
    const notTried: string[] = [];
    for (const it of INTERVENTIONS) {
      const o = f.c_tried[it.key];
      if (o) tried.push(`${it.label}: ${OUTCOME_LABELS[o]}`);
      else notTried.push(it.label);
    }
    const lines = tried.length ? [...tried] : ["טרם נוסו התערבויות בית-ספריות"];
    if (tried.length && notTried.length) lines.push(`טרם נוסו: ${notTried.join(", ")}`);
    sections.push({ title: "התערבויות שנוסו בבית הספר", lines });
  }

  // כלים והכוונה
  const tips = SCHOOL_TIPS.filter(t => t.when(f));
  if (tips.length) {
    sections.push({
      title: "כלים והכוונה לצוות",
      lines: tips.flatMap(t => [`${t.title}: ${t.lines[0]}`, t.lines[1]]),
    });
  }

  // מיצוי אפשרויות בתחום הלימודי
  if (academicOn(A) && f.c_aca_steps) {
    const rows = ACA_STEPS.filter(x => f.c_aca_steps?.[x.key]).map(x => `${x.label}: ${ACA_STEP_LABELS[f.c_aca_steps![x.key]!]}`);
    if (rows.length) {
      if (!acaExhaustionAdequate(A)) rows.push("טרם מוצו כל האפשרויות הבית-ספריות");
      sections.push({ title: "מיצוי אפשרויות בתחום הלימודי", lines: rows });
    }
  }

  // אבחונים, ועדות, משפחה
  const docs: string[] = [];
  for (const d of f.c_diag ?? []) {
    docs.push(`${DIAGNOSIS_KIND_LABELS[d.kind]} (${d.year})${d.signedBy ? `, חתום/ה: ${d.signedBy}` : ""}`);
  }
  if (f.c_diag && !docs.length) docs.push("אין אבחונים או חוות דעת בתיק");
  if (f.c_team) docs.push(`צוות רב-מקצועי: ${TEAM_LABELS[f.c_team]}`);
  if (f.c_zakaut) docs.push(`ועדת זכאות ואפיון: ${ZAKAUT_LABELS[f.c_zakaut]}${f.c_zakaut === "decided" && f.c_zakaut_on ? ` (${formatDateHe(f.c_zakaut_on)})` : ""}`);
  // Not a word about matriculation accommodations before ח' - see hatamotApplies.
  if (f.c_hatamot && f._grade && hatamotApplies(f._grade)) docs.push(`התאמות בדרכי היבחנות: ${HATAMOT_LABELS[f.c_hatamot]}`);
  if (f.c_economic === "yes") docs.push(ECONOMIC_NOTE);
  if (docs.length) sections.push({ title: "אבחונים, ועדות ומשאבים", lines: docs });

  // מסלולים
  const active = tracks.filter(t => t.relevance !== "info");
  if (active.length) {
    sections.push({
      title: "מסלולים לבדיקה",
      lines: active.map(t => `${t.name} (${RELEVANCE_LABELS[t.relevance]})${t.deadline ? ` - ${t.deadline.label}` : ""}`),
    });
  }

  const head = "סיכום לקראת הפניה - התלמיד/ה";
  const meta = `נוצר בעזרת "טיפול חכם" ב-${formatDateHe(today)}${f.c_fill ? `, ${FILL_MODE_LABELS[f.c_fill]}` : ""}.`;
  const unknowns = unknownCount(A);
  const partial = unknowns > 0
    ? ` ${unknowns === 1 ? "פריט אחד סומן" : `${unknowns} פריטים סומנו`} כ"לא ידוע" ונספרו כאילו הקושי אינו קיים, ולכן היעדר ממצא בתחום שלא היה עליו מידע אינו שולל קושי בו.`
    : "";
  const foot = "הסיכום מבוסס על דיווח הממלא/ת בלבד. הוא אינו אבחון, אינו קובע זכאות ואינו מחליף הערכה מקצועית או החלטת ועדה. אינו מכיל פרטים מזהים." + partial;

  const text = [head, meta, "", ...sections.flatMap(s => [s.title, ...s.lines.map(l => `- ${l}`), ""]), foot].join("\n");
  const html = [
    `<h2>${esc(head)}</h2>`,
    `<p><em>${esc(meta)}</em></p>`,
    ...sections.map(s => `<h3>${esc(s.title)}</h3><ul>${s.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>`),
    `<p><small>${esc(foot)}</small></p>`,
  ].join("");

  return { text, html, doc: { head, meta, sections, foot } };
}
