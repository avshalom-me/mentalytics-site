/**
 * The vocabulary of a review note, shared by the questionnaire's review layer,
 * the two API routes and the admin page.
 *
 * Pure and client-safe. What talks to the database is school-review.server.ts.
 */

export const NOTE_KINDS = ["error", "wording", "missing", "clinical", "other"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  error: "טעות",
  wording: "ניסוח",
  missing: "חסר",
  clinical: "שאלה קלינית",
  other: "אחר",
};

export const NOTE_SEVERITIES = ["high", "medium", "low"] as const;
export type NoteSeverity = (typeof NOTE_SEVERITIES)[number];
export const NOTE_SEVERITY_LABELS: Record<NoteSeverity, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };

export const NOTE_STATUSES = ["open", "accepted", "rejected", "done"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export const NOTE_STATUS_LABELS: Record<NoteStatus, string> = {
  open: "חדשה",
  accepted: "אושרה ליישום",
  rejected: "לא תיושם",
  done: "טופלה",
};

/** A screen id for a note written inside the committees atlas rather than on a questionnaire screen. */
export const ATLAS_STEP = "atlas";

export interface ReviewNote {
  id: string;
  reviewer_id: string;
  created_at: string;
  updated_at: string;
  step: string;
  variant: string | null;
  block_id: string | null;
  block_label: string | null;
  quote: string | null;
  kind: NoteKind;
  severity: NoteSeverity;
  note: string;
  suggestion: string | null;
  case_id: string | null;
  case_modified: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any> | null;
  context: Record<string, unknown>;
  status: NoteStatus;
  response: string | null;
  handled_at: string | null;
  withdrawn_at: string | null;
}

/** What the review layer sends when a note is written. */
export interface NoteInput {
  step: string;
  variant?: string | null;
  block_id?: string | null;
  block_label?: string | null;
  quote?: string | null;
  kind: NoteKind;
  severity: NoteSeverity;
  note: string;
  suggestion?: string | null;
  case_id?: string | null;
  case_modified?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers?: Record<string, any> | null;
  context?: Record<string, unknown>;
}

export const LIMITS = {
  note: 4000,
  suggestion: 4000,
  quote: 1500,
  label: 240,
  response: 4000,
  /** The answers of one questionnaire are a few kilobytes; this is a ceiling against abuse, not a budget. */
  answersBytes: 60_000,
  contextBytes: 24_000,
  notesPerReviewer: 2000,
  seenKeys: 600,
} as const;

/**
 * Where the text behind a note most likely lives, from the block it was
 * written on. A hint for whoever turns the note into a change - the quote is
 * what is actually searched for.
 */
export function sourceHint(step: string, blockId: string | null | undefined): string {
  const id = blockId ?? "";
  if (id.startsWith("track:")) return "app/lib/school-tracks.ts, app/lib/gan-tracks.ts, app/lib/school-tracks-clinical.ts";
  if (id.startsWith("tip:")) return "app/lib/school-report.ts (SCHOOL_TIPS), app/lib/gan-report.ts (GAN_TIPS)";
  if (id.startsWith("summary")) return "app/lib/school-report.ts (buildSchoolSummary)";
  if (id.startsWith("rule:")) return "app/lib/school-report.ts (eligibilityRoutes), app/lib/gan-report.ts (ganRoutes)";
  if (id.startsWith("schedule")) return "app/lib/school-tracks.ts (ACCEPTABLE_BY_CATEGORY)";
  if (id.startsWith("pending")) return "app/lib/school-tracks-clinical.ts, app/lib/gan-report.ts (GAN_PENDING_DECISIONS)";
  if (id.startsWith("case:")) return "app/kids/review/cases.ts";
  if (id.startsWith("explain")) return "app/api/explain-recommendation/route.ts, app/lib/treatment-rationale.ts";
  if (step === "p-result") return "app/lib/kids-score.server.ts (ממצאים, הפניות וכלים), app/lib/kids-recommendations.ts, app/kids/KidsQuiz.tsx";
  if (step === "p-refine" || step === "p-docs" || step === "p-consent" || step === "p-demo") return "app/kids/counselor.tsx, app/lib/school-report.ts, app/lib/gan-report.ts";
  if (step === ATLAS_STEP) return "app/kids/review/Atlas.tsx";
  return "app/kids/KidsQuiz.tsx, app/lib/questionnaire-items.server.ts, app/kids/counselor.tsx";
}
