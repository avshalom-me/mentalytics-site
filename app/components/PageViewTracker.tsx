"use client";

import { usePageView } from "@/app/lib/useTrack";

/**
 * Fires a page_view analytics event on mount. Mounted on server-component
 * listing pages (city / region / online) so paid-search landings are counted
 * in the /admin patient funnel — tagged with the visitor's channel (e.g.
 * google_paid). Renders nothing. (For therapist-recruitment pages use
 * RecruitPageTracker instead, which fires a separate event type.)
 */
export default function PageViewTracker({ page, source }: { page: string; source?: string }) {
  usePageView(page, source);
  return null;
}
