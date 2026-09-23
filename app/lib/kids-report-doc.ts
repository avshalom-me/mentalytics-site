/**
 * The parent's report as a document: the findings the results screen shows,
 * laid out for report-pdf.ts rather than for a scrolling page.
 *
 * Pure. The results screen passes in what it has already worked out - labels,
 * the parsed domains, the cross-domain notes - so nothing here reaches into the
 * questionnaire's UI, and the whole of it can be tested without a browser.
 *
 * Also home to toolGroupsOf, which both reports use: the tools appendix groups
 * a practice under the finding that produced it, the way the screen does
 * inside each finding's card.
 */

import type { KidsDomainResult } from "./kids-recommendations";
import type { ReportDoc, ToolGroup } from "./report-pdf";

/** Leading emoji and punctuation off a label the engine wrote for the screen. */
export const stripMarks = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();
const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));

export interface KidsReportInput {
  /** "23.9.2026" */
  dateLabel: string;
  /** Already labelled, e.g. ["כיתה", "כיתה ג"]. A blank or "-" value is left out. */
  details: [string, string][];
  /** The areas the parent marked, with the level they chose: ["רגשי", "הרבה"]. */
  areas: [string, string][];
  /** A medical note that stands apart from the findings - the BMI one. */
  medicalNote?: string;
  domains: { label: string; result: KidsDomainResult }[];
  /** The cross-domain notes, as the screen shows them. */
  notes: string[];
  /** When nothing was found: what the screen says instead of the domains. */
  noFindings?: { title: string; line: string };
}

/** The screen's four referral headings, in its order, as a document names them. */
const KIND_LINES = [
  ["treatment", "טיפול מומלץ"],
  ["assessment", "אבחון מומלץ"],
  ["professional", "פנייה לאיש/ת מקצוע"],
  ["external", "פנייה נוספת"],
] as const;

export const KIDS_REPORT_FOOT =
  "התוצאות מבוססות על התשובות לשאלון ומהוות הערכה כללית בלבד. אין לראות בהן אבחון, המלצה טיפולית מחייבת או תחליף לייעוץ מקצועי. מומלץ לפנות לאיש/ת מקצוע מוסמך/ת לצורך הערכה מלאה.";

export function buildKidsReportDoc(input: KidsReportInput): ReportDoc {
  const sections: ReportDoc["sections"] = [];

  const details = input.details
    .filter(([, v]) => v && v.trim() && v.trim() !== "-")
    .map(([k, v]) => `${k}: ${v}`);
  if (input.areas.length) details.push(`תחומי קושי שסומנו: ${input.areas.map(([k, v]) => `${k} (${v})`).join(", ")}`);
  if (details.length) sections.push({ title: "פרטים", lines: details });

  if (input.medicalNote) sections.push({ title: "לתשומת לב", lines: [stripMarks(input.medicalNote)] });

  if (input.noFindings) {
    sections.push({ title: input.noFindings.title, lines: [stripMarks(input.noFindings.line)] });
  }

  for (const d of input.domains) {
    const lines: string[] = [];
    const groups = d.result.groups;
    // Every symptom behind every card in the domain, including the ones with no
    // referral attached ("מתח ברמה נמוכה") - the screen shows those too.
    const symptoms = uniq(groups.flatMap(g => g.recs.flatMap(r => r.symptoms)).map(stripMarks).filter(Boolean));
    if (symptoms.length) lines.push(`ממצאים: ${symptoms.join("; ")}`);
    for (const [kind, heading] of KIND_LINES) {
      const labels = uniq(
        groups
          .filter(g => g.kind === kind && g.treatmentKey !== "_no_action")
          .map(g => `${stripMarks(g.treatmentLabel)}${g.urgent ? " (דחוף)" : ""}`),
      );
      if (labels.length) lines.push(`${heading}: ${labels.join("; ")}`);
    }
    const notes = uniq(groups.flatMap(g => g.recs.flatMap(r => (r.notes ?? "").split("\n"))).map(stripMarks).filter(Boolean));
    lines.push(...notes);
    for (const w of d.result.standaloneWarnings) lines.push(stripMarks(w.text));
    if (lines.length) sections.push({ title: stripMarks(d.label), lines });
  }

  const notes = uniq(input.notes.flatMap(n => n.split("\n")).map(stripMarks).filter(Boolean));
  if (notes.length) sections.push({ title: "הערות נוספות", lines: notes });

  return {
    head: "דוח ממצאים - שאלון הכוונה טיפולית לילדים ונוער",
    meta: `נוצר בעזרת "טיפול חכם" ב-${input.dateLabel}.`,
    sections,
    foot: KIDS_REPORT_FOOT,
  };
}

/**
 * The tools, grouped by the finding that produced them.
 *
 * Grouping is what makes a list of tips readable: "for the anxiety" and "for
 * the attention" are different afternoons. A tool the engine did not tie to a
 * symptom falls under its referral instead.
 */
export function toolGroupsOf(domains: { result: KidsDomainResult }[]): ToolGroup[] {
  const map = new Map<string, string[]>();
  for (const d of domains)
    for (const g of d.result.groups)
      for (const r of g.recs)
        for (const t of r.tools) {
          const key = stripMarks(t.sourceSymptom || g.treatmentLabel) || stripMarks(g.treatmentLabel);
          const arr = map.get(key) ?? [];
          const text = stripMarks(t.text);
          if (text && !arr.includes(text)) arr.push(text);
          map.set(key, arr);
        }
  return Array.from(map, ([title, tools]) => ({ title, tools })).filter(g => g.tools.length > 0);
}
