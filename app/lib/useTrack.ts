"use client";

import { useEffect, useRef, useCallback } from "react";
import { getOrCreateSessionId } from "./session";
import { captureAttribution, getAttribution } from "./attribution";
import { gaEvent } from "./gtag";

type EventType = "page_view" | "profile_impression" | "filter_used" | "quiz_step" | "quiz_complete" | "recruit_page_view" | "therapist_explain_click" | "matching_click";

function sendTrack(event_type: EventType, extra?: Record<string, unknown>) {
  const session_id = getOrCreateSessionId();
  const attribution = getAttribution() ?? {};
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id, ...attribution, ...extra }),
  }).catch(() => {});
}

export function trackQuizStep(quizType: "adults" | "kids", step: string, progress: number) {
  sendTrack("quiz_step", { metadata: { quiz_type: quizType, step, progress } });
}

export function trackQuizComplete(quizType: "adults" | "kids") {
  sendTrack("quiz_complete", { metadata: { quiz_type: quizType } });
  gaEvent("quiz_complete", { quiz_type: quizType });
}

/**
 * Patient clicked "✦ ניתוח אישי" — an AI explanation of why a SPECIFIC therapist
 * fits them. The highest-intent action short of a contact click; previously
 * fired the OpenAI call but was tracked nowhere. Persisted per therapist_id so
 * the admin can see which therapists drive deep evaluation.
 */
export function trackTherapistExplain(therapistId: string, quizType: "adults" | "kids") {
  sendTrack("therapist_explain_click", { therapist_id: therapistId, source: quizType === "adults" ? "adult" : "child" });
}

/** Patient entered the matching flow for a treatment type (top of the match funnel). */
export function trackMatchingClick(quizType: "adults" | "kids", treatment: string) {
  sendTrack("matching_click", { source: quizType === "adults" ? "adult" : "child", metadata: { treatment } });
}

export function usePageView(page: string, source?: string) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    sendTrack("page_view", { source, metadata: { page } });
  }, [page, source]);
}

/**
 * Landing view on a therapist RECRUITMENT page (/therapists/join). Dedicated
 * event type — NOT page_view — so patient-funnel reports that count page_view
 * (directory entries, weekly report, attribution report) stay clean of
 * therapist-ad traffic. Powers the "מבקרים" column in /admin/recruitment
 * (distinct sessions per utm_campaign).
 */
export function useRecruitPageView(page: string) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // Capture the URL's utm before reading: getAttribution alone would keep a
    // stale stored touch if this effect ever ran before AttributionTracker's.
    captureAttribution();
    sendTrack("recruit_page_view", { source: page, metadata: { page } });
  }, [page]);
}

export function useFilterTrack() {
  return useCallback((filterName: string, filterValue: string) => {
    sendTrack("filter_used", { metadata: { filter_name: filterName, filter_value: filterValue } });
  }, []);
}

const impressedThisSession = new Set<string>();

export function useImpressionTrack(therapistId: string, position?: number) {
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
          const metadata = position != null ? { position } : undefined;
          sendTrack("profile_impression", { therapist_id: therapistId, source: "directory", metadata });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [therapistId, position]);

  return ref;
}
