import { generalizeFinding } from "./sensitive-findings";

/**
 * The health-revealing part of a match-card click, handed to the therapist
 * profile without passing through its URL.
 *
 * Until 19/9/2026 the card link carried it as query parameters - `sy` (the
 * finding, e.g. "נמצא קושי בתפקוד המיני בזוגיות"), `t` (the treatment, e.g.
 * "טיפול מיני", "טיפול בהתמכרויות") and `i` (the domain, e.g. "addiction"). A
 * URL is not private: GA4 and the Google Ads tag both record the full page
 * location, Vercel keeps it in the request log, and the browser keeps it in
 * history. So the finding itself reached Google on every profile opened from
 * the results. It now goes in sessionStorage - per tab, gone when the tab
 * closes - and the profile's TrackView takes it from there for the same
 * therapist_profile_views row as before. Age band, gender, region and score
 * stay in the URL: none of them is a health fact, and the page reads `a` to
 * know which questionnaire "back" should return to.
 *
 * Trade-off accepted: a profile opened in a NEW tab starts with an empty
 * sessionStorage, so that one view is recorded without the context. Only the
 * therapist dashboard's breakdown loses a row; nothing the visitor sees changes.
 */

export type SensitiveMatchContext = {
  issue?: string;
  treatment?: string;
  symptom?: string;
};

type Entry = SensitiveMatchContext & { ts: number };

const KEY = "mnt_match_ctx";
// Long enough to read a profile and come back; short enough that nothing
// lingers in a tab left open on a shared computer.
const TTL_MS = 30 * 60_000;

function readAll(now: number): Record<string, Entry> {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
    const fresh: Record<string, Entry> = {};
    for (const [id, e] of Object.entries(parsed)) {
      if (e && typeof e.ts === "number" && now - e.ts <= TTL_MS) fresh[id] = e;
    }
    return fresh;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Entry>): void {
  try {
    if (Object.keys(all).length === 0) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked (private mode) - the view is recorded without context */
  }
}

/** Called on the card's click, right before the browser follows the link. */
export function stashMatchContext(therapistId: string, ctx: SensitiveMatchContext, now = Date.now()): void {
  if (!therapistId) return;
  const all = readAll(now);
  all[therapistId] = {
    issue: ctx.issue || undefined,
    treatment: ctx.treatment || undefined,
    // Pooled here as well as by the caller and the server: whatever reaches
    // this store must already be what may be recorded.
    symptom: (generalizeFinding(ctx.symptom) as string | undefined) || undefined,
    ts: now,
  };
  writeAll(all);
}

/**
 * Read once, on the profile, and removed as it is read - so nothing sensitive
 * waits in storage once it has been used.
 */
export function takeMatchContext(therapistId: string, now = Date.now()): SensitiveMatchContext | undefined {
  if (!therapistId) return undefined;
  const all = readAll(now);
  const e = all[therapistId];
  delete all[therapistId];
  writeAll(all);
  if (!e) return undefined;
  return { issue: e.issue, treatment: e.treatment, symptom: e.symptom };
}

/** Query parameters that must never appear on a profile URL again. */
export const SENSITIVE_PROFILE_PARAMS = ["i", "t", "sy"] as const;
