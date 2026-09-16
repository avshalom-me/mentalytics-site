"use client";

import { useImpressionTrack } from "@/app/lib/useTrack";

/**
 * Client-side impression wrapper for server-rendered therapist cards (the
 * region / city SEO pages). Those cards emitted NO profile_impression, so
 * therapists shown there were invisible in "חשיפות" and the directory's
 * impression→view conversion read slightly high. Same IntersectionObserver +
 * per-session dedup as the main directory cards.
 */
export default function CardImpression({
  therapistId,
  position,
  tier,
  children,
}: {
  therapistId: string;
  position?: number;
  /** free = חינמי, מוסתר למבקר ממומן (app/lib/paid-visitor.ts). על העוטף, כי הוא פריט הרשת. */
  tier?: "free" | "promoted";
  children: React.ReactNode;
}) {
  const ref = useImpressionTrack(therapistId, position);
  return <div ref={ref} data-tier={tier}>{children}</div>;
}
