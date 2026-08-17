import "server-only"; // compile-time tripwire: this module holds API secrets and must never be pulled into a client bundle.

// Read-only Google Ads API client - pulls per-campaign spend + performance so the
// marketing dashboard can show real cost / CPC / CTR / CPL without manual entry.
// Uses the REST API (searchStream) + a refresh-token OAuth flow - no new npm
// dependency. All secrets come from env (set in Vercel); when they're absent the
// dashboard degrades gracefully to a "not configured" state.

const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/\D/g, "");
const LOGIN_CUSTOMER_ID = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, "");
// Google deprecates API versions ~3×/year (keeps ~3 recent majors live);
// overridable via env so it can be bumped without a code change if a call ever
// returns a 404/version error.
const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || "v24";

export function googleAdsConfigured(): boolean {
  return Boolean(DEV_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && CUSTOMER_ID);
}

export type AdsCampaign = {
  id: string;
  name: string;
  utmCampaign: string | null; // parsed from the campaign's final_url_suffix
  cost: number; // ILS
  clicks: number;
  impressions: number;
  conversions: number;
  ctr: number; // %
  avgCpc: number; // ILS
};

export type AdsResult = {
  campaigns: AdsCampaign[];
  byDay: { date: string; cost: number }[];
  total: number;
};

type GaqlRow = {
  campaign?: { id?: string | number; name?: string; finalUrlSuffix?: string | null };
  metrics?: {
    costMicros?: string | number;
    clicks?: string | number;
    impressions?: string | number;
    conversions?: string | number;
  };
  segments?: { date?: string };
};

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OAuth refresh failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text).access_token as string;
}

// POST מאומת גנרי מול חשבון ה-Ads - משרת גם את מודול העלאת ההמרות
// (google-ads-conversions.ts), כדי שהאימות וההגדרות יחיו במקום אחד.
// pathSuffix מודבק אחרי customers/{id}, למשל ":uploadClickConversions"
// או "/googleAds:search".
export async function googleAdsPost(
  pathSuffix: string,
  body: unknown
): Promise<{ status: number; text: string }> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}${pathSuffix}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": DEV_TOKEN!,
        ...(LOGIN_CUSTOMER_ID ? { "login-customer-id": LOGIN_CUSTOMER_ID } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  const text = await res.text();
  return { status: res.status, text };
}

function parseUtmCampaign(suffix?: string | null): string | null {
  if (!suffix) return null;
  const m = /utm_campaign=([^&]+)/.exec(suffix);
  return m ? decodeURIComponent(m[1]) : null;
}

// Fallback for campaigns whose utm lives in the ad's Final URL rather than the
// campaign's final_url_suffix (the API can only read the suffix): infer the
// utm_campaign from the campaign name so CPL can still join to contacts. The
// suffix (parseUtmCampaign) always takes precedence - add a Final URL suffix to
// a campaign and this heuristic is bypassed. Name-based, so keep the campaign
// names recognizable.
function inferUtmFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("telaviv") || n.includes("tel-aviv") || n.includes("תל אביב") || n.includes("תל-אביב")) return "g-telaviv";
  if (n.includes("jerusalem") || n.includes("ירושלים")) return "g-jerusalem";
  if (n.includes("g-how") || n.includes("howto") || n.includes("how to")) return "g-howto";
  if (n.includes("online") || n.includes("אונליין") || n.includes("search-patients")) return "g-online";
  // Therapist-recruitment campaigns (Demand Gen + Display). The suffix is set on
  // these, so parseUtmCampaign normally wins; this is a fallback if it's ever
  // read at the ad-group level (which the campaign query can't see).
  if (n.includes("demandgen") || n.includes("demand-gen")) return "therapist-demandgen";
  if (n.includes("therapist") && n.includes("display")) return "therapist-display";
  return null;
}

function isoDate(d: Date): string {
  // Format in the ad account's timezone (Asia/Jerusalem), NOT UTC - GAQL
  // segments.date is in the account TZ, so a UTC date would shift the window a
  // day and drop today's spend during the 00:00–03:00 UTC-vs-Israel gap.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function fetchGoogleAdsCampaigns(days: number): Promise<AdsResult> {
  const token = await getAccessToken();
  const end = new Date();
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  // GAQL uses snake_case field names; the REST response returns camelCase.
  const query =
    "SELECT campaign.id, campaign.name, campaign.final_url_suffix, " +
    "metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, segments.date " +
    "FROM campaign " +
    `WHERE segments.date BETWEEN '${isoDate(start)}' AND '${isoDate(end)}' ` +
    "AND campaign.status != 'REMOVED'";

  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "developer-token": DEV_TOKEN!,
        ...(LOGIN_CUSTOMER_ID ? { "login-customer-id": LOGIN_CUSTOMER_ID } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Ads API error (${res.status}): ${text.slice(0, 500)}`);

  // searchStream returns an array of batches: [{ results: [...] }, ...]. Some
  // zero-row ranges return an empty body - treat that as no results, not a parse error.
  const batches = text.trim() ? (JSON.parse(text) as { results?: GaqlRow[] }[]) : [];
  const rows: GaqlRow[] = Array.isArray(batches) ? batches.flatMap((b) => b.results ?? []) : [];

  const byId = new Map<string, AdsCampaign>();
  const byDayMap = new Map<string, number>();

  for (const r of rows) {
    const id = String(r.campaign?.id ?? "");
    if (!id) continue;
    const cost = Number(r.metrics?.costMicros ?? 0) / 1_000_000;
    const clicks = Number(r.metrics?.clicks ?? 0);
    const impressions = Number(r.metrics?.impressions ?? 0);
    const conversions = Number(r.metrics?.conversions ?? 0);
    const date = r.segments?.date ?? "";

    let c = byId.get(id);
    if (!c) {
      c = {
        id,
        name: r.campaign?.name ?? id,
        utmCampaign: parseUtmCampaign(r.campaign?.finalUrlSuffix) ?? inferUtmFromName(r.campaign?.name ?? ""),
        cost: 0,
        clicks: 0,
        impressions: 0,
        conversions: 0,
        ctr: 0,
        avgCpc: 0,
      };
      byId.set(id, c);
    }
    c.cost += cost;
    c.clicks += clicks;
    c.impressions += impressions;
    c.conversions += conversions;
    if (date) byDayMap.set(date, (byDayMap.get(date) ?? 0) + cost);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const campaigns = [...byId.values()]
    .map((c) => ({
      ...c,
      cost: round2(c.cost),
      ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0,
      avgCpc: c.clicks > 0 ? round2(c.cost / c.clicks) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  const byDay = [...byDayMap.entries()]
    .map(([date, cost]) => ({ date, cost: round2(cost) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const total = round2(campaigns.reduce((s, c) => s + c.cost, 0));

  return { campaigns, byDay, total };
}
