"use client";

import { useEffect, useRef } from "react";
import { seedAttribution, type Attribution } from "@/app/lib/attribution";
import { usePageView } from "@/app/lib/useTrack";
import { getOrCreateSessionId } from "@/app/lib/session";
import { trackingOptedOut } from "@/app/lib/track-optout";

// Runs on a saved-match return visit: FIRST restore the original attribution
// from the token (cross-device - localStorage may be empty here), THEN let the
// page_view fire so it, and every later event in this session (profile views,
// contact clicks), carries the original campaign.
//
// It also records the visit against the token, with this session's id
// (18/9/26). That row is what ties a contact made after coming back to the
// questionnaire session that produced the list: contact.session_id ->
// match_token_visits.session_id -> match_tokens.session_id. The page_view
// alone could not, because it never carried the token.
export default function MatchReturnTracker({ seed, token }: { seed: Partial<Attribution>; token: string }) {
  const seeded = useRef(false);
  if (typeof window !== "undefined" && !seeded.current) {
    // Synchronous on first render - must beat every effect-based tracker.
    seeded.current = true;
    seedAttribution(seed);
  }
  useEffect(() => {
    seeded.current = true;
  }, []);
  usePageView("match_return", "match_return");

  const visitSent = useRef(false);
  useEffect(() => {
    if (visitSent.current || trackingOptedOut()) return;
    visitSent.current = true;
    fetch("/api/match-token/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, session_id: getOrCreateSessionId() }),
      keepalive: true,
    }).catch(() => {
      /* measurement only - never surfaces to the visitor */
    });
  }, [token]);
  return null;
}
