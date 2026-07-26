"use client";

import { useEffect, useRef } from "react";
import { seedAttribution, type Attribution } from "@/app/lib/attribution";
import { usePageView } from "@/app/lib/useTrack";

// Runs on a saved-match return visit: FIRST restore the original attribution
// from the token (cross-device - localStorage may be empty here), THEN let the
// page_view fire so it, and every later event in this session (profile views,
// contact clicks), carries the original campaign.
export default function MatchReturnTracker({ seed }: { seed: Partial<Attribution> }) {
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
  return null;
}
