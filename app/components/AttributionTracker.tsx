"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/app/lib/attribution";

/**
 * Captures marketing attribution (UTM / gclid / fbclid / referrer) as early as
 * possible on every landing. Renders nothing. Mounted once in the root layout.
 */
export default function AttributionTracker() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
