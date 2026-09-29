// Advertising spend outside Google, from the platforms' invoices (budget agent
// step 3, docs/agents/budget-agent-plan.md).
//
// No platform API on purpose. The owner decided on 30/9/2026 that Meta, when
// the account is back, is read only from its invoices; nothing logs into
// Facebook or holds a token for it. A row is what an invoice or receipt says:
// an amount before VAT for a period. Any window's total is prorated by day.
//
// Pure apart from fetchBoiRate, which reads the Bank of Israel's public
// exchange-rate feed (no key, read-only).

export type PlatformKey = "taboola" | "meta" | "tiktok" | "other";
export type SpendCurrency = "ILS" | "USD" | "EUR";

export const PLATFORMS: { key: PlatformKey; label: string; channel: string | null }[] = [
  { key: "taboola", label: "טאבולה", channel: "taboola_paid" },
  { key: "meta", label: "מטא", channel: "meta_paid" },
  { key: "tiktok", label: "טיקטוק", channel: "tiktok_paid" },
  { key: "other", label: "אחר", channel: null },
];

export const CURRENCIES: SpendCurrency[] = ["ILS", "USD", "EUR"];

export function platformLabel(key: string): string {
  return PLATFORMS.find((p) => p.key === key)?.label ?? key;
}

export type PlatformSpendRow = {
  id?: string;
  platform: string;
  campaign_key: string | null;
  period_start: string;
  period_end: string;
  amount_orig: number | string;
  currency: string;
  fx_rate: number | string;
  amount_ils: number | string;
  vat_orig?: number | string | null;
  source?: string;
  source_ref?: string | null;
  note?: string | null;
  created_at?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** Days that the inclusive ranges [aStart, aEnd] and [bStart, bEnd] share. */
export function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const from = Math.max(dayNumber(aStart), dayNumber(bStart));
  const to = Math.min(dayNumber(aEnd), dayNumber(bEnd));
  return Math.max(0, to - from + 1);
}

/** The row's shekels that fall inside [from, to], spread evenly over its days. */
export function prorated(row: PlatformSpendRow, from: string, to: string): number {
  const days = overlapDays(row.period_start, row.period_end, row.period_start, row.period_end);
  if (days <= 0) return 0;
  return (Number(row.amount_ils) * overlapDays(row.period_start, row.period_end, from, to)) / days;
}

export type PlatformWindow = {
  platform: PlatformKey | string;
  label: string;
  cost: number;
  seekers: number;
  cpl: number | null;
};

/**
 * Spend and seekers per platform over the inclusive window [from, to]. The
 * seekers come from the site (budget RPC platform_seekers), matched by the
 * platform's paid channel. Platforms with neither are left out.
 */
export function platformTotals(
  rows: PlatformSpendRow[],
  seekers: { channel: string; seekers: number | string }[],
  from: string,
  to: string
): PlatformWindow[] {
  return PLATFORMS.map((p) => {
    const cost = rows.filter((r) => r.platform === p.key).reduce((s, r) => s + prorated(r, from, to), 0);
    const n = p.channel
      ? seekers.filter((s) => s.channel === p.channel).reduce((s, x) => s + Number(x.seekers), 0)
      : 0;
    return {
      platform: p.key,
      label: p.label,
      cost: Math.round(cost),
      seekers: n,
      // No invoice yet is not "free": without spend there is no cost per seeker.
      cpl: n > 0 && cost > 0 ? Math.round(Math.round(cost) / n) : null,
    };
  }).filter((w) => w.cost > 0 || w.seekers > 0);
}

// ---------- Bank of Israel representative rates ----------

const BOI_SERIES: Record<Exclude<SpendCurrency, "ILS">, string> = {
  USD: "RER_USD_ILS",
  EUR: "RER_EUR_ILS",
};

/** The feed's CSV: one row per business day, TIME_PERIOD and OBS_VALUE among the columns. */
export function parseBoiCsv(csv: string): { date: string; rate: number }[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const dateCol = header.indexOf("TIME_PERIOD");
  const valueCol = header.indexOf("OBS_VALUE");
  if (dateCol < 0 || valueCol < 0) return [];
  return lines
    .slice(1)
    .map((l) => l.split(","))
    .map((cols) => ({ date: cols[dateCol], rate: Number(cols[valueCol]) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.rate) && r.rate > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * The representative rate in force on a day: the last one published on or
 * before it (none is published on weekends and holidays). Null when the feed
 * cannot be read - the caller then asks for the rate by hand.
 */
export async function fetchBoiRate(
  currency: SpendCurrency,
  day: string
): Promise<{ rate: number; date: string } | null> {
  if (currency === "ILS") return { rate: 1, date: day };
  const from = new Date(Date.parse(`${day}T00:00:00Z`) - 14 * DAY_MS).toISOString().slice(0, 10);
  const url =
    `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/${BOI_SERIES[currency]}` +
    `?startperiod=${from}&endperiod=${day}&format=csv`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const rows = parseBoiCsv(await res.text()).filter((r) => r.date <= day);
    const last = rows[rows.length - 1];
    return last ? { rate: last.rate, date: last.date } : null;
  } catch {
    return null;
  }
}
