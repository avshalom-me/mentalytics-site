"use client";

import { useEffect, useRef, useCallback } from "react";
import { getOrCreateSessionId } from "./session";

type EventType = "page_view" | "profile_impression" | "filter_used" | "quiz_step" | "quiz_complete";

function sendTrack(event_type: EventType, extra?: Record<string, unknown>) {
  const session_id = getOrCreateSessionId();
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id, ...extra }),
  }).catch(() => {});
}

export function trackQuizStep(quizType: "adults" | "kids", step: string, progress: number) {
  sendTrack("quiz_step", { metadata: { quiz_type: quizType, step, progress } });
}

export function trackQuizComplete(quizType: "adults" | "kids") {
  sendTrack("quiz_complete", { metadata: { quiz_type: quizType } });
}

export function usePageView(page: string, source?: string) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendTrack("page_view", { source, metadata: { page } });
  }, [page, source]);
}

export function useFilterTrack() {
  return useCallback((filterName: string, filterValue: string) => {
    sendTrack("filter_used", { metadata: { filter_name: filterName, filter_value: filterValue } });
  }, []);
}

const impressedThisSession = new Set<string>();

export function useImpressionTrack(therapistId: string) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || tracked.current || impressedThisSession.has(therapistId)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current && !impressedThisSession.has(therapistId)) {
          tracked.current = true;
          impressedThisSession.add(therapistId);
          sendTrack("profile_impression", { therapist_id: therapistId, source: "directory" });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [therapistId]);

  return ref;
}
