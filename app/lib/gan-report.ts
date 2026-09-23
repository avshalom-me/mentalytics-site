/**
 * The kindergarten teacher's rubric on top of the kids questionnaire: what was
 * tried in the kindergarten, the statuses only she knows, which directions the
 * findings point to, and the conversion into gan-tracks.ts's input.
 *
 * The same split as the school side. gan-tracks.ts knows dates, documents and
 * who may sign; it does not know whether a finding should send a child toward
 * a committee. That judgement is here, one rule per direction, each saying
 * which questionnaire answers it reads - and each is a default written for the
 * clinician of record to read. GAN_PENDING_DECISIONS lists what is waiting on
 * that reading, so the map can be honest about it.
 *
 * Nothing here is scored and nothing is free text: the rubric stays anonymous
 * by construction, like the counsellor's.
 */

import type { Ans, AttemptKind, CounselorFields, Outcome } from "./school-report";
import {
  isGanGrade,
  type DevCenterStatus,
  type ExtraYearStatus,
  type GanDirection,
  type GanSetting,
  type GanTracksInput,
  type RehabDaycareStatus,
} from "./gan-tracks";

/** Same literal as school-report's UNKNOWN; kept local so the two modules do not import each other's values. */
const UNKNOWN = "unknown";

// ── What was tried in the kindergarten ───────────────────────────────────────

/**
 * The kindergarten's own attempts, by kind. "treatment" and "system" are the
 * two kinds the school floor asks for; "development" - the paramedical
 * therapies - is recorded and reported but is not the emotional route's
 * treatment, and the developmental routes have no floor at all (see ganRoutes).
 *
 * `toddler`: whether a day-care can have tried it. A day-care has no
 * kindergarten plan and no מתי"א, and the psychological service does not
 * regularly serve it (State Comptroller, 2025) - offering those rows to a
 * פעוטון teacher asked her about things that were never hers to try.
 */
export const GAN_INTERVENTIONS = [
  { key: "gan_plan", label: "תוכנית התערבות בגן (הגננת)", kind: "system", toddler: false },
  { key: "inclusion", label: "תמיכה מסל השילוב או מגננת השילוב (מתי\"א)", kind: "system", toddler: false },
  { key: "parents", label: "שיחות והדרכה להורים", kind: "system", toddler: true },
  { key: "shach", label: "ייעוץ או תצפית של פסיכולוג/ית שפ\"ח", kind: "treatment", toddler: false },
  { key: "emotional", label: "טיפול רגשי או דיאדי, או הדרכת הורים טיפולית", kind: "treatment", toddler: true },
  { key: "paramedical", label: "טיפול פרא-רפואי (קלינאות תקשורת, ריפוי בעיסוק, פיזיותרפיה)", kind: "development", toddler: true },
] as const;
export type GanInterventionKey = (typeof GAN_INTERVENTIONS)[number]["key"];

export const GAN_ATTEMPT_LABELS: Record<AttemptKind, string> = {
  treatment: "ניסיון טיפולי אחד (ייעוץ או תצפית של פסיכולוג/ית שפ\"ח, או טיפול רגשי, דיאדי או הדרכת הורים טיפולית)",
  system: "התערבות אחת בגן (תוכנית התערבות, תמיכה מסל השילוב, או שיחות והדרכה להורים)",
};

// ── Labels ───────────────────────────────────────────────────────────────────

export const GAN_SETTING_LABELS: Record<GanSetting, string> = {
  regular: "גן רגיל, ללא תמיכה",
  regular_support: "גן רגיל, עם תמיכה מסל השילוב",
  personal_basket: "גן רגיל, עם סל אישי מוועדה",
  special_gan: "גן חינוך מיוחד",
  daycare: "מעון או פעוטון",
  rehab_daycare: "מעון יום שיקומי",
  home: "בבית או אצל מטפלת",
};
/** Which settings to offer: a toddler is in a day-care or at home, an older child in a kindergarten. */
export const TODDLER_SETTINGS: GanSetting[] = ["daycare", "rehab_daycare", "home"];
export const GAN_SETTINGS: GanSetting[] = ["regular", "regular_support", "personal_basket", "special_gan"];

export type DevCenterAnswer = DevCenterStatus | typeof UNKNOWN;
export const DEV_CENTER_LABELS: Record<DevCenterAnswer, string> = {
  none: "לא פנו", waiting: "הופנו וממתינים לתור", in_process: "בתהליך הערכה", done: "ההערכה הסתיימה", unknown: "לא ידוע",
};
export const REHAB_DAYCARE_LABELS: Record<RehabDaycareStatus, string> = {
  none: "לא נבדק", considering: "בהתלבטות", applied: "הוגשה בקשה", attends: "משובץ/ת במעון",
};
export const EXTRA_YEAR_LABELS: Record<ExtraYearStatus, string> = {
  none: "לא עלה", considering: "בהתלבטות", requested: "הוגשה בקשה", decided: "התקבלה החלטה",
};
export const GAN_TEAM_LABELS = { yes: "דן בילד/ה", no: "טרם דן", unknown: "לא ידוע" } as const;

/** The in-branch observations in a kindergarten's words. Same keys and values as the school's. */
export const GAN_ATTEND_LABELS = {
  regular: "מגיע/ה באופן סדיר", some: "היעדרויות מדי פעם", frequent: "היעדרויות תכופות", refusal: "סירוב להגיע לגן",
} as const;
export const GAN_OBSERVATION_LABELS = {
  attend: "הגעה לגן",
  regulation: "קושי בוויסות בגן ובחצר",
  bullyPerp: "פגיעה בילדים אחרים (דחיפות, נשיכות, הצקות)",
  isolation: "בידוד או דחייה חברתית בגן",
  bullyVictim: "נפגע/ת מילדים אחרים בגן",
} as const;

// ── Which direction, if any ──────────────────────────────────────────────────

const yes = (v: unknown) => v === "כן";
const areaAtLeast = (v: unknown, from: "מעט" | "הרבה") =>
  (from === "מעט" ? ["מעט", "הרבה", "הרבה מאוד"] : ["הרבה", "הרבה מאוד"]).includes(String(v ?? ""));
const GAN_ACAD_ITEMS = ["gan_q1", "gan_q2", "gan_q3", "gan_q4", "gan_q5"] as const;

/**
 * Language: the three kindergarten items whose referral in the scoring is a
 * speech therapist (kids-score.server.ts, computeGanAcad) - letters and
 * numbers, shapes and colours, expression and vocabulary. Rhyming alone is
 * answered there with tools, not a referral, and is left out here too.
 */
export function ganLanguageFinding(A: Ans): boolean {
  return yes(A.gan_q4) || yes(A.gan_q1) || yes(A.gan_q2);
}

/**
 * Functional: the fine-motor item, an occupational-therapy referral out of the
 * developmental block (sensory regulation), three or more kindergarten items at
 * once - the scoring's own threshold for "consult the kindergarten
 * psychologist" - or a toddler whose developmental area was marked "הרבה" and
 * above: under 3 the questionnaire has no motor screen to say more with.
 */
export function ganFunctionalFinding(A: Ans): boolean {
  const many = GAN_ACAD_ITEMS.filter(k => yes(A[k])).length >= 3;
  const ot = Array.isArray(A._findingKeys?.treatmentKeys) && A._findingKeys.treatmentKeys.includes("ריפוי בעיסוק");
  return yes(A.gan_q5) || ot || many || (A._grade === "פעוט" && areaAtLeast(A.a_dev, "הרבה"));
}

/**
 * Autism: the pattern the scoring reports as possible communication
 * difficulties - all three communication items and at least one of the four
 * that go with them (repetitive behaviour, rigidity, restricted interest,
 * sensory). Anything less is referred to treatment there and is not a
 * direction here.
 */
export function ganAutismFinding(A: Ans): boolean {
  if (!yes(A.soc3)) return false;
  const all = yes(A.comm1) && yes(A.comm2) && yes(A.comm3);
  const extra = ["comm_rep", "comm_rigid", "comm_interest", "comm_sens"].some(k => yes(A[k]));
  return all && extra;
}

/** The scored emotional referral, read exactly as the school rubric reads it. */
const emotionalFinding = (A: Ans): boolean =>
  Array.isArray(A._found) ? A._found.includes("emotional") : areaAtLeast(A.a_emo, "הרבה");

/**
 * A determination in the file stands on its own: an ASD assessment or a
 * diagnosis committee's decision is not an inference from the questionnaire.
 */
function documentedDirections(A: Ans): GanDirection[] {
  const kinds = new Set(((A as CounselorFields).c_diag ?? []).map(d => d.kind));
  const out: GanDirection[] = [];
  if (kinds.has("אבחון קשיי תקשורת ASD")) out.push("autism");
  if (kinds.has("ועדת אבחון - חוק הסעד")) out.push("intellectual");
  return out;
}

/** An attempt counts toward exhaustion only if it did not suffice - the school rule. */
const attemptCounts = (o: Outcome | undefined) => !!o && o !== "helped";

export function ganMissingAttempts(A: Ans): AttemptKind[] {
  const tried = ((A as CounselorFields).c_gan_tried ?? {}) as Partial<Record<GanInterventionKey, Outcome>>;
  const out: AttemptKind[] = [];
  for (const kind of ["treatment", "system"] as const) {
    if (!GAN_INTERVENTIONS.some(i => i.kind === kind && attemptCounts(tried[i.key]))) out.push(kind);
  }
  return out;
}
function ganHelpedOnly(A: Ans): AttemptKind[] {
  const tried = ((A as CounselorFields).c_gan_tried ?? {}) as Partial<Record<GanInterventionKey, Outcome>>;
  return (["treatment", "system"] as const).filter(kind => {
    const outcomes = GAN_INTERVENTIONS.filter(i => i.kind === kind).map(i => tried[i.key]).filter(Boolean);
    return outcomes.length > 0 && outcomes.every(o => o === "helped");
  });
}

export interface GanRouteState {
  /** Directions the map may name. */
  live: GanDirection[];
  /** The emotional route, when the findings support it and the attempts are not yet there. */
  pending: GanDirection[];
  missing: AttemptKind[];
  helpedOnly: AttemptKind[];
}

/**
 * Which directions the kindergarten map names.
 *
 * The developmental directions - language, functional, autism - open on the
 * finding alone. In early childhood the committee follows a diagnosis, and the
 * diagnosis follows an assessment that has a waiting list; asking a
 * kindergarten to exhaust interventions first would only move the assessment
 * later. The emotional route keeps the school's floor - one treatment attempt
 * and one attempt in the kindergarten, neither of which sufficed - because
 * that is the owner's rule for 55 and nothing about the age changes it.
 * Behavioural and social findings alone name no committee, as at school.
 */
export function ganRoutes(A: Ans): GanRouteState {
  const live: GanDirection[] = [];
  if (ganLanguageFinding(A)) live.push("language");
  if (ganFunctionalFinding(A)) live.push("functional");
  if (ganAutismFinding(A)) live.push("autism");
  for (const d of documentedDirections(A)) if (!live.includes(d)) live.push(d);
  if (!emotionalFinding(A)) return { live, pending: [], missing: [], helpedOnly: [] };
  const missing = ganMissingAttempts(A);
  if (!missing.length) return { live: [...live, "emotional"], pending: [], missing: [], helpedOnly: [] };
  return { live, pending: ["emotional"], missing, helpedOnly: ganHelpedOnly(A).filter(k => missing.includes(k)) };
}

export function ganExhaustionMessage(r: Pick<GanRouteState, "missing" | "helpedOnly">): string {
  const parts = [`מומלץ להשלים ${r.missing.map(m => GAN_ATTEMPT_LABELS[m]).join(" ו")} כדי לסיים מיצוי אפשרויות בכיוון הרגשי`];
  if (r.helpedOnly.length) parts.push("התערבות שסומנה 'הועיל' אינה נספרת כמיצוי - מיצוי פירושו ניסיון שלא הספיק");
  return `${parts.join(". ")}, ולאחר מכן מומלץ לשקול פנייה לוועדת זכאות ואפיון.`;
}

// ── Engine input ─────────────────────────────────────────────────────────────

export function toGanTracksInput(A: Ans, today: string): GanTracksInput | null {
  const f = A as CounselorFields;
  if (!isGanGrade(f._grade)) return null;
  const routes = ganRoutes(A);
  const age = parseInt(String(f._age ?? ""), 10);
  return {
    grade: f._grade,
    today,
    age: Number.isFinite(age) && age > 0 ? age : undefined,
    diagnoses: f.c_diag ?? [],
    directions: routes.live,
    pendingDirections: routes.pending,
    exhaustionNote: routes.missing.length ? ganExhaustionMessage(routes) : undefined,
    // "not known" is not "did not meet" - the engine must see no answer.
    team: f.c_team && f.c_team !== "unknown" ? { convened: f.c_team === "yes" } : undefined,
    devCenter: f.c_devcenter && f.c_devcenter !== UNKNOWN ? f.c_devcenter : undefined,
    setting: f.c_setting,
    zakaut: f.c_zakaut ? { status: f.c_zakaut, decisionReceivedOn: f.c_zakaut_on || undefined } : undefined,
    rehabDaycare: f.c_daycare,
    extraYear: f.c_extra_year,
  };
}

// ── What the kindergarten can do with what it reported ───────────────────────

/**
 * The school's two lines of guidance beside each observation, in a
 * kindergarten's terms: a corner and a signal rather than a way out of class,
 * the yard and the transitions rather than the breaks, and the adults to turn
 * to because a four-year-old does not report. Conventional practice, phrased
 * as what tends to help, beside the referral and never instead of it.
 */
export const GAN_TIPS: { key: string; title: string; when: (f: CounselorFields) => boolean; lines: [string, string] }[] = [
  {
    key: "regulation",
    title: "ויסות בגן ובחצר",
    when: f => typeof f.c_regulation === "number" && f.c_regulation >= 2,
    lines: [
      "כדאי לקבוע מראש פינת רגיעה וסימן מוסכם, ולהשתמש בהם לפני שהעומס מגיע לשיא ולא כתגובה להתפרצות.",
      "תיעוד קצר של מה שקדם לאירועים החוזרים מגלה לרוב מעבר, פעילות או שעה ביום שחוזרים על עצמם, ומשם אפשר לשנות את סדר היום ולא רק את התגובה.",
    ],
  },
  {
    key: "isolation",
    title: "בידוד או דחייה חברתית בגן",
    when: f => typeof f.c_isolation === "number" && f.c_isolation >= 2,
    lines: [
      "משחק בקבוצות קטנות שהגננת מרכיבה, עם תפקיד ברור לכל ילד/ה, מוריד את החשיפה לדחייה ומייצר הזדמנויות לקשר.",
      "כדאי לאתר ילד/ה אחד/ת שיש איתו/ה בסיס לקשר ולבסס אותו לפני שמרחיבים לקבוצה - קשר אחד יציב מועיל יותר מניסיון לשלב בגן כולו.",
    ],
  },
  {
    key: "bully_victim",
    title: "חשד לפגיעה מילדים אחרים",
    when: f => f.c_bully_victim === "suspected",
    lines: [
      "חשד מצדיק תצפית שקטה לפני כל צעד - בחצר, במעברים ובמשחק החופשי - ושיחה עם הסייעת, בלי לנקוב בשמות מול הילדים.",
      "חשוב שהילד/ה יידע/תדע למי מהמבוגרים לפנות, ושהמענה לא יהיה תלוי ביוזמה שלו/ה - ילדים צעירים מתקשים לספר.",
    ],
  },
  {
    key: "bully_victim_known",
    title: "נפגע/ת מילדים אחרים - אירוע ידוע",
    when: f => f.c_bully_victim === "known",
    lines: [
      "אירוע ידוע מחייב השגחה צמודה במקומות ובזמנים שבהם הפגיעה קורית, תיעוד, ויידוע ההורים של שני הילדים - הטיפול מערכתי ולא שיחה בין הילדים.",
      "חשוב שהילד/ה יידע/תדע למי מהמבוגרים לפנות, ושהמענה לא יהיה תלוי ביוזמה שלו/ה - ילדים צעירים מתקשים לספר.",
    ],
  },
  {
    key: "bully_perp",
    title: "חשד לפגיעה בילדים אחרים",
    when: f => f.c_bully_perp === "suspected",
    lines: [
      "חשד מצדיק בירור לפני תגובה: מה בדיוק נצפה, על ידי מי ובאילו נסיבות - תגובה על חשד שלא אומת פוגעת באמון.",
      "בגיל הגן פגיעה בילדים אחרים נובעת לרוב מקושי בוויסות, בשפה או בהבנת משחק משותף - ולכל אחד מהם מענה אחר.",
    ],
  },
  {
    key: "bully_perp_known",
    title: "פגיעה בילדים אחרים - אירוע ידוע",
    when: f => f.c_bully_perp === "known",
    lines: [
      "אירוע ידוע מטופל בהשגחה, בתיעוד וביידוע ההורים, ובתגובה שמתמקדת בתיקון ובלמידה ולא בענישה בלבד.",
      "בגיל הגן פגיעה בילדים אחרים נובעת לרוב מקושי בוויסות, בשפה או בהבנת משחק משותף - ולכל אחד מהם מענה אחר.",
    ],
  },
  {
    key: "change",
    title: "שינוי חד השנה",
    when: f => f.c_change === "כן",
    lines: [
      "שינוי חד לרוב מסמן אירוע: משפחתי (לידת אח/ות, מעבר דירה, פרידה), בריאותי או במסגרת. כדאי לברר מה קרה לפני שמפרשים את הסימפטומים כקושי מתמשך.",
      "אם האירוע ידוע, הטיפול בו קודם להפניה; אם לא, שיחה עם ההורים היא הצעד הראשון.",
    ],
  },
];

/**
 * The agenda for the clinician of record. Each line changes what a
 * kindergarten teacher is told, and none of them is technical.
 */
export const GAN_PENDING_DECISIONS: string[] = [
  "הכיוונים ההתפתחותיים (שפה, תפקודי, אוטיזם) נפתחים על הממצא לבד, בלי רצפת מיצוי - האם זה הכלל הנכון לגיל הרך",
  "הכיוון הרגשי (55) בגן נשען על רצפת המיצוי של בית הספר - טיפול אחד והתערבות אחת בגן שלא הספיקו",
  "מה פותח כיוון תפקודי: פריט המוטוריקה, הפניה לריפוי בעיסוק, שלושה פריטים לימודיים בגן, או סימון 'הרבה' בתחום ההתפתחותי אצל פעוט",
  "משפטי ההכוונה לצוות הגן (GAN_TIPS) - קריאה קלינית",
];
