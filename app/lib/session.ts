/**
 * Visitor session id.
 *
 * A session is a VISIT, not a person: it expires after 30 minutes of
 * inactivity, the same definition GA4 and every analytics tool uses.
 *
 * It used to be minted once and kept forever, which quietly broke every metric
 * built on session counts. Measured 8/8/2026: two returning visitors showed up
 * as single "sessions" spanning 7 and 5 days, and between them accounted for
 * all 73 August visits attributed to a Meta campaign - on an ad account that
 * had been blocked for a month. Anything divided per session (visits, pages
 * per visit, conversion rate) was wrong in the same direction.
 */

const KEY = "mnt_session_id";
const SEEN_KEY = "mnt_session_seen";
const IDLE_MS = 30 * 60 * 1000;

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = Date.now();
    const seenRaw = localStorage.getItem(SEEN_KEY);
    const seen = seenRaw ? Number(seenRaw) : 0;
    let id = localStorage.getItem(KEY);

    // No id, or the previous activity is older than the idle window - this is
    // a new visit. A missing/corrupt timestamp on an existing id also starts a
    // fresh session rather than extending an unbounded old one.
    if (!id || !Number.isFinite(seen) || seen <= 0 || now - seen > IDLE_MS) {
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem(KEY, id);
    }

    // Touch on every call so the window slides with real activity.
    localStorage.setItem(SEEN_KEY, String(now));
    return id;
  } catch {
    return "";
  }
}
