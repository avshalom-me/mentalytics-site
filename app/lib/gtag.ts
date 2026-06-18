/**
 * GA4 conversion helper. The gtag.js library + the global `gtag()` bootstrap are
 * loaded once in app/layout.tsx (measurement id G-V3QQRXSQ0T). This module wraps
 * `gtag('event', …)` so every funnel conversion fires from one typed place, and
 * no-ops safely when gtag is unavailable (SSR, dev without the script, or an
 * ad-blocker).
 *
 * Mark each of these events as a "key event" in the GA4 admin UI to turn it into
 * a conversion; once GA4 is linked to Google Ads they can be imported there too.
 */
import { getAttribution } from "./attribution";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Fire a GA4 event now. Safe no-op if gtag hasn't loaded yet. */
export function gaEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  // Attach our normalized marketing channel so conversions can be segmented by
  // source inside GA4. (GA4 also auto-captures the gclid-based source that
  // Google Ads needs for conversion import — this is an extra, friendly label.)
  const channel = getAttribution()?.channel;
  window.gtag("event", name, channel ? { ...params, channel } : params);
}

/**
 * Fire a GA4 event exactly once per browser session, waiting briefly for gtag to
 * load. Use on post-action "thank you" pages (payment success), where the page
 * mounts on load — there gtag.js may still be loading, and a refresh would
 * otherwise double-count the conversion.
 */
export function gaEventOnce(
  dedupeKey: string,
  name: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  const alreadyFired = () => {
    try {
      return sessionStorage.getItem(dedupeKey) === "1";
    } catch {
      return false; // sessionStorage blocked — fire anyway rather than lose the conversion
    }
  };
  if (alreadyFired()) return;

  let tries = 0;
  const attempt = () => {
    if (alreadyFired()) return;
    if (typeof window.gtag === "function") {
      try {
        sessionStorage.setItem(dedupeKey, "1");
      } catch {
        /* ignore — best-effort dedupe */
      }
      gaEvent(name, params);
      return;
    }
    if (tries++ < 20) setTimeout(attempt, 150); // wait up to ~3s for gtag.js
  };
  attempt();
}
