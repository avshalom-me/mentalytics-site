// The arithmetic behind the monthly budget report (docs/agents/budget-agent-plan.md,
// section ו and step 6). Pure: every input is passed in, so each chapter's
// numbers can be checked by hand and by vitest. The report itself is
// app/lib/budget-report.ts.

/** Split a total across keys in proportion to their weights. Keys with no weight get nothing. */
export function allocateByShare(total: number, weights: Map<string, number>): Map<string, number> {
  const sum = [...weights.values()].reduce((s, w) => s + Math.max(0, w), 0);
  const out = new Map<string, number>();
  if (sum <= 0 || total === 0) return out;
  for (const [k, w] of weights) if (w > 0) out.set(k, (total * w) / sum);
  return out;
}

export type Utilization = "limited" | "partial" | "saturated" | "unknown";

/**
 * How much of its daily budget a campaign actually spends. Google does not sync
 * "impression share lost to budget" here, so this is the proxy: a campaign that
 * spends ~all of its budget day after day would buy more with more money; one
 * that spends well under it is limited by demand, not by the budget.
 */
export function budgetUtilization(
  daily: { cost: number }[],
  dailyBudget: number | null
): { avgDaily: number; share: number | null; kind: Utilization } {
  const days = daily.length;
  const avgDaily = days ? daily.reduce((s, d) => s + d.cost, 0) / days : 0;
  if (!dailyBudget || dailyBudget <= 0 || days < 5) return { avgDaily, share: null, kind: "unknown" };
  const share = avgDaily / dailyBudget;
  return { avgDaily, share, kind: share >= 0.9 ? "limited" : share < 0.6 ? "saturated" : "partial" };
}

export type WindowStats = { cost: number; clicks: number; impressions: number };

export type Anomaly = { metric: "cpc" | "ctr"; before: number; after: number; change: number };

/**
 * CPC and CTR of the last window against the one before it. A move of 30% or
 * more on at least 30 clicks in each window is reported; smaller samples are
 * noise at this account's volume.
 */
export function anomalies(before: WindowStats, after: WindowStats, minClicks = 30, threshold = 0.3): Anomaly[] {
  if (before.clicks < minClicks || after.clicks < minClicks) return [];
  const out: Anomaly[] = [];
  const cpcB = before.cost / before.clicks;
  const cpcA = after.cost / after.clicks;
  if (cpcB > 0 && Math.abs(cpcA / cpcB - 1) >= threshold) {
    out.push({ metric: "cpc", before: cpcB, after: cpcA, change: cpcA / cpcB - 1 });
  }
  if (before.impressions > 0 && after.impressions > 0) {
    const ctrB = before.clicks / before.impressions;
    const ctrA = after.clicks / after.impressions;
    if (ctrB > 0 && Math.abs(ctrA / ctrB - 1) >= threshold) {
      out.push({ metric: "ctr", before: ctrB, after: ctrA, change: ctrA / ctrB - 1 });
    }
  }
  return out;
}

/**
 * Months of cash left at the given monthly result. Null when there is no cash
 * figure, or when the month is not losing money (then there is no runway to count).
 */
export function runwayMonths(cash: number | null, monthlyNet: number): number | null {
  if (cash == null || monthlyNet >= 0) return null;
  return Math.max(0, cash / -monthlyNet);
}

export type GiftOfferRow = { therapist_id: string; sent_at: string };
export type GiftTokenRow = { therapist_id: string; first_viewed_at: string | null; used_at: string | null; created_at: string };

export type GiftFunnel = {
  sent: number;
  opened: number;
  /** Of the opened, how many opened within 34 hours - the window measured on 26/9/2026. */
  openedWithin34h: number;
  registered: number;
  /** Registered, and then charged at least once after the offer. */
  paid: number;
};

/**
 * Sent → opened → registered → paid, one step per therapist. Opening is only
 * measured since 4/9/2026 (first_viewed_at), so offers sent earlier count as sent
 * but can never count as opened.
 */
export function giftFunnel(
  offers: GiftOfferRow[],
  tokens: GiftTokenRow[],
  paidAfter: Map<string, string[]>
): GiftFunnel {
  const f: GiftFunnel = { sent: offers.length, opened: 0, openedWithin34h: 0, registered: 0, paid: 0 };
  for (const o of offers) {
    const mine = tokens.filter((t) => t.therapist_id === o.therapist_id && t.created_at >= o.sent_at.slice(0, 10));
    const firstView = mine.map((t) => t.first_viewed_at).filter((v): v is string => !!v).sort()[0];
    const used = mine.some((t) => t.used_at);
    // Registering means the offer was opened, even when the view was not
    // logged (before 4/9/2026, or a browser that blocked the beacon).
    if (firstView || used) f.opened++;
    if (firstView && Date.parse(firstView) - Date.parse(o.sent_at) <= 34 * 60 * 60 * 1000) f.openedWithin34h++;
    if (used) {
      f.registered++;
      if ((paidAfter.get(o.therapist_id) ?? []).some((at) => at > o.sent_at)) f.paid++;
    }
  }
  return f;
}

/** A plain percentage for a report line: "12%", or "—" without a base. */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}
