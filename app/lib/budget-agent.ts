// The monthly budget agent's arithmetic (docs/agents/budget-agent-plan.md, step 1).
//
// Pure on purpose: no database, no clock, no model. The caller passes the
// numbers in, so every figure on /admin/budget can be checked by hand, and the
// wording layer that comes later only dresses a result it cannot change.
//
// The split is a recommendation and nothing else. Nothing here, or anywhere
// that calls it, changes a budget in Google Ads.

export type BudgetCampaignInput = {
  googleName: string;
  utmCampaign: string;
  active: boolean;
  budgetType: "daily" | "total";
  /** ₪ per day as set in Google (registry), before VAT. */
  dailyBudget: number | null;
  /** First day with spend, YYYY-MM-DD; null = no spend yet. */
  firstSpend: string | null;
  cost30: number;
  cost60: number;
  /** Distinct sessions that clicked to contact a therapist from this campaign. */
  seekers30: number;
  seekers60: number;
  /** Of seekers60, the ones who contacted a paying therapist (paid/centre) or one on a trial. */
  paidSeekers60: number;
  trialSeekers60: number;
  protectedReason: string | null;
  /** YYYY-MM-DD, last day of the protection; null with a reason = until changed. */
  protectedUntil: string | null;
};

export type BudgetDecision = "keep" | "reduce" | "pause" | "report";

export type BudgetCampaignPlan = BudgetCampaignInput & {
  cpl30: number | null;
  cpl60: number | null;
  /** The cost per seeker used to rank and to project, and the window it came from. */
  rate: number | null;
  rateWindow: 30 | 60 | null;
  /** Fewer than NOISE_SEEKERS seekers behind the rate. */
  noisy: boolean;
  /**
   * The cost per seeker the forecast uses: the rate itself, or for a noisy one,
   * the rate pulled toward the account's average (forecastRate below).
   */
  forecastRate: number | null;
  learning: boolean;
  isProtected: boolean;
  /** Takes part in the split: active, with a daily budget. */
  inPlan: boolean;
  proposedDaily: number;
  decision: BudgetDecision;
  projectedCost: number;
  /** null when the campaign has no rate yet (new, or no seeker in 60 days). */
  projectedSeekers: number | null;
};

export type BudgetProjection = {
  month: string;
  daysInMonth: number;
  ceiling: number | null;
  /** What the ceiling leaves for Google after the other platforms' spend recorded for the month. */
  googleCeiling: number | null;
  /** Spend on the other platforms that invoices already place in the target month. */
  otherMonthCost: number;
  /**
   * The trailing 30 days: every Google campaign including paused ones, plus the
   * other platforms' invoiced spend. byPlatform is empty when Google is alone.
   */
  lastMonth: {
    cost: number;
    seekers: number;
    cpl: number | null;
    byPlatform: { label: string; cost: number; seekers: number; cpl: number | null }[];
  };
  /** The budgets as set today, over the whole target month. */
  current: { daily: number; monthly: number };
  plan: {
    daily: number;
    monthly: number;
    seekers: number;
    cpl: number | null;
    /** Campaigns in the plan whose seekers cannot be projected yet. */
    unknown: string[];
  };
  /** The protected and learning campaigns alone already exceed the ceiling. */
  overCeiling: boolean;
  campaigns: BudgetCampaignPlan[];
};

// A rate from fewer seekers than this is a guess: in the week before 29/9/2026
// North Sharon went from ₪62 to ₪114 a seeker on four seekers. Plan section ו.1.
export const NOISE_SEEKERS = 8;
// Google's learning period, and the time a new campaign needs before its rate
// means anything. Until then it keeps its budget.
export const LEARNING_DAYS = 30;
// Below this a campaign barely serves; better paused than kept as a gesture.
export const MIN_DAILY = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Cost per seeker the way the 29/9 analysis rounded it: the shekel total first,
 * then the division. No spend recorded means unknown, not free.
 */
function costPerSeeker(cost: number, seekers: number): number | null {
  return seekers > 0 && cost > 0 ? Math.round(Math.round(cost) / seekers) : null;
}

/**
 * The month a plan is for: from the 15th on, the one that follows (the owner
 * plans ahead); before it, the one under way (the run on the 1st plans the
 * month that has just started).
 */
export function defaultTargetMonth(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  if (d < 15) return `${y}-${String(m).padStart(2, "0")}`;
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Split a monthly ceiling across the Google campaigns, and project what it buys.
 *
 * The rules, in order - the page prints the same list:
 * 1. A protected campaign, and one still learning (under LEARNING_DAYS since its
 *    first spend), keep the budget they have.
 * 2. The rest are ranked by cost per seeker: the 30-day figure when it rests on
 *    at least NOISE_SEEKERS seekers, otherwise the 60-day one.
 * 3. Cheapest first, each keeps its current budget while the ceiling allows; the
 *    one at the edge gets what is left if that is at least MIN_DAILY a day; the
 *    rest, and any campaign without a seeker in 60 days, are candidates to pause.
 *    Nothing is ever raised above what is set today.
 */
export type OtherPlatformInput = {
  label: string;
  /** Invoiced spend prorated into the trailing 30 days, ₪ before VAT. */
  cost30: number;
  seekers30: number;
  /** Invoiced spend prorated into the target month. */
  monthCost: number;
};

export function projectBudget(input: {
  campaigns: BudgetCampaignInput[];
  ceiling: number | null;
  month: string;
  today: string;
  /** Taboola, Meta and the like, from their invoices (ads-platforms.ts). */
  otherPlatforms?: OtherPlatformInput[];
}): BudgetProjection {
  const D = daysInMonth(input.month);
  const monthStart = `${input.month}-01`;
  const others = input.otherPlatforms ?? [];
  const otherMonthCost = Math.round(others.reduce((s, o) => s + o.monthCost, 0));
  // The ceiling is for all advertising; what the other platforms already take
  // in the month comes off Google's share.
  const googleCeiling = input.ceiling == null ? null : Math.max(0, input.ceiling - otherMonthCost);

  const rows: BudgetCampaignPlan[] = input.campaigns.map((c) => {
    const cpl30 = costPerSeeker(c.cost30, c.seekers30);
    const cpl60 = costPerSeeker(c.cost60, c.seekers60);
    const use30 = c.seekers30 >= NOISE_SEEKERS;
    const rate = use30 ? cpl30 : cpl60;
    const rateWindow: 30 | 60 | null = rate == null ? null : use30 ? 30 : 60;
    const seekersBehind = use30 ? c.seekers30 : c.seekers60;
    const inPlan = c.active && c.budgetType === "daily" && (c.dailyBudget ?? 0) > 0;
    return {
      ...c,
      cpl30,
      cpl60,
      rate,
      rateWindow,
      noisy: rate != null && seekersBehind < NOISE_SEEKERS,
      forecastRate: null,
      learning: inPlan && (c.firstSpend == null || daysBetween(c.firstSpend, input.today) < LEARNING_DAYS),
      isProtected:
        !!c.protectedReason?.trim() && (c.protectedUntil == null || c.protectedUntil >= monthStart),
      inPlan,
      proposedDaily: 0,
      decision: "report",
      projectedCost: 0,
      projectedSeekers: null,
    };
  });

  const inPlan = rows.filter((r) => r.inPlan);
  const kept = inPlan.filter((r) => r.isProtected || r.learning);
  const keptMonthly = kept.reduce((s, r) => s + (r.dailyBudget ?? 0) * D, 0);

  if (googleCeiling == null) {
    // No ceiling: report what the current settings buy, recommend nothing.
    for (const r of inPlan) r.proposedDaily = r.dailyBudget ?? 0;
  } else {
    for (const r of kept) {
      r.proposedDaily = r.dailyBudget ?? 0;
      r.decision = "keep";
    }
    const candidates = inPlan
      .filter((r) => !r.isProtected && !r.learning)
      .sort(
        (a, b) =>
          (a.rate ?? Infinity) - (b.rate ?? Infinity) ||
          b.seekers60 - a.seekers60 ||
          a.googleName.localeCompare(b.googleName)
      );
    let remaining = googleCeiling - keptMonthly;
    for (const r of candidates) {
      const current = r.dailyBudget ?? 0;
      let daily = r.rate == null ? 0 : Math.min(current, Math.max(0, Math.floor(remaining / D)));
      if (daily < MIN_DAILY) daily = 0;
      r.proposedDaily = daily;
      r.decision = daily === 0 ? "pause" : daily < current ? "reduce" : "keep";
      remaining -= daily * D;
    }
  }

  const googleCost = rows.reduce((s, r) => s + r.cost30, 0);
  const googleSeekers = rows.reduce((s, r) => s + r.seekers30, 0);
  // A rate from a handful of seekers makes a wild forecast: g-shfela's first
  // day, ₪3 for one seeker, forecast 103 seekers a month on 30/9/2026. For the
  // forecast (not the ranking), a noisy rate is pulled toward the account's own
  // cost per seeker, as if NOISE_SEEKERS more seekers had come at that average.
  const accountRate = googleSeekers > 0 && googleCost > 0 ? googleCost / googleSeekers : null;
  for (const r of rows) {
    if (r.rate == null) r.forecastRate = null;
    else if (!r.noisy || accountRate == null) r.forecastRate = r.rate;
    else {
      const cost = r.rateWindow === 30 ? r.cost30 : r.cost60;
      const seekers = r.rateWindow === 30 ? r.seekers30 : r.seekers60;
      r.forecastRate = (cost + NOISE_SEEKERS * accountRate) / (seekers + NOISE_SEEKERS);
    }
    r.projectedCost = r.proposedDaily * D;
    r.projectedSeekers =
      r.forecastRate != null && r.proposedDaily > 0 ? r.projectedCost / r.forecastRate : r.proposedDaily > 0 ? null : 0;
  }

  const lastCost = googleCost + others.reduce((s, o) => s + o.cost30, 0);
  const lastSeekers = googleSeekers + others.reduce((s, o) => s + o.seekers30, 0);
  const byPlatform = others.length
    ? [
        { label: "גוגל", cost: Math.round(googleCost), seekers: googleSeekers, cpl: costPerSeeker(googleCost, googleSeekers) },
        ...others.map((o) => ({
          label: o.label,
          cost: Math.round(o.cost30),
          seekers: o.seekers30,
          cpl: costPerSeeker(o.cost30, o.seekers30),
        })),
      ]
    : [];
  const currentDaily = inPlan.reduce((s, r) => s + (r.dailyBudget ?? 0), 0);
  const planDaily = inPlan.reduce((s, r) => s + r.proposedDaily, 0);
  const known = inPlan.filter((r) => r.projectedSeekers != null && r.proposedDaily > 0);
  const planSeekers = known.reduce((s, r) => s + (r.projectedSeekers ?? 0), 0);
  const knownCost = known.reduce((s, r) => s + r.projectedCost, 0);

  return {
    month: input.month,
    daysInMonth: D,
    ceiling: input.ceiling,
    googleCeiling,
    otherMonthCost,
    lastMonth: {
      cost: Math.round(lastCost),
      seekers: lastSeekers,
      cpl: costPerSeeker(lastCost, lastSeekers),
      byPlatform,
    },
    current: { daily: currentDaily, monthly: currentDaily * D },
    plan: {
      daily: planDaily,
      monthly: planDaily * D,
      seekers: Math.round(planSeekers),
      cpl: planSeekers > 0 ? Math.round(knownCost / planSeekers) : null,
      unknown: inPlan.filter((r) => r.proposedDaily > 0 && r.projectedSeekers == null).map((r) => r.googleName),
    },
    overCeiling: googleCeiling != null && keptMonthly > googleCeiling,
    campaigns: rows,
  };
}

const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export function hebrewMonth(month: string): string {
  return HEBREW_MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

const nis = (n: number) => `₪${Math.round(n).toLocaleString("he-IL")}`;

export type BudgetChange = {
  googleName: string;
  from: number;
  to: number;
  decision: "reduce" | "pause";
  rate: number | null;
  rateWindow: 30 | 60 | null;
  noisy: boolean;
};

export type BudgetRecommendation = {
  /** There is something to change in Google: the budgets set today exceed the ceiling. */
  needed: boolean;
  title: string;
  body: string;
  changes: BudgetChange[];
};

/**
 * The monthly recommendation as it goes into the agents' queue: what to change
 * in Google, campaign by campaign, and what stays. Deterministic - the model
 * later adds a short "why", never a number.
 */
export function budgetRecommendation(p: BudgetProjection): BudgetRecommendation {
  const month = hebrewMonth(p.month);
  const inPlan = p.campaigns.filter((c) => c.inPlan);
  const changes: BudgetChange[] = inPlan
    .filter((c) => c.proposedDaily !== (c.dailyBudget ?? 0))
    .map((c) => ({
      googleName: c.googleName,
      from: c.dailyBudget ?? 0,
      to: c.proposedDaily,
      decision: c.proposedDaily === 0 ? ("pause" as const) : ("reduce" as const),
      rate: c.rate,
      rateWindow: c.rateWindow,
      noisy: c.noisy,
    }))
    // Pauses first; then the bigger budget; then the dearer seeker; then by name.
    .sort(
      (a, b) =>
        (a.decision === b.decision ? 0 : a.decision === "pause" ? -1 : 1) ||
        b.from - a.from ||
        (b.rate ?? 1e9) - (a.rate ?? 1e9) ||
        a.googleName.localeCompare(b.googleName)
    );

  if (p.ceiling == null || p.googleCeiling == null) {
    return { needed: false, title: `אין תקרת פרסום ל${month}`, body: summarySentence(p), changes: [] };
  }
  const needed = p.current.monthly > p.googleCeiling && changes.length > 0;
  if (!needed) {
    return {
      needed: false,
      title: `תקציב ${month}: התקציבים בגוגל בתוך התקרה`,
      body: summarySentence(p),
      changes: [],
    };
  }

  const why = (c: BudgetChange) =>
    c.rate == null
      ? "אף פונה ב-60 יום"
      : `${nis(c.rate)} לפונה ב-${c.rateWindow} יום${c.noisy ? ", על מעט נתונים" : ""}`;
  const lines: string[] = [summarySentence(p), "", "מה לשנות בגוגל:"];
  for (const c of changes) {
    lines.push(
      c.decision === "pause"
        ? `• להשהות את ${c.googleName} (היום ${nis(c.from)} ליום; ${why(c)})`
        : `• להוריד את ${c.googleName} מ-${nis(c.from)} ל-${nis(c.to)} ליום (${why(c)})`
    );
  }
  const kept = inPlan.filter((c) => c.proposedDaily > 0 && c.proposedDaily === (c.dailyBudget ?? 0));
  if (kept.length) {
    lines.push(
      "",
      `ללא שינוי: ${kept
        .map((c) => `${c.googleName}${c.isProtected ? " (מוגן)" : c.learning ? " (בלמידה)" : ""}`)
        .join(", ")}.`
    );
  }
  const guarded = inPlan.filter((c) => c.isProtected);
  if (guarded.length) {
    lines.push(
      "",
      `מוגן = נשאר בתקציב שלו גם כשהוא יקר, כי יש סיבה שהמספרים לא רואים: ${guarded
        .map((c) => `${c.googleName} - ${c.protectedReason}`)
        .join("; ")}.`
    );
  }
  if (p.overCeiling) lines.push("", "⚠ המוגנים והחדשים לבדם עוברים את התקרה.");
  lines.push(
    "",
    "הוצאה בטאבולה ובמטא נספרת רק מהחשבוניות שהוזנו בעמוד התקציב, בלי חיבור לחשבונות עצמם. " +
      "שום דבר לא שונה בגוגל - השינוי בידיים שלך."
  );

  return {
    needed: true,
    title: `תקציב ${month}: להוריד מ-${nis(p.current.monthly)} ל-${nis(p.plan.monthly)} (כ-${p.plan.seekers} פונים)`,
    body: lines.join("\n"),
    changes,
  };
}

/** Every number in a text, as written but without thousands separators. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/**
 * The guard on the model's wording: it may only repeat numbers it was given.
 * A single number that appears nowhere in the input throws the wording away,
 * and the recommendation goes out without it.
 */
export function narrativeIsFaithful(narrative: string, source: string): boolean {
  const allowed = new Set(numbersIn(source));
  return numbersIn(narrative).every((n) => allowed.has(n));
}

/** The sentence the owner asked for, built from the projection alone. */
export function summarySentence(p: BudgetProjection): string {
  const month = hebrewMonth(p.month);
  const others = p.lastMonth.byPlatform.slice(1).filter((b) => b.cost > 0 || b.seekers > 0);
  const last = `${p.lastMonth.seekers} פונים ב-30 הימים האחרונים, שעלו ${nis(p.lastMonth.cost)}${
    p.lastMonth.cpl != null ? ` (${nis(p.lastMonth.cpl)} לפונה)` : ""
  }${others.map((b) => `, מתוכם ${b.label}: ${b.seekers} פונים ב-${nis(b.cost)}`).join("")}`;
  const ceilingNote =
    p.ceiling != null && p.otherMonthCost > 0
      ? ` התקרה: ${nis(p.ceiling)}, מתוכה ${nis(p.otherMonthCost)} כבר רשומים בפלטפורמות אחרות, ולגוגל נשארים ${nis(p.googleCeiling ?? 0)}.`
      : p.ceiling != null
        ? ` התקרה: ${nis(p.ceiling)}.`
        : "";
  const unknown = p.plan.unknown.length
    ? `, לא כולל ${p.plan.unknown.join(", ")} שעוד אין לו נתונים`
    : "";
  if (p.ceiling == null) {
    return `אין תקרה ל${month}. בתקציבים של היום: כ-${p.plan.seekers} פונים ב-${nis(p.plan.monthly)}${unknown}, מול ${last}.`;
  }
  const head = `הצפי ל${month}: כ-${p.plan.seekers} פונים ב-${nis(p.plan.monthly)}${
    p.plan.cpl != null ? ` (כ-${nis(p.plan.cpl)} לפונה)` : ""
  }${unknown}, מול ${last}.${ceilingNote}`;
  return p.overCeiling
    ? `${head} הקמפיינים המוגנים והחדשים לבדם כבר עוברים אותה.`
    : head;
}
