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
  /** The trailing 30 days, every Google campaign including paused ones. */
  lastMonth: { cost: number; seekers: number; cpl: number | null };
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

/** Cost per seeker the way the 29/9 analysis rounded it: the shekel total first, then the division. */
function costPerSeeker(cost: number, seekers: number): number | null {
  return seekers > 0 ? Math.round(Math.round(cost) / seekers) : null;
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
export function projectBudget(input: {
  campaigns: BudgetCampaignInput[];
  ceiling: number | null;
  month: string;
  today: string;
}): BudgetProjection {
  const D = daysInMonth(input.month);
  const monthStart = `${input.month}-01`;

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

  if (input.ceiling == null) {
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
    let remaining = input.ceiling - keptMonthly;
    for (const r of candidates) {
      const current = r.dailyBudget ?? 0;
      let daily = r.rate == null ? 0 : Math.min(current, Math.max(0, Math.floor(remaining / D)));
      if (daily < MIN_DAILY) daily = 0;
      r.proposedDaily = daily;
      r.decision = daily === 0 ? "pause" : daily < current ? "reduce" : "keep";
      remaining -= daily * D;
    }
  }

  for (const r of rows) {
    r.projectedCost = r.proposedDaily * D;
    r.projectedSeekers = r.rate != null && r.proposedDaily > 0 ? r.projectedCost / r.rate : r.proposedDaily > 0 ? null : 0;
  }

  const lastCost = rows.reduce((s, r) => s + r.cost30, 0);
  const lastSeekers = rows.reduce((s, r) => s + r.seekers30, 0);
  const currentDaily = inPlan.reduce((s, r) => s + (r.dailyBudget ?? 0), 0);
  const planDaily = inPlan.reduce((s, r) => s + r.proposedDaily, 0);
  const known = inPlan.filter((r) => r.projectedSeekers != null && r.proposedDaily > 0);
  const planSeekers = known.reduce((s, r) => s + (r.projectedSeekers ?? 0), 0);
  const knownCost = known.reduce((s, r) => s + r.projectedCost, 0);

  return {
    month: input.month,
    daysInMonth: D,
    ceiling: input.ceiling,
    lastMonth: {
      cost: Math.round(lastCost),
      seekers: lastSeekers,
      cpl: costPerSeeker(lastCost, lastSeekers),
    },
    current: { daily: currentDaily, monthly: currentDaily * D },
    plan: {
      daily: planDaily,
      monthly: planDaily * D,
      seekers: Math.round(planSeekers),
      cpl: planSeekers > 0 ? Math.round(knownCost / planSeekers) : null,
      unknown: inPlan.filter((r) => r.proposedDaily > 0 && r.projectedSeekers == null).map((r) => r.googleName),
    },
    overCeiling: input.ceiling != null && keptMonthly > input.ceiling,
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

/** The sentence the owner asked for, built from the projection alone. */
export function summarySentence(p: BudgetProjection): string {
  const month = hebrewMonth(p.month);
  const last = `${p.lastMonth.seekers} פונים ב-30 הימים האחרונים, שעלו ${nis(p.lastMonth.cost)}${
    p.lastMonth.cpl != null ? ` (${nis(p.lastMonth.cpl)} לפונה)` : ""
  }`;
  const unknown = p.plan.unknown.length
    ? `, לא כולל ${p.plan.unknown.join(", ")} שעוד אין לו נתונים`
    : "";
  if (p.ceiling == null) {
    return `אין תקרה ל${month}. בתקציבים של היום: כ-${p.plan.seekers} פונים ב-${nis(p.plan.monthly)}${unknown}, מול ${last}.`;
  }
  const head = `הצפי ל${month}: כ-${p.plan.seekers} פונים ב-${nis(p.plan.monthly)}${
    p.plan.cpl != null ? ` (כ-${nis(p.plan.cpl)} לפונה)` : ""
  }${unknown}, מול ${last}. התקרה: ${nis(p.ceiling)}.`;
  return p.overCeiling
    ? `${head} הקמפיינים המוגנים והחדשים לבדם כבר עוברים אותה.`
    : head;
}
