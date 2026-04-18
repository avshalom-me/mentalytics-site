"use client";

import { useEffect } from "react";

export default function TrackView({ therapistId, source }: { therapistId: string; source: "match" | "directory" }) {
  useEffect(() => {
    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ therapist_id: therapistId, source }),
    }).catch(() => {});
  }, [therapistId, source]);

  return null;
}
