"use client";

import { useEffect } from "react";
import { gaEventOnce } from "@/app/lib/gtag";

/**
 * Fires a GA4 conversion once on mount. Drop into any "thank you" / success page
 * (including server components) to record a conversion when the page is reached.
 */
export default function GaConversion({
  event,
  dedupeKey,
  params,
}: {
  event: string;
  dedupeKey: string;
  params?: Record<string, unknown>;
}) {
  useEffect(() => {
    gaEventOnce(dedupeKey, event, params);
    // Fire-once-on-mount; gaEventOnce handles dedupe + gtag readiness.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
