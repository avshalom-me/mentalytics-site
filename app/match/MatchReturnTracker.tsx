"use client";

import { useEffect, useRef } from "react";
import { getAttribution, seedAttribution, type Attribution } from "@/app/lib/attribution";
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
//
// And the cards shown here are reported as match-card impressions, the way the
// results screen reports them (18/9/26). A contact made from this list already
// counts as a match contact, so the impressions it came from belong in the same
// funnel; before, these cards reported themselves as directory impressions.
// Repeat loads inside 30 minutes are deduplicated by /api/track-view.
export default function MatchReturnTracker({
  seed,
  token,
  quizType,
  impressions = [],
}: {
  seed: Partial<Attribution>;
  token: string;
  quizType: "adults" | "kids";
  impressions?: { therapistId: string; score: number | null }[];
}) {
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

  const impressionsSent = useRef(false);
  useEffect(() => {
    if (impressionsSent.current || impressions.length === 0 || trackingOptedOut()) return;
    impressionsSent.current = true;
    const sessionId = getOrCreateSessionId();
    // Runs after the synchronous seed above, so it carries the original campaign.
    const attribution = getAttribution() ?? {};
    // The same fields the results screen sends, minus what the saved list does
    // not store: the viewer's region, and for adults their issue, age and
    // gender. The kids quiz fixes issue and age band to "child", so those stay.
    const viewer = quizType === "kids" ? { viewer_issue: "child", viewer_age_band: "child" } : {};
    for (const { therapistId, score } of impressions) {
      fetch("/api/track-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_id: therapistId,
          source: "match_card",
          match_score: score,
          session_id: sessionId,
          ...viewer,
          ...attribution,
        }),
      }).catch(() => {});
    }
  }, [impressions, quizType]);
  return null;
}
