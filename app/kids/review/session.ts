/**
 * Whether this browser is in the review mode of /school, and the calls the
 * review layer makes.
 *
 * A reviewer opens a personal link: /school#review=<token>. The token is in
 * the fragment and not in the query string, because a fragment is never sent
 * to the server and so never reaches a request log or an analytics page URL;
 * it is taken out of the address bar the moment it is read, and kept in this
 * browser so the link has to be opened only once.
 *
 * Kept tiny and free of React on purpose: KidsQuiz imports this file, and the
 * rest of the review mode is loaded only when one of these two functions says
 * it is wanted. A counsellor never downloads any of it.
 */

import type { NoteInput, ReviewNote } from "@/app/lib/school-review";
import type { Ans } from "../quiz-logic";

const STORE_KEY = "school_review_v1";
const RESTORE_KEY = "school_review_restore_v1";
const RESTORE_FLAG = "school_review_restore_on";
const SEEN_KEY = "school_review_seen_v1";
const TOKEN_RX = /^[A-Za-z0-9_-]{24,64}$/;

let cached: string | null | undefined;

function fromHash(): string | null {
  const m = /(?:^#|&)review=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!m || !TOKEN_RX.test(m[1])) return null;
  // Out of the address bar: a link that stays there gets copied, bookmarked
  // and shared in a screenshot.
  try {
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
  } catch { /* an old browser keeps the fragment; nothing breaks */ }
  return m[1];
}

/**
 * The review token of this browser, or null. Synchronous, so the very first
 * effect of the questionnaire can already know not to count this visit.
 */
export function reviewToken(): string | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  let token: string | null = null;
  try {
    token = fromHash();
    if (token) localStorage.setItem(STORE_KEY, token);
    else {
      const stored = localStorage.getItem(STORE_KEY);
      token = stored && TOKEN_RX.test(stored) ? stored : null;
    }
  } catch {
    token = null;
  }
  cached = token;
  return token;
}

/** Leave the review mode on this browser - the link was revoked, or the reviewer asked to. */
export function forgetReviewToken(): void {
  cached = null;
  try { localStorage.removeItem(STORE_KEY); } catch { /* nothing to forget */ }
}

// ── A note opened from the admin page ────────────────────────────────────────
// The admin page and /school share an origin, so a note's state travels through
// storage: no token in a URL, and nothing fetched that the admin did not
// already have on screen.

export interface RestorePayload {
  A: Ans;
  step: string;
  /** What the banner shows above the restored state. */
  note: { reviewer: string; kindLabel: string; text: string; quote: string | null; blockLabel: string | null };
  at: number;
}

/** Called by the admin page before it opens /school#review-restore. */
export function stashRestore(payload: Omit<RestorePayload, "at">): void {
  localStorage.setItem(RESTORE_KEY, JSON.stringify({ ...payload, at: Date.now() }));
}

function restoreRequested(): boolean {
  try {
    if (window.location.hash.includes("review-restore")) {
      sessionStorage.setItem(RESTORE_FLAG, "1");
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
    return sessionStorage.getItem(RESTORE_FLAG) === "1";
  } catch {
    return false;
  }
}

/** The state the admin page asked to open, once. Stale after ten minutes. */
export function takeRestore(): RestorePayload | null {
  try {
    const raw = localStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    localStorage.removeItem(RESTORE_KEY);
    const p = JSON.parse(raw) as RestorePayload;
    return p && typeof p.at === "number" && Date.now() - p.at < 10 * 60_000 && p.A && typeof p.step === "string" ? p : null;
  } catch {
    return null;
  }
}

/**
 * Is this visit a review - a reviewer with a link, or the owner opening a note
 * from the admin page? Either way it is not a counsellor at work, and nothing
 * it does should be counted as one.
 */
export function reviewActive(): boolean {
  if (typeof window === "undefined") return false;
  // Both are read, never short-circuited: each takes its own mark out of the
  // address bar, and a reviewer opening a note from the admin page has both.
  const restoring = restoreRequested();
  return reviewToken() !== null || restoring;
}

// ── What this reviewer has seen, kept locally and sent up in batches ─────────

/**
 * Kept per link, by the tail of its token: two people who open their links in
 * the same browser must not inherit each other's list of what was looked at.
 */
const seenStoreKey = () => `${SEEN_KEY}:${(reviewToken() ?? "none").slice(-8)}`;

export function readSeenLocal(): string[] {
  try {
    const raw = localStorage.getItem(seenStoreKey());
    return raw ? (JSON.parse(raw) as string[]).filter(k => typeof k === "string") : [];
  } catch {
    return [];
  }
}
export function writeSeenLocal(keys: Iterable<string>): void {
  try { localStorage.setItem(seenStoreKey(), JSON.stringify([...keys])); } catch { /* private mode */ }
}

// ── API ──────────────────────────────────────────────────────────────────────

export class ReviewApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/school-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, token: reviewToken(), ...payload }),
  });
  const json = await res.json().catch(() => ({ ok: false, error: "השרת לא ענה" }));
  if (!res.ok || !json.ok) throw new ReviewApiError(json.error || "שגיאה", res.status);
  return json as T;
}

export const reviewApi = {
  session: () => call<{ reviewer: { name: string }; notes: ReviewNote[]; seen: string[] }>("session"),
  addNote: (note: NoteInput) => call<{ note: ReviewNote }>("add_note", { note }),
  updateNote: (id: string, note: Pick<NoteInput, "kind" | "severity" | "note" | "suggestion">) => call<{ note: ReviewNote }>("update_note", { id, note }),
  withdrawNote: (id: string) => call<{ note: ReviewNote }>("withdraw_note", { id }),
  seen: (keys: string[]) => call<Record<string, never>>("seen", { keys }),
};
