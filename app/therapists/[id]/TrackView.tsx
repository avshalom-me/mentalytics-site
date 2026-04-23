"use client";

import { useEffect } from "react";

export interface ViewerContext {
  region?: string;
  issue?: string;
  age_band?: string;
  gender?: string;
  match_score?: number;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "mnt_session_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      // Not for identification — just for dedup. 16 hex chars is enough.
      id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
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
  useEffect(() => {
    const session_id = getOrCreateSessionId();
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        therapist_id: therapistId,
        source,
        viewer_region: context?.region ?? null,
        viewer_issue: context?.issue ?? null,
        viewer_age_band: context?.age_band ?? null,
        viewer_gender: context?.gender ?? null,
        match_score: context?.match_score ?? null,
        session_id,
      }),
    }).catch(() => {});
  }, [therapistId, source, context]);

  return null;
}
