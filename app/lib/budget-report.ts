import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetch-all-rows";
import { loadBudgetReport, type BudgetReport } from "./budget-data";
import { daysInMonth, hebrewMonth, NOISE_SEEKERS } from "./budget-agent";
import {
  allocateByShare,
  anomalies,
  budgetUtilization,
  giftFunnel,
  pct,
  runwayMonths,
  type WindowStats,
} from "./budget-report-calc";
import { HOLIDAYS_KNOWN_UNTIL, holidaysBetween } from "./israel-holidays";
import { monthIncome, monthlySumitTotals } from "./sumit-documents";
import { PLATFORMS } from "./ads-platforms";
import { ALL_REGIONS, CITY_TO_REGION } from "./regions";

// The monthly budget report: the fourteen chapters of section ו in
// docs/agents/budget-agent-plan.md, on one page (/admin/budget/report).
//
// Every number is computed here from the database; nothing is estimated by a
// model. Each chapter is built on its own and fails on its own: a chapter that
// cannot be computed says why, and the rest of the report still stands. A
// chapter whose data the system does not collect yet says so instead of
// guessing ("missing"), or says what it uses in its place ("partial").

export type ChapterStatus = "ok" | "partial" | "missing" | "error";

export type ReportChapter = {
  n: number;
  key: string;
  title: string;
  status: ChapterStatus;
  summary: string;
  table?: { head: string[]; rows: (string | number)[][] };
  notes?: string[];
};

export type BudgetMonthlyReport = {
  generatedAt: string;
  today: string;
  month: string;
  window: { from: string; to: string };
  sentence: string;
  chapters: ReportChapter[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const shiftDay = (day: string, by: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
const nis = (n: number | null | undefined) => (n == null ? "—" : `₪${Math.round(n).toLocaleString("he-IL")}`);
const shortDate = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d}/${m}`;
};
const ilDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));
const cps = (cost: number, seekers: number) => (seekers > 0 && cost > 0 ? Math.round(Math.round(cost) / seekers) : null);

const ONLINE = "אונליין / ארצי";
const UNASSIGNED = "לא משויך";
// The price a paying therapist pays us a month, before VAT - the yardstick for
// "cost per payer" (plan section ו.2).
const PAYER_PRICE = 140;
// Fewer local results than this is a region short of therapists (section ו.6).
const THIN_SUPPLY = 4;

type ClickRow = { therapist_id: string | null; session_id: string | null; channel: string | null; utm_campaign: string | null; clicked_at: string };
type MatchRow = { utm_campaign: string | null; channel: string | null; session_id: string | null; metadata: Record<string, unknown> | null };
type TherapistRow = {
  id: string;
  full_name: string | null;
  regions: string[] | null;
  online: boolean | null;
  promotion_source: string | null;
  center_account_id: string | null;
  promoted_since: string | null;
  created_at: string;
};
type SubRow = { therapist_id: string; status: string; amount: number | null; first_charge_on: string | null; cancelled_at: string | null; created_at: string };
type CenterRow = { id: string; name: string | null; status: string; agreed_monthly_price: number | string | null; billing_starts_at: string | null };
type DailyRow = { date: string; campaign_name: string; cost: number | string; clicks: number; impressions: number };
type PaymentRow = { reference_id: string; payment_type: string; created_at: string };

type Shared = {
  base: BudgetReport;
  today: string;
  asOf: string;
  from30: string;
  to30: string;
  monthStart: string;
  monthEnd: string;
  clicks90: ClickRow[];
  matches30: MatchRow[];
  therapists: TherapistRow[];
  subs: SubRow[];
  centers: CenterRow[];
  daily90: DailyRow[];
  window90: Map<string, { cost: number; seekers: number }>;
  payments: PaymentRow[];
};

async function loadShared(month?: string): Promise<Shared> {
  const base = await loadBudgetReport({ month });
  const asOf = new Date().toISOString().slice(0, 10);
  const since90 = shiftDay(asOf, -90);
  const monthStart = `${base.month}-01`;
  const monthEnd = `${base.month}-${String(daysInMonth(base.month)).padStart(2, "0")}`;

  const [clicks90, matches30, therapistsQ, subsQ, centersQ, daily90, window90Q, payments] = await Promise.all([
    fetchAllRows<ClickRow>(() =>
      supabaseAdmin
        .from("therapist_contact_clicks")
        .select("therapist_id, session_id, channel, utm_campaign, clicked_at")
        .gte("clicked_at", `${since90}T00:00:00Z`)
    ),
    fetchAllRows<MatchRow>(() =>
      supabaseAdmin
        .from("analytics_events")
        .select("utm_campaign, channel, session_id, metadata")
        .eq("event_type", "match_results")
        .gte("created_at", `${shiftDay(asOf, -30)}T00:00:00Z`)
        .lt("created_at", `${asOf}T00:00:00Z`)
    ),
    supabaseAdmin
      .from("therapists")
      .select("id, full_name, regions, online, promotion_source, center_account_id, promoted_since, created_at")
      .eq("status", "paying"),
    supabaseAdmin.from("subscriptions").select("therapist_id, status, amount, first_charge_on, cancelled_at, created_at"),
    supabaseAdmin.from("therapy_center_accounts").select("id, name, status, agreed_monthly_price, billing_starts_at"),
    fetchAllRows<DailyRow>(() =>
      supabaseAdmin
        .from("ads_campaign_daily")
        .select("date, campaign_name, cost, clicks, impressions")
        .gte("date", since90)
        .lt("date", asOf)
    ),
    supabaseAdmin.rpc("budget_campaign_window", { p_days: 90 }),
    fetchAllRows<PaymentRow>(() =>
      supabaseAdmin
        .from("payments")
        .select("reference_id, payment_type, created_at")
        .eq("status", "completed")
        .in("payment_type", ["subscription", "subscription_renewal"])
        .gte("created_at", `${shiftDay(asOf, -180)}T00:00:00Z`)
    ),
  ]);
  for (const [name, q] of [
    ["therapists", therapistsQ],
    ["subscriptions", subsQ],
    ["therapy_center_accounts", centersQ],
    ["budget_campaign_window", window90Q],
  ] as const) {
    if (q.error) throw new Error(`${name}: ${q.error.message}`);
  }

  return {
    base,
    today: base.today,
    asOf,
    from30: base.platforms.window.from,
    to30: base.platforms.window.to,
    monthStart,
    monthEnd,
    clicks90,
    matches30,
    therapists: (therapistsQ.data ?? []) as TherapistRow[],
    subs: (subsQ.data ?? []) as SubRow[],
    centers: (centersQ.data ?? []) as CenterRow[],
    daily90,
    window90: new Map(
      ((window90Q.data ?? []) as { utm_campaign: string; cost: number | string; seekers: number | string }[]).map((r) => [
        r.utm_campaign,
        { cost: Number(r.cost), seekers: Number(r.seekers) },
      ])
    ),
    payments,
  };
}

// ---------- 1. Cost per seeker, 30/60/90 ----------

function chapterCostPerSeeker(s: Shared): ReportChapter {
  const rows = s.base.projection.campaigns
    .filter((c) => c.cost60 > 0 || c.inPlan)
    .map((c) => {
      const w90 = s.window90.get(c.utmCampaign);
      const cpl90 = w90 ? cps(w90.cost, w90.seekers) : null;
      return { c, cpl90 };
    });
  // Cheapest and dearest only among campaigns whose rate rests on enough seekers
  // and that are past learning - otherwise a campaign one day old, with ₪3 and
  // one seeker, "wins".
  const ranked = rows
    .filter((r) => r.c.rate != null && !r.c.noisy && !r.c.learning)
    .sort((a, b) => (a.c.rate ?? 0) - (b.c.rate ?? 0));
  const target = s.base.cplTarget?.value ?? null;
  const cheapest = ranked[0];
  const dearest = ranked[ranked.length - 1];
  return {
    n: 1,
    key: "cost_per_seeker",
    title: "עלות לפונה לכל קמפיין, 30/60/90 יום",
    status: "ok",
    summary:
      ranked.length === 0
        ? "אין עדיין קמפיין עם מספיק פונים כדי לדרג."
        : `הזול: ${cheapest.c.googleName} (${nis(cheapest.c.rate)} לפונה). היקר: ${dearest.c.googleName} (${nis(dearest.c.rate)}).` +
          " (רק קמפיינים עם 8 פונים ומעלה ומעבר לתקופת הלמידה.)" +
          (target ? ` היעד בתוכנית העסקית: ${nis(target)}.` : ""),
    table: {
      head: ["קמפיין", "הוצאה 30 יום", "פונים 30 יום", "לפונה 30", "לפונה 60", "לפונה 90", "הערה"],
      rows: rows.map(({ c, cpl90 }) => [
        c.googleName,
        nis(c.cost30),
        c.seekers30,
        nis(c.cpl30),
        nis(c.cpl60),
        nis(cpl90),
        [!c.active ? "מושהה" : "", c.noisy ? `פחות מ-${NOISE_SEEKERS} פונים` : "", c.learning ? "בלמידה" : ""]
          .filter(Boolean)
          .join(", ") || "—",
      ]),
    },
    notes: ["פונה = סשן אחד שלחץ ליצירת קשר עם מטפל/ת ממודעה בגוגל. ההשוואה ל-30 יום נשענת על מעט נתונים כשיש פחות מ-8 פונים."],
  };
}

// ---------- 2, 3, 6. Regions: spend, payers, income, supply ----------

type RegionLine = {
  region: string;
  searches: number;
  avgLocal: number | null;
  adSpend: number;
  payers: number;
  mrrNow: number;
  mrrSoon: number;
};

function regionalModel(s: Shared): RegionLine[] {
  const lines = new Map<string, RegionLine>();
  const line = (region: string) => {
    let l = lines.get(region);
    if (!l) {
      l = { region, searches: 0, avgLocal: null, adSpend: 0, payers: 0, mrrNow: 0, mrrSoon: 0 };
      lines.set(region, l);
    }
    return l;
  };

  // Searches and supply depth, from the match results people saw.
  const localSum = new Map<string, { sum: number; n: number }>();
  const sessionsByRegion = new Map<string, Set<string>>();
  for (const m of s.matches30) {
    const region = typeof m.metadata?.region === "string" && m.metadata.region ? String(m.metadata.region) : ONLINE;
    const set = sessionsByRegion.get(region) ?? new Set<string>();
    set.add(m.session_id ?? `${Math.random()}`);
    sessionsByRegion.set(region, set);
    const local = Number(m.metadata?.local);
    if (region !== ONLINE && m.metadata && "local" in m.metadata && Number.isFinite(local)) {
      const a = localSum.get(region) ?? { sum: 0, n: 0 };
      a.sum += local;
      a.n++;
      localSum.set(region, a);
    }
  }
  for (const [region, set] of sessionsByRegion) line(region).searches = set.size;
  for (const [region, a] of localSum) line(region).avgLocal = a.n ? a.sum / a.n : null;

  // Ad spend goes where each campaign's own searches went.
  const weightsFor = (filter: (m: MatchRow) => boolean) => {
    const w = new Map<string, number>();
    const seen = new Set<string>();
    for (const m of s.matches30) {
      if (!filter(m)) continue;
      const key = `${m.session_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const region = typeof m.metadata?.region === "string" && m.metadata.region ? String(m.metadata.region) : ONLINE;
      w.set(region, (w.get(region) ?? 0) + 1);
    }
    return w;
  };
  const spend = (cost: number, weights: Map<string, number>) => {
    const parts = allocateByShare(cost, weights);
    if (parts.size === 0 && cost > 0) line(UNASSIGNED).adSpend += cost;
    for (const [region, v] of parts) line(region).adSpend += v;
  };
  for (const c of s.base.projection.campaigns) {
    if (c.cost30 <= 0) continue;
    spend(c.cost30, weightsFor((m) => m.channel === "google_paid" && m.utm_campaign === c.utmCampaign));
  }
  for (const w of s.base.platforms.last30) {
    const channel = PLATFORMS.find((p) => p.key === w.platform)?.channel;
    if (w.cost > 0) spend(w.cost, channel ? weightsFor((m) => m.channel === channel) : new Map());
  }

  // Income: each paying therapist's subscription, split across the regions they serve.
  // A therapist lists cities ("תל אביב"); the searches are logged by region
  // ("גוש דן"), so the cities are mapped up before the two can meet.
  const soon = shiftDay(s.today, 45);
  const regionsOf = (t: TherapistRow | undefined): string[] => {
    const mapped = new Set<string>();
    for (const place of t?.regions ?? []) {
      const region = ALL_REGIONS.includes(place) ? place : CITY_TO_REGION[place];
      if (region) mapped.add(region);
    }
    if (mapped.size) return [...mapped];
    return t?.online ? [ONLINE] : [UNASSIGNED];
  };
  const byId = new Map(s.therapists.map((t) => [t.id, t]));
  for (const sub of s.subs) {
    if (sub.status !== "active" || !sub.amount) continue;
    const t = byId.get(sub.therapist_id);
    if (!t) continue;
    const regions = regionsOf(t);
    const now = !sub.first_charge_on || sub.first_charge_on <= s.today;
    const within = !sub.first_charge_on || sub.first_charge_on <= soon;
    for (const r of regions) {
      const l = line(r);
      if (now) {
        l.mrrNow += sub.amount / regions.length;
        l.payers += 1 / regions.length;
      }
      if (within) l.mrrSoon += sub.amount / regions.length;
    }
  }
  // Centres: their agreed price, across the regions of the therapists they list.
  for (const c of s.centers) {
    if (c.status !== "active" || !c.billing_starts_at) continue;
    const price = Number(c.agreed_monthly_price) || 0;
    if (price <= 0) continue;
    const weights = new Map<string, number>();
    for (const t of s.therapists.filter((x) => x.center_account_id === c.id)) {
      for (const r of regionsOf(t)) weights.set(r, (weights.get(r) ?? 0) + 1);
    }
    const parts = weights.size ? allocateByShare(price, weights) : new Map([[UNASSIGNED, price]]);
    for (const [r, v] of parts) {
      if (c.billing_starts_at <= s.today) line(r).mrrNow += v;
      if (c.billing_starts_at <= soon) line(r).mrrSoon += v;
    }
  }

  return [...lines.values()].sort((a, b) => b.adSpend - a.adSpend || b.mrrSoon - a.mrrSoon || b.searches - a.searches);
}

function chapterCostPerPayer(regions: RegionLine[]): ReportChapter {
  const rows = regions.filter((r) => r.adSpend >= 1 || r.payers > 0);
  const over = rows.filter((r) => r.payers > 0 && r.adSpend / r.payers > PAYER_PRICE);
  const noPayers = rows.filter((r) => r.adSpend >= 50 && r.payers === 0);
  return {
    n: 2,
    key: "cost_per_payer",
    title: "עלות למשלם, לפי אזור",
    status: "ok",
    summary:
      (over.length
        ? `באזורים ${over.map((r) => r.region).join(", ")} ההוצאה על פרסום לכל מטפל משלם גבוהה ממה שהוא משלם לנו בחודש (${nis(PAYER_PRICE)}).`
        : `בכל אזור שיש בו משלמים, ההוצאה לכל משלם נמוכה מ-${nis(PAYER_PRICE)}.`) +
      (noPayers.length ? ` מוציאים באזורים בלי אף משלם: ${noPayers.map((r) => r.region).join(", ")}.` : ""),
    table: {
      head: ["אזור", "פרסום 30 יום", "משלמים", "פרסום למשלם", `מול ${nis(PAYER_PRICE)}`],
      rows: rows.map((r) => {
        const perPayer = r.payers > 0 ? r.adSpend / r.payers : null;
        return [
          r.region,
          nis(r.adSpend),
          Math.round(r.payers * 10) / 10,
          nis(perPayer),
          perPayer == null ? (r.adSpend >= 1 ? "אין משלמים" : "—") : `×${(perPayer / PAYER_PRICE).toFixed(1)}`,
        ];
      }),
    },
    notes: [
      "משלם = מטפל/ת במסלול בתשלום שכבר חויב/ה. מטפל שעובד בכמה אזורים נספר בחלקים שווים.",
      "ההוצאה משויכת לאזור לפי היכן חיפשו מי שהגיעו מהקמפיין (תוצאות ההתאמה ב-30 יום), ולא לפי הגדרת המיקוד בגוגל.",
    ],
  };
}

function chapterRegionalPnL(regions: RegionLine[], s: Shared): ReportChapter {
  const rows = regions.filter((r) => r.adSpend >= 1 || r.mrrSoon > 0 || r.searches >= 5);
  const totalSpend = rows.reduce((a, r) => a + r.adSpend, 0);
  const totalNow = rows.reduce((a, r) => a + r.mrrNow, 0);
  const totalSoon = rows.reduce((a, r) => a + r.mrrSoon, 0);
  return {
    n: 3,
    key: "regional_pnl",
    title: "רווח והפסד לפי אזור",
    status: "ok",
    summary: `פרסום ב-30 יום: ${nis(totalSpend)}. הכנסה חודשית קבועה היום: ${nis(totalNow)}; בעוד 45 יום, עם המרכזים ותקופות המתנה שמסתיימות: ${nis(totalSoon)}.`,
    table: {
      head: ["אזור", "חיפושים 30 יום", "תוצאות מקומיות בממוצע", "פרסום 30 יום", "הכנסה חודשית היום", "בעוד 45 יום", "פרסום מול הכנסה"],
      rows: rows.map((r) => [
        r.region,
        r.searches,
        r.avgLocal == null ? "—" : (Math.round(r.avgLocal * 10) / 10).toString(),
        nis(r.adSpend),
        nis(r.mrrNow),
        nis(r.mrrSoon),
        r.mrrSoon > 0 ? pct(r.adSpend, r.mrrSoon) : r.adSpend >= 1 ? "אין הכנסה" : "—",
      ]),
    },
    notes: [
      "הכנסה חודשית = מנויי מטפלים פעילים שחויבו + מרכזים שהחיוב שלהם התחיל, לפני מע״מ. מרכז מתחלק בין האזורים של המטפלים שלו.",
      "\"אונליין / ארצי\" = חיפושים בלי אזור. מי שמחפש כך פונה גם למטפלים באזורים, ולכן השורה הזו נראית גרועה מהמציאות: ההכנסה שבה היא רק של מטפלים שאין להם עיר.",
      `חלון החיפושים: ${shortDate(s.from30)}-${shortDate(s.to30)}.`,
    ],
  };
}

function chapterThinSupply(regions: RegionLine[]): ReportChapter {
  const thin = regions.filter(
    (r) => r.region !== ONLINE && r.region !== UNASSIGNED && r.searches >= 10 && r.avgLocal != null && r.avgLocal < THIN_SUPPLY
  );
  return {
    n: 6,
    key: "thin_supply",
    title: "אזורים חנוקים בהיצע",
    status: "ok",
    summary: thin.length
      ? `באזורים ${thin.map((r) => `${r.region} (${(Math.round((r.avgLocal ?? 0) * 10) / 10).toString()} תוצאות מקומיות)`).join(", ")} מי שמחפש רואה מעט מטפלים קרובים. שם הפתרון הוא עוד מטפל מקודם, לא עוד תקציב.`
      : `אין אזור עם 10 חיפושים ומעלה ופחות מ-${THIN_SUPPLY} תוצאות מקומיות בממוצע.`,
    table: thin.length
      ? {
          head: ["אזור", "חיפושים 30 יום", "תוצאות מקומיות בממוצע", "פרסום 30 יום"],
          rows: thin.map((r) => [r.region, r.searches, (Math.round((r.avgLocal ?? 0) * 10) / 10).toString(), nis(r.adSpend)]),
        }
      : undefined,
    notes: ["תוצאות מקומיות = כמה מטפלים מהאזור של המחפש הוצגו לו. הלקח מהשרון ומהשפלה: פרסום באזור חנוק מביא חיפושים שלא הופכים לפניות."],
  };
}

// ---------- 4. Protected ----------

function chapterProtected(s: Shared): ReportChapter {
  const list = s.base.projection.campaigns.filter((c) => c.isProtected);
  return {
    n: 4,
    key: "protected",
    title: "קמפיינים מוגנים",
    status: "ok",
    summary: list.length
      ? `${list.length} קמפיינים מוגנים: ההצעה לא נוגעת בהם גם כשהם יקרים.`
      : "אין קמפיין מוגן.",
    table: list.length
      ? {
          head: ["קמפיין", "למה", "עד"],
          rows: list.map((c) => [c.googleName, c.protectedReason ?? "", c.protectedUntil ? shortDate(c.protectedUntil) : "עד שיבוטל"]),
        }
      : undefined,
  };
}

// ---------- 5. First charges in the next 45 days ----------

function chapterFirstCharges(s: Shared): ReportChapter {
  const until = shiftDay(s.today, 45);
  const since30 = `${s.from30}T00:00:00Z`;
  const contacts = (ids: string[]) =>
    new Set(
      s.clicks90
        .filter((c) => c.therapist_id && ids.includes(c.therapist_id) && c.clicked_at >= since30)
        .map((c) => c.session_id ?? c.clicked_at)
    ).size;
  const byId = new Map(s.therapists.map((t) => [t.id, t]));
  type Line = { date: string; who: string; kind: string; amount: number; seekers: number };
  const lines: Line[] = [];
  for (const sub of s.subs) {
    if (sub.status !== "active" || !sub.first_charge_on) continue;
    if (sub.first_charge_on < s.today || sub.first_charge_on > until) continue;
    const t = byId.get(sub.therapist_id);
    lines.push({
      date: sub.first_charge_on,
      who: t?.full_name ?? "מטפל/ת",
      kind: "מטפל/ת בתקופת מתנה",
      amount: sub.amount ?? 0,
      seekers: contacts([sub.therapist_id]),
    });
  }
  for (const c of s.centers) {
    if (c.status !== "active" || !c.billing_starts_at) continue;
    if (c.billing_starts_at < s.today || c.billing_starts_at > until) continue;
    const ids = s.therapists.filter((t) => t.center_account_id === c.id).map((t) => t.id);
    lines.push({
      date: c.billing_starts_at,
      who: `${c.name ?? "מרכז"} (${ids.length} מטפלים)`,
      kind: "מרכז",
      amount: Number(c.agreed_monthly_price) || 0,
      seekers: ids.length ? contacts(ids) : 0,
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date));
  const atRisk = lines.filter((l) => l.seekers === 0);
  return {
    n: 5,
    key: "first_charges",
    title: "חיובים ראשונים ב-45 הימים הקרובים",
    status: "ok",
    summary: lines.length
      ? `${lines.length} חיובים ראשונים עד ${shortDate(until)}, ${nis(lines.reduce((a, l) => a + l.amount, 0))} בחודש.` +
        (atRisk.length ? ` ${atRisk.length} מהם בלי אף פונה ב-30 הימים האחרונים: ${atRisk.map((l) => l.who).join(", ")}.` : "")
      : `אין חיוב ראשון עד ${shortDate(until)}.`,
    table: lines.length
      ? {
          head: ["תאריך", "מי", "סוג", "סכום חודשי", "פונים ב-30 יום"],
          rows: lines.map((l) => [shortDate(l.date), l.who, l.kind, nis(l.amount), l.seekers === 0 ? "0 ⚠" : l.seekers]),
        }
      : undefined,
    notes: ["החודש הראשון בתשלום הוא החודש שבו נשארים או עוזבים. מי שמגיע אליו בלי פניות הוא הסיכון הגדול."],
  };
}

// ---------- 7. Budget margins ----------

function chapterMargins(s: Shared): ReportChapter {
  const from14 = shiftDay(s.asOf, -14);
  const rows = s.base.projection.campaigns
    .filter((c) => c.inPlan)
    .map((c) => {
      const days = s.daily90.filter((d) => d.campaign_name === c.googleName && d.date >= from14);
      const u = budgetUtilization(days.map((d) => ({ cost: Number(d.cost) })), c.dailyBudget);
      return { c, u };
    });
  const label: Record<string, string> = {
    limited: "מוגבל תקציב",
    partial: "חלקי",
    saturated: "רווי",
    unknown: "אין מספיק ימים",
  };
  const limited = rows.filter((r) => r.u.kind === "limited");
  const saturated = rows.filter((r) => r.u.kind === "saturated");
  return {
    n: 7,
    key: "margins",
    title: "שולי התקציב: מי מוגבל בתקציב ומי רווי",
    status: "partial",
    summary:
      `מוגבלי תקציב (שקל נוסף יקנה עוד חשיפה): ${limited.map((r) => r.c.googleName).join(", ") || "אין"}. ` +
      `רוויים (תקציב נוסף לא יעזור): ${saturated.map((r) => r.c.googleName).join(", ") || "אין"}.`,
    table: {
      head: ["קמפיין", "תקציב יומי", "הוצאה ממוצעת ליום (14 יום)", "ניצול", "מצב"],
      rows: rows.map(({ c, u }) => [
        c.googleName,
        nis(c.dailyBudget),
        nis(u.avgDaily),
        u.share == null ? "—" : pct(u.share, 1),
        label[u.kind],
      ]),
    },
    notes: [
      "מדד עקיף: \"נתח חשיפות שאבד בגלל תקציב\" של גוגל לא מסונכרן היום. הוספה שלו דורשת שינוי בסקריפט הלילי שמודבק בגוגל אדס.",
      "מוגבל תקציב = הוצאה של 90% מהתקציב ומעלה בממוצע; רווי = פחות מ-60%.",
      "התקציב היומי הוא מה שמוגדר היום, וההוצאה היא של 14 הימים האחרונים. תקציב ששונה לאחרונה (למשל הורדה) מראה ניצול מעל 100% עד שהימים הישנים יוצאים מהחלון.",
    ],
  };
}

// ---------- 8. Holidays ----------

function chapterHolidays(s: Shared): ReportChapter {
  const past = holidaysBetween(s.from30, s.to30);
  const ahead = holidaysBetween(s.monthStart, s.monthEnd);
  const beyond = s.monthEnd > HOLIDAYS_KNOWN_UNTIL;
  const fmt = (h: { name: string; from: string; to: string; schoolOnly?: boolean }) =>
    `${h.name} (${shortDate(h.from)}${h.to !== h.from ? `-${shortDate(h.to)}` : ""})${h.schoolOnly ? ", חופשת בתי ספר" : ""}`;
  return {
    n: 8,
    key: "holidays",
    title: "חגים",
    status: beyond ? "partial" : "ok",
    summary:
      (past.length
        ? `ב-30 הימים האחרונים: ${past.map(fmt).join(", ")}. שבוע עם חג לא נשפט מול שבוע רגיל.`
        : "ב-30 הימים האחרונים לא היה חג.") +
      ` ב${hebrewMonth(s.base.month)}: ${ahead.length ? ahead.map(fmt).join(", ") : "אין חגים"}.`,
    notes: beyond ? [`לוח החגים מכסה עד ${HOLIDAYS_KNOWN_UNTIL}; צריך להרחיב אותו (app/lib/israel-holidays.ts).`] : undefined,
  };
}

// ---------- 9. Gift offers funnel ----------

async function chapterGiftFunnel(s: Shared): Promise<ReportChapter> {
  const since = shiftDay(s.asOf, -90);
  const [offersQ, tokensQ] = await Promise.all([
    supabaseAdmin.from("gift_offers").select("therapist_id, sent_at").gte("sent_at", `${since}T00:00:00Z`),
    supabaseAdmin
      .from("gift_checkout_tokens")
      .select("therapist_id, first_viewed_at, used_at, created_at")
      .gte("created_at", `${since}T00:00:00Z`),
  ]);
  if (offersQ.error) throw new Error(`gift_offers: ${offersQ.error.message}`);
  if (tokensQ.error) throw new Error(`gift_checkout_tokens: ${tokensQ.error.message}`);
  const offers = (offersQ.data ?? []).filter((o) => o.sent_at) as { therapist_id: string; sent_at: string }[];
  const tokens = (tokensQ.data ?? []) as { therapist_id: string; first_viewed_at: string | null; used_at: string | null; created_at: string }[];
  const paidAfter = new Map<string, string[]>();
  for (const p of s.payments) {
    const list = paidAfter.get(p.reference_id) ?? [];
    list.push(p.created_at);
    paidAfter.set(p.reference_id, list);
  }
  const months = [...new Set(offers.map((o) => ilDay(o.sent_at).slice(0, 7)))].sort().reverse();
  const perMonth = months.map((m) => ({ m, f: giftFunnel(offers.filter((o) => ilDay(o.sent_at).startsWith(m)), tokens, paidAfter) }));
  const all = giftFunnel(offers, tokens, paidAfter);
  return {
    n: 9,
    key: "gift_funnel",
    title: "משפך הצעות המתנה",
    status: "ok",
    summary: offers.length
      ? `ב-90 יום: ${all.sent} הצעות נשלחו, ${all.opened} נפתחו (${all.openedWithin34h} תוך 34 שעות), ${all.registered} נרשמו, ${all.paid} כבר שילמו.`
      : "לא נשלחו הצעות מתנה ב-90 יום.",
    table: perMonth.length
      ? {
          head: ["חודש שליחה", "נשלחו", "נפתחו", "תוך 34 שעות", "נרשמו", "שילמו"],
          rows: perMonth.map(({ m, f }) => [
            `${hebrewMonth(m)} ${m.slice(0, 4)}`,
            f.sent,
            `${f.opened} (${pct(f.opened, f.sent)})`,
            f.openedWithin34h,
            `${f.registered} (${pct(f.registered, f.sent)})`,
            f.paid,
          ]),
        }
      : undefined,
    notes: [
      "פתיחה נמדדת רק מ-4/9/2026. מי שנרשם במתנה משלם רק בחיוב הראשון, אחרי חודשי המתנה, ולכן \"שילמו\" מתמלא באיחור.",
      "חלון התגובה שנמדד: מי שלא פתח תוך 34 שעות כמעט אף פעם לא פותח.",
    ],
  };
}

// ---------- 10. Retention ----------

function chapterRetention(s: Shared): ReportChapter {
  const since30 = `${s.from30}T00:00:00Z`;
  const cancelled = s.subs.filter((x) => x.cancelled_at && x.cancelled_at >= since30);
  const paidBefore = (id: string, before: string) => s.payments.some((p) => p.reference_id === id && p.created_at < before);
  const afterCharge = cancelled.filter((x) => paidBefore(x.therapist_id, x.cancelled_at!));
  const lastContact = new Map<string, string>();
  for (const c of s.clicks90) {
    if (!c.therapist_id) continue;
    const prev = lastContact.get(c.therapist_id);
    if (!prev || c.clicked_at > prev) lastContact.set(c.therapist_id, c.clicked_at);
  }
  const quiet = s.therapists.filter(
    (t) =>
      t.promotion_source === "paid" &&
      (t.promoted_since ?? t.created_at) < since30 &&
      !((lastContact.get(t.id) ?? "") >= since30)
  );
  return {
    n: 10,
    key: "retention",
    title: "שימור",
    status: "ok",
    summary:
      `ב-30 יום בוטלו ${cancelled.length} מנויים, ${afterCharge.length} מהם אחרי שכבר חויבו. ` +
      (quiet.length
        ? `${quiet.length} משלמים ותיקים בלי אף פנייה ב-30 יום.`
        : "אין משלם ותיק בלי פנייה ב-30 יום."),
    table: quiet.length
      ? {
          head: ["משלם/ת שקט/ה", "אזורים", "פנייה אחרונה"],
          rows: quiet.slice(0, 15).map((t) => {
            const last = lastContact.get(t.id);
            return [t.full_name ?? "—", (t.regions ?? []).join(", ") || (t.online ? ONLINE : "—"), last ? shortDate(ilDay(last)) : "לפני יותר מ-90 יום"];
          }),
        }
      : undefined,
    notes: ["סוכן השימור עוקב אחרי אותם מטפלים כל בוקר, ובעמוד הסוכנים יש את ההקשר המלא. שום מייל לא נשלח אליהם."],
  };
}

// ---------- 11. MRR, cash flow, runway ----------

async function chapterMrr(s: Shared): Promise<ReportChapter> {
  const lastMonth = (() => {
    const [y, m] = s.today.split("-").map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  })();
  const [docsQ, recurringQ, cashQ, loansQ] = await Promise.all([
    supabaseAdmin
      .from("sumit_documents")
      .select("kind, doc_date, value_net")
      .in("kind", ["charge", "credit"])
      .gte("doc_date", `${lastMonth}-01`)
      .lte("doc_date", `${lastMonth}-${String(daysInMonth(lastMonth)).padStart(2, "0")}`),
    supabaseAdmin.from("recurring_expenses").select("start_date, months_total, amount, active, category, vendor"),
    // The latest balance the owner gave; "month" holds the day it was true on.
    supabaseAdmin
      .from("plan_targets")
      .select("month, target")
      .eq("metric", "cash_balance")
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("finance_loans")
      .select("label, remaining, monthly_payment, as_of")
      .eq("active", true)
      .order("label"),
  ]);
  if (docsQ.error) throw new Error(`sumit_documents: ${docsQ.error.message}`);
  if (recurringQ.error) throw new Error(`recurring_expenses: ${recurringQ.error.message}`);
  if (loansQ.error) throw new Error(`finance_loans: ${loansQ.error.message}`);

  const lastIncome = monthIncome({
    month: lastMonth,
    siteIncome: 0,
    manualRefunds: 0,
    sumit: monthlySumitTotals(docsQ.data ?? []).get(lastMonth) ?? null,
  });

  const mrrNow =
    s.subs
      .filter((x) => x.status === "active" && x.amount && (!x.first_charge_on || x.first_charge_on <= s.today))
      .reduce((a, x) => a + (x.amount ?? 0), 0) +
    s.centers
      .filter((c) => c.status === "active" && c.billing_starts_at && c.billing_starts_at <= s.today)
      .reduce((a, c) => a + (Number(c.agreed_monthly_price) || 0), 0);
  const mrrMonth =
    s.subs
      .filter((x) => x.status === "active" && x.amount && (!x.first_charge_on || x.first_charge_on <= s.monthEnd))
      .reduce((a, x) => a + (x.amount ?? 0), 0) +
    s.centers
      .filter((c) => c.status === "active" && c.billing_starts_at && c.billing_starts_at <= s.monthEnd)
      .reduce((a, c) => a + (Number(c.agreed_monthly_price) || 0), 0);

  // Fixed monthly costs that run in the target month.
  const monthIndex = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  const target = monthIndex(s.monthStart);
  const fixed = (recurringQ.data ?? [])
    .filter((r) => r.active)
    .filter((r) => {
      const start = monthIndex(String(r.start_date));
      return start <= target && (r.months_total == null || target < start + Number(r.months_total));
    })
    .reduce((a, r) => a + Number(r.amount || 0), 0);
  const ads = s.base.ceiling?.value ?? s.base.projection.current.monthly;
  const net = mrrMonth - fixed - ads;
  const cash = cashQ.data ? Number(cashQ.data.target) : null;
  const cashDay = cashQ.data ? String(cashQ.data.month) : null;
  const fullDate = (day: string) => `${shortDate(day)}/${day.slice(0, 4)}`;

  // Paying back a loan is not an expense, so it stays out of the deficit; it
  // still leaves the account, so the runway pays it until the loan is done.
  const loans = (loansQ.data ?? [])
    .map((l) => ({
      label: String(l.label),
      remaining: Number(l.remaining) || 0,
      monthlyPayment: Number(l.monthly_payment) || 0,
      asOf: String(l.as_of),
    }))
    .filter((l) => l.remaining > 0 && l.monthlyPayment > 0);
  const loanPayments = loans.reduce((a, l) => a + Math.min(l.remaining, l.monthlyPayment), 0);
  const cashChange = net - loanPayments;
  const runway = runwayMonths(cash, net, loans);
  // The month that falls a number of months after a day: whole calendar months
  // first (30/9 + 8 = 30/5, where 8 × 30.44 days would reach 1/6), then the
  // fraction in days. For a loan's last payment, and for the cash running out.
  const monthAfter = (day: string, months: number) => {
    const [y, m, d] = day.split("-").map(Number);
    const whole = Math.floor(months);
    const index = y * 12 + (m - 1) + whole;
    const ty = Math.floor(index / 12);
    const tm = (index % 12) + 1;
    const date = new Date(Date.UTC(ty, tm - 1, Math.min(d, daysInMonth(`${ty}-${String(tm).padStart(2, "0")}`))));
    date.setUTCDate(date.getUTCDate() + Math.round((months - whole) * 30.44));
    const key = date.toISOString().slice(0, 7);
    return `${hebrewMonth(key)} ${key.slice(0, 4)}`;
  };

  return {
    n: 11,
    key: "mrr",
    title: "הכנסה חודשית קבועה, הוצאות ו-runway",
    status: cash == null ? "partial" : "ok",
    summary:
      `הכנסה חודשית קבועה היום ${nis(mrrNow)}; ב${hebrewMonth(s.base.month)} ${nis(mrrMonth)}. ` +
      `הוצאה חודשית ${nis(fixed + ads)} (קבועות ${nis(fixed)} + פרסום ${nis(ads)}), ולכן ${net >= 0 ? "עודף" : "גירעון"} של ${nis(Math.abs(net))} בחודש` +
      (loans.length
        ? `; עם החזרי הלוואות (${nis(loanPayments)}) המזומן ${cashChange >= 0 ? "עולה" : "יורד"} ב-${nis(Math.abs(cashChange))} בחודש. `
        : ". ") +
      (runway != null && cashDay
        ? `ביתרה של ${nis(cash)} (נכון ל-${fullDate(cashDay)}) זה מספיק לכ-${runway.toFixed(1)} חודשים, כלומר עד ${monthAfter(cashDay, runway)} בערך.`
        : cash == null
          ? "ל-runway חסרה יתרת המזומנים."
          : `בקצב הזה היתרה של ${nis(cash)} לא נגמרת בעשר השנים הקרובות.`),
    table: {
      head: ["שורה", "₪ לחודש"],
      rows: [
        [`הכנסה בפועל ב${hebrewMonth(lastMonth)} (חשבוניות Sumit פחות זיכויים)`, lastIncome.source === "sumit" ? nis(lastIncome.income - lastIncome.refunds) : "—"],
        ["הכנסה חודשית קבועה היום", nis(mrrNow)],
        [`הכנסה חודשית קבועה ב${hebrewMonth(s.base.month)} (עם מרכזים ומתנות שמתחילים לשלם)`, nis(mrrMonth)],
        ["הוצאות קבועות רשומות", nis(fixed)],
        [s.base.ceiling ? "פרסום (התקרה)" : "פרסום (התקציבים בגוגל)", nis(ads)],
        [net >= 0 ? "עודף חודשי" : "גירעון חודשי", nis(Math.abs(net))],
        ...(loans.length
          ? [
              ["החזרי הלוואות", nis(loanPayments)],
              [cashChange >= 0 ? "עלייה חודשית במזומן" : "ירידה חודשית במזומן", nis(Math.abs(cashChange))],
            ]
          : []),
        ...(cash != null && cashDay ? [[`יתרת מזומנים ב-${fullDate(cashDay)}`, nis(cash)]] : []),
      ],
    },
    notes: [
      "הכנסה חודשית קבועה = מנויים פעילים שחויבו + מרכזים שהחיוב שלהם התחיל, לפני מע״מ.",
      "ההוצאות הקבועות הן רק מה שרשום בעמוד הכספים. רשימת ההוצאות שכנראה חסרות: סעיף ה בתוכנית.",
      ...(cash == null
        ? ["כדי לחשב runway צריך יתרת מזומנים: שורה ב-plan_targets עם metric = cash_balance. היא לא נשלפת מהבנק."]
        : [
            `ה-runway מניח שהחודש של ${hebrewMonth(s.base.month)} חוזר על עצמו: בלי מטפלים חדשים, בלי ביטולים ובלי הוצאות שלא רשומות. יתרת המזומנים וההלוואות לפי הבעלים, לא מהבנק; יתרה חדשה = שורה חדשה ב-plan_targets (metric = cash_balance) עם היום שלה.`,
          ]),
      ...(loans.length
        ? ["החזר הלוואה הוא לא הוצאה, ולכן הוא לא בגירעון; הוא כן יוצא מהעו״ש, ולכן הוא ב-runway עד שההלוואה נגמרת."]
        : []),
      ...loans.map((l) => {
        const payments = Math.ceil(l.remaining / l.monthlyPayment);
        return `${l.label}: נותרו ${nis(l.remaining)} (נכון ל-${fullDate(l.asOf)}), ${nis(l.monthlyPayment)} בחודש - כ-${payments} תשלומים, עד ${monthAfter(l.asOf, payments)} בערך.`;
      }),
    ],
  };
}

// ---------- 12. Month-to-month anomalies ----------

async function chapterAnomalies(s: Shared): Promise<ReportChapter> {
  const cut = shiftDay(s.asOf, -14);
  const prevCut = shiftDay(s.asOf, -28);
  const sum = (rows: DailyRow[]): WindowStats => ({
    cost: rows.reduce((a, r) => a + Number(r.cost), 0),
    clicks: rows.reduce((a, r) => a + Number(r.clicks), 0),
    impressions: rows.reduce((a, r) => a + Number(r.impressions), 0),
  });
  // Only campaigns running now: a paused campaign's last days are its wind-down, not news.
  const running = new Set(s.base.projection.campaigns.filter((c) => c.active).map((c) => c.googleName));
  const names = [...new Set(s.daily90.map((d) => d.campaign_name))].filter((n) => running.has(n));
  const found: (string | number)[][] = [];
  for (const name of names) {
    const mine = s.daily90.filter((d) => d.campaign_name === name);
    const after = sum(mine.filter((d) => d.date >= cut));
    const before = sum(mine.filter((d) => d.date >= prevCut && d.date < cut));
    for (const a of anomalies(before, after)) {
      found.push([
        name,
        a.metric === "cpc" ? "עלות לקליק" : "שיעור הקלקה",
        a.metric === "cpc" ? `₪${a.before.toFixed(2)}` : `${(a.before * 100).toFixed(1)}%`,
        a.metric === "cpc" ? `₪${a.after.toFixed(2)}` : `${(a.after * 100).toFixed(1)}%`,
        `${a.change > 0 ? "+" : ""}${Math.round(a.change * 100)}%`,
      ]);
    }
  }
  const { data: adsOpen, error } = await supabaseAdmin
    .from("agent_actions")
    .select("title, severity")
    .eq("agent", "ads")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`agent_actions: ${error.message}`);
  const holidays = holidaysBetween(prevCut, shiftDay(s.asOf, -1));
  return {
    n: 12,
    key: "anomalies",
    title: "חריגות לעומת השבועיים הקודמים",
    status: "ok",
    summary:
      (found.length ? `${found.length} שינויים של 30% ומעלה בעלות לקליק או בשיעור ההקלקה.` : "אין שינוי חד בעלות לקליק או בשיעור ההקלקה.") +
      ` בסוכן הפרסום פתוחים ${adsOpen?.length ?? 0} ממצאים.` +
      (holidays.length ? ` זהירות: בתקופה היו ${holidays.map((h) => h.name).join(", ")}.` : ""),
    table: found.length ? { head: ["קמפיין", "מדד", "לפני", "אחרי", "שינוי"], rows: found } : undefined,
    notes: (adsOpen ?? []).slice(0, 6).map((a) => `${a.severity === "high" ? "🟠" : "•"} ${a.title}`),
  };
}

// ---------- 13. Contact to treatment ----------

async function chapterContactToTreatment(s: Shared): Promise<ReportChapter> {
  const { data } = await supabaseAdmin
    .from("plan_targets")
    .select("month, target")
    .eq("metric", "lead_to_treatment_pct")
    .lte("month", s.monthStart)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    n: 13,
    key: "contact_to_treatment",
    title: "מפנייה לטיפול",
    status: "missing",
    summary:
      `לא נמדד. ${data ? `היעד בתוכנית העסקית: ${Number(data.target)}% מהפונים מתחילים טיפול. ` : ""}` +
      "האתר רואה את הלחיצה ליצירת קשר, ולא את מה שקורה אחריה.",
    notes: ["ההצעה, בלי לבנות עכשיו: שאלה קצרה אחת למטפל/ת פעם בחודש (\"כמה מהפניות מהאתר התחילו טיפול?\"), כדי לדעת אם פונה זול הוא גם פונה טוב."],
  };
}

// ---------- 14. Decision log ----------

async function chapterDecisions(s: Shared): Promise<ReportChapter> {
  const { data, error } = await supabaseAdmin
    .from("agent_actions")
    .select("dedupe_key, title, status, status_changed_at, resolution_note, created_at")
    .eq("agent", "budget")
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) throw new Error(`agent_actions: ${error.message}`);
  const recs = new Map((data ?? []).map((a) => [String(a.dedupe_key ?? "").replace("budget:", ""), a]));

  // What each month actually brought, for the three months the data covers.
  const months = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.parse(`${s.today.slice(0, 7)}-01T00:00:00Z`));
    d.setUTCMonth(d.getUTCMonth() - i);
    months.add(d.toISOString().slice(0, 7));
  }
  for (const k of recs.keys()) if (k) months.add(k);
  const status: Record<string, string> = { pending: "ממתין", approved: "אושר", done: "בוצע", dismissed: "נדחה" };
  // The spend data starts where the nightly sync's 30-day lookback first
  // reached; a month that began before it has no full "actual".
  const firstDataDay = s.daily90.reduce((min, d) => (d.date < min ? d.date : min), "9999-12-31");
  const rows = [...months]
    .sort()
    .reverse()
    .map((m) => {
      const rec = recs.get(m);
      const started = m <= s.today.slice(0, 7);
      const covered = `${m}-01` >= firstDataDay;
      let actual = "—";
      if (started && covered) {
        const cost = s.daily90.filter((d) => d.date.startsWith(m)).reduce((a, d) => a + Number(d.cost), 0);
        const seekers = new Set(
          s.clicks90.filter((c) => c.channel === "google_paid" && ilDay(c.clicked_at).startsWith(m)).map((c) => c.session_id)
        ).size;
        actual = `${nis(cost)} · ${seekers} פונים${m === s.today.slice(0, 7) ? " (עד היום)" : ""}`;
      } else if (started) {
        actual = "אין נתוני הוצאה לכל החודש";
      }
      return [
        `${hebrewMonth(m)} ${m.slice(0, 4)}`,
        rec ? String(rec.title) : "—",
        rec ? `${status[String(rec.status)] ?? rec.status}${rec.resolution_note ? `: ${rec.resolution_note}` : ""}` : "—",
        actual,
      ];
    });
  return {
    n: 14,
    key: "decisions",
    title: "יומן החלטות",
    status: recs.size ? "ok" : "partial",
    summary: recs.size
      ? `${recs.size} המלצות תקציב עד היום. לכל חודש: מה הומלץ, מה הוחלט, ומה יצא בגוגל.`
      : "עוד אין המלצות קודמות. היומן מתמלא מהריצה החודשית הראשונה.",
    table: { head: ["חודש", "ההמלצה", "מה הוחלט", "בפועל בגוגל"], rows },
    notes: ["\"בפועל\" נמדד מההוצאה שסונכרנה מגוגל ומהפונים שהגיעו ממנה באותו חודש, 90 יום אחורה לכל היותר."],
  };
}

// ---------- The report ----------

async function safe(
  n: number,
  key: string,
  title: string,
  build: () => ReportChapter | Promise<ReportChapter>
): Promise<ReportChapter> {
  try {
    return await build();
  } catch (e) {
    return {
      n,
      key,
      title,
      status: "error",
      summary: `הפרק לא חושב: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function buildBudgetMonthlyReport(opts: { month?: string } = {}): Promise<BudgetMonthlyReport> {
  const s = await loadShared(opts.month);
  let regions: RegionLine[] | null = null;
  const regionsOnce = () => (regions ??= regionalModel(s));

  const chapters = await Promise.all([
    safe(1, "cost_per_seeker", "עלות לפונה לכל קמפיין, 30/60/90 יום", () => chapterCostPerSeeker(s)),
    safe(2, "cost_per_payer", "עלות למשלם, לפי אזור", () => chapterCostPerPayer(regionsOnce())),
    safe(3, "regional_pnl", "רווח והפסד לפי אזור", () => chapterRegionalPnL(regionsOnce(), s)),
    safe(4, "protected", "קמפיינים מוגנים", () => chapterProtected(s)),
    safe(5, "first_charges", "חיובים ראשונים ב-45 הימים הקרובים", () => chapterFirstCharges(s)),
    safe(6, "thin_supply", "אזורים חנוקים בהיצע", () => chapterThinSupply(regionsOnce())),
    safe(7, "margins", "שולי התקציב", () => chapterMargins(s)),
    safe(8, "holidays", "חגים", () => chapterHolidays(s)),
    safe(9, "gift_funnel", "משפך הצעות המתנה", () => chapterGiftFunnel(s)),
    safe(10, "retention", "שימור", () => chapterRetention(s)),
    safe(11, "mrr", "הכנסה חודשית קבועה, הוצאות ו-runway", () => chapterMrr(s)),
    safe(12, "anomalies", "חריגות", () => chapterAnomalies(s)),
    safe(13, "contact_to_treatment", "מפנייה לטיפול", () => chapterContactToTreatment(s)),
    safe(14, "decisions", "יומן החלטות", () => chapterDecisions(s)),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    today: s.today,
    month: s.base.month,
    window: { from: s.from30, to: s.to30 },
    sentence: s.base.sentence,
    chapters,
  };
}
