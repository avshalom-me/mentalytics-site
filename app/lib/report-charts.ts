/**
 * The pictures in the counsellor's report, as data.
 *
 * A - תמונת מצב לפי תחום: where the counsellor said the difficulty is, on her
 *     own four-point scale, and whether the questionnaire's items backed it.
 * B - מה נוסה ומה קרה: each attempt the school (or kindergarten) recorded, by
 *     its outcome - which is what a committee reads as מיצוי אפשרויות.
 * C - הדרך לוועדה: the committee's floor (one system attempt and one
 *     treatment attempt that did not suffice), the admissible diagnosis, then
 *     the referral and the hearings with this year's dates. Drawn only when a
 *     route asks for the floor.
 *
 * Pure: the screen and the PDF draw the same rows, and the rows are tested.
 * Deliberately not here: scores against thresholds. Screening totals drawn as
 * a gauge read as a normed test result, "לא ידוע" is counted as 0, and a scale
 * exists only where the counsellor was led to it - three ways to mislead a
 * committee or a parent with one picture.
 *
 * Colour carries meaning and nothing else: teal depth is the level, and the
 * three outcomes have one colour each. Every coloured mark also says its
 * meaning in words, so a black-and-white print loses nothing.
 *
 * Each builder returns null when it has nothing worth drawing, and the report
 * then keeps its text alone: a chart with one bar or one dot is clutter.
 */

import type { Ans, AttemptKind, CounselorFields, Outcome, SummaryDomain } from "./school-report";
import { INTERVENTIONS, eligibilityRoutes, missingAttempts } from "./school-report";
import { GAN_INTERVENTIONS, ganMissingAttempts, ganRoutes, type GanInterventionKey } from "./gan-report";
import { ganWindow, isGanGrade } from "./gan-tracks";
import { formatDateHe, zakautWindow, type SchoolTrack } from "./school-tracks";

// ── The palette, shared by the screen and the PDF ────────────────────────────

/** The site's teal ramp, from "לא סומן" to "הרבה מאוד". */
export const LEVEL_TONES = [
  { bg: "#F7FAF9", fg: "#6B807E", border: "#C2DFDE" },
  { bg: "#EAF4F3", fg: "#2A6462", border: "#EAF4F3" },
  { bg: "#C2DFDE", fg: "#2A6462", border: "#C2DFDE" },
  { bg: "#3D8C8A", fg: "#FFFFFF", border: "#3D8C8A" },
] as const;
/**
 * The legend's sample for a level. "מעט" is a tint (#EAF4F3) whose own edge is the
 * same tint, so on white paper - and more so on a black-and-white print - its
 * swatch vanished and the legend seemed to name only two levels. The two lighter
 * levels get an edge that shows; the tile itself is unchanged.
 */
export function levelSwatch(level: number): { fill: string; border: string } {
  const t = LEVEL_TONES[level];
  return { fill: t.bg, border: level >= 3 ? t.border : "#9FCBC9" };
}

/**
 * A label centred on a date of the year ribbon hangs half its width over the end
 * it is near; within this share of either end it sits against that edge instead.
 * 16% is what a phone's "today" label needs: on 31 August it was cut off and
 * pushed the page 12px wider than the screen.
 */
export const RIBBON_EDGE_PCT = 16;
export function ribbonEdge(pct: number): "start" | "end" | null {
  return pct < RIBBON_EDGE_PCT ? "start" : pct > 100 - RIBBON_EDGE_PCT ? "end" : null;
}

export const URGENT_RING = "#D49018";
export const URGENT_FG = "#8a5a06";

/**
 * One colour per outcome. "הועיל" is the one drawn as an outline - it does not
 * count toward מיצוי, and the hollow tag says so before the legend does.
 */
export const OUTCOME_TONES: Record<Outcome, { fill: string; bg: string; border: string; fg: string }> = {
  helped: { fill: "#3D8C8A", bg: "#FFFFFF", border: "#3D8C8A", fg: "#2A6462" },
  partial: { fill: "#D49018", bg: "#FDF6E3", border: "#E8C77E", fg: "#8a5a06" },
  no_help: { fill: "#F0A8AC", bg: "#FCEBEC", border: "#F0A8AC", fg: "#9C4A50" },
};

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
/** What a tile says under its domain - "לא סומן" rather than "כלל לא", which reads as a finding of none. */
export const PROFILE_TILE_LEVELS = ["לא סומן", ...PROFILE_LEVEL_LABELS];
export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  urgent: "עלו ממצאים · דחוף",
  found: "עלו ממצאים",
  none: "לא עלה ממצא",
  not_marked: "",
};
export const PROFILE_CAPTION = "תמונת מצב לפי תחום: רמת הקושי לפי הדיווח, ומה עלה בפריטי השאלון";
export const PROFILE_URGENT_LEGEND = "מסגרת זהב = ממצא דחוף";

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

export const OUTCOME_ORDER: Outcome[] = ["helped", "partial", "no_help"];
export const OUTCOME_LABELS_SHORT: Record<Outcome, string> = { helped: "הועיל", partial: "חלקית", no_help: "לא הועיל" };
/** Printed only when a tag is "הועיל". */
export const HELPED_LEGEND = "תגית עם מסגרת בלבד = הועיל, ולכן אינה נספרת כמיצוי";
export interface TriedRow { label: string; outcome: Outcome }
export interface TriedGroup { title: string; rows: TriedRow[] }
export interface TriedChart {
  kind: "tried";
  groups: TriedGroup[];
  /** How many attempts ended each way - the bar above the tags. */
  counts: Record<Outcome, number>;
  total: number;
  /** What was not tried, said under the chart so the PDF loses nothing the text list had. */
  untried: string[];
  /** The committee floor, when a route asks for it - absent when none does. */
  exhaustion?: Record<AttemptKind, boolean>;
  /** Whether any tag is "הועיל" - its legend is printed only then. */
  anyHelped: boolean;
}

/** Fewer recorded attempts than this, and the text list says it better. */
const MIN_TRIED_ROWS = 2;

/**
 * The committee floor - one treatment attempt and one system attempt that did
 * not suffice - when some route asks for it. In a kindergarten only the
 * emotional route does.
 */
export function exhaustionOf(A: Ans): Record<AttemptKind, boolean> | undefined {
  const f = A as CounselorFields;
  if (isGanGrade(f._grade)) {
    const r = ganRoutes(A);
    if (!r.live.includes("emotional") && !r.pending.includes("emotional")) return undefined;
    const missing = ganMissingAttempts(A);
    return { treatment: !missing.includes("treatment"), system: !missing.includes("system") };
  }
  const r = eligibilityRoutes(A);
  const candidates = Array.from(new Set([...r.live, ...r.pending]));
  if (!candidates.length) return undefined;
  const missing = missingAttempts(A, candidates);
  return { treatment: !missing.includes("treatment"), system: !missing.includes("system") };
}

export function triedChart(A: Ans): TriedChart | null {
  const f = A as CounselorFields;
  const groups: TriedGroup[] = [];
  const untried: string[] = [];

  if (isGanGrade(f._grade)) {
    const tried = (f.c_gan_tried ?? {}) as Partial<Record<GanInterventionKey, Outcome>>;
    const toddler = f._grade === "פעוט";
    const offered = GAN_INTERVENTIONS.filter(i => !toddler || i.toddler);
    const titles = { system: toddler ? "במסגרת" : "בגן", treatment: "טיפולי", development: "התפתחותי" } as const;
    for (const kind of ["system", "treatment", "development"] as const) {
      const rows = offered.filter(i => i.kind === kind && tried[i.key]).map(i => ({ label: i.label, outcome: tried[i.key]! }));
      if (rows.length) groups.push({ title: titles[kind], rows });
    }
    for (const i of offered) if (!tried[i.key]) untried.push(i.label);
  } else {
    const tried = f.c_tried ?? {};
    const titles = { treatment: "טיפולי", system: "מערכתי" } as const;
    for (const kind of ["treatment", "system"] as const) {
      const rows = INTERVENTIONS.filter(i => i.kind === kind && tried[i.key]).map(i => ({ label: i.label, outcome: tried[i.key]! }));
      if (rows.length) groups.push({ title: titles[kind], rows });
    }
    for (const i of INTERVENTIONS) if (!tried[i.key]) untried.push(i.label);
  }

  const rows = groups.flatMap(g => g.rows);
  if (rows.length < MIN_TRIED_ROWS) return null;
  const counts: Record<Outcome, number> = { helped: 0, partial: 0, no_help: 0 };
  for (const r of rows) counts[r.outcome]++;
  const exhaustion = exhaustionOf(A);
  return {
    kind: "tried", groups, counts, total: rows.length, untried,
    ...(exhaustion ? { exhaustion } : {}),
    anyHelped: counts.helped > 0,
  };
}

/** "מיצוי: ניסיון טיפולי ✓ · התערבות מערכתית ✗" - for the copied text and anywhere the path is not drawn. */
export function exhaustionLine(e: Record<AttemptKind, boolean>, gan = false): string {
  const mark = (ok: boolean) => (ok ? "✓" : "✗");
  return `מיצוי: ניסיון טיפולי ${mark(e.treatment)} · ${gan ? "התערבות בגן" : "התערבות מערכתית"} ${mark(e.system)}`;
}

// ── C: the way to the committee ──────────────────────────────────────────────

/** done / missing: the floor; next: where the team stands once it is met; ahead: what follows. */
export type PathState = "done" | "missing" | "next" | "ahead";
export interface PathStation { key: "system" | "treatment" | "diagnosis" | "referral" | "hearing"; label: string; sub: string; state: PathState }
export interface PathChart { kind: "path"; title: string; stations: PathStation[] }
export const PATH_NOTE = "רצפת המיצוי שהוועדה מצפה לראות לפני הפניה. אינו קובע זכאות - ההחלטה בידי הוועדה.";

/**
 * The floor as two stations, the admissible diagnosis, then the referral and
 * the hearings with the year's dates. "השלב הבא" falls on the referral only
 * when everything before it is in place - the map's own rule: assessment
 * first, committee after. Once the referral date has passed the stations carry
 * next year's - the referral is not lost, it moves a year. Once the file is
 * with the committee the next step is the hearing. Null when no route asks for
 * the floor, or once the committee has decided - a road nobody is on, or one
 * already travelled.
 *
 * tracks: the map's, for the one fact it holds and the answers do not -
 * whether the file has a diagnosis ועדת זכאות can accept.
 */
export function pathChart(A: Ans, today: string, tracks: Pick<SchoolTrack, "key" | "blocks">[] = []): PathChart | null {
  const e = exhaustionOf(A);
  if (!e) return null;
  const f = A as CounselorFields;
  if (f.c_zakaut === "decided") return null;
  const submitted = f.c_zakaut === "in_process";
  const gan = isGanGrade(f._grade);
  const toddler = f._grade === "פעוט";
  const win = gan ? ganWindow(today) : zakautWindow(today);
  const next = gan ? ganWindow(win.nextOpens) : zakautWindow(win.nextOpens);
  const diagnosisOk = !tracks.some(t => t.key === "assessment" && t.blocks?.includes("zakaut"));
  const ready = e.system && e.treatment && diagnosisOk;
  const floor = (ok: boolean): Pick<PathStation, "sub" | "state"> => ({ sub: ok ? "הושלם" : "להשלים", state: ok ? "done" : "missing" });
  return {
    kind: "path",
    // In a kindergarten the floor belongs to the emotional route alone.
    title: gan ? "הדרך לוועדת זכאות ואפיון - בכיוון הרגשי" : "הדרך לוועדת זכאות ואפיון",
    stations: [
      { key: "system", label: gan ? (toddler ? "התערבות במסגרת" : "התערבות בגן") : "התערבות מערכתית", ...floor(e.system) },
      { key: "treatment", label: "ניסיון טיפולי", ...floor(e.treatment) },
      { key: "diagnosis", label: "אבחנה קבילה", sub: diagnosisOk ? "בתיק" : "חסרה בתיק", state: diagnosisOk ? "done" : "missing" },
      submitted
        ? { key: "referral", label: "הפניה לוועדה", sub: "הוגשה", state: "done" }
        : {
            key: "referral",
            label: "הפניה לוועדה",
            sub: win.open ? `עד ${formatDateHe(win.deadline)}` : `המועד חלף · הבא עד ${formatDateHe(next.deadline)}`,
            state: ready ? "next" : "ahead",
          },
      {
        key: "hearing",
        label: "דיון בוועדה",
        sub: `${gan ? "דיוני הגנים" : "הדיונים"} עד ${formatDateHe((win.open || submitted ? win : next).committeesFinishBy)}`,
        state: submitted ? "next" : "ahead",
      },
    ],
  };
}

export type ReportChart = ProfileChart | TriedChart | PathChart;
