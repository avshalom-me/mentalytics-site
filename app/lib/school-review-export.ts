/**
 * Review notes as a document someone else can work from.
 *
 * The notes are not the end of the line: they are read again - by the owner,
 * by a panel of models asked to check them - and only then turned into code.
 * So the export is written for that second reader. Every note carries the
 * exact text it is about, where on which screen, the case it was written on,
 * and a pointer to the files the text most likely lives in; the JSON export
 * adds the full answers, which is what lets the state be rebuilt.
 *
 * Pure: takes the notes and the names, returns strings.
 */

import {
  NOTE_KIND_LABELS, NOTE_SEVERITY_LABELS, NOTE_STATUS_LABELS, sourceHint, type ReviewNote,
} from "./school-review";

export interface ExportNames {
  /** Screen id -> the name a reviewer sees. */
  screenName: (step: string) => string;
  /** Screens in questionnaire order; a note on an unlisted screen sorts last. */
  screenOrder: readonly string[];
  reviewerName: (id: string) => string;
  caseTitle: (id: string | null) => string | null;
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

const dateHe = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};
const list = (v: unknown): string | null => (Array.isArray(v) && v.length ? v.map(String).join(", ") : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
/** A quoted block: every line prefixed, so a multi-line quote stays one quote. */
const quoted = (text: string) => text.split("\n").map(l => `  > ${l}`).join("\n");

/** Screens in questionnaire order, and inside a screen the worst first. */
export function sortForExport(notes: ReviewNote[], order: readonly string[]): ReviewNote[] {
  const pos = (step: string) => { const i = order.indexOf(step); return i < 0 ? order.length : i; };
  return [...notes].sort((a, b) =>
    pos(a.step) - pos(b.step) ||
    SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
    a.created_at.localeCompare(b.created_at));
}

export function notesToMarkdown(notes: ReviewNote[], names: ExportNames, title = "הערות ביקורת - שאלון היועצות"): string {
  const sorted = sortForExport(notes, names.screenOrder);
  const out: string[] = [`# ${title}`, "", `${sorted.length} הערות · הופק ב-${dateHe(new Date().toISOString())}`, ""];
  let screen = "";
  let n = 0;
  for (const note of sorted) {
    if (note.step !== screen) {
      screen = note.step;
      out.push(`## ${names.screenName(note.step)} (\`${note.step}\`)`, "");
    }
    n += 1;
    const ctx = note.context ?? {};
    const caseTitle = names.caseTitle(note.case_id);
    out.push(`### ${n}. ${NOTE_KIND_LABELS[note.kind]} · חומרה ${NOTE_SEVERITY_LABELS[note.severity]}${note.block_label ? ` · ${note.block_label}` : ""}`);
    out.push(`- בודק/ת: ${names.reviewerName(note.reviewer_id)} · ${dateHe(note.created_at)} · סטטוס: ${NOTE_STATUS_LABELS[note.status]}`);
    const where = [
      note.block_id ? `בלוק \`${note.block_id}\`` : null,
      note.variant ? `גרסת מסך: ${note.variant}` : null,
      caseTitle ? `מקרה: ${caseTitle}${note.case_modified ? " (התשובות שונו)" : ""}` : null,
      str(ctx.scenario) ? `מצב באטלס: ${str(ctx.scenario)}` : null,
    ].filter(Boolean);
    if (where.length) out.push(`- מיקום: ${where.join(" · ")}`);
    out.push(`- איפה בקוד (השערה לפי המיקום): ${sourceHint(note.step, note.block_id)}`);
    if (note.quote) out.push("- הטקסט שעליו ההערה:", quoted(note.quote));
    out.push("- ההערה:", quoted(note.note));
    if (note.suggestion) out.push("- נוסח מוצע:", quoted(note.suggestion));
    const shown = [
      list(ctx.referrals) ? `הפניות בדוח: ${list(ctx.referrals)}` : null,
      list(ctx.tracks) ? `מסלולים במפה: ${list(ctx.tracks)}` : null,
      list(ctx.tips) ? `כלים לצוות: ${list(ctx.tips)}` : null,
    ].filter(Boolean);
    if (shown.length) out.push(`- מה הוצג באותו מצב: ${shown.join(" · ")}`);
    if (str(ctx.explain_text)) out.push("- ההסבר שהוצג (נוצר מחדש בכל לחיצה, לכן נשמר כפי שנראה):", quoted(str(ctx.explain_text)!));
    if (note.response) out.push("- תשובה שניתנה:", quoted(note.response));
    out.push(`- מזהה: \`${note.id}\``, "");
  }
  return out.join("\n");
}

const CSV_COLUMNS: [string, (n: ReviewNote, names: ExportNames) => string][] = [
  ["מזהה", n => n.id],
  ["תאריך", n => dateHe(n.created_at)],
  ["בודק/ת", (n, names) => names.reviewerName(n.reviewer_id)],
  ["מסך", (n, names) => names.screenName(n.step)],
  ["מזהה מסך", n => n.step],
  ["גרסת מסך", n => n.variant ?? ""],
  ["בלוק", n => n.block_label ?? ""],
  ["מזהה בלוק", n => n.block_id ?? ""],
  ["סוג", n => NOTE_KIND_LABELS[n.kind]],
  ["חומרה", n => NOTE_SEVERITY_LABELS[n.severity]],
  ["סטטוס", n => NOTE_STATUS_LABELS[n.status]],
  ["הטקסט שעליו ההערה", n => n.quote ?? ""],
  ["ההערה", n => n.note],
  ["נוסח מוצע", n => n.suggestion ?? ""],
  ["מקרה", (n, names) => names.caseTitle(n.case_id) ?? ""],
  ["התשובות שונו", n => (n.case_modified ? "כן" : "")],
  ["תשובה", n => n.response ?? ""],
];

/**
 * One cell, safe to open in Excel: quotes doubled, and a leading =, +, - or @
 * defused - a note is free text typed by someone else, and a spreadsheet
 * treats such a cell as a formula.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** With a BOM, so Excel reads the Hebrew as UTF-8. */
export function notesToCsv(notes: ReviewNote[], names: ExportNames): string {
  const rows = sortForExport(notes, names.screenOrder).map(n => CSV_COLUMNS.map(([, get]) => csvCell(get(n, names))).join(","));
  return `﻿${[CSV_COLUMNS.map(([h]) => csvCell(h)).join(","), ...rows].join("\r\n")}`;
}

/** Everything, answers included: what a later session needs to rebuild each state. */
export function notesToJson(notes: ReviewNote[], names: ExportNames): string {
  return JSON.stringify(
    sortForExport(notes, names.screenOrder).map(n => ({
      ...n,
      reviewer: names.reviewerName(n.reviewer_id),
      screen_name: names.screenName(n.step),
      case_title: names.caseTitle(n.case_id),
      source_hint: sourceHint(n.step, n.block_id),
    })),
    null,
    2,
  );
}
