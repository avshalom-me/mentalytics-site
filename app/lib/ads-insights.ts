import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { CITY_SEO_LIST, ALL_REGIONS } from "./regions";

// The single ads-analysis engine. Both consumers read from HERE:
//   /api/admin-ads-console  - serves the full payload to the console page
//   ads-monitor (agent 4)   - pushes red/amber alerts to the suggestion queue
//
// Until 30/08/26 these were two separate systems with two data sources: the
// agent asked the live Google Ads API four questions while the console ran
// fifteen checks on the nightly-synced ads_* tables, so everything learned
// during the sharon investigation (broad match, place-less intent, HMO terms)
// reached only whoever remembered to open the console. One engine, one data
// source (the synced tables - complete through yesterday, which for a 07:00
// agent is fresher than "live" and includes keywords/search terms the live
// campaign API never returned), and every alert carries a stable key so the
// queue can auto-recover the moment a fixed problem stops re-appearing.

const LOOKBACK_DAYS = 7;
// כמה אחורה מחפשים את הפנייה האחרונה של קמפיין. בצורת ארוכה מזה כבר לא
// צריכה מספר מדויק כדי להיות ברורה, והחלון הקצר שומר את השאילתה זולה.
const DRY_WINDOW_DAYS = 45;
// תקציב חודשי מתוכנן לפרסום (₪) - נקבע ל-3,500 ב-30/8/26. ניתן לעקוף
// בסביבה (ADS_MONTHLY_BUDGET) בלי דיפלוי.
const MONTHLY_BUDGET = Number(process.env.ADS_MONTHLY_BUDGET ?? 3500);
// יעד עלות ללחיצת פנייה כשאין אבן דרך בתוכנית העסקית.
const FALLBACK_MAX_CPL = Number(process.env.ADS_MAX_CPL ?? 250);

export type AdsAlert = {
  // Stable dedupe key (ads:<check>:<campaign> or ads:<check>). The queue keys
  // recovery on it: an alert that stops being emitted closes itself.
  key: string;
  severity: "red" | "amber" | "info";
  title: string;
  detail: string;
};

export type AdsCampaignRow = {
  google_name: string;
  registered: boolean;
  utm_campaign: string | null;
  status: string | null;
  cost7: number; cost30: number;
  clicks7: number; clicks30: number;
  impr7: number; impr30: number;
  cpc7: number | null;
  ctr7: number | null;
  conv7: number;
  conv30: number;
  sessions7: number; sessions30: number;
  quiz30: number;
  views30: number;
  contacts7: number; contacts30: number;
  costPerContact30: number | null;
  // אורך הבצורת: כמה ימים עברו מאז הפנייה האחרונה, וכמה כסף נשרף מאז.
  // null = לא נראתה פנייה בכל חלון הבדיקה (DRY_WINDOW_DAYS).
  daysSinceContact: number | null;
  costSinceContact: number;
};

export type AdsInsights = {
  payload: {
    registry: RegistryRow[];
    campaigns: AdsCampaignRow[];
    siteOnly: SiteRow[];
    alerts: AdsAlert[];
    lastSync: string | null;
    monthlyTarget: number;
    totalCost30: number;
    keywords: {
      capViolations: unknown[];
      topSpenders: unknown[];
      rarelyServed: { campaign: string; count: number }[];
    };
    searchTerms: {
      generic: unknown[];
      hiddenShare: unknown[];
      placeless: { campaign: string; pct: number; cost30: number; top: { term: string; cost: number; clicks: number }[] }[];
      hmoFree: { campaign: string; term: string; cost: number; clicks: number }[];
    };
  };
  alerts: AdsAlert[];
  lastSync: string | null;
  spendMtd: number;
  budgetPace: { expected: number; actual: number } | null;
  cplTarget: { value: number; fromPlan: boolean };
  managedKeys: string[];
};

export type RegistryRow = {
  id: string;
  google_name: string;
  utm_campaign: string | null;
  budget_type: "daily" | "total";
  budget_amount: number | null;
  end_date: string | null;
  cpc_cap: number | null;
  active: boolean;
  notes: string | null;
};

type SiteRow = { utm_campaign: string; sessions: number; quiz_completes: number; profile_views: number; contacts: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

// plan_targets holds a trajectory of milestones (09/26 ₪65 → 12/26 ₪50 →
// 06/27 ₪40), so the newest row is the FUTURE goal, not today's. Use the
// milestone in force now: the latest month that has already started, or the
// earliest one if the plan begins in the future.
async function maxCplTarget(): Promise<{ value: number; fromPlan: boolean }> {
  try {
    const { data } = await supabaseAdmin
      .from("plan_targets")
      .select("metric, month, target")
      .eq("metric", "cpl_max")
      .order("month", { ascending: true });
    const rows = (data ?? []).filter((r) => Number(r.target) > 0);
    const today = new Date().toISOString().slice(0, 10);
    const current = [...rows].reverse().find((r) => String(r.month) <= today) ?? rows[0];
    const n = Number(current?.target);
    if (Number.isFinite(n) && n > 0) return { value: n, fromPlan: true };
  } catch {
    /* ממשיכים עם ברירת המחדל */
  }
  return { value: FALLBACK_MAX_CPL, fromPlan: false };
}

export async function buildAdsInsights(): Promise<AdsInsights> {
  const [registryQ, configQ, dailyQ, kwStatusQ, syncQ, site7Q, site30Q, cplTarget] = await Promise.all([
    supabaseAdmin.from("ads_campaign_registry").select("*").order("google_name"),
    supabaseAdmin.from("ads_campaign_config").select("*"),
    supabaseAdmin
      .from("ads_campaign_daily")
      .select("*")
      .gte("date", new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)),
    supabaseAdmin.from("ads_keyword_status").select("*"),
    supabaseAdmin.from("ads_sync_log").select("synced_at").order("synced_at", { ascending: false }).limit(1),
    supabaseAdmin.rpc("ads_console_site_stats", { p_days: 7 }),
    supabaseAdmin.rpc("ads_console_site_stats", { p_days: 30 }),
    maxCplTarget(),
  ]);
  for (const q of [registryQ, configQ, dailyQ, kwStatusQ, syncQ, site7Q, site30Q]) {
    if (q && typeof q === "object" && "error" in q && q.error) throw new Error(String(q.error.message));
  }

  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const since30 = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10);
  const todayIso = new Date().toISOString().slice(0, 10);
  const sinceDryDay = new Date(Date.now() - DRY_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  // Keyword/search-term dailies can exceed the 1000-row PostgREST cap, so
  // they page through fetchAllRows. Keywords come as a single 30-day fetch
  // (match_type included, for the broad-share check); the 7-day views the
  // console shows are derived by filtering, not refetched.
  const [kwDaily, terms] = await Promise.all([
    fetchAllRows<{ date: string; campaign_name: string; ad_group: string; keyword: string; match_type: string | null; impressions: number; clicks: number; cost: number }>(
      () => supabaseAdmin.from("ads_keyword_daily").select("date, campaign_name, ad_group, keyword, match_type, impressions, clicks, cost").gte("date", since30)
    ),
    fetchAllRows<{ date: string; campaign_name: string; term: string; impressions: number; clicks: number; cost: number }>(
      () => supabaseAdmin.from("ads_search_term_daily").select("*").gte("date", since30)
    ),
  ]);

  // מתי כל קמפיין הביא פנייה בפעם האחרונה. בלי זה בדיקת ה"קר" מכירה רק
  // "אפס בשבוע", וזה מדד רועש: שבוע יבש בקמפיין קטן הוא לפעמים מקריות,
  // בעוד עשרה ימים רצופים בקמפיין שממשיך לשלם הם ממצא. נמדד מול
  // utm_campaign כי זו הזהות שצד האתר מכיר.
  const contactRows = await fetchAllRows<{ utm_campaign: string | null; clicked_at: string }>(
    () => supabaseAdmin
      .from("therapist_contact_clicks")
      .select("utm_campaign, clicked_at")
      .gte("clicked_at", new Date(Date.now() - DRY_WINDOW_DAYS * 86_400_000).toISOString())
  );
  const lastContactByUtm = new Map<string, string>();
  for (const row of contactRows) {
    if (!row.utm_campaign) continue;
    const day = row.clicked_at.slice(0, 10);
    const prev = lastContactByUtm.get(row.utm_campaign);
    if (!prev || day > prev) lastContactByUtm.set(row.utm_campaign, day);
  }

  const registry = (registryQ.data ?? []) as RegistryRow[];
  type ConfigRow = {
    campaign_id: number;
    campaign_name: string; status: string | null; end_date: string | null;
    daily_budget: number | null; total_budget: number | null;
    bidding_strategy: string | null; cpc_ceiling: number | null;
    net_search: boolean | null; net_partners: boolean | null; net_display: boolean | null;
  };
  const config = (configQ.data ?? []) as ConfigRow[];
  const configByName = new Map(config.map((c) => [c.campaign_name, c]));
  const daily = (dailyQ.data ?? []) as { date: string; campaign_name: string; impressions: number; clicks: number; cost: number; conversions: number }[];
  const lastSync = (syncQ.data?.[0]?.synced_at as string | undefined) ?? null;

  const site7 = new Map(((site7Q.data ?? []) as SiteRow[]).map((s) => [s.utm_campaign, s]));
  const site30 = new Map(((site30Q.data ?? []) as SiteRow[]).map((s) => [s.utm_campaign, s]));

  // --- Google-side aggregates per campaign: 7d, previous-7d, 30d, MTD ---
  type Agg = { impr: number; clicks: number; cost: number; conv: number };
  const zero = (): Agg => ({ impr: 0, clicks: 0, cost: 0, conv: 0 });
  const g7 = new Map<string, Agg>();
  const gPrev7 = new Map<string, Agg>();
  const g30 = new Map<string, Agg>();
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  // First day we ever saw data for a campaign - the launch audit below uses
  // it to know which campaigns are young enough to still be fixable cheaply.
  const firstSeen = new Map<string, string>();
  let spendMtd = 0;
  for (const d of daily) {
    const f = firstSeen.get(d.campaign_name);
    if (!f || d.date < f) firstSeen.set(d.campaign_name, d.date);
    const into = (m: Map<string, Agg>) => {
      const a = m.get(d.campaign_name) ?? zero();
      a.impr += d.impressions; a.clicks += d.clicks; a.cost += d.cost; a.conv += d.conversions;
      m.set(d.campaign_name, a);
    };
    into(g30);
    if (d.date >= since7) into(g7);
    else if (d.date >= since14) into(gPrev7);
    if (d.date >= monthStart) spendMtd += d.cost;
  }
  spendMtd = r2(spendMtd);

  // --- Master rows: registry ∪ any synced campaign missing from it ---
  const names = new Set<string>([...registry.map((r) => r.google_name), ...g30.keys(), ...config.map((c) => c.campaign_name)]);
  const claimedUtm = new Set(registry.map((r) => r.utm_campaign).filter(Boolean) as string[]);
  const campaigns: AdsCampaignRow[] = [...names].map((name) => {
    const reg = registry.find((r) => r.google_name === name) ?? null;
    const cfg = configByName.get(name) ?? null;
    const a7 = g7.get(name) ?? zero();
    const a30 = g30.get(name) ?? zero();
    const s7 = reg?.utm_campaign ? site7.get(reg.utm_campaign) : undefined;
    const s30 = reg?.utm_campaign ? site30.get(reg.utm_campaign) : undefined;
    // הפנייה האחרונה, ומה שנשרף מאז. כשאין פנייה בכל החלון סופרים את כל
    // ההוצאה שיש עליה נתונים - כלומר 30 הימים של ads_campaign_daily, ולכן
    // הסכום הזה הוא רצפה ולא הסכום המלא של הבצורת.
    const lastContactDay = reg?.utm_campaign ? lastContactByUtm.get(reg.utm_campaign) ?? null : null;
    const dryFrom = lastContactDay ?? sinceDryDay;
    return {
      google_name: name,
      registered: !!reg,
      utm_campaign: reg?.utm_campaign ?? null,
      status: cfg?.status ?? null,
      cost7: r2(a7.cost), cost30: r2(a30.cost),
      clicks7: a7.clicks, clicks30: a30.clicks,
      impr7: a7.impr, impr30: a30.impr,
      cpc7: a7.clicks > 0 ? r2(a7.cost / a7.clicks) : null,
      ctr7: a7.impr > 0 ? r2((a7.clicks / a7.impr) * 100) : null,
      conv7: r2(a7.conv),
      conv30: r2(a30.conv),
      sessions7: s7?.sessions ?? 0, sessions30: s30?.sessions ?? 0,
      quiz30: s30?.quiz_completes ?? 0,
      views30: s30?.profile_views ?? 0,
      contacts7: s7?.contacts ?? 0, contacts30: s30?.contacts ?? 0,
      costPerContact30: s30 && s30.contacts > 0 && a30.cost > 0 ? r2(a30.cost / s30.contacts) : null,
      daysSinceContact: lastContactDay
        ? Math.floor((Date.parse(todayIso) - Date.parse(lastContactDay)) / 86_400_000)
        : null,
      costSinceContact: r2(
        daily.filter((d) => d.campaign_name === name && d.date > dryFrom).reduce((s, d) => s + d.cost, 0)
      ),
    };
  }).sort((a, b) => b.cost30 - a.cost30 || a.google_name.localeCompare(b.google_name));

  // Paid traffic whose utm_campaign no registry row claims - includes the
  // '(ללא תיוג)' bucket, whose growth means a suffix got swallowed again.
  const siteOnly = [...site30.values()]
    .filter((s) => !claimedUtm.has(s.utm_campaign))
    .sort((a, b) => b.sessions - a.sessions);

  // --- Keywords ---
  type KwAgg = { campaign: string; keyword: string; impr: number; clicks: number; cost: number };
  const kwMap = new Map<string, KwAgg>();
  const broadByCampaign = new Map<string, { broad: number; total: number }>();
  // 30-day keyword impressions per campaign, for the "what is actually
  // serving" check below.
  const kwImprByCampaign = new Map<string, number>();
  for (const k of kwDaily) {
    kwImprByCampaign.set(k.campaign_name, (kwImprByCampaign.get(k.campaign_name) ?? 0) + k.impressions);
    const b = broadByCampaign.get(k.campaign_name) ?? { broad: 0, total: 0 };
    b.total += k.cost;
    if ((k.match_type ?? "").toUpperCase() === "BROAD") b.broad += k.cost;
    broadByCampaign.set(k.campaign_name, b);

    if (k.date < since7) continue;
    const key = `${k.campaign_name} ${k.keyword}`;
    const a = kwMap.get(key) ?? { campaign: k.campaign_name, keyword: k.keyword, impr: 0, clicks: 0, cost: 0 };
    a.impr += k.impressions; a.clicks += k.clicks; a.cost += k.cost;
    kwMap.set(key, a);
  }
  const kwAgg = [...kwMap.values()];
  const capOf = new Map(registry.map((r) => [r.google_name, r.cpc_cap]));
  const kwCapViolations = kwAgg
    .filter((k) => {
      const cap = capOf.get(k.campaign);
      return cap != null && k.clicks > 0 && k.cost / k.clicks > cap * 1.05;
    })
    .map((k) => ({ ...k, cost: r2(k.cost), cpc: r2(k.cost / k.clicks) }))
    .sort((a, b) => b.cpc - a.cpc);
  const kwTop = kwAgg
    .filter((k) => k.cost > 0)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 15)
    .map((k) => ({ ...k, cost: r2(k.cost), cpc: k.clicks > 0 ? r2(k.cost / k.clicks) : null, ctr: k.impr > 0 ? r2((k.clicks / k.impr) * 100) : null }));
  const kwStatusRows = (kwStatusQ.data ?? []) as { campaign_name: string; serving_status: string | null; status: string | null }[];
  const rarely = kwStatusRows.filter((k) => (k.serving_status ?? "").toUpperCase().includes("RARELY"));
  const rarelyByCampaign = new Map<string, number>();
  for (const k of rarely) rarelyByCampaign.set(k.campaign_name, (rarelyByCampaign.get(k.campaign_name) ?? 0) + 1);
  const kwCountByCampaign = new Map<string, number>();
  for (const k of kwStatusRows) kwCountByCampaign.set(k.campaign_name, (kwCountByCampaign.get(k.campaign_name) ?? 0) + 1);

  // --- Search terms ---
  // The "צפון" family is what ate 62% of g-hadera; any generic geo term
  // showing impressions is a leak worth blocking the same day.
  const GENERIC = /(^|\s)(צפון|בצפון|הצפון|גליל|בגליל|בישראל|בארץ)(\s|$)/;
  const genericHits = terms
    .filter((t) => t.date >= since14 && GENERIC.test(t.term) && t.impressions > 0)
    .map((t) => ({ campaign: t.campaign_name, term: t.term, impressions: t.impressions, clicks: t.clicks, cost: r2(t.cost) }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30);
  // Google hides sub-threshold queries; the gap between campaign cost and
  // the cost its visible terms account for approximates that hidden share.
  const termCost30 = new Map<string, number>();
  for (const t of terms) termCost30.set(t.campaign_name, (termCost30.get(t.campaign_name) ?? 0) + t.cost);
  const hiddenShare = [...g30.entries()]
    .filter(([, a]) => a.cost >= 100)
    .map(([name, a]) => ({ campaign: name, cost30: r2(a.cost), hiddenPct: Math.max(0, Math.round((1 - (termCost30.get(name) ?? 0) / a.cost) * 100)) }))
    .filter((h) => h.hiddenPct >= 30)
    .sort((a, b) => b.hiddenPct - a.hiddenPct);

  // --- What intent the campaign actually buys ---
  // Aug 2026: g-sharon put 85-90% of its budget into searches with no place
  // in them ("פסיכולוג" alone) and converted quiz-completers to contacts at
  // 12%, against 34% for the campaign buying "פסיכולוג תל אביב". The same 49
  // therapists appeared in both and converted 2.6x worse under that traffic
  // (p=0.011), so the gap is audience intent, not supply. Online/remote words
  // count as intent too - otherwise the online campaign (2% place-less and
  // the best converter in the account) would trip this every night.
  const GEO_TOKENS = [
    ...CITY_SEO_LIST, ...ALL_REGIONS,
    "מרכז", "שרון", "צפון", "דרום", "שפלה", "גליל", "עמק", "אזור", "קרוב", "סביב",
    "אונליין", "און ליין", "זום", "מרחוק", "טלפוני", "וידאו",
  ];
  const hasPlaceIntent = (term: string) => GEO_TOKENS.some((g) => term.includes(g));
  // Subsidised/free seekers: they finish the quiz and never contact a private
  // therapist, so their clicks are pure loss however cheap they look.
  const HMO_FREE = /(כללית|מכבי|מאוחדת|לאומית|בהסדר|סבסוד|קופת חולים|קופ"ח|חינם|ללא תשלום)/;

  const termTotals = new Map<string, { campaign: string; term: string; cost: number; clicks: number }>();
  for (const t of terms) {
    const k = `${t.campaign_name} ${t.term}`;
    const a = termTotals.get(k) ?? { campaign: t.campaign_name, term: t.term, cost: 0, clicks: 0 };
    a.cost += t.cost; a.clicks += t.clicks;
    termTotals.set(k, a);
  }
  const intentByCampaign = new Map<string, { total: number; noIntent: number; top: { term: string; cost: number; clicks: number }[] }>();
  const hmoFree: { campaign: string; term: string; cost: number; clicks: number }[] = [];
  for (const a of termTotals.values()) {
    const e = intentByCampaign.get(a.campaign) ?? { total: 0, noIntent: 0, top: [] };
    e.total += a.cost;
    if (!hasPlaceIntent(a.term)) {
      e.noIntent += a.cost;
      if (a.clicks > 0) e.top.push({ term: a.term, cost: r2(a.cost), clicks: a.clicks });
    }
    intentByCampaign.set(a.campaign, e);
    if (HMO_FREE.test(a.term) && a.clicks > 0) hmoFree.push({ campaign: a.campaign, term: a.term, cost: r2(a.cost), clicks: a.clicks });
  }
  const placeless = [...intentByCampaign.entries()]
    .filter(([, e]) => e.total >= 100 && e.noIntent / e.total >= 0.6)
    .map(([campaign, e]) => ({
      campaign,
      pct: Math.round((e.noIntent / e.total) * 100),
      cost30: r2(e.noIntent),
      top: e.top.sort((x, y) => y.cost - x.cost).slice(0, 8),
    }))
    .sort((a, b) => b.cost30 - a.cost30);
  hmoFree.sort((a, b) => b.cost - a.cost);

  // ---------------------------------------------------------------- Alerts
  const alerts: AdsAlert[] = [];
  const push = (key: string, severity: AdsAlert["severity"], title: string, detail: string) =>
    alerts.push({ key, severity, title, detail });
  const today = new Date().toISOString().slice(0, 10);
  const daysUntil = (d: string) => Math.ceil((new Date(d + "T00:00:00Z").getTime() - new Date(today + "T00:00:00Z").getTime()) / 86_400_000);

  // Sync health first: when this fires, every number below is only as fresh
  // as the last sync, so it outranks everything.
  if (lastSync) {
    const hours = (Date.now() - new Date(lastSync).getTime()) / 3_600_000;
    if (hours > 48) push("ads:sync-stale", "red", `📡 הסנכרון האחרון לפני ${Math.round(hours)} שעות`, "הסקריפט בגוגל אדס הפסיק לרוץ או שהסוד הוחלף. כל המספרים כאן קפואים לאותו רגע. Tools > Scripts > לבדוק את היומן.");
  } else {
    push("ads:sync-none", "info", "📡 סקריפט הסנכרון טרם חובר", "עד החיבור פועלות רק התראות הרישום הידני. הוראות ההתקנה: docs/ads-console-setup.md בריפו.");
  }

  for (const reg of registry.filter((x) => x.active)) {
    const end = reg.end_date ?? configByName.get(reg.google_name)?.end_date ?? null;
    if (end) {
      const left = daysUntil(end);
      if (left < 0) push(`ads:end:${reg.google_name}`, "red", `⏰ ${reg.google_name} - תאריך הסיום עבר`, `הקמפיין נעצר ב-${end}. להאריך תאריך + תקציב כולל באותה שמירה.`);
      else if (left <= 14) push(`ads:end:${reg.google_name}`, left <= 7 ? "red" : "amber", `⏰ ${reg.google_name} נעצר בעוד ${left} ימים`, `תאריך סיום ${end}. תקציב כולל מוגבל ל-90 יום מתחילת הקמפיין - להאריך תאריך ותקציב באותה שמירה.`);
    }
    const cfg = configByName.get(reg.google_name);
    if (reg.cpc_cap != null && cfg && cfg.cpc_ceiling == null) {
      // Google's config feed does not always expose the ceiling, so a null
      // alone is not proof the cap is gone - 30/08/26 one campaign read null
      // at 23:59 and ₪7 at 05:06. Observed CPC decides the severity.
      const obs = campaigns.find((c) => c.google_name === reg.google_name);
      const overCap = obs?.cpc7 != null && obs.clicks7 >= 5 && obs.cpc7 > reg.cpc_cap * 1.05;
      if (overCap) push(`ads:cap-missing:${reg.google_name}`, "red", `🎯 ${reg.google_name} - התקרה לא קיימת בגוגל`, `ברישום מצופה תקרת ₪${reg.cpc_cap}, בהגדרות אין תקרה, וה-CPC בפועל ₪${obs?.cpc7} מעל התקרה. זה מה שעלה ל-g-online ב-₪8.51 לקליק.`);
      else push(`ads:cap-missing:${reg.google_name}`, "amber", `🎯 ${reg.google_name} - לא נקראה תקרת CPC`, `ברישום מצופה תקרת ₪${reg.cpc_cap} ובהגדרות שנקראו אין תקרה, אבל ה-CPC בפועל (${obs?.cpc7 != null ? `₪${obs.cpc7}` : "מעט קליקים"}) לא חורג. או שהתקרה נשמרה זה עתה, או שגוגל לא מחזירה את השדה לקמפיין הזה. לאמת ידנית ב-Settings > Bidding.`);
    }
    if (reg.budget_amount == null) {
      push(`ads:no-budget:${reg.google_name}`, "info", `📝 ${reg.google_name} - חסר תקציב ברישום`, "להשלים את השדה בטבלת הרישום כדי שהתראות הקצב יעבדו.");
    }
  }

  // The registry↔Google join runs on campaign name, so a rename in Google
  // silently orphans the registry row and every alert built on it.
  if (config.length > 0) {
    for (const reg of registry.filter((x) => x.active && !configByName.has(x.google_name))) {
      push(`ads:rename:${reg.google_name}`, "amber", `🔗 ${reg.google_name} - לא נמצא בגוגל בסנכרון האחרון`, "שם הקמפיין ברישום לא תואם אף קמפיין קיים (שינוי שם בגוגל? נמחק?). עד שהשם יתוקן ברישום, ההצלבות וההתראות לא מכסות אותו.");
    }
  }

  // Budget: where the month LANDS, not whether today's slice is over. One
  // alert carries all three numbers a decision needs - spent so far, where
  // this month ends at the current pace, and what the last seven days would
  // cost over a full month (which is what next month inherits). The run-rate
  // number is the one that moved on 30/08/26: 4,026 spent over 30 days, but
  // the trailing week ran at 202/day - a 6,150 month - because a
  // total-budget campaign accelerates as its end date approaches.
  const totalCost30 = r2([...g30.values()].reduce((s, a) => s + a.cost, 0));
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expected = r2(MONTHLY_BUDGET * (dayOfMonth / daysInMonth));
  const budgetPace = { expected, actual: spendMtd };
  // Projection needs a few days of month behind it; before day 3 only an
  // outright overspend counts.
  const projectedThisMonth = dayOfMonth >= 3 ? r2((spendMtd / dayOfMonth) * daysInMonth) : null;
  const runRateDaily = r2(campaigns.reduce((s, c) => s + c.cost7, 0) / 7);
  const runRateMonthly = r2(runRateDaily * 30.4);

  const overNow = spendMtd > MONTHLY_BUDGET;
  const overProjected = projectedThisMonth != null && projectedThisMonth > MONTHLY_BUDGET * 1.05;
  const overRunRate = runRateMonthly > MONTHLY_BUDGET * 1.25;
  if (overNow || overProjected || overRunRate) {
    const worst = Math.max(spendMtd, projectedThisMonth ?? 0, runRateMonthly);
    push(
      `ads:pace:${today.slice(0, 7)}`,
      overNow || worst > MONTHLY_BUDGET * 1.25 ? "red" : "amber",
      overNow
        ? `💸 עברנו את התקציב החודשי: ₪${Math.round(spendMtd)} מתוך ₪${MONTHLY_BUDGET}`
        : `💸 בקצב הנוכחי החודש ייסגר על ₪${Math.round(projectedThisMonth ?? runRateMonthly)} מול יעד ₪${MONTHLY_BUDGET}`,
      `מתחילת החודש: ₪${Math.round(spendMtd)} (הקצב המתוכנן ליום הזה: ₪${Math.round(expected)}). ` +
      `${projectedThisMonth != null ? `סגירה צפויה של החודש: ₪${Math.round(projectedThisMonth)}. ` : ""}` +
      `שבעת הימים האחרונים רצו ב-₪${runRateDaily} ליום - כלומר ₪${Math.round(runRateMonthly)} לחודש מלא, וזה מה שהחודש הבא יורש אם לא משנים תקציבים. ` +
      `העמודה שמחליטה מאיפה מקצצים היא עלות-לפנייה בקונסולה, לא ההוצאה המוחלטת.`
    );
  }

  let pollutionFired = false;
  for (const c of campaigns) {
    const cap = capOf.get(c.google_name);
    if (cap != null && c.cpc7 != null && c.clicks7 >= 5 && c.cpc7 > cap * 1.05) {
      push(`ads:cap-cpc:${c.google_name}`, "red", `🎯 ${c.google_name} - CPC ‏₪${c.cpc7} מעל התקרה ₪${cap}`, "התקרה כנראה לא נשמרה בפועל. לפתוח Settings > Bidding ולוודא.");
    }
    // A 7-day window on purpose: after the goal is fixed in Google, the
    // alert clears within a week instead of dragging a month of history.
    if (c.clicks7 >= 10 && c.conv7 / c.clicks7 > 1.05) {
      pollutionFired = true;
      push(`ads:pollution:${c.google_name}`, "red", `🗑️ ${c.google_name} - ${Math.round(c.conv7)} המרות מ-${c.clicks7} קליקים בשבוע`, "יחס מעל 1 = פעולת המרה ראשית סופרת צפיות עמוד. Goals > Conversions > להוריד ל-Secondary.");
    }
    // Spend with zero contacts. The trigger is still a spending week with no
    // contact, but the alert now leads with HOW LONG the campaign has been
    // dry, because that is what separates noise from a finding: a single zero
    // week on a small campaign happens, ten consecutive days on one that keeps
    // paying does not. g-haifa (03/09/26) fired at ₪173/week and sat in the
    // queue for three days reading like every other weekly zero, while the
    // real fact was that its last contact had been on 26/08.
    if (c.cost7 >= 50 && c.contacts7 === 0 && c.utm_campaign) {
      const dry = c.daysSinceContact;
      const burned = Math.round(Math.max(c.costSinceContact, c.cost7));
      // אדום כשהבצורת ארוכה משבוע וגם נשרף בה כסף אמיתי, או בכל מקרה
      // מעל ₪150 בשבוע - הסף הישן, שנשאר כדי שקמפיין יקר לא יירד לכתום
      // רק בגלל שהפנייה האחרונה שלו הייתה אתמול.
      const severity = (dry != null && dry >= 7 && burned >= 120) || c.cost7 >= 150 ? "red" : "amber";
      const howLong = dry == null
        ? `${DRY_WINDOW_DAYS}+ ימים`
        : `${dry} ימים`;
      push(
        `ads:cold:${c.google_name}`,
        severity,
        `🥶 ${c.google_name} - ${howLong} בלי פנייה, ₪${burned} מאז`,
        `השבוע האחרון: ₪${Math.round(c.cost7)} על ${c.clicks7} קליקים ואפס פניות. ` +
        (dry == null
          ? `לא נרשמה אף פנייה מהקמפיין הזה ב-${DRY_WINDOW_DAYS} הימים האחרונים. `
          : dry >= 7
            ? `הפנייה האחרונה הייתה לפני ${dry} ימים - זה כבר לא רעש של שבוע בודד. `
            : `הפנייה האחרונה הייתה לפני ${dry} ימים, כך שייתכן שזו עדיין תנודתיות. `) +
        `לבדוק לפי הסדר: דוח מונחי חיפוש (האם הקליקים עברו לשאילתות בלי כוונה), תקרת CPC, ואז ההיצע באזור. ` +
        `אם שלושתם תקינים - השאלה היא כמה עוד שווה לשלם על הבצורת הזו.`
      );
    }
    // Cost per contact against the business-plan milestone in force.
    if (c.utm_campaign && c.cost7 >= 75 && c.contacts7 > 0) {
      const cpl = r2(c.cost7 / c.contacts7);
      if (cpl > cplTarget.value) {
        push(`ads:cpl:${c.google_name}`, "amber", `💰 עלות לפנייה ב-${c.google_name}: ₪${Math.round(cpl)} - מעל היעד ₪${cplTarget.value}`, `${LOOKBACK_DAYS} ימים אחרונים: ₪${Math.round(c.cost7)} ל-${c.contacts7} פניות. היעד ${cplTarget.fromPlan ? "מהתוכנית העסקית" : "ברירת מחדל"}. לשקול: חידוד מילות מפתח, תקרת CPC, או צמצום תקציב.`);
      }
    }
    // Spend that jumped week-over-week. A deliberate budget raise recovers
    // by itself after a week, when the new level becomes the baseline.
    const prev = gPrev7.get(c.google_name);
    if (prev && prev.cost >= 30 && c.cost7 >= 100 && c.cost7 > prev.cost * 1.75) {
      push(`ads:spike:${c.google_name}`, "amber", `📈 ${c.google_name} - ההוצאה קפצה ל-₪${Math.round(c.cost7)} (מ-₪${Math.round(prev.cost)} בשבוע הקודם)`, "קפיצה של מעל 75% בשבוע. אם לא העלית תקציב במכוון - לבדוק מונחי חיפוש ותקרה עכשיו, לא בסוף החודש.");
    }
    // Spending campaign with no registry row: unmeasured money.
    if (!c.registered && c.cost7 >= 25) {
      push(`ads:unregistered:${c.google_name}`, "red", `📝 ${c.google_name} - מוציא כסף ואינו ברישום`, "בלי שורה ברישום (utm, תקציב, תקרה) אי אפשר לחבר את ההוצאה לפניות באתר. להוסיף בקונסולת האדס.");
    } else if (!c.registered && c.cost30 > 0) {
      push(`ads:unregistered:${c.google_name}`, "info", `📝 ${c.google_name} - קמפיין בגוגל שאינו ברישום`, "להוסיף שורה בטבלת הרישום (utm, תקציב, תקרה) כדי שההצלבות וההתראות יכסו אותו.");
    }
  }

  // Day zero: the networks a campaign is ALLOWED to serve on, straight from
  // its settings. This is the only check here that fires before a single
  // impression exists - g-emek1 burned its first week taking 100% of clicks
  // from Display while its type read "Search", and no amount of impression
  // analysis could have said so on launch day. Null means an older sync
  // script that does not send the fields; the impression-share check below
  // stays as the fallback for that case.
  for (const c of config) {
    if (c.status !== "ENABLED") continue;
    const wrong: string[] = [];
    if (c.net_display === true) wrong.push("רשת המדיה (Display)");
    if (c.net_partners === true) wrong.push("שותפי חיפוש");
    if (wrong.length > 0) {
      push(`ads:networks:${c.campaign_name}`, c.net_display === true ? "red" : "amber",
        `🌐 ${c.campaign_name} - מוגש גם ב${wrong.join(" וב")}`,
        `קמפיין חיפוש אמור לרוץ על חיפוש בלבד. ${c.net_display === true ? "ברשת המדיה המודעה מוצגת כבאנר למי שלא חיפש כלום - זה מה שבלע 100% מהקליקים של g-emek1 בשבוע הראשון שלו. " : ""}Campaign settings > Networks > להוריד את הסימון ולשמור.`);
    }
    if (c.net_search === false) {
      push(`ads:nosearch:${c.campaign_name}`, "red", `🌐 ${c.campaign_name} - רשת החיפוש כבויה`,
        "הקמפיין לא מוגש בחיפוש בגוגל בכלל. Campaign settings > Networks > לסמן Search Network.");
    }
  }

  // Launch audit: everything worth catching in a campaign's first two weeks,
  // delivered as ONE finding rather than a drip of separate alerts. A new
  // campaign is the cheapest moment to fix a misconfiguration and the moment
  // nobody is watching the console, so the queue does the watching.
  for (const c of campaigns) {
    const first = firstSeen.get(c.google_name);
    if (!first || c.status !== "ENABLED") continue;
    const ageDays = Math.floor((Date.now() - new Date(first + "T00:00:00Z").getTime()) / 86_400_000);
    if (ageDays > 14) continue;
    const cfg = configByName.get(c.google_name);
    const issues: string[] = [];
    if (cfg?.net_display === true) issues.push("מוגש ברשת המדיה");
    if (cfg?.net_partners === true) issues.push("מוגש בשותפי חיפוש");
    if (!c.registered) issues.push("אינו ברישום הקמפיינים");
    else if (!c.utm_campaign) issues.push("אין לו utm_campaign ברישום - אי אפשר לחבר הוצאה לפניות");
    if (cfg && cfg.cpc_ceiling == null) issues.push("אין תקרת CPC");
    const kwTotal = kwCountByCampaign.get(c.google_name) ?? 0;
    const kwRarely = rarelyByCampaign.get(c.google_name) ?? 0;
    if (kwTotal >= 10 && kwRarely / kwTotal >= 0.5) issues.push(`${kwRarely} מ-${kwTotal} מילות המפתח לא מוגשות (נפח חיפוש נמוך)`);
    const b = broadByCampaign.get(c.google_name);
    if (b && b.total >= 20 && b.broad / b.total >= 0.4) issues.push("רוב ההוצאה בהתאמה רחבה");
    if (c.sessions7 === 0 && c.clicks7 >= 5) issues.push(`${c.clicks7} קליקים בגוגל אבל 0 סשנים מתויגים באתר - ה-Final URL suffix כנראה חסר`);
    if (issues.length > 0) {
      push(`ads:launch:${c.google_name}`, "red", `🚀 ${c.google_name} - קמפיין בן ${ageDays} ימים עם ${issues.length} ליקויים`,
        `${issues.map((x) => "• " + x).join("  ")}  |  שבועיים ראשונים הם הרגע הזול לתקן. אחרי 14 יום הבדיקה הזו נסגרת מעצמה, וכל ליקוי שנשאר ימשיך להתריע בנפרד.`);
    }
  }

  // Impressions its own keywords cannot explain. A Search campaign whose
  // keyword impressions are a small fraction of the campaign total is
  // serving somewhere other than the searches it was built for - Display
  // expansion or search partners. g-emek1, 30/08/26: 854 campaign
  // impressions against 11 from keywords, clicks at 1.20 where the rest of
  // the account pays 3-8, and a CTR under 2% against a 5.9% median. Three
  // independent tells, all pointing off the search network.
  for (const [name, a] of g30) {
    if (a.impr < 200) continue;
    const kwImpr = kwImprByCampaign.get(name) ?? 0;
    const share = kwImpr / a.impr;
    if (share < 0.25) {
      push(`ads:offnetwork:${name}`, "red", `📺 ${name} - ${Math.round((1 - share) * 100)}% מהחשיפות לא הגיעו ממילות המפתח`, `${a.impr} חשיפות בקמפיין מול ${kwImpr} ממילות המפתח שלו. קמפיין חיפוש אמור לקבל את רוב החשיפות ממילותיו - הפער הזה אומר שהוא מוגש במקום אחר (רשת המדיה או שותפי חיפוש). לבדוק Settings > Networks ולכבות את מה שאינו Search.`);
    }
  }

  // Keywords Google refuses to serve for lack of search volume. This is not
  // a setup error - it is Google saying the demand does not exist - and it
  // matters most when it hits the town the paying therapists are actually in.
  for (const [name, total] of kwCountByCampaign) {
    const r = rarelyByCampaign.get(name) ?? 0;
    if (total >= 10 && r / total >= 0.5) {
      push(`ads:rarely:${name}`, "amber", `🔇 ${name} - ${r} מתוך ${total} מילות המפתח לא מוגשות (נפח חיפוש נמוך)`, `גוגל סימנה אותן "Low search volume" והן לא רצות בכלל. זה לא באג בהגדרות אלא קביעה של גוגל שאין ביקוש למונחים האלה. לשקול ערים גדולות יותר בסביבה, או להסיט את המאמץ לערוץ אחר (התאמות/אונליין) במקום להעלות תקציב לביקוש שלא קיים.`);
    }
  }

  // Broad-match share of keyword spend. The sharon lesson: broad keywords
  // map to place-less queries however geographic their text looks, and the
  // campaign's phrase keywords starve at ₪0-9 while two broads eat ₪450.
  for (const [name, b] of broadByCampaign) {
    if (b.total >= 50 && b.broad / b.total >= 0.4) {
      push(`ads:broad:${name}`, "amber", `🎛️ ${name} - ${Math.round((b.broad / b.total) * 100)}% מהוצאת מילות המפתח בהתאמה רחבה`, `₪${Math.round(b.broad)} ב-30 יום דרך מילות BROAD. בשרון זה מה שהפיל את יחס הפנייה ל-12% מול 34% בת"א - ההתאמה הרחבה קונה "פסיכולוג" בלי עיר גם כשכתוב בה שם אזור. לשקול השהיה ומעבר ל-phrase.`);
    }
  }

  const withImpr = campaigns.filter((c) => c.impr7 >= 100 && c.ctr7 != null);
  if (withImpr.length >= 3) {
    const ctrs = withImpr.map((c) => c.ctr7 as number).sort((a, b) => a - b);
    const median = ctrs[Math.floor(ctrs.length / 2)];
    for (const c of withImpr) {
      if ((c.ctr7 as number) < median * 0.4) {
        push(`ads:ctr:${c.google_name}`, "amber", `📉 ${c.google_name} - CTR ‏${c.ctr7}% מול חציון ${median}%`, "CTR חריג כלפי מטה = בדרך כלל דליפת מיקוד (מחוז במקום ערים) או מילים לא רלוונטיות. כך התגלתה נפת יזרעאל ב-g-emek1.");
      }
    }
  }

  const untagged30 = site30.get("(ללא תיוג)");
  const taggedSessions30 = [...site30.values()].filter((s) => s.utm_campaign !== "(ללא תיוג)").reduce((s, x) => s + x.sessions, 0);
  if (untagged30 && taggedSessions30 > 0 && untagged30.sessions >= taggedSessions30 * 0.1) {
    push("ads:untagged", "amber", `🏷️ ${untagged30.sessions} סשנים ממומנים ללא תיוג קמפיין ב-30 יום`, "מעל 10% מהתנועה המתויגת. Final URL suffix חסר או נבלע איפשהו - לעבור קמפיין-קמפיין על Campaign URL options.");
  }

  for (const p of placeless) {
    const c = campaigns.find((x) => x.google_name === p.campaign);
    const rate = c && c.quiz30 > 0 ? ` יחס פנייה/שאלון שלו: ${Math.round((c.contacts30 / c.quiz30) * 100)}% (ת"א ‏34%).` : "";
    push(`ads:placeless:${p.campaign}`, "amber", `🧭 ${p.campaign} - ${p.pct}% מהתקציב על חיפושים בלי שם מקום`, `₪${Math.round(p.cost30)} ב-30 יום הלכו לשאילתות כלליות ("פסיכולוג" בלי עיר). תנועה כזו ממלאת שאלונים ולא פונה.${rate} לשקול מילות מפתח עם שם עיר, או צמצום סוג ההתאמה. הרשימה בסקציית מונחי החיפוש.`);
  }

  if (hmoFree.length > 0) {
    const hmoCost = hmoFree.reduce((s2, t) => s2 + t.cost, 0);
    push("ads:hmo", hmoCost >= 25 ? "amber" : "info", `🏥 ${hmoFree.length} חיפושי קופת חולים / טיפול חינם (₪${Math.round(hmoCost)})`, "מי שמחפש טיפול מסובסד מסיים את השאלון ולא פונה למטפל פרטי. לחסום ברשימת שליליות משותפת לכל החשבון: כללית, מכבי, מאוחדת, לאומית, בהסדר, סבסוד, חינם.");
  }

  if (genericHits.length > 0) {
    push("ads:generic", "red", `🔍 ${genericHits.length} מונחי חיפוש גנריים ("צפון"/"בישראל") ב-14 יום`, "לחסום מיד כמילים שליליות - מילה כזו בלעה 62% מהתקציב של g-hadera. הרשימה בסקציית מונחי החיפוש למטה.");
  }

  // Conversion-pipe health: Google's lead count vs the site's own contact
  // clicks. ~60% is the healthy ratio (Count:One dedupe + ad blockers);
  // far below means the tag broke, far above means double counting. Skipped
  // while a pollution alert is up - the ratio is meaningless then anyway.
  if (!pollutionFired) {
    const conv7Total = campaigns.reduce((s, c) => s + c.conv7, 0);
    const contacts7Total = campaigns.reduce((s, c) => s + c.contacts7, 0);
    if (conv7Total >= 10 || contacts7Total >= 10) {
      const ratio = contacts7Total > 0 ? conv7Total / contacts7Total : null;
      if (ratio != null && (ratio < 0.3 || ratio > 1.5)) {
        push("ads:convgap", "amber", `🔌 פער בין המרות גוגל (${Math.round(conv7Total)}) ללחיצות פנייה באתר (${contacts7Total})`, ratio < 0.3
          ? "גוגל רואה הרבה פחות מהאתר - תג ההמרה כנראה נשבר (בדיקה: Goals > Conversions > פנייה למטפל > סטטוס). היחס הבריא ~60%."
          : "גוגל סופרת יותר פניות מהאתר עצמו - כנראה ספירה כפולה (ייבוא GA4 ליד התג הישיר?). לוודא שפעולת המרה אחת בלבד היא Primary.");
      }
    }
  }

  const order = { red: 0, amber: 1, info: 2 } as const;
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  // Every key the checks above could have emitted for the entities examined
  // in this run - so the queue closes an alert the moment its condition
  // stops holding, without ever touching alerts for things not examined.
  // The legacy trio (untracked/zero/cpl by numeric campaign id) is included
  // so alerts from the pre-engine agent close instead of pending forever.
  const managedKeys = [
    ...[...names].flatMap((n) => [
      `ads:end:${n}`, `ads:cap-missing:${n}`, `ads:cap-cpc:${n}`, `ads:pollution:${n}`,
      `ads:cold:${n}`, `ads:cpl:${n}`, `ads:spike:${n}`, `ads:unregistered:${n}`,
      `ads:broad:${n}`, `ads:ctr:${n}`, `ads:rename:${n}`, `ads:placeless:${n}`,
      `ads:offnetwork:${n}`, `ads:rarely:${n}`, `ads:networks:${n}`, `ads:nosearch:${n}`, `ads:launch:${n}`,
    ]),
    ...config.flatMap((c) => [`ads:untracked:${c.campaign_id}`, `ads:zero:${c.campaign_id}`, `ads:cpl:${c.campaign_id}`]),
    `ads:pace:${today.slice(0, 7)}`,
    "ads:sync-stale", "ads:untagged", "ads:generic", "ads:hmo", "ads:convgap",
  ];

  return {
    payload: {
      registry,
      campaigns,
      siteOnly,
      alerts,
      lastSync,
      monthlyTarget: MONTHLY_BUDGET,
      totalCost30,
      keywords: {
        capViolations: kwCapViolations.slice(0, 20),
        topSpenders: kwTop,
        rarelyServed: [...rarelyByCampaign.entries()].map(([campaign, count]) => ({ campaign, count })).sort((a, b) => b.count - a.count),
      },
      searchTerms: { generic: genericHits, hiddenShare, placeless, hmoFree: hmoFree.slice(0, 20) },
    },
    alerts,
    lastSync,
    spendMtd,
    budgetPace,
    cplTarget,
    managedKeys,
  };
}
