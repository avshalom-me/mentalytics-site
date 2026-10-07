import { coversRegion } from "./match-fallback";
import { ALL_REGIONS, CITY_SEO_LIST, CITY_TO_REGION, REGION_GROUP_LABELS, regionGroupOf } from "./regions";

// Why a campaign went cold - not only that it did.
//
// Until 7/10/2026 the ads agent stopped at detection: "23 days without a
// contact, ₪280 since", followed by a list of things for the owner to go and
// check - search terms, the CPC cap, the supply in the region. Every one of
// those is a question the data already answers. Done by hand that day for
// g-north-sharon it took an hour and came back with: tracking intact, the same
// searches as before, the same number of finished quizzes, and nobody
// contacting anyone - because 88% of the spend buys "psychologist" and a paid
// visitor to that region is shown exactly one.
//
// This module is that hour, as code. It takes numbers and returns numbers and
// a few Hebrew sentences built from them; it reads no database and calls no
// model, so every claim in the text is one a test can check. The loading lives
// in ads-diagnosis-data.ts, the wiring in ads-insights.ts.
//
// What it will not do is claim certainty. It names the most likely cause, the
// evidence for it and what would confirm it. A dry spell that chance explains
// is called that, and is the one case where the right advice is to wait.

/** Sessions' worth of the account-wide rate mixed into a campaign's own. */
export const PRIOR_WEIGHT = 30;
/** How far back the "before" window reaches, from the start of the dry spell. */
export const BASELINE_DAYS = 45;
/** At or above this chance of zero, a dry spell is still plausibly luck. */
export const CHANCE_PLAUSIBLE = 0.2;
/** Below this, it is not luck. */
export const CHANCE_UNLIKELY = 0.05;
/** A promotion ending within this many days is supply about to disappear. */
export const EXPIRY_HORIZON_DAYS = 21;
/** Under this many relevant promoted therapists the region is the bottleneck (24/9/2026, sharon). */
export const MIN_PROMOTED_TOTAL = 5;
/** The floor the supply-gaps agent uses for one region x treatment slice (owner, 23/8/2026). */
export const MIN_PROMOTED_PER_SLICE = 4;

// ------------------------------------------------------------- statistics

/** P(X <= k) for X ~ Poisson(lambda). */
export function poissonCdf(k: number, lambda: number): number {
  if (!(lambda > 0)) return 1;
  let term = Math.exp(-lambda);
  let sum = term;
  for (let i = 1; i <= k; i++) {
    term *= lambda / i;
    sum += term;
  }
  return Math.min(1, sum);
}

/**
 * Seekers per session, pulled toward the account's rate while the campaign's
 * own sample is small. A campaign with 3 seekers from 20 sessions is not a 15%
 * campaign, and one with none from 20 is not a 0% campaign.
 */
export function shrunkRate(seekers: number, sessions: number, prior: number, weight = PRIOR_WEIGHT): number {
  return (seekers + weight * prior) / (sessions + weight);
}

/**
 * Is the cost per seeker above the target by more than luck allows?
 * `expected` is how many seekers the money would have bought at the target,
 * `p` the chance of seeing this few or fewer if the campaign were on target.
 */
export function cplVerdict(cost: number, seekers: number, target: number): { expected: number; p: number; above: boolean } {
  const expected = target > 0 ? cost / target : 0;
  return { expected, p: poissonCdf(seekers, expected), above: seekers < expected };
}

// ------------------------------------------------------------------ dates

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86_400_000);
}

/** 2026-09-16 → 16/9 */
function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

// ----------------------------------------------------------------- funnel

/** One campaign-day as ads_campaign_funnel_daily returns it. Every stage counts sessions. */
export type FunnelDay = {
  d: string;
  /** sessions */
  s: number;
  /** saw a therapist card */
  c: number;
  /** started the quiz */
  qs: number;
  /** finished the quiz */
  qd: number;
  /** saw match results */
  r: number;
  /** profile views (events, not sessions) */
  pv: number;
  /** seekers: people who pressed a contact button */
  k: number;
  /** contact clicks */
  cl: number;
};

export type FunnelTotals = {
  sessions: number;
  sawCards: number;
  quizStarted: number;
  quizDone: number;
  sawResults: number;
  profileViews: number;
  seekers: number;
  contactClicks: number;
};

export const EMPTY_FUNNEL: FunnelTotals = {
  sessions: 0, sawCards: 0, quizStarted: 0, quizDone: 0, sawResults: 0, profileViews: 0, seekers: 0, contactClicks: 0,
};

/** Totals for the days from `from` to `to`, both included. */
export function sumFunnel(days: FunnelDay[], from: string, to: string): FunnelTotals {
  const t = { ...EMPTY_FUNNEL };
  for (const x of days) {
    if (x.d < from || x.d > to) continue;
    t.sessions += x.s;
    t.sawCards += x.c;
    t.quizStarted += x.qs;
    t.quizDone += x.qd;
    t.sawResults += x.r;
    t.profileViews += x.pv;
    t.seekers += x.k;
    t.contactClicks += x.cl;
  }
  return t;
}

/** The last day on which someone pressed a contact button, or null if nobody did. */
export function lastSeekerDay(days: FunnelDay[]): string | null {
  let last: string | null = null;
  for (const x of days) if (x.k > 0 && (!last || x.d > last)) last = x.d;
  return last;
}

// ------------------------------------------------- who the campaign serves

/** One campaign as ads_campaign_profile returns it. */
export type CampaignProfile = {
  landing: { page: string; n: number }[];
  regions: { region: string; n: number }[];
  searches: { n: number; noPlace: number } | null;
  quizTypes: Record<string, number>;
  treatmentSessions: number;
  treatments: { t: string; n: number }[];
};

export type CampaignScope = { kind: "region"; region: string } | { kind: "online" } | { kind: "unknown" };

function regionOfLandingPage(page: string): string | null {
  const [kind, name] = page.split(":");
  if (!name) return null;
  if (kind === "region" || kind === "lp") {
    if ((ALL_REGIONS as readonly string[]).includes(name)) return name;
  }
  if (kind === "city" || kind === "city_topic" || kind === "lp") {
    return CITY_TO_REGION[name] ?? null;
  }
  return null;
}

/**
 * The region a campaign serves, read from its visitors rather than from a
 * setting nobody keeps up to date: first the region they ask for in the quiz,
 * then the page the ads land on. A campaign landing on the online page is an
 * online campaign whatever its visitors type.
 */
export function campaignScope(p: CampaignProfile | null): CampaignScope {
  if (!p) return { kind: "unknown" };
  const landingTotal = p.landing.reduce((s, l) => s + l.n, 0);
  const onlineLanding = p.landing.filter((l) => l.page === "region:online").reduce((s, l) => s + l.n, 0);
  if (landingTotal > 0 && onlineLanding / landingTotal >= 0.5) return { kind: "online" };

  const known = p.regions.filter((r) => (ALL_REGIONS as readonly string[]).includes(r.region));
  const located = known.reduce((s, r) => s + r.n, 0);
  const lead = [...known].sort((a, b) => b.n - a.n)[0];
  if (lead && located >= 3 && lead.n / located >= 0.6) return { kind: "region", region: lead.region };

  const byRegion = new Map<string, number>();
  for (const l of p.landing) {
    const region = regionOfLandingPage(l.page);
    if (region) byRegion.set(region, (byRegion.get(region) ?? 0) + l.n);
  }
  const top = [...byRegion.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && landingTotal > 0 && top[1] / landingTotal >= 0.5) return { kind: "region", region: top[0] };
  return { kind: "unknown" };
}

export type Audience = "adults" | "kids" | "mixed";

/** Adults or children, by which quiz the campaign's visitors finish. */
export function campaignAudience(p: CampaignProfile | null): Audience {
  const adults = p?.quizTypes?.adults ?? 0;
  const kids = p?.quizTypes?.kids ?? 0;
  if (adults + kids < 5) {
    const page = p?.landing?.[0]?.page ?? "";
    return /ילדים|נוער/.test(page) ? "kids" : "adults";
  }
  if (kids / (adults + kids) >= 0.7) return "kids";
  if (adults / (adults + kids) >= 0.7) return "adults";
  return "mixed";
}

// ------------------------------------------------------------------ supply

/** A listed therapist, reduced to what a visitor chooses by. */
export type SupplyTherapist = {
  id: string;
  name: string;
  /** promoted = shown to a paid visitor; free therapists are hidden from one (16/9/2026). */
  promoted: boolean;
  psychologist: boolean;
  female: boolean;
  adults: boolean;
  kids: boolean;
  online: boolean;
  regions: string[];
  /** training areas, plus "טיפול זוגי" when a couples modality is declared */
  areas: string[];
  /** the day a trial or gift promotion ends (YYYY-MM-DD); null when it has no end */
  promotedUntil: string | null;
};

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

function inScope(t: SupplyTherapist, scope: CampaignScope, audience: Audience): boolean {
  if (scope.kind === "region" && !coversRegion(t.regions, scope.region)) return false;
  if (scope.kind === "online" && !t.online) return false;
  if (audience === "adults") return t.adults;
  if (audience === "kids") return t.kids;
  return t.adults || t.kids;
}

/** A spend-weighted share of the campaign's keywords that ask for a psychologist by name. */
export function psychologistShare(keywords: { keyword: string; cost: number }[]): number | null {
  const total = keywords.reduce((s, k) => s + k.cost, 0);
  if (total < 30) return null;
  const psych = keywords.filter((k) => /פסיכולוג/.test(k.keyword)).reduce((s, k) => s + k.cost, 0);
  return psych / total;
}

export type SupplyGap = "thin" | "profession" | "treatment";

export type SupplyFit = {
  scopeLabel: string;
  audience: Audience;
  promoted: number;
  free: number;
  /** share of keyword spend on "psychologist" terms; null when there is too little spend to say */
  psychShare: number | null;
  promotedPsych: number;
  promotedPsychFemale: number;
  freePsych: number;
  /** what the quiz recommended to this campaign's visitors, and who covers it */
  treatments: { t: string; share: number; promoted: number; free: number }[];
  gaps: SupplyGap[];
  /** free therapists who would close the gap, the best answer first - who a gift offer should go to */
  candidates: { id: string; name: string }[];
  /** promoted therapists whose trial or gift ends soon: how many, and the first date */
  expiring: { n: number; until: string } | null;
};

/**
 * What the campaign buys against what a paid visitor is shown. Returns null
 * when the campaign's region is unknown - then there is no supply to count.
 */
export function supplyFit(input: {
  scope: CampaignScope;
  audience: Audience;
  profile: CampaignProfile | null;
  keywords: { keyword: string; cost: number }[];
  supply: SupplyTherapist[];
  /** YYYY-MM-DD; without it nothing is reported as about to expire */
  today?: string;
}): SupplyFit | null {
  const { scope, audience, profile, keywords, supply, today } = input;
  if (scope.kind === "unknown") return null;

  const pool = supply.filter((t) => inScope(t, scope, audience));
  const promoted = pool.filter((t) => t.promoted);
  const free = pool.filter((t) => !t.promoted);
  const psychShare = psychologistShare(keywords);

  const covers = (t: SupplyTherapist, treatment: string) => t.areas.some((a) => norm(a) === norm(treatment));
  const sessions = profile?.treatmentSessions ?? 0;
  const treatments = sessions >= 5
    ? (profile?.treatments ?? [])
        .map((x) => ({ t: x.t, share: x.n / sessions }))
        .filter((x) => x.share >= 0.4)
        .slice(0, 2)
        .map((x) => ({
          ...x,
          promoted: promoted.filter((t) => covers(t, x.t)).length,
          free: free.filter((t) => covers(t, x.t)).length,
        }))
    : [];

  const promotedPsych = promoted.filter((t) => t.psychologist).length;
  const gaps: SupplyGap[] = [];
  if (promoted.length < MIN_PROMOTED_TOTAL) gaps.push("thin");
  if (psychShare != null && psychShare >= 0.6 && promotedPsych <= 1) gaps.push("profession");
  const shortTreatments = treatments.filter((x) => x.share >= 0.5 && x.promoted < MIN_PROMOTED_PER_SLICE);
  if (shortTreatments.length > 0) gaps.push("treatment");

  // Who to offer a promotion to: free therapists that answer the gap. A
  // psychologist who also covers the missing treatment comes first.
  const wanted = (t: SupplyTherapist) =>
    (gaps.includes("profession") && t.psychologist ? 2 : 0) +
    (shortTreatments.some((x) => covers(t, x.t)) ? 1 : 0);
  const candidates = free
    .map((t) => ({ t, score: wanted(t) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name, "he"))
    .map((x) => ({ id: x.t.id, name: x.t.name }));

  const horizon = today ? addDays(today, EXPIRY_HORIZON_DAYS) : null;
  const ending = today && horizon
    ? promoted.map((t) => t.promotedUntil).filter((d): d is string => !!d && d >= today && d <= horizon).sort()
    : [];

  return {
    scopeLabel: scope.kind === "online" ? "אונליין" : scope.region,
    audience,
    promoted: promoted.length,
    free: free.length,
    psychShare,
    promotedPsych,
    promotedPsychFemale: promoted.filter((t) => t.psychologist && t.female).length,
    freePsych: free.filter((t) => t.psychologist).length,
    treatments,
    gaps,
    candidates,
    expiring: ending.length > 0 ? { n: ending.length, until: ending[0] } : null,
  };
}

// --------------------------------------------------------------- diagnosis

export type SupplyChange = { date: string; therapistId: string; kind: "promoted" | "demoted" };
export type SiteChange = { date: string; label: string };

/**
 * A therapist promoted and demoted inside the same window ends where they
 * started, and that is no change. On 5/10/2026 a centre was archived and
 * restored the same day, and eight of its therapists would otherwise have
 * read as "eight dropped, eight joined". `changes` must be in the order they
 * happened.
 */
export function netSupplyChanges(changes: SupplyChange[]): SupplyChange[] {
  const byTherapist = new Map<string, SupplyChange[]>();
  for (const c of changes) {
    const list = byTherapist.get(c.therapistId) ?? [];
    list.push(c);
    byTherapist.set(c.therapistId, list);
  }
  const out: SupplyChange[] = [];
  for (const list of byTherapist.values()) {
    const first = list[0];
    const last = list[list.length - 1];
    if (first.kind === last.kind) out.push(last);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export type PendingGiftOffer = { regionLabel: string; treatment: string; candidates: { id: string; name: string }[] };

export type DiagnosisInput = {
  googleName: string;
  utm: string;
  /** YYYY-MM-DD */
  today: string;
  /** the campaign's site funnel by day, oldest first */
  days: FunnelDay[];
  /** Google's side of the same days */
  google: { date: string; clicks: number; cost: number }[];
  /** seekers per session across the account - the prior a small campaign leans on */
  accountRate: number;
  profile: CampaignProfile | null;
  /** the campaign's keywords with their spend, last 30 days */
  keywords: { keyword: string; cost: number }[];
  supply: SupplyTherapist[];
  supplyChanges: SupplyChange[];
  siteChanges: SiteChange[];
  /** when the campaign's landing page family was last revised (PAGE_REVISED) */
  landingRevised: string | null;
  pendingGiftOffers: PendingGiftOffer[];
};

export type DiagnosisCause = "chance" | "tracking" | "landing" | "quiz" | "supply" | "change" | "unknown";
export type DiagnosisStage = "tracking" | "landing" | "quiz" | "contact" | "thin";

export type Diagnosis = {
  utm: string;
  cause: DiagnosisCause;
  confidence: "high" | "medium" | "low";
  /** three or four words for the alert title */
  tag: string;
  dry: FunnelTotals & { from: string; days: number; clicks: number; cost: number };
  baseline: FunnelTotals & { from: string; to: string; days: number; clicks: number; cost: number };
  rate: number;
  expected: number;
  /** the chance of no seeker at all, had nothing changed */
  pZero: number;
  chance: "plausible" | "borderline" | "unlikely";
  stage: DiagnosisStage;
  changes: string[];
  fit: SupplyFit | null;
  steps: string[];
  /** the whole diagnosis as the finding's body: one line per claim */
  text: string;
};

function sumGoogle(rows: { date: string; clicks: number; cost: number }[], from: string, to: string) {
  let clicks = 0;
  let cost = 0;
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    clicks += r.clicks;
    cost += r.cost;
  }
  return { clicks, cost };
}

function findStage(dry: FunnelTotals, base: FunnelTotals, dryClicks: number): DiagnosisStage {
  // Clicks Google charged for that never became tagged sessions: the zero is
  // a measurement gap before it is a performance one.
  if (dryClicks >= 10 && dry.sessions < dryClicks * 0.5) return "tracking";

  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
  const cardsDry = ratio(dry.sawCards, dry.sessions);
  const cardsBase = ratio(base.sawCards, base.sessions);
  if (
    dry.sessions >= 15 && base.sessions >= 15 && cardsDry != null && cardsBase != null &&
    cardsDry < cardsBase * 0.7 && cardsBase - cardsDry >= 0.15
  ) return "landing";

  const quizDry = ratio(dry.quizDone, dry.quizStarted);
  const quizBase = ratio(base.quizDone, base.quizStarted);
  if (dry.quizStarted >= 10 && base.quizStarted >= 10 && quizDry != null && quizBase != null && quizDry < quizBase * 0.7) {
    return "quiz";
  }

  if (dry.sawCards >= 10 || dry.sawResults >= 5) return "contact";
  return "thin";
}

function percent(p: number): string {
  if (p < 0.001) return "פחות מ-0.1%";
  if (p < 0.01) return `${(p * 100).toFixed(1)}%`;
  return `${Math.round(p * 100)}%`;
}

const AUDIENCE_LABEL: Record<Audience, string> = { adults: " למבוגרים", kids: " לילדים ונוער", mixed: "" };

const TAG: Record<DiagnosisCause, string> = {
  chance: "בגבול המקריות",
  tracking: "בעיית מדידה",
  landing: "דף הנחיתה",
  quiz: "נשירה בשאלון",
  supply: "כנראה היצע",
  change: "סמוך לשינוי",
  unknown: "סיבה לא ידועה",
};

const HEADLINE: Record<DiagnosisCause, string> = {
  chance: "אבחון: בגבול המקריות. עדיין אי אפשר לומר שמשהו נשבר.",
  tracking: "אבחון: הקליקים לא מגיעים לאתר מתויגים. זו כנראה בעיית מדידה, לא בעיית ביצועים.",
  landing: "אבחון: פחות מבקרים מגיעים לכרטיסי המטפלים. לבדוק את דף הנחיתה.",
  quiz: "אבחון: הנשירה בתוך השאלון עלתה.",
  supply: "אבחון: כנראה היצע מקודם שלא תואם למה שהקמפיין קונה. התנועה עצמה מגיעה ומתנהגת כרגיל.",
  change: "אבחון: הירידה מתחילה סמוך לשינוי ידוע.",
  unknown: "אבחון: לא נמצאה סיבה בנתוני האתר.",
};

/**
 * The diagnosis for one campaign that is spending without seekers.
 * `days` must reach back far enough to hold the dry spell and a baseline
 * before it; the engine passes 75.
 */
export function diagnoseCampaign(input: DiagnosisInput): Diagnosis {
  const { days, today } = input;
  const firstDay = days[0]?.d ?? today;
  const last = lastSeekerDay(days);
  const dryFrom = last ? addDays(last, 1) : firstDay;
  const dryTotals = sumFunnel(days, dryFrom, today);
  const dryGoogle = sumGoogle(input.google, dryFrom, today);

  const baseTo = addDays(dryFrom, -1);
  const baseFromWanted = addDays(dryFrom, -BASELINE_DAYS);
  const baseFrom = baseFromWanted < firstDay ? firstDay : baseFromWanted;
  const baseTotals = last ? sumFunnel(days, baseFrom, baseTo) : { ...EMPTY_FUNNEL };
  const baseGoogle = last ? sumGoogle(input.google, baseFrom, baseTo) : { clicks: 0, cost: 0 };

  const rate = shrunkRate(baseTotals.seekers, baseTotals.sessions, input.accountRate);
  const expected = dryTotals.sessions * rate;
  const pZero = Math.exp(-expected);
  const chance = pZero >= CHANCE_PLAUSIBLE ? "plausible" : pZero >= CHANCE_UNLIKELY ? "borderline" : "unlikely";
  const stage = findStage(dryTotals, baseTotals, dryGoogle.clicks);

  const scope = campaignScope(input.profile);
  const audience = campaignAudience(input.profile);
  const fit = supplyFit({ scope, audience, profile: input.profile, keywords: input.keywords, supply: input.supply, today });

  // What changed around the start of the dry spell. A week of slack before
  // it: a change takes a few days to show as "no contact since".
  const windowFrom = addDays(dryFrom, -7);
  const inWindow = (d: string) => d >= windowFrom && d <= today;
  const changes: string[] = [];
  for (const c of input.siteChanges) if (inWindow(c.date)) changes.push(`${shortDay(c.date)} ${c.label}`);
  const scoped = new Set(input.supply.filter((t) => inScope(t, scope, audience)).map((t) => t.id));
  const net = scope.kind === "unknown"
    ? []
    : netSupplyChanges(input.supplyChanges.filter((c) => inWindow(c.date) && scoped.has(c.therapistId)));
  const dates = (list: SupplyChange[]) => [...new Set(list.map((c) => shortDay(c.date)))].join(", ");
  const demoted = net.filter((c) => c.kind === "demoted");
  const promotedNow = net.filter((c) => c.kind === "promoted");
  if (demoted.length > 0) {
    changes.push(`${demoted.length === 1 ? "ירד מקודם אחד" : `ירדו ${demoted.length} מקודמים`} באזור (${dates(demoted)})`);
  }
  if (promotedNow.length > 0) {
    changes.push(`${promotedNow.length === 1 ? "נוסף מקודם אחד" : `נוספו ${promotedNow.length} מקודמים`} (${dates(promotedNow)})`);
  }

  let cause: DiagnosisCause;
  if (stage === "tracking") cause = "tracking";
  else if (chance === "plausible") cause = "chance";
  else if (stage === "landing") cause = "landing";
  else if (stage === "quiz") cause = "quiz";
  else if (fit && fit.gaps.length > 0) cause = "supply";
  else if (changes.length > 0) cause = "change";
  else cause = "unknown";

  const hardGap = !!fit && (fit.gaps.includes("profession") || fit.gaps.includes("treatment"));
  const confidence: Diagnosis["confidence"] =
    cause === "chance" || cause === "unknown" ? "low"
      : cause === "supply" ? (hardGap && changes.length > 0 && chance === "unlikely" ? "high" : "medium")
        : cause === "tracking" ? "high"
          : "medium";

  // ---- the text: one line per claim, each built from the numbers above
  const lines: string[] = [HEADLINE[cause]];

  const dryDays = Math.max(1, daysBetween(dryFrom, today) + 1);
  const since = last ? `מאז ${shortDay(dryFrom)}` : `ב-${dryDays} הימים שנבדקו`;
  const versus = baseTotals.sessions >= 20
    ? `בקצב הקודם של הקמפיין (${baseTotals.seekers} פונים מ-${baseTotals.sessions} סשנים, משוקלל עם ממוצע החשבון)`
    : "לפי ממוצע החשבון, כי לקמפיין אין עדיין היסטוריה מספקת,";
  const verdict = chance === "unlikely" ? "לא מקרי" : chance === "borderline" ? "ספק מקרי" : "ייתכן שמקרי";
  lines.push(
    `• ${verdict}: 0 פונים מ-${dryTotals.sessions} סשנים ${since}. ${versus} היו צפויים ${expected.toFixed(1)}, והסיכוי לאפס במקרה הוא ${percent(pZero)}.`
  );

  const chain = (clicks: number, f: FunnelTotals) =>
    `${clicks} קליקים ← ${f.sessions} סשנים ← ${f.sawCards} ראו כרטיסים ← ${f.quizDone} סיימו שאלון ← ${f.seekers} פנו`;
  lines.push(
    `• המשפך ${since}: ${chain(dryGoogle.clicks, dryTotals)}.` +
    (baseTotals.sessions > 0 ? ` לפני כן (${daysBetween(baseFrom, baseTo) + 1} ימים): ${chain(baseGoogle.clicks, baseTotals)}.` : "")
  );

  if (changes.length > 0) lines.push(`• מה השתנה בתקופה: ${changes.join(" · ")}.`);

  if (fit && (cause !== "chance" || fit.gaps.length > 0)) {
    const where = fit.scopeLabel === "אונליין" ? "שעובדים אונליין" : `ב${fit.scopeLabel}`;
    const buys = fit.psychShare != null ? `${Math.round(fit.psychShare * 100)}% מהוצאת מילות המפתח על "פסיכולוג". ` : "";
    lines.push(
      `• מה הקמפיין קונה מול מה שמבקר ממומן רואה: ${buys}` +
      `מקודמים${AUDIENCE_LABEL[fit.audience]} ${where}: ${fit.promoted}, מהם פסיכולוגים ${fit.promotedPsych} (נשים: ${fit.promotedPsychFemale}). ` +
      `חינמיים, שמוסתרים ממנו: ${fit.free}, מהם פסיכולוגים ${fit.freePsych}.`
    );
    for (const t of fit.treatments.filter((x) => x.promoted < MIN_PROMOTED_PER_SLICE)) {
      lines.push(`• ${t.t} הומלץ ל-${Math.round(t.share * 100)}% ממסיימי השאלון: ${t.promoted} מקודמים, ${t.free} חינמיים.`);
    }
    if (fit.expiring) {
      lines.push(
        `• בקרוב פחות: ${fit.expiring.n === 1 ? "מקודם אחד מסיים" : `${fit.expiring.n} מקודמים מסיימים`} תקופת ניסיון או מתנה, הראשון ב-${shortDay(fit.expiring.until)}.`
      );
    }
  }

  const steps: string[] = [];
  // Google's day closes at midnight, so the last full week ends yesterday.
  const weekly = Math.round(sumGoogle(input.google, addDays(today, -7), addDays(today, -1)).cost);
  if (cause === "chance") {
    // How long until zero stops being luck: an expected 3 seekers puts the
    // chance of none at 5%.
    const perDay = sumFunnel(days, addDays(today, -13), today).sessions / 14;
    const missing = Math.ceil(3 / rate - dryTotals.sessions);
    const wait = perDay > 0 && missing > 0 ? Math.ceil(missing / perDay) : null;
    steps.push(
      wait != null
        ? `אין מה לתקן עכשיו. אם לא יגיע פונה בעוד כ-${wait} ימים (עוד ${missing} סשנים), זה כבר לא מקרי והאבחון יתעדכן.`
        : "אין מה לתקן עכשיו. האבחון יתעדכן כשיצטברו עוד סשנים."
    );
  } else if (cause === "tracking") {
    steps.push(`בגוגל אדס: Campaign settings > Campaign URL options, ולוודא שיש Final URL suffix עם utm_campaign=${input.utm}.`);
    steps.push("עד שהתיוג חוזר, אפס הפונים כאן אינו מדד: הפניות נרשמות בלי קמפיין.");
  } else if (cause === "landing") {
    steps.push(
      "לפתוח את דף הנחיתה של הקמפיין בטלפון ולוודא שכרטיסי המטפלים מופיעים בלי גלילה ארוכה." +
      (input.landingRevised && inWindow(input.landingRevised) ? ` קוד דפי הנחיתה עודכן לאחרונה ב-${shortDay(input.landingRevised)}.` : "")
    );
  } else if (cause === "quiz") {
    steps.push("לבדוק בעמוד נשירת השאלון באדמין אם שלב מסוים התחיל לעצור את המבקרים.");
  } else if (cause === "supply" && fit) {
    const label = scope.kind === "region" ? REGION_GROUP_LABELS[regionGroupOf(scope.region)] : "אונליין";
    // An offer waiting in the queue counts only for the therapists in it who
    // answer this gap. The queue is per region group and per treatment, so it
    // also holds an art therapist from the other half of the region.
    const wanted = new Set(fit.candidates.map((c) => c.id));
    const offers = input.pendingGiftOffers
      .filter((o) => o.regionLabel === label)
      .map((o) => ({ ...o, candidates: o.candidates.filter((c) => wanted.has(c.id)) }))
      .filter((o) => o.candidates.length > 0)
      // The offer for the treatment that is short comes first.
      .map((o) => ({ o, lead: fit.treatments.some((t) => t.promoted < MIN_PROMOTED_PER_SLICE && o.treatment.includes(t.t)) ? 0 : 1 }))
      .sort((a, b) => a.lead - b.lead)
      .map((x) => x.o)
      .slice(0, 3);
    if (offers.length > 0) {
      steps.push(
        `לשלוח את הצעות המתנה שכבר ממתינות בתור הסוכנים: ${offers.map((o) => `"${o.treatment}" (${o.candidates.map((c) => c.name.trim()).join(", ")})`).join("; ")}.`
      );
    } else if (fit.candidates.length > 0) {
      steps.push(`מועמדים חינמיים שסוגרים את הפער, להצעת קידום: ${fit.candidates.slice(0, 6).map((c) => c.name.trim()).join(", ")}.`);
    } else {
      steps.push("אין במאגר מטפל חינמי שסוגר את הפער. זה פער גיוס, לא פער מתנות.");
    }
    steps.push(
      `עד שיצטרפו מקודמים מתאימים: לצמצם את התקציב או להשהות. השבוע האחרון עלה ₪${weekly} בלי פונה. השינוי בגוגל נעשה על ידך.`
    );
  } else if (cause === "change") {
    steps.push("לבדוק אם השינוי שברשימה הוא שעצר את הפניות, ואם כן להחליט אם להחזיר אותו או להתאים את הקמפיין.");
  } else {
    steps.push("הצעד הבא הוא בגוגל אדס עצמו: נתח החשיפות, מיקום הקליקים וכתובות הנחיתה. אלה עדיין לא נבדקים אוטומטית.");
  }
  lines.push(`מה לעשות: ${steps.map((s, i) => (steps.length > 1 ? `${i + 1}) ${s}` : s)).join(" ")}`);

  return {
    utm: input.utm,
    cause,
    confidence,
    tag: TAG[cause],
    dry: { ...dryTotals, from: dryFrom, days: dryDays, clicks: dryGoogle.clicks, cost: Math.round(dryGoogle.cost) },
    baseline: {
      ...baseTotals,
      from: baseFrom,
      to: baseTo,
      days: last ? daysBetween(baseFrom, baseTo) + 1 : 0,
      clicks: baseGoogle.clicks,
      cost: Math.round(baseGoogle.cost),
    },
    rate,
    expected,
    pZero,
    chance,
    stage,
    changes,
    fit,
    steps,
    text: lines.join("\n"),
  };
}

// ------------------------------------------------------------ search terms

// A place name that merely contains "צפון" is not a generic search. Until
// 7/10/2026 "פסיכולוגית צפון תל אביב" tripped the generic-term alert, which
// then sat red in the queue for five weeks and taught its reader to skip it.
const PLACE_PHRASES: readonly string[] = [
  ...ALL_REGIONS,
  ...CITY_SEO_LIST,
  "צפון תל אביב", 'צפון ת"א', "הצפון הישן", "צפון הישן",
].slice().sort((a, b) => b.length - a.length);

const GENERIC_GEO = /(^|\s)(צפון|בצפון|הצפון|גליל|בגליל|בישראל|בארץ)(\s|$)/;

/**
 * A search for a whole part of the country ("פסיכולוג בצפון", "בישראל")
 * rather than a place we have therapists in. Known place names are taken out
 * first, so the neighbourhood and the region that carry the word do not count.
 */
export function isGenericGeoTerm(term: string): boolean {
  let rest = ` ${term} `;
  for (const p of PLACE_PHRASES) {
    // A prefixed "ב" belongs to the place ("בצפון השרון"), not to the term.
    rest = rest.split(` ב${p} `).join("  ").split(` ${p} `).join("  ");
  }
  return GENERIC_GEO.test(rest.replace(/\s+/g, " ").trim());
}
