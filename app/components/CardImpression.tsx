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
  children,
}: {
  therapistId: string;
  position?: number;
  children: React.ReactNode;
}) {
  const ref = useImpressionTrack(therapistId, position);
  return <div ref={ref}>{children}</div>;
}
