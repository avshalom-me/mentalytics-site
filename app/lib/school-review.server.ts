import "server-only";

import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { LIMITS, NOTE_KINDS, NOTE_SEVERITIES, type NoteInput, type NoteKind, type NoteSeverity } from "./school-review";

/**
 * The server side of the /school review mode: who a link belongs to, and what
 * a note may contain. See supabase/migrations/20261001_school_review.sql for
 * what is stored and why.
 */

export interface Reviewer {
  id: string;
  name: string;
  active: boolean;
  seen: Record<string, string>;
  created_at: string;
  last_seen_at: string | null;
}

/** 32 url-safe characters; what newReviewToken produces and nothing shorter. */
const TOKEN_RX = /^[A-Za-z0-9_-]{24,64}$/;

export function newReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * The active reviewer a token belongs to, or null.
 *
 * The shape is checked before the database is asked, so a request that carries
 * no token or a mangled one costs nothing - which matters on the score route,
 * where almost every caller is a counsellor with no token at all.
 */
export async function findReviewer(token: unknown): Promise<Reviewer | null> {
  if (typeof token !== "string" || !TOKEN_RX.test(token)) return null;
  const { data, error } = await supabaseAdmin
    .from("school_reviewers")
    .select("id, name, active, seen, created_at, last_seen_at")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as Reviewer;
}

export async function isActiveReviewToken(token: unknown): Promise<boolean> {
  return (await findReviewer(token)) !== null;
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v ?? null), "utf8");
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Never stored with a note: the device fingerprint and the two access tokens that ride in a score request. */
const NEVER_STORED = ["_fp", "_staffToken", "_reviewToken"];

export type CleanNote = Required<Pick<NoteInput, "step" | "kind" | "severity" | "note">> & {
  variant: string | null;
  block_id: string | null;
  block_label: string | null;
  quote: string | null;
  suggestion: string | null;
  case_id: string | null;
  case_modified: boolean;
  answers: Record<string, unknown> | null;
  context: Record<string, unknown>;
};

/** A note as it may be stored, or the reason it may not. */
export function cleanNoteInput(raw: unknown): { ok: true; value: CleanNote } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: "הערה לא תקינה" };
  const step = typeof raw.step === "string" && /^[a-z0-9-]{1,40}$/.test(raw.step) ? raw.step : null;
  if (!step) return { ok: false, error: "חסר המסך שעליו נכתבה ההערה" };
  if (!NOTE_KINDS.includes(raw.kind as NoteKind)) return { ok: false, error: "חסר סוג ההערה" };
  if (!NOTE_SEVERITIES.includes(raw.severity as NoteSeverity)) return { ok: false, error: "חסרה חומרת ההערה" };
  const note = text(raw.note, LIMITS.note);
  if (!note) return { ok: false, error: "ההערה ריקה" };

  let answers: Record<string, unknown> | null = null;
  if (isPlainObject(raw.answers)) {
    answers = { ...raw.answers };
    for (const k of NEVER_STORED) delete answers[k];
    if (bytes(answers) > LIMITS.answersBytes) return { ok: false, error: "מצב השאלון גדול מדי לשמירה" };
  }
  const context = isPlainObject(raw.context) && bytes(raw.context) <= LIMITS.contextBytes ? raw.context : {};

  return {
    ok: true,
    value: {
      step,
      variant: text(raw.variant, 40),
      block_id: text(raw.block_id, LIMITS.label),
      block_label: text(raw.block_label, LIMITS.label),
      quote: text(raw.quote, LIMITS.quote),
      kind: raw.kind as NoteKind,
      severity: raw.severity as NoteSeverity,
      note,
      suggestion: text(raw.suggestion, LIMITS.suggestion),
      case_id: text(raw.case_id, 60),
      case_modified: raw.case_modified === true,
      answers,
      context,
    },
  };
}

/** The parts of a note its writer may change afterwards: what it says, never where it sits or the state it was written on. */
export function cleanNoteEdit(raw: unknown): { ok: true; value: Pick<CleanNote, "kind" | "severity" | "note" | "suggestion"> } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: "הערה לא תקינה" };
  if (!NOTE_KINDS.includes(raw.kind as NoteKind)) return { ok: false, error: "חסר סוג ההערה" };
  if (!NOTE_SEVERITIES.includes(raw.severity as NoteSeverity)) return { ok: false, error: "חסרה חומרת ההערה" };
  const note = text(raw.note, LIMITS.note);
  if (!note) return { ok: false, error: "ההערה ריקה" };
  return { ok: true, value: { kind: raw.kind as NoteKind, severity: raw.severity as NoteSeverity, note, suggestion: text(raw.suggestion, LIMITS.suggestion) } };
}

export const NOTE_COLUMNS =
  "id, reviewer_id, created_at, updated_at, step, variant, block_id, block_label, quote, kind, severity, note, suggestion, case_id, case_modified, answers, context, status, response, handled_at, withdrawn_at";
