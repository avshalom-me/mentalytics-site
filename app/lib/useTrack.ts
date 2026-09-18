"use client";

import { useEffect, useRef, useCallback } from "react";
import { getOrCreateSessionId } from "./session";
import { captureAttribution, getAttribution } from "./attribution";
import { trackingOptedOut } from "./track-optout";
import { gaEvent } from "./gtag";
import { tfaEvent } from "./taboola";

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

/** Which questionnaire an event belongs to. "school" is the counsellor rubric. */
export type QuizType = "adults" | "kids" | "school";

/**
 * The audience tag carried on therapist-facing events.
 *
 * A counsellor is neither the patient nor the parent, so she gets her own
 * value rather than being folded into "child" - otherwise every count of who
 * looked at a therapist would quietly include professionals browsing on behalf
 * of families who have chosen nothing.
 */
function sourceOf(quizType: QuizType): "adult" | "child" | "school" {
  return quizType === "adults" ? "adult" : quizType === "school" ? "school" : "child";
}

export function trackQuizStep(quizType: QuizType, step: string, progress: number) {
  sendTrack("quiz_step", { metadata: { quiz_type: quizType, step, progress, device: deviceBucket() } });
  // המרת Taboola נורית רק במסך הפתיחה. בלי התנאי הזה כל שאלה בשאלון
  // הייתה נספרת כהמרה נפרדת ומנפחת את הנתון פי עשרות. לכל שאלון מסך פתיחה
  // משלו: "disclaimer" במבוגרים, "p-consent" בילדים - בלי השני, רבע
  // מההתחלות (הורים) לא היו נספרות לקמפיין הארצי.
  // Taboola pays for parents and adults; a counsellor is not a campaign
  // conversion, so the school rubric reports no start to it.
  const opening = quizType === "adults" ? "disclaimer" : "p-consent";
  if (step === opening && quizType !== "school") tfaEvent("quiz_start", { once: `tfa_quiz_start_${quizType}` });
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
/*
 * Bumped to 3 on 18/9/2026: `treatments` is now the DISTINCT treatments. In v2 it
 * was one entry per recommendation, cut to five - so "CBT, CBT, CBT, CBT, CBT"
 * was a common value and whatever ranked sixth (usually טיפול דינאמי) was lost
 * from 46% of adult records. v2 treatment shares are therefore lower bounds for
 * everything but CBT and must not be pooled with v3. The full result - every
 * domain, assessments, the default flag, the questionnaire version - lives on
 * quiz_treatments v2 (trackQuizResult); this event stays the completion marker.
 */
const QUIZ_COMPLETE_SCHEMA = 3;

export function trackQuizComplete(quizType: QuizType, facts?: QuizCompleteFacts) {
  sendTrack("quiz_complete", {
    metadata: {
      v: QUIZ_COMPLETE_SCHEMA,
      quiz_type: quizType,
      ...(facts?.issue ? { issue: facts.issue } : {}),
      ...(facts?.treatments?.length ? { treatments: Array.from(new Set(facts.treatments)).slice(0, 5) } : {}),
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
 * The recorded result of a scored questionnaire - one event, one shape, for the
 * adults, kids and school flows alike.
 *
 * Carried by the `quiz_treatments` event (the name predates its scope) rather
 * than by quiz_complete, because the kids flow fires quiz_complete on reaching
 * the result screen, before scoring has run; moving it would have redefined
 * "completion" mid-series. quiz_complete stays the funnel marker, this is the
 * research record, and the two join on session_id.
 *
 * Every field is a key or a bucket - no free text, no answers, no finding text.
 * A suicidality finding in particular is never part of this record, not even as
 * an "urgent" flag: see sensitive-findings.ts.
 *
 * v2 (18/9/2026) against v1, which was kids-only and carried three key lists:
 *  - sent for EVERY scored questionnaire, including one that found nothing
 *    (n_recs 0). v1 skipped those, so they were missing from every denominator.
 *  - `domains`: all the domains the person selected. quiz_complete.issue records
 *    only the first, which put relationships at 19% when 49% had selected it.
 *  - `default_treatments`: keys present only because nothing fired (see
 *    quiz-result-facts.ts).
 *  - `qv` / `cv` / `build`: the instrument version that scored it, the one baked
 *    into this bundle, and the commit. qv != cv means a cached bundle asked the
 *    questions and a newer server scored them - a mixed-version record.
 *  - age band, gender and device, so the record stands on its own.
 */
export type QuizResultFacts = {
  domains?: string[];
  treatments?: string[];
  assessments?: string[];
  professionals?: string[];
  defaultTreatments?: string[];
  nRecs: number;
  age_band?: string | null;
  gender?: string | null;
  /** Instrument version reported by the score API. */
  algo?: string | null;
};

const QUIZ_RESULT_SCHEMA = 2;
// Distinct keys per family never approach this; it is a payload guard, and
// `truncated` records the day it ever bites instead of failing silently again.
const RESULT_KEYS_CAP = 15;

export function trackQuizResult(quizType: QuizType, facts: QuizResultFacts) {
  const lists = {
    domains: uniqueKeys(facts.domains),
    treatments: uniqueKeys(facts.treatments),
    assessments: uniqueKeys(facts.assessments),
    professionals: uniqueKeys(facts.professionals),
    default_treatments: uniqueKeys(facts.defaultTreatments),
  };
  const truncated = Object.values(lists).some((l) => l.length > RESULT_KEYS_CAP);
  const metadata: Record<string, unknown> = {
    v: QUIZ_RESULT_SCHEMA,
    quiz_type: quizType,
    n_recs: facts.nRecs,
  };
  for (const [name, list] of Object.entries(lists)) {
    if (list.length) metadata[name] = list.slice(0, RESULT_KEYS_CAP);
  }
  if (truncated) metadata.truncated = true;
  // Staff test runs (the quiz sends this token as _staffToken) are marked rather
  // than dropped, so a production check can still be read back. The weekly
  // counters exclude them outright; research queries must exclude staff rows.
  try {
    if (localStorage.getItem("staff_token")) metadata.staff = true;
  } catch {
    /* storage blocked - treat as a visitor */
  }
  if (facts.age_band) metadata.age_band = facts.age_band;
  if (facts.gender) metadata.gender = facts.gender;
  if (facts.algo) metadata.qv = facts.algo;
  if (process.env.NEXT_PUBLIC_QUIZ_ALGO_VERSION) metadata.cv = process.env.NEXT_PUBLIC_QUIZ_ALGO_VERSION;
  if (process.env.NEXT_PUBLIC_BUILD_SHA) metadata.build = process.env.NEXT_PUBLIC_BUILD_SHA;
  const device = deviceBucket();
  if (device) metadata.device = device;
  sendTrack("quiz_treatments", { metadata });
}

function uniqueKeys(list: string[] | undefined): string[] {
  return Array.from(new Set((list ?? []).filter((k) => typeof k === "string" && k.length > 0)));
}

/**
 * Patient clicked "✦ ניתוח אישי" - an AI explanation of why a SPECIFIC therapist
 * fits them. The highest-intent action short of a contact click; previously
 * fired the OpenAI call but was tracked nowhere. Persisted per therapist_id so
 * the admin can see which therapists drive deep evaluation.
 */
export function trackTherapistExplain(therapistId: string, quizType: QuizType) {
  sendTrack("therapist_explain_click", { therapist_id: therapistId, source: sourceOf(quizType) });
}

/** Patient entered the matching flow for a treatment type (top of the match funnel). */
export function trackMatchingClick(
  quizType: QuizType,
  treatment: string,
  // "top" = the single prominent button above the report, added 3/9/26 after
  // 107 of 122 non-searching sessions left the results screen within ~30s
  // without pressing any of the per-finding buttons. Tagged so the two
  // placements can be compared; omitted = the in-card button (unchanged).
  placement?: "top" | "card",
) {
  const metadata = placement ? { treatment, placement } : { treatment };
  sendTrack("matching_click", { source: sourceOf(quizType), metadata });
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
  quizType: QuizType,
  opts: { region: string | null; city?: string | null; online: boolean },
) {
  sendTrack("match_search", {
    source: sourceOf(quizType),
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
  quizType: QuizType,
  opts: { region: string | null; city?: string | null; online: boolean; returned: number; local?: number },
) {
  sendTrack("match_results", {
    source: sourceOf(quizType),
    metadata: {
      quiz_type: quizType,
      region: opts.region || null,
      city: opts.city || null,
      online: opts.online,
      returned: opts.returned,
      // כמה מהתוצאות באזור שהתבקש (null כשלא התבקש מיקום). מ-6/9/2026
      // התוצאות מחולקות לקבוצה מקומית וקבוצה חיצונית, וזה המדד לפני/אחרי.
      local: opts.local ?? null,
      // הדגל שמאפשר לספור בשאילתה אחת כמה חיפושים הציגו בחירה דלה.
      thin: opts.returned < 4,
    },
  });
}

/** Patient saved their match list (WhatsApp-to-self / copy link). */
export function trackMatchSaved(quizType: QuizType, token: string, count: number) {
  sendTrack("match_saved", { source: sourceOf(quizType), metadata: { token, count } });
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
