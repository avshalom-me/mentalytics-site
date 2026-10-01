/**
 * What a review note may contain on its way into the database, and what it
 * looks like on its way out to whoever acts on it.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));

import { cleanNoteEdit, cleanNoteInput, newReviewToken } from "./school-review.server";
import { LIMITS, sourceHint, type ReviewNote } from "./school-review";
import { csvCell, notesToCsv, notesToJson, notesToMarkdown, sortForExport, type ExportNames } from "./school-review-export";

const valid = { step: "p-result", kind: "wording", severity: "medium", note: "  הניסוח לא ברור  " };

describe("a note on its way in", () => {
  it("is accepted with only the four required parts, trimmed", () => {
    const r = cleanNoteInput(valid);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.note).toBe("הניסוח לא ברור");
    expect(r.value.answers).toBeNull();
    expect(r.value.context).toEqual({});
    expect(r.value.case_modified).toBe(false);
  });

  it("is refused without a screen, a kind, a severity or any text", () => {
    expect(cleanNoteInput(null).ok).toBe(false);
    expect(cleanNoteInput({ ...valid, step: "" }).ok).toBe(false);
    expect(cleanNoteInput({ ...valid, step: "p-result; drop table" }).ok).toBe(false);
    expect(cleanNoteInput({ ...valid, kind: "praise" }).ok).toBe(false);
    expect(cleanNoteInput({ ...valid, severity: "urgent" }).ok).toBe(false);
    expect(cleanNoteInput({ ...valid, note: "   " }).ok).toBe(false);
  });

  it("never stores the fingerprint or an access token that rode in with the answers", () => {
    const r = cleanNoteInput({ ...valid, answers: { _grade: "ח", q1: 3, _fp: "abc", _staffToken: "s", _reviewToken: "t" } });
    expect(r.ok && r.value.answers).toEqual({ _grade: "ח", q1: 3 });
  });

  it("cuts long text to its limit and refuses answers the size of an attack", () => {
    const r = cleanNoteInput({ ...valid, note: "א".repeat(LIMITS.note + 500), quote: "ב".repeat(LIMITS.quote + 500) });
    expect(r.ok && r.value.note.length).toBe(LIMITS.note);
    expect(r.ok && r.value.quote?.length).toBe(LIMITS.quote);
    expect(cleanNoteInput({ ...valid, answers: { blob: "x".repeat(LIMITS.answersBytes) } }).ok).toBe(false);
  });

  it("lets its writer change what it says and nothing else", () => {
    const r = cleanNoteEdit({ kind: "error", severity: "high", note: "טעות", suggestion: "", step: "p-q1", answers: { q1: 5 } });
    expect(r.ok && r.value).toEqual({ kind: "error", severity: "high", note: "טעות", suggestion: null });
  });
});

describe("a review link", () => {
  it("carries a token long enough not to be guessed, and url-safe", () => {
    const a = newReviewToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newReviewToken()).not.toBe(a);
  });
});

const note = (over: Partial<ReviewNote>): ReviewNote => ({
  id: "00000000-0000-4000-8000-000000000001", reviewer_id: "r1", created_at: "2026-10-01T08:00:00Z", updated_at: "2026-10-01T08:00:00Z",
  step: "p-result", variant: "school", block_id: "track:zakaut:steps", block_label: "מסלול: ועדת זכאות ואפיון · צעדים",
  quote: "ההורים בוחרים בין שלוש מסגרות", kind: "error", severity: "medium", note: "לא מדויק", suggestion: null,
  case_id: "noam-8", case_modified: false, answers: { _grade: "ח" }, context: { tracks: ["zakaut:consider"] },
  status: "open", response: null, handled_at: null, withdrawn_at: null, ...over,
});
const names: ExportNames = {
  screenName: s => (s === "p-q1" ? "1. דאגות ולחצים" : s === "p-result" ? "הדוח" : s),
  screenOrder: ["p-q1", "p-result", "atlas"],
  reviewerName: () => "בודקת",
  caseTitle: id => (id === "noam-8" ? "נועם, כיתה ח'" : null),
};

describe("notes on their way out", () => {
  const notes = [
    note({ id: "a", step: "p-result", severity: "low" }),
    note({ id: "b", step: "p-q1", severity: "medium", block_id: null, block_label: null }),
    note({ id: "c", step: "p-result", severity: "high" }),
  ];

  it("follow the questionnaire, and within a screen the worst comes first", () => {
    expect(sortForExport(notes, names.screenOrder).map(n => n.id)).toEqual(["b", "c", "a"]);
  });

  it("say, for each note, what it is about and where to look for it", () => {
    const md = notesToMarkdown([notes[0]], names);
    expect(md).toContain("## הדוח (`p-result`)");
    expect(md).toContain("> ההורים בוחרים בין שלוש מסגרות");
    expect(md).toContain("בלוק `track:zakaut:steps`");
    expect(md).toContain("מקרה: נועם, כיתה ח'");
    expect(md).toContain("app/lib/school-tracks.ts");
    expect(md).toContain("מסלולים במפה: zakaut:consider");
  });

  it("keep a multi-line quote as one quote", () => {
    const md = notesToMarkdown([note({ quote: "שורה אחת\nשורה שתיים" })], names);
    expect(md).toContain("  > שורה אחת\n  > שורה שתיים");
  });

  it("carry the answers in the JSON, which is what rebuilds the state", () => {
    const parsed = JSON.parse(notesToJson([notes[0]], names));
    expect(parsed[0].answers).toEqual({ _grade: "ח" });
    expect(parsed[0].source_hint).toContain("school-tracks");
    expect(parsed[0].case_title).toBe("נועם, כיתה ח'");
  });

  it("open in Excel without running anything a reviewer typed", () => {
    expect(csvCell('הוא אמר "לא"')).toBe('"הוא אמר ""לא"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("\"'=HYPERLINK(1)\"");
    expect(csvCell("-5 נקודות")).toBe("\"'-5 נקודות\"");
    const csv = notesToCsv([notes[0]], names);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});

describe("the pointer from a note to the code", () => {
  it("follows the block the note sits on", () => {
    expect(sourceHint("p-result", "track:hatamot:why")).toContain("school-tracks");
    expect(sourceHint("p-result", "tip:regulation")).toContain("SCHOOL_TIPS");
    expect(sourceHint("p-result", "finding:CBT")).toContain("kids-score.server");
    expect(sourceHint("atlas", "rule:learning")).toContain("eligibilityRoutes");
    expect(sourceHint("p-aq", null)).toContain("questionnaire-items");
    expect(sourceHint("p-refine", "q:איך מולא השאלון")).toContain("counselor.tsx");
  });
});
