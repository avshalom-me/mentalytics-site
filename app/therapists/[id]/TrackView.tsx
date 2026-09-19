"use client";

import { useEffect, useRef } from "react";
import { getOrCreateSessionId } from "@/app/lib/session";
import { getAttribution } from "@/app/lib/attribution";
import { trackingOptedOut } from "@/app/lib/track-optout";
import { takeMatchContext, type SensitiveMatchContext } from "@/app/lib/match-view-context";

/**
 * What the URL may carry about a match visit: nothing about health. The
 * domain, treatment and finding that led here arrive separately, through
 * sessionStorage (see app/lib/match-view-context.ts), and are merged in below.
 */
export interface ViewerContext {
  region?: string;
  age_band?: string;
  gender?: string;
  match_score?: number;
}

export default function TrackView({
  therapistId,
  source,
  context,
}: {
  therapistId: string;
  source: "match" | "directory";
  context?: ViewerContext;
}) {
  // Taken once per mount: the store deletes an entry as it is read, and the
  // effect below can run twice for one view (React's development double-run),
  // which would otherwise send the second copy without its context.
  const sensitive = useRef<SensitiveMatchContext | null | undefined>(undefined);

  useEffect(() => {
    if (trackingOptedOut()) return; // מכשיר של הצוות
    if (sensitive.current === undefined) {
      sensitive.current = source === "match" ? takeMatchContext(therapistId) ?? null : null;
    }
    const s = sensitive.current;
    const session_id = getOrCreateSessionId();
    const attribution = getAttribution() ?? {};
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapist_id: therapistId,
        source,
        viewer_region: context?.region ?? null,
        viewer_issue: s?.issue ?? null,
        viewer_age_band: context?.age_band ?? null,
        viewer_gender: context?.gender ?? null,
        viewer_treatment: s?.treatment ?? null,
        viewer_symptom: s?.symptom ?? null,
        match_score: context?.match_score ?? null,
        session_id,
        ...attribution,
      }),
    }).catch(() => {});
  }, [therapistId, source, context]);

  return null;
}
