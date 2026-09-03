"use client";

import { useEffect, useRef, useCallback } from "react";
import { getOrCreateSessionId } from "./session";
import { captureAttribution, getAttribution } from "./attribution";
import { trackingOptedOut } from "./track-optout";
import { gaEvent } from "./gtag";

type EventType = "page_view" | "profile_impression" | "filter_used" | "quiz_step" | "quiz_complete" | "quiz_treatments" | "recruit_page_view" | "therapist_explain_click" | "matching_click" | "match_search" | "match_results" | "match_saved";

function sendTrack(event_type: EventType, extra?: Record<string, unknown>) {
  if (trackingOptedOut()) return; // מכשיר של הצוות - לא מזהמים את הנתונים
  const session_id = getOrCreateSessionId();
  const attribution = getAttribution() ?? {};
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event_type, session_id, ...attribution, ...extra }),
  }).catch(() => {});
}

/**
 * Coarse viewport bucket, three values, recomputed per event.
 *
 * Quiz dropout could be read per step but not per device, so "the text is too
 * small on a phone" could never be confirmed or measured against the funnel.
 * Width buckets are the whole story here - no user agent, no screen dimensions,
 * nothing that narrows a visitor down.
 */
function deviceBucket(): "mobile" | "tablet" | "desktop" | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window.innerWidth;
  if (!w) return undefined;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function trackQuizStep(quizType: "adults" | "kids", step: string, progress: number) {
  sendTrack("quiz_step", { metadata: { quiz_type: quizType, step, progress, device: deviceBucket() } });
}

/**
 * Anonymous, coarse profile of a completed questionnaire.
 *
 * Every field is a bucketed category already stored at the same granularity on
 * therapist_profile_views - no free text, no answers, nothing that identifies a
 * person. This is what makes the aggregate publishable: "of the people who
 * arrived with X, the system matched Y" is a statement about counts, and the
 * underlying rows cannot be walked back to anyone.
 */
export type QuizCompleteFacts = {
  /** Analytics-issue taxonomy: emotional | functional | relationship | addiction | personal | child */
  issue?: string | null;
  /** Recommended treatment labels, in rank order. */
  treatments?: string[];
  age_band?: string | null;
  region?: string | null;
  gender?: string | null;
};

/**
 * Schema version of the quiz_complete metadata.
 *
 * Bumped to 2 on 6/8/2026 when the facts above were added; version 1 rows
 * carry only `quiz_type`. This exists so analysis never has to guess a cutoff
 * date: `metadata->>'v' = '2'` selects exactly the rows that have the new
 * fields, and rows without it are unambiguously the old shape. Filtering by
 * created_at would be wrong the moment a deploy is rolled back or a client
 * keeps an old bundle cached and keeps sending v1 events for hours.
 */
const QUIZ_COMPLETE_SCHEMA = 2;

export function trackQuizComplete(quizType: "adults" | "kids", facts?: QuizCompleteFacts) {
  sendTrack("quiz_complete", {
    metadata: {
      v: QUIZ_COMPLETE_SCHEMA,
      quiz_type: quizType,
      ...(facts?.issue ? { issue: facts.issue } : {}),
      ...(facts?.treatments?.length ? { treatments: facts.treatments.slice(0, 5) } : {}),
      ...(facts?.age_band ? { age_band: facts.age_band } : {}),
      ...(facts?.region ? { region: facts.region } : {}),
      ...(facts?.gender ? { gender: facts.gender } : {}),
    },
  });
  // GA4 gets the low-cardinality fields only - treatments is an array, which GA4
  // cannot aggregate as a custom dimension.
  gaEvent("quiz_complete", { quiz_type: quizType, issue: facts?.issue ?? undefined });
}

/**
 * What a finished questionnaire actually recommended.
 *
 * Separate from quiz_complete because the kids flow fires that one on reaching
 * the result screen, before scoring has run - so its completion events have
 * never carried a treatment list, and there was no way to ask what the child
 * questionnaire recommends. Moving quiz_complete after scoring would have fixed
 * the data by redefining "completion" mid-series; this leaves that metric alone
 * and reports the treatments on their own event, once per scored questionnaire.
 *
 * Keys, not display labels - the same strings the matching searches on.
 */
export function trackQuizTreatments(
  quizType: "adults" | "kids",
  keys: { treatments?: string[]; assessments?: string[]; professionals?: string[] },
) {
  const { treatments = [], assessments = [], professionals = [] } = keys;
  if (!treatments.length && !assessments.length && !professionals.length) return;
  sendTrack("quiz_treatments", {
    metadata: {
      quiz_type: quizType,
      ...(treatments.length ? { treatments: treatments.slice(0, 10) } : {}),
      ...(assessments.length ? { assessments: assessments.slice(0, 10) } : {}),
      ...(professionals.length ? { professionals: professionals.slice(0, 10) } : {}),
    },
  });
}

/**
 * Patient clicked "✦ ניתוח אישי" - an AI explanation of why a SPECIFIC therapist
 * fits them. The highest-intent action short of a contact click; previously
 * fired the OpenAI call but was tracked nowhere. Persisted per therapist_id so
 * the admin can see which therapists drive deep evaluation.
 */
export function trackTherapistExplain(therapistId: string, quizType: "adults" | "kids") {
  sendTrack("therapist_explain_click", { therapist_id: therapistId, source: quizType === "adults" ? "adult" : "child" });
}

/** Patient entered the matching flow for a treatment type (top of the match funnel). */
export function trackMatchingClick(
  quizType: "adults" | "kids",
  treatment: string,
  // "top" = the single prominent button above the report, added 3/9/26 after
  // 107 of 122 non-searching sessions left the results screen within ~30s
  // without pressing any of the per-finding buttons. Tagged so the two
  // placements can be compared; omitted = the in-card button (unchanged).
  placement?: "top" | "card",
) {
  const metadata = placement ? { treatment, placement } : { treatment };
  sendTrack("matching_click", { source: quizType === "adults" ? "adult" : "child", metadata });
  // Single GA4 emission point (was inline gtag at each call site, which bypassed
  // the channel-attaching wrapper and only covered the adults flow).
  gaEvent("matching_click", { quiz_type: quizType, treatment, ...(placement ? { placement } : {}) });
}

/**
 * Patient actually submitted the therapist search - the step AFTER
 * matching_click, which only means the form opened.
 *
 * Carries the region they chose, and that is the point: region lives nowhere
 * else in the event stream. It reaches the DB as viewer_region on profile-view
 * rows, so it exists only for sessions whose results finished rendering. Here
 * it is recorded at the moment of asking.
 *
 * `region: null` is meaningful, not missing data - it is the "no location
 * given" search, which the scorer treats as professional-fit-only and which
 * produces the inflated scores measured on 17/8/2026.
 */
export function trackMatchSearch(
  quizType: "adults" | "kids",
  opts: { region: string | null; city?: string | null; online: boolean },
) {
  sendTrack("match_search", {
    source: quizType === "adults" ? "adult" : "child",
    metadata: {
      quiz_type: quizType,
      region: opts.region || null,
      city: opts.city || null,
      online: opts.online,
      // הדגל שמאפשר לספור בשאילתה אחת כמה חיפשו בלי מיקום בכלל.
      no_location: !opts.region && !opts.city && !opts.online,
    },
  });
}

/**
 * כמה אפשרויות המטופל באמת קיבל בחיפוש הזה.
 *
 * נשלח **אחרי** שהתשובה חזרה, ולכן בנפרד מ-trackMatchSearch שנשלח ברגע
 * השאלה. בלי המספר הזה אי אפשר לדעת אם אזור "מכוסה" באמת: סוכן פערי
 * ההיצע ידע לספור כמה מטפלים קיימים, אבל לא כמה מהם הופיעו בפועל למי
 * שחיפש - וזה ההבדל בין ירושלים "מכוסה" לירושלים עם שתי אפשרויות למסך.
 */
export function trackMatchResults(
  quizType: "adults" | "kids",
  opts: { region: string | null; city?: string | null; online: boolean; returned: number },
) {
  sendTrack("match_results", {
    source: quizType === "adults" ? "adult" : "child",
    metadata: {
      quiz_type: quizType,
      region: opts.region || null,
      city: opts.city || null,
      online: opts.online,
      returned: opts.returned,
      // הדגל שמאפשר לספור בשאילתה אחת כמה חיפושים הציגו בחירה דלה.
      thin: opts.returned < 4,
    },
  });
}

/** Patient saved their match list (WhatsApp-to-self / copy link). */
export function trackMatchSaved(quizType: "adults" | "kids", token: string, count: number) {
  sendTrack("match_saved", { source: quizType === "adults" ? "adult" : "child", metadata: { token, count } });
  gaEvent("match_saved", { quiz_type: quizType });
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
 * event type - NOT page_view - so patient-funnel reports that count page_view
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

/**
 * therapistId = null משבית את המעקב: כרטיס מרכז של מסלול 1 מסונתז מחשבון
 * המרכז ואין לו שורה ב-therapists, ול-analytics_events יש FK לטבלה הזו -
 * דיווח עליו היה נדחה בשקט בכל גלילה.
 */
export function useImpressionTrack(therapistId: string | null, position?: number) {
  const ref = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!therapistId || !el || tracked.current || impressedThisSession.has(therapistId)) return;

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
