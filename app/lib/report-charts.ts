/**
 * The two pictures in the counsellor's report, as data.
 *
 * A - תמונת מצב לפי תחום: where the counsellor said the difficulty is, on her
 *     own four-point scale, and whether the questionnaire's items backed it.
 * B - מה נוסה ומה קרה: each attempt the school (or kindergarten) recorded, by
 *     its outcome - which is what a committee reads as מיצוי אפשרויות.
 *
 * Pure: the screen and the PDF draw the same rows, and the rows are tested.
 * Deliberately not here: scores against thresholds. Screening totals drawn as
 * a gauge read as a normed test result, "לא ידוע" is counted as 0, and a scale
 * exists only where the counsellor was led to it - three ways to mislead a
 * committee or a parent with one picture.
 *
 * Each builder returns null when it has nothing worth drawing, and the report
 * then keeps its text alone: a chart with one bar or one dot is clutter.
 */

import type { Ans, AttemptKind, CounselorFields, Outcome, SummaryDomain } from "./school-report";
import { INTERVENTIONS, eligibilityRoutes, missingAttempts } from "./school-report";
import { GAN_INTERVENTIONS, ganMissingAttempts, ganRoutes, type GanInterventionKey } from "./gan-report";
import { isGanGrade } from "./gan-tracks";

// ── A: the difficulty by domain ──────────────────────────────────────────────

/** found: the items produced a finding; urgent: one of them is marked urgent; none: flagged, nothing found; not_marked: "כלל לא". */
export type ProfileStatus = "urgent" | "found" | "none" | "not_marked";
export interface ProfileRow { key: string; label: string; level: 0 | 1 | 2 | 3; status: ProfileStatus }
export interface ProfileChart { kind: "profile"; rows: ProfileRow[] }

/** The questionnaire's order, kept fixed so two reports read the same way. */
const PROFILE_DOMAINS = [
  { key: "emotional", area: "a_emo", label: "רגשי" },
  { key: "academic", area: "a_aca", label: "לימודי" },
  { key: "developmental", area: "a_dev", label: "התפתחותי" },
  { key: "behavioral", area: "a_beh", label: "התנהגותי" },
  { key: "social", area: "a_soc", label: "חברתי" },
] as const;
const LEVELS = ["כלל לא", "מעט", "הרבה", "הרבה מאוד"];
export const PROFILE_LEVEL_LABELS = LEVELS.slice(1);
export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  urgent: "עלו ממצאים · דחוף",
  found: "עלו ממצאים",
  none: "לא עלה ממצא",
  not_marked: "לא סומן",
};

/**
 * "Found" means what the summary's domain section counts: a symptom, a
 * referral other than the engine's "consult the counsellor", or a warning.
 */
function domainFinding(d: SummaryDomain | undefined): { found: boolean; urgent: boolean } {
  if (!d) return { found: false, urgent: false };
  const groups = d.result.groups.filter(g => g.treatmentKey !== "_no_action" && g.treatmentKey !== "יועצת בית ספר");
  const symptoms = d.result.groups.some(g => g.recs.some(r => r.symptoms.length > 0));
  const found = symptoms || groups.length > 0 || d.result.standaloneWarnings.length > 0;
  const urgent = d.result.groups.some(g => g.urgent) || d.result.standaloneWarnings.some(w => w.urgent);
  return { found, urgent: found && urgent };
}

/**
 * One row per domain the counsellor was asked to rate. A domain the opening
 * screen never showed her (development past ב', the toddler's hidden ones) has
 * no answer and no row. Null when nothing was rated above "כלל לא".
 */
export function profileChart(A: Ans, domains: SummaryDomain[]): ProfileChart | null {
  const rows: ProfileRow[] = [];
  for (const p of PROFILE_DOMAINS) {
    const level = LEVELS.indexOf(String(A[p.area] ?? ""));
    if (level < 0) continue;
    const { found, urgent } = domainFinding(domains.find(d => d.key === p.key));
    const status: ProfileStatus = level === 0 ? "not_marked" : urgent ? "urgent" : found ? "found" : "none";
    rows.push({ key: p.key, label: p.label, level: level as ProfileRow["level"], status });
  }
  return rows.some(r => r.level > 0) ? { kind: "profile", rows } : null;
}

// ── B: what was tried and what came of it ────────────────────────────────────

export const OUTCOME_COLUMNS: Outcome[] = ["helped", "partial", "no_help"];
export const OUTCOME_COLUMN_LABELS: Record<Outcome, string> = { helped: "הועיל", partial: "חלקית", no_help: "לא הועיל" };
/** The legend for the hollow dot - printed only when a row is "הועיל". */
export const HELPED_LEGEND = "עיגול ריק = הועיל, ולכן אינו נספר כמיצוי";
export const PROFILE_CAPTION = "תמונת מצב לפי תחום: רמת הקושי לפי הדיווח, ומה עלה בפריטי השאלון";
export interface TriedRow { label: string; outcome: Outcome }
export interface TriedGroup { title: string; rows: TriedRow[] }
export interface TriedChart {
  kind: "tried";
  groups: TriedGroup[];
  /** What was not tried, said under the chart so the PDF loses nothing the text list had. */
  untried: string[];
  /** The committee floor, when a route asks for it - absent when none does. */
  exhaustion?: Record<AttemptKind, boolean>;
  /** Whether any row is "הועיל" - the legend for the hollow dot is printed only then. */
  anyHelped: boolean;
}

/** Fewer recorded attempts than this, and the text list says it better. */
const MIN_TRIED_ROWS = 2;

export function triedChart(A: Ans): TriedChart | null {
  const f = A as CounselorFields;
  const gan = isGanGrade(f._grade);
  const groups: TriedGroup[] = [];
  const untried: string[] = [];
  let exhaustion: TriedChart["exhaustion"];

  if (gan) {
    const tried = (f.c_gan_tried ?? {}) as Partial<Record<GanInterventionKey, Outcome>>;
    const toddler = f._grade === "פעוט";
    const offered = GAN_INTERVENTIONS.filter(i => !toddler || i.toddler);
    const titles = { system: toddler ? "במסגרת" : "בגן", treatment: "טיפולי", development: "התפתחותי" } as const;
    for (const kind of ["system", "treatment", "development"] as const) {
      const rows = offered.filter(i => i.kind === kind && tried[i.key]).map(i => ({ label: i.label, outcome: tried[i.key]! }));
      if (rows.length) groups.push({ title: titles[kind], rows });
    }
    for (const i of offered) if (!tried[i.key]) untried.push(i.label);
    // Only the emotional route carries the floor in a kindergarten.
    const r = ganRoutes(A);
    if (r.live.includes("emotional") || r.pending.includes("emotional")) {
      const missing = ganMissingAttempts(A);
      exhaustion = { treatment: !missing.includes("treatment"), system: !missing.includes("system") };
    }
  } else {
    const tried = f.c_tried ?? {};
    const titles = { treatment: "טיפולי", system: "מערכתי" } as const;
    for (const kind of ["treatment", "system"] as const) {
      const rows = INTERVENTIONS.filter(i => i.kind === kind && tried[i.key]).map(i => ({ label: i.label, outcome: tried[i.key]! }));
      if (rows.length) groups.push({ title: titles[kind], rows });
    }
    for (const i of INTERVENTIONS) if (!tried[i.key]) untried.push(i.label);
    const r = eligibilityRoutes(A);
    const candidates = Array.from(new Set([...r.live, ...r.pending]));
    if (candidates.length) {
      const missing = missingAttempts(A, candidates);
      exhaustion = { treatment: !missing.includes("treatment"), system: !missing.includes("system") };
    }
  }

  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0);
  if (rowCount < MIN_TRIED_ROWS) return null;
  const anyHelped = groups.some(g => g.rows.some(r => r.outcome === "helped"));
  return { kind: "tried", groups, untried, ...(exhaustion ? { exhaustion } : {}), anyHelped };
}

/** "מיצוי: ניסיון טיפולי ✓ · התערבות מערכתית ✗" - the line under chart B, shared by the screen and the PDF. */
export function exhaustionLine(e: Record<AttemptKind, boolean>, gan = false): string {
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  return `מיצוי: ניסיון טיפולי ${mark(e.treatment)} · ${gan ? "התערבות בגן" : "התערבות מערכתית"} ${mark(e.system)}`;
}

export type ReportChart = ProfileChart | TriedChart;
