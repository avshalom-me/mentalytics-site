"use client";

import { useEffect, useState, Fragment } from "react";
import { CHANNEL_LABELS } from "@/app/lib/attribution";
import { REGION_LABELS, ISSUE_LABELS, AGE_LABELS, GENDER_LABELS } from "@/app/lib/stats-categories";

// PHASE 1 marketing/leads dashboard. Data-first: KPIs (2/7/30 days) + plan
// targets vs. actuals; the weekly AI insight is opt-in (a button) and split into
// collapsible sections rather than a wall of text. Read-only.

type Ai = {
  summary: string | null;
  recommendations: string | null;
  silentTherapists: string | null;
  marketing: string | null;
  weekStart: string | null;
  weekEnd: string | null;
};

type PeriodKpis = {
  contacts: number;
  contactsPrev: number;
  profileViews: number;
  conversionPct: number;
  explainClicks: number;
};

type Target = {
  id: string;
  metric: string;
  month: string;
  scenario: string;
  target: number;
  actual: number | null;
  direction: "ceiling" | "goal";
};

type Supply = {
  total: number;
  registered: number;
  paid: number;
  trial: number;
  free: number;
  listed: number;
  paying: number;
  pendingNamed: number;
  incomplete: number;
};

type Churn = { everPaid: number; active: number; churned: number; pct: number | null };

type Data = {
  ai: Ai | null;
  kpis: Record<string, PeriodKpis>;
  targets: Target[];
  supply: Supply;
  churn: Churn;
  generated_at: string;
};

const PERIODS: { key: string; label: string }[] = [
  { key: "d2", label: "יומיים" },
  { key: "d7", label: "7 ימים" },
  { key: "d30", label: "30 ימים" },
];

// Label + plain-language explanation for each plan-target metric. Shown when a
// row is clicked, so the table stays short but every line is self-explaining.
// Insertion order here is the display order (most important first).
const METRIC_INFO: Record<string, { label: string; explain: string }> = {
  therapists_total: {
    label: "מטפלים פעילים",
    explain:
      "מטפלים מאושרים המוצגים למטופלים (בתשלום + מקודמים + חינמיים) — לא כולל ממתינים לאישור והרשמות לא-גמורות. עקבי עם לוח הבקרה הראשי. הפילוח המלא בכרטיס 'פילוח היצע מטפלים' למעלה.",
  },
  questionnaires_month: {
    label: "שאלונים בחודש",
    explain: "כמה שאלוני התאמה הושלמו החודש (אירוע quiz_complete) — ראש המשפך של מסלול השאלון.",
  },
  cpl_max: {
    label: "עלות מקס׳ לליד (CPL)",
    explain:
      "התקרה של כמה מותר לשלם על כל פנייה. מחושב: הוצאת פרסום ÷ מספר הפניות. היעד יורד עם הזמן (יעילות משתפרת). דורש הזנת הוצאת פרסום.",
  },
  lead_to_treatment_pct: {
    label: "המרה: ליד → טיפול",
    explain:
      "אחוז הפניות שהופכות לטיפול בפועל — מדד היעילות המרכזי של המשפך. דורש נתוני תוצאה (האם הליד הפך למטופל).",
  },
  cac_max: {
    label: "עלות רכישת מטפל (CAC)",
    explain: "כמה עולה לרכוש מטפל משלם חדש: הוצאת פרסום ÷ מטפלים משלמים חדשים. קיים בעמוד הכספים.",
  },
  churn_max_pct: {
    label: "נטישת מטפלים (Churn)",
    explain:
      "אחוז המטפלים ששילמו אי-פעם ואין להם יותר מנוי פעיל — מדד בריאות מרכזי. מחושב מצטבר (לא חודשי) כי בסיס המשלמים עדיין קטן מכדי לחשב שיעור חודשי יציב.",
  },
  teachers_total: {
    label: "מורים / אנשי חינוך",
    explain: "מספר אנשי החינוך המשתמשים במערכת (ערוץ הפניה נוסף). טרם מחובר למדידה אוטומטית.",
  },
};

// base is the default plan track; when a metric has no base row (e.g.
// therapists_total is only projected pessimistic/optimistic) fall back in this order.
const SCENARIO_PRIORITY: Record<string, number> = { base: 0, pessimistic: 1, optimistic: 2, success: 3 };

const SCENARIO_LABELS: Record<string, string> = {
  base: "בסיס",
  optimistic: "אופטימי",
  pessimistic: "פסימי",
};

function num(n: number) {
  return n.toLocaleString("he-IL");
}
// Percent metrics render with %, cost ceilings with ₪, counts plain.
function fmtMetricVal(metric: string, v: number): string {
  if (metric.endsWith("_pct")) return `${v}%`;
  if (metric === "cpl_max" || metric === "cac_max") return `₪${num(v)}`;
  return num(v);
}
function formatMonth(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("he-IL", { month: "short", year: "numeric" });
}

// --- Markdown (mirrors the local helper in the weekly/monthly report pages). ---
function formatTextWithBold(text: string): React.ReactNode {
  return text.split(/(\*\*.+?\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}
function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-7 text-stone-700">
      {blocks.map((block, i) => {
        if (/^\s*-\s/.test(block)) {
          const items = block.split(/\n/).filter((l) => /^\s*-\s/.test(l));
          return (
            <ul key={i} className="list-disc pr-5 space-y-1">
              {items.map((item, j) => (
                <li key={j}>{formatTextWithBold(item.replace(/^\s*-\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{formatTextWithBold(block)}</p>;
      })}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
      <div className="text-3xl font-black text-[#2A6462]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-stone-500">{label}</div>
      {sub && <div className="mt-1.5 text-xs">{sub}</div>}
    </div>
  );
}

function Delta({ cur, prev, unit }: { cur: number; prev: number; unit: string }) {
  if (prev === 0) {
    return cur > 0 ? <span className="font-bold text-green-700">חדש</span> : <span className="text-stone-300">—</span>;
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`font-bold ${up ? "text-green-700" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% מ{unit} הקודם
    </span>
  );
}

// Supply split by commitment tier. The 3 "active" tiers (listed on the site)
// get a proportional stacked bar; pending/incomplete are pipeline states shown
// as separate chips so they're never conflated with real supply.
function SupplyPanel({ s }: { s: Supply }) {
  const active = s.paid + s.trial + s.free || 1;
  const bar = [
    { label: "משלמים", n: s.paid, color: "#2A6462" },
    { label: "מקודמים (מתנה)", n: s.trial, color: "#3D8C8A" },
    { label: "חינמיים", n: s.free, color: "#C2DFDE" },
  ];
  const chips = [
    { label: "משלמים", n: s.paid, dot: "#2A6462", hint: "תשלום בפועל" },
    { label: "מקודמים (מתנה)", n: s.trial, dot: "#3D8C8A", hint: "קידום/ניסיון חינם" },
    { label: "חינמיים", n: s.free, dot: "#C2DFDE", hint: "מאושרים בדירקטורי" },
    { label: "ממתינים לאישור", n: s.pendingNamed, dot: "#D49018", hint: "הוגשו, טרם אושרו" },
    { label: "הרשמות לא-גמורות", n: s.incomplete, dot: "#DDE9E8", hint: "נפתחו ולא הושלמו" },
  ];
  return (
    <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">פילוח היצע מטפלים</h2>
        <span className="text-xs text-stone-500">
          {num(s.listed)} מוצגים למטופלים · {num(s.registered)} רשומים
        </span>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        מתוך {num(s.total)} שנפתחו במערכת — {num(s.incomplete)} הרשמות לא-גמורות אינן נספרות כרשומים.
      </p>
      <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
        {bar.map((x) => (
          <div key={x.label} style={{ width: `${(x.n / active) * 100}%`, background: x.color }} title={`${x.label}: ${x.n}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {chips.map((t) => (
          <div key={t.label} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.dot }} />
              <span className="text-xl font-black text-stone-900">{num(t.n)}</span>
            </div>
            <div className="mt-0.5 text-xs font-semibold text-stone-600">{t.label}</div>
            <div className="text-[11px] text-stone-400">{t.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function evalTarget(t: Target): { label: string; cls: string } {
  if (t.actual == null) return { label: "טרם מחושב", cls: "bg-stone-100 text-stone-500" };
  if (t.direction === "ceiling") {
    if (t.actual <= t.target) return { label: "עומד ביעד", cls: "bg-green-100 text-green-700" };
    if (t.actual <= t.target * 1.2) return { label: "חורג מעט", cls: "bg-amber-100 text-amber-700" };
    return { label: "חורג", cls: "bg-red-100 text-red-700" };
  }
  if (t.actual >= t.target) return { label: "עומד ביעד", cls: "bg-green-100 text-green-700" };
  if (t.actual >= t.target * 0.8) return { label: "קרוב ליעד", cls: "bg-amber-100 text-amber-700" };
  return { label: "מתחת ליעד", cls: "bg-red-100 text-red-700" };
}

// One representative row per known metric — the best available scenario
// (base if present, else the next by SCENARIO_PRIORITY) at the month nearest to
// now — so the table stays short instead of listing every month × scenario.
// Ordered by METRIC_INFO insertion order (most important first).
function currentTargets(targets: Target[]): Target[] {
  const now = Date.now();
  const byMetric = new Map<string, Target[]>();
  for (const t of targets) {
    if (!(t.metric in METRIC_INFO)) continue;
    const arr = byMetric.get(t.metric);
    if (arr) arr.push(t);
    else byMetric.set(t.metric, [t]);
  }
  const out: Target[] = [];
  for (const metric of Object.keys(METRIC_INFO)) {
    const rows = byMetric.get(metric);
    if (!rows || rows.length === 0) continue;
    const bestScenario = [...rows].sort(
      (a, b) => (SCENARIO_PRIORITY[a.scenario] ?? 9) - (SCENARIO_PRIORITY[b.scenario] ?? 9)
    )[0].scenario;
    const scoped = rows
      .filter((r) => r.scenario === bestScenario)
      .sort((a, b) => Math.abs(new Date(a.month).getTime() - now) - Math.abs(new Date(b.month).getTime() - now));
    out.push(scoped[0]);
  }
  return out;
}

// ---- PHASE 2: funnels + campaigns. Reuses the existing read-only admin
// endpoints (attribution / analytics / finance) rather than re-implementing the
// aggregation here — the cross-page audit flagged that duplication as the main
// risk, so this tab lazy-fetches those APIs when opened. ----

type FunnelSrc = { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
type AttrChannel = {
  channel: string;
  profileViews: number;
  contactClicks: number;
  viewToClick: number;
};
type FinMonth = { month: string; ad_spend: number; new_paying: number; cac_actual: number | null };

const P2_PERIODS: { key: "week" | "month" | "all"; label: string }[] = [
  { key: "week", label: "7 ימים" },
  { key: "month", label: "30 ימים" },
  { key: "all", label: "הכל" },
];

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function FunnelCard({
  eyebrow,
  title,
  steps,
  headline,
  note,
}: {
  eyebrow: string;
  title: string;
  steps: { label: string; value: number; color: string }[];
  headline: number;
  note?: string;
}) {
  const top = steps[0]?.value || 1;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#3D8C8A]">{eyebrow}</p>
          <h3 className="text-base font-black text-stone-800">{title}</h3>
        </div>
        <div className="text-center">
          <div className="text-lg font-black text-[#D49018]">{headline.toFixed(1)}%</div>
          <div className="text-[11px] text-stone-400">צפייה→פנייה</div>
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => {
          // Clamp: a step can exceed the previous one (e.g. one quiz → many
          // profile opens), which isn't a monotone funnel — cap the bar at 100%
          // and hide the ">100%" step conversion since it reads as nonsense.
          const w = Math.min(100, Math.max(6, (s.value / top) * 100));
          const conv = i > 0 && steps[i - 1].value > 0 ? (s.value / steps[i - 1].value) * 100 : null;
          return (
            <div key={s.label}>
              <div className="mb-0.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">{s.label}</span>
                <span className="text-stone-500">
                  {num(s.value)}
                  {conv != null && conv <= 100 && <span className="text-stone-400"> · {conv.toFixed(0)}%</span>}
                </span>
              </div>
              <div className="h-6 rounded-lg" style={{ width: `${w}%`, minWidth: "2.5rem", background: s.color }} />
            </div>
          );
        })}
      </div>
      {note && <p className="mt-3 text-xs text-stone-400">{note}</p>}
    </div>
  );
}

type AdsCampaignRow = {
  id: string;
  name: string;
  utmCampaign: string | null;
  cost: number;
  clicks: number;
  impressions: number;
  ctr: number;
  avgCpc: number;
};
type AdsData = {
  ok: boolean;
  configured: boolean;
  campaigns?: AdsCampaignRow[];
  byDay?: { date: string; cost: number }[];
  total?: number;
  error?: string;
};
type CampaignFunnelRow = {
  campaign: string;
  sessions: number;
  viewed_profile: number;
  contacts: number;
  whatsapp: number;
  phone: number;
  email: number;
  site_message: number;
};
type RecruitRow = { campaign: string; signups: number };

function FunnelsCampaigns() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [channels, setChannels] = useState<AttrChannel[] | null>(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [campaigns, setCampaigns] = useState<{ campaign: string; contactClicks: number }[] | null>(null);
  const [funnel, setFunnel] = useState<{ directory: FunnelSrc; match: FunnelSrc } | null>(null);
  const [cac, setCac] = useState<FinMonth | null>(null);
  const [ads, setAds] = useState<AdsData | null>(null);
  const [campFunnel, setCampFunnel] = useState<CampaignFunnelRow[] | null>(null);
  const [recruit, setRecruit] = useState<RecruitRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false; // guard against a slower earlier request overwriting a newer one
    setLoading(true);
    setError("");
    // Each fetch resolves to {ok:false} on failure so Promise.all never rejects
    // and one endpoint failing doesn't blank the whole tab.
    const asJson = (url: string) =>
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
    Promise.all([
      asJson(`/api/admin-attribution?period=${period}`),
      asJson(`/api/admin-analytics?period=${period}`),
      asJson(`/api/admin-crm/finance`),
      asJson(`/api/admin-google-ads?period=${period}`),
      asJson(`/api/admin-campaign-funnel?period=${period}`),
      asJson(`/api/admin-therapist-campaigns?period=${period}`),
    ])
      .then(([a, an, fin, gads, cf, rec]) => {
        if (ignore) return;
        // Core = attribution + analytics. Finance (CAC) and Google Ads are
        // optional; if they fail their cards show a fallback but the rest renders.
        if (!a?.ok || !an?.ok) {
          setError("שגיאה בטעינת נתוני המשפכים");
          return;
        }
        setChannels(a.channels ?? []);
        setTotalContacts(a.totals?.contactClicks ?? 0);
        setCampaigns(a.topCampaigns ?? []);
        setFunnel(an.funnelBySource ?? null);
        // finance builds months newest-first, so the CURRENT month is index 0.
        const months: FinMonth[] = fin?.ok ? fin.months ?? [] : [];
        setCac(months[0] ?? null);
        setAds((gads as AdsData) ?? null);
        setCampFunnel(cf?.ok ? (cf.rows as CampaignFunnelRow[]) ?? [] : []);
        setRecruit(rec?.ok ? (rec.campaigns as RecruitRow[]) ?? [] : []);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [period]);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
          {P2_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                period === p.key ? "bg-[#2A6462] text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-stone-400">טוען…</p>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <>
          {funnel && (
            <div className="mb-5 grid gap-3 lg:grid-cols-2">
              <FunnelCard
                eyebrow="מסלול 1"
                title="מאגר המטפלים"
                headline={pct(funnel.directory.contactClicks, funnel.directory.profileViews)}
                steps={[
                  { label: "חשיפות בדירקטורי", value: funnel.directory.impressions, color: "#C2DFDE" },
                  { label: "צפיות פרופיל", value: funnel.directory.profileViews, color: "#3D8C8A" },
                  { label: "פניות", value: funnel.directory.contactClicks, color: "#D49018" },
                ]}
              />
              <FunnelCard
                eyebrow="מסלול 2 ✦"
                title="שאלון ההתאמה"
                headline={pct(funnel.match.contactClicks, funnel.match.profileViews)}
                steps={[
                  { label: "סיימו שאלון", value: funnel.match.pageViews, color: "#2A6462" },
                  { label: "צפיות פרופיל (התאמה)", value: funnel.match.profileViews, color: "#3D8C8A" },
                  { label: "פניות", value: funnel.match.contactClicks, color: "#D49018" },
                ]}
                note={`${num(funnel.match.impressions)} כרטיסי מטפל הוצגו בהתאמות`}
              />
            </div>
          )}
          {!funnel && <p className="mb-5 text-sm text-stone-400">אין נתוני משפך לטווח זה.</p>}

          {/* Per-campaign on-site funnel: ad click -> profile view -> contact by type */}
          {campFunnel && campFunnel.some((r) => r.campaign.startsWith("g-")) && (
            <div className="mb-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="mb-1 text-base font-black text-stone-800">משפך לפי קמפיין ממומן</h3>
              <p className="mb-3 text-xs text-stone-500">
                מה עשו מי שהגיעו מכל קמפיין: כניסות ← צפו בפרופיל ← פנו (לפי סוג הפנייה).
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="px-2 py-2 text-right font-semibold">קמפיין</th>
                    <th className="px-2 py-2 text-center font-semibold">כניסות</th>
                    <th className="px-2 py-2 text-center font-semibold">צפו בפרופיל</th>
                    <th className="px-2 py-2 text-center font-semibold">פניות</th>
                    <th className="px-2 py-2 text-center font-semibold">💬</th>
                    <th className="px-2 py-2 text-center font-semibold">📞</th>
                    <th className="px-2 py-2 text-center font-semibold">✉️</th>
                    <th className="px-2 py-2 text-center font-semibold">📝</th>
                  </tr>
                </thead>
                <tbody>
                  {campFunnel
                    .filter((r) => r.campaign.startsWith("g-"))
                    .map((r) => {
                      const conv = r.sessions > 0 ? Math.round((r.contacts / r.sessions) * 1000) / 10 : 0;
                      return (
                        <tr key={r.campaign} className="border-b border-stone-100">
                          <td className="px-2 py-2 font-semibold text-stone-700">{r.campaign}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.sessions)}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.viewed_profile)}</td>
                          <td className="px-2 text-center font-bold text-stone-900">
                            {num(r.contacts)}
                            {/* conv = clicks ÷ distinct sessions; hide when >100% (multiple contacts in one session) */}
                            {r.sessions > 0 && r.contacts > 0 && conv <= 100 && (
                              <span className="text-stone-400"> · {conv}%</span>
                            )}
                          </td>
                          <td className="px-2 text-center text-stone-500">{r.whatsapp || "—"}</td>
                          <td className="px-2 text-center text-stone-500">{r.phone || "—"}</td>
                          <td className="px-2 text-center text-stone-500">{r.email || "—"}</td>
                          <td className="px-2 text-center text-stone-500">{r.site_message || "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-stone-400">
                💬 וואטסאפ · 📞 טלפון · ✉️ מייל · 📝 טופס-אתר. כניסות/צפיות = סשנים ייחודיים; הכל לפי utm_campaign.
              </p>
            </div>
          )}

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-stone-800">פניות לפי ערוץ</h3>
                <a href="/admin/attribution" className="text-xs font-semibold text-[#3D8C8A] hover:underline">
                  ניתוח מלא ←
                </a>
              </div>
              {/* Contacts + share only. Per-channel view→contact from attribution is
                  unreliable here (match_card impressions land under "unknown" as
                  profile views), so efficiency lives on /admin/attribution. */}
              {channels && channels.some((c) => c.contactClicks > 0) ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="px-2 py-2 text-right font-semibold">ערוץ</th>
                      <th className="px-2 py-2 text-center font-semibold">פניות</th>
                      <th className="px-2 py-2 text-center font-semibold">חלק</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels
                      .filter((c) => c.contactClicks > 0)
                      .map((c) => (
                        <tr key={c.channel} className="border-b border-stone-100">
                          <td className="px-2 py-2 font-semibold text-stone-700">
                            {CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] ?? c.channel}
                          </td>
                          <td className="px-2 text-center font-bold text-stone-900">{num(c.contactClicks)}</td>
                          <td className="px-2 text-center text-stone-500">
                            {totalContacts > 0 ? `${Math.round((c.contactClicks / totalContacts) * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-stone-400">אין עדיין פניות מתויגות בערוץ לטווח זה.</p>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="mb-1 text-base font-black text-stone-800">CAC אמיתי</h3>
              <p className="mb-3 text-xs text-stone-500">
                עלות רכישת מטפל משלם — {cac ? formatMonth(cac.month) : "החודש הנוכחי"} (מעמוד הכספים).
              </p>
              {cac && cac.cac_actual != null ? (
                <>
                  <div className="text-3xl font-black text-[#2A6462]">₪{num(cac.cac_actual)}</div>
                  <div className="mt-2 text-xs text-stone-500">
                    ₪{num(cac.ad_spend)} הוצאת פרסום ÷ {num(cac.new_paying)} מטפלים חדשים
                  </div>
                </>
              ) : (
                <p className="text-sm text-stone-400">לא הוזנה הוצאת פרסום החודש בעמוד הכספים — לכן CAC לא מחושב.</p>
              )}
            </div>
          </div>

          {/* Google Ads spend — auto, when the API is connected */}
          {ads && (
            <div className="mb-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-stone-800">פרסום ממומן — Google Ads</h3>
                {ads.ok && ads.configured && (
                  <span className="text-xs text-stone-500">
                    סה״כ הוצאה: <span className="font-bold text-stone-800">₪{num(Math.round(ads.total ?? 0))}</span>
                  </span>
                )}
              </div>
              {ads.configured === false ? (
                <p className="text-sm text-stone-400">
                  לא מחובר. הזן את משתני הסביבה של Google Ads ב-Vercel כדי לראות הוצאה, CPC ו-CPL אוטומטית.
                </p>
              ) : ads.ok === false ? (
                <p className="text-sm text-red-600">לא ניתן לטעון נתוני Google Ads: {ads.error ?? "שגיאה"}</p>
              ) : ads.campaigns && ads.campaigns.length ? (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-500">
                        <th className="px-2 py-2 text-right font-semibold">קמפיין</th>
                        <th className="px-2 py-2 text-center font-semibold">הוצאה</th>
                        <th className="px-2 py-2 text-center font-semibold">קליקים</th>
                        <th className="px-2 py-2 text-center font-semibold">CTR</th>
                        <th className="px-2 py-2 text-center font-semibold">CPC</th>
                        <th className="px-2 py-2 text-center font-semibold">עלות/המרה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.campaigns.map((c) => {
                        // Join on the uncapped per-campaign funnel data (not the
                        // top-15 topCampaigns), so a campaign ranked #16+ still gets a CPL.
                        const contacts = c.utmCampaign
                          ? campFunnel?.find((x) => x.campaign === c.utmCampaign)?.contacts ?? 0
                          : 0;
                        const signups = c.utmCampaign
                          ? recruit?.find((x) => x.campaign === c.utmCampaign)?.signups ?? 0
                          : 0;
                        // Adaptive cost-per-acquisition: patient campaigns → cost per
                        // contact; recruitment campaigns → cost per therapist signup.
                        const acq =
                          contacts > 0
                            ? { cost: Math.round(c.cost / contacts), unit: "פנייה" }
                            : signups > 0
                              ? { cost: Math.round(c.cost / signups), unit: "הרשמה" }
                              : null;
                        return (
                          <tr key={c.id} className="border-b border-stone-100">
                            <td className="px-2 py-2 font-semibold text-stone-700">
                              {c.name}
                              {c.utmCampaign && <span className="text-xs text-stone-400"> · {c.utmCampaign}</span>}
                            </td>
                            <td className="px-2 text-center font-bold text-stone-900">₪{num(Math.round(c.cost))}</td>
                            <td className="px-2 text-center text-stone-600">{num(c.clicks)}</td>
                            <td className="px-2 text-center text-stone-500">{c.ctr.toFixed(1)}%</td>
                            <td className="px-2 text-center text-stone-500">₪{c.avgCpc.toFixed(2)}</td>
                            <td className="px-2 text-center font-bold text-[#2A6462]">
                              {acq ? (
                                <>
                                  ₪{num(acq.cost)}
                                  <span className="text-[10px] font-normal text-stone-400"> / {acq.unit}</span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {ads.byDay &&
                    ads.byDay.length > 1 &&
                    (() => {
                      const max = Math.max(1, ...ads.byDay!.map((d) => d.cost));
                      return (
                        <div className="mt-4">
                          <p className="mb-1 text-xs font-semibold text-stone-500">הוצאה יומית</p>
                          <div className="flex items-end gap-0.5" style={{ height: "48px" }}>
                            {ads.byDay!.map((d) => (
                              <div
                                key={d.date}
                                title={`${d.date}: ₪${num(Math.round(d.cost))}`}
                                className="flex-1 rounded-t bg-[#3D8C8A]"
                                style={{ height: `${Math.max(4, (d.cost / max) * 100)}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  <p className="mt-3 text-[11px] leading-5 text-stone-400">
                    הוצאה, קליקים, CTR ו-CPC נמשכים אוטומטית מ-Google Ads.{" "}
                    <span className="font-semibold text-stone-500">עלות/המרה מחושבת אצלנו</span> לפי מטרת הקמפיין: קמפיין
                    מטופלים = הוצאה ÷ פניות (&quot;/ פנייה&quot;); קמפיין גיוס מטפלים = הוצאה ÷ הרשמות (&quot;/ הרשמה&quot;) — הכל
                    לפי utm_campaign. &quot;—&quot; = אין utm_campaign זמין, או שעדיין אין המרה מיוחסת.
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone-400">אין הוצאה בטווח זה.</p>
              )}
            </div>
          )}

          <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="mb-3 text-base font-black text-stone-800">קמפיינים מובילים (לפי פניות)</h3>
            {campaigns && campaigns.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="px-2 py-2 text-right font-semibold">קמפיין (utm_campaign)</th>
                    <th className="px-2 py-2 text-center font-semibold">פניות</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.campaign} className="border-b border-stone-100">
                      <td className="px-2 py-2 font-semibold text-stone-700">{c.campaign}</td>
                      <td className="px-2 text-center font-bold text-stone-900">{num(c.contactClicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-stone-400">אין עדיין פניות מתויגות בקמפיין לטווח זה.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ---- PHASE 3: demand, supply quality, recruitment. Same lazy-fetch-existing-
// endpoints pattern as Phase 2 (supply-demand / analytics / recruitment). ----

type NameCount = { name: string; count: number };
type Demographics = { byRegion: NameCount[]; byIssue: NameCount[]; byAgeBand: NameCount[]; byGender: NameCount[] };
type Breakdowns = { total: number; withPhoto: number; acceptingNew: number; onlineCount: number };
type RegionRow = { region: string; label: string; therapists: number; demand: number; demandPerTherapist: number | null; status: string };
type CampaignRow = { campaign: string; visitors: number; signups: number; approved: number; paying: number };

const REGION_ACTION: Record<string, { label: string; cls: string }> = {
  needs_therapists: { label: "לגייס מטפלים", cls: "bg-amber-100 text-amber-700" },
  needs_patients: { label: "להביא מטופלים", cls: "bg-[#EAF4F3] text-[#2A6462]" },
  balanced: { label: "מאוזן", cls: "bg-green-100 text-green-700" },
  empty: { label: "ריק", cls: "bg-stone-100 text-stone-400" },
};

function DemoCard({ title, items, labelOf }: { title: string; items: NameCount[]; labelOf: (k: string) => string }) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const top = items.slice(0, 5);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-black text-stone-700">{title}</h4>
      <div className="space-y-1.5">
        {top.map((i) => {
          const share = Math.round((i.count / total) * 100);
          return (
            <div key={i.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">{labelOf(i.name)}</span>
                <span className="text-stone-400">{share}%</span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-[#3D8C8A]" style={{ width: `${Math.max(3, share)}%` }} />
              </div>
            </div>
          );
        })}
        {!top.length && <p className="text-xs text-stone-400">אין נתונים לטווח זה.</p>}
      </div>
    </div>
  );
}

function QualityCard({ label, count, total }: { label: string; count: number; total: number }) {
  const p = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
      <div className="text-3xl font-black text-[#2A6462]">{p}%</div>
      <div className="mt-1 text-xs font-semibold text-stone-600">{label}</div>
      <div className="text-[11px] text-stone-400">
        {num(count)} מתוך {num(total)}
      </div>
    </div>
  );
}

function DemandSupply() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [demo, setDemo] = useState<Demographics | null>(null);
  const [breakdowns, setBreakdowns] = useState<Breakdowns | null>(null);
  const [regions, setRegions] = useState<RegionRow[] | null>(null);
  const [sdMeta, setSdMeta] = useState<{ starvingCount: number; demandNoRegion: number; onlineTherapistCount: number } | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [totalSignups, setTotalSignups] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    const asJson = (url: string) =>
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
    Promise.all([
      asJson(`/api/admin-supply-demand?period=${period}`),
      asJson(`/api/admin-analytics?period=${period}`),
      asJson(`/api/admin-therapist-campaigns?period=${period}`),
    ])
      .then(([sd, an, rec]) => {
        if (ignore) return;
        // Render each section from whatever loaded — one endpoint failing must
        // not blank the others.
        if (an?.ok) {
          setDemo(an.demographics ?? null);
          setBreakdowns(an.therapistBreakdowns ?? null);
        }
        if (sd?.ok) {
          setRegions(sd.regions ?? []);
          setSdMeta({
            starvingCount: sd.starvingCount ?? 0,
            demandNoRegion: sd.demandNoRegion ?? 0,
            onlineTherapistCount: sd.onlineTherapistCount ?? 0,
          });
        }
        if (rec?.ok) {
          setCampaigns(rec.campaigns ?? []);
          setTotalSignups(rec.totalSignups ?? 0);
        }
        if (!sd?.ok && !an?.ok && !rec?.ok) setError("שגיאה בטעינת נתוני ביקוש/היצע");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [period]);

  return (
    <>
      <div className="mb-5 flex justify-end">
        <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
          {P2_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                period === p.key ? "bg-[#2A6462] text-white" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-stone-400">טוען…</p>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && !error && (
        <>
          {/* Demand demographics — for ad targeting */}
          {demo && (
            <div className="mb-6">
              <h3 className="mb-1 text-base font-black text-stone-800">דמוגרפיית ביקוש</h3>
              <p className="mb-3 text-xs text-stone-500">
                מי המטופלים שמחפשים (משוקלל לפי צפיות וחשיפות בהתאמות) — לטרגוט פרסום.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DemoCard title="אזור" items={demo.byRegion} labelOf={(k) => REGION_LABELS[k as keyof typeof REGION_LABELS] ?? k} />
                <DemoCard title="נושא" items={demo.byIssue} labelOf={(k) => ISSUE_LABELS[k as keyof typeof ISSUE_LABELS] ?? k} />
                <DemoCard title="גיל" items={demo.byAgeBand} labelOf={(k) => AGE_LABELS[k as keyof typeof AGE_LABELS] ?? k} />
                <DemoCard title="מגדר" items={demo.byGender} labelOf={(k) => GENDER_LABELS[k as keyof typeof GENDER_LABELS] ?? k} />
              </div>
            </div>
          )}

          {/* Where to act — supply vs demand by region */}
          {regions && (
            <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-stone-800">איפה לפעול — היצע מול ביקוש</h3>
                <a href="/admin/supply-demand" className="text-xs font-semibold text-[#3D8C8A] hover:underline">
                  ניתוח מלא ←
                </a>
              </div>
              <p className="mb-3 text-xs text-stone-500">
                ביקוש = צפיות פרופיל וחשיפות בהתאמות.
                {sdMeta
                  ? ` ${num(sdMeta.onlineTherapistCount)} מציעים אונליין (מצב נוכחי) · ${num(sdMeta.starvingCount)} בלי פניות בטווח · ${num(sdMeta.demandNoRegion)} צפיות ללא אזור.`
                  : ""}
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="px-2 py-2 text-right font-semibold">אזור</th>
                    <th className="px-2 py-2 text-center font-semibold">היצע</th>
                    <th className="px-2 py-2 text-center font-semibold">ביקוש</th>
                    <th className="px-2 py-2 text-center font-semibold">ביקוש/מטפל</th>
                    <th className="px-2 py-2 text-center font-semibold">פעולה</th>
                  </tr>
                </thead>
                <tbody>
                  {[...regions]
                    .sort((a, b) => b.demand - a.demand)
                    .map((r) => {
                      const act = REGION_ACTION[r.status] ?? REGION_ACTION.empty;
                      return (
                        <tr key={r.region} className="border-b border-stone-100">
                          <td className="px-2 py-2 font-semibold text-stone-700">{r.label}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.therapists)}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.demand)}</td>
                          <td className="px-2 text-center text-stone-500">{r.demandPerTherapist ?? "—"}</td>
                          <td className="px-2 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${act.cls}`}>{act.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Supply quality */}
          {breakdowns && (
            <div className="mb-6">
              <h3 className="mb-1 text-base font-black text-stone-800">
                איכות היצע <span className="text-xs font-normal text-stone-400">(מצב נוכחי)</span>
              </h3>
              <p className="mb-3 text-xs text-stone-500">
                מבין {num(breakdowns.total)} המטפלים המוצגים כרגע — משפיע ישירות על המרה. אינו מושפע מהטווח.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <QualityCard label="עם תמונת פרופיל" count={breakdowns.withPhoto} total={breakdowns.total} />
                <QualityCard label="מקבלים מטופלים חדשים" count={breakdowns.acceptingNew} total={breakdowns.total} />
                <QualityCard label="מציעים אונליין" count={breakdowns.onlineCount} total={breakdowns.total} />
              </div>
            </div>
          )}

          {/* Recruitment funnel */}
          {campaigns && (
            <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-stone-800">משפך גיוס מטפלים</h3>
                <a href="/admin/recruitment" className="text-xs font-semibold text-[#3D8C8A] hover:underline">
                  ניתוח מלא ←
                </a>
              </div>
              <p className="mb-3 text-xs text-stone-500">{num(totalSignups)} הרשמות מטפלים בטווח — לפי קמפיין.</p>
              {campaigns.some((c) => c.signups > 0 || c.visitors > 0) ? (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-500">
                        <th className="px-2 py-2 text-right font-semibold">קמפיין</th>
                        <th className="px-2 py-2 text-center font-semibold">מבקרים</th>
                        <th className="px-2 py-2 text-center font-semibold">נרשמו</th>
                        <th className="px-2 py-2 text-center font-semibold">אושרו</th>
                        <th className="px-2 py-2 text-center font-semibold">משלמים</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns
                        .filter((c) => c.signups > 0 || c.visitors > 0)
                        .map((c) => (
                          <tr key={c.campaign} className="border-b border-stone-100">
                            <td className="px-2 py-2 font-semibold text-stone-700">{c.campaign}</td>
                            <td className="px-2 text-center text-stone-500">{c.visitors > 0 ? num(c.visitors) : "—"}</td>
                            <td className="px-2 text-center font-bold text-stone-900">{num(c.signups)}</td>
                            <td className="px-2 text-center text-stone-600">{num(c.approved)}</td>
                            <td className="px-2 text-center text-stone-600">{num(c.paying)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[11px] text-stone-400">
                    מבקרים מיוחסים לפי UTM; הרשמות לפי שדה הקמפיין של המטפל — לכן ייתכן פער בין המקורות (הרשמות לא-מתויגות מופיעות תחת "ללא קמפיין").
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone-400">אין עדיין הרשמות מתויגות בקמפיין לטווח זה.</p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function MarketingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("d7");
  const [showAi, setShowAi] = useState(false);
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "funnels" | "demand">("overview");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-marketing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => (j.ok ? setData(j) : setError(j.error || "שגיאה בטעינה")))
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  const k = data?.kpis[period];
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-stone-900">שיווק ופניות</h1>
          <p className="mt-1 text-sm text-stone-500">תמונת מצב שיווקית — מדדים, משפכים, יעדים ותובנת AI.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-stone-200">
          {(
            [
              ["overview", "סקירה"],
              ["funnels", "משפכים וקמפיינים"],
              ["demand", "ביקוש והיצע"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition ${
                tab === key ? "border-[#2A6462] text-[#2A6462]" : "border-transparent text-stone-400 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "funnels" && <FunnelsCampaigns />}

        {tab === "demand" && <DemandSupply />}

        {tab === "overview" && (
          <>
            {/* Period toggle */}
            <div className="mb-5 flex justify-end">
              <div className="inline-flex rounded-full border border-stone-200 bg-white p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      period === p.key ? "bg-[#2A6462] text-white" : "text-stone-500 hover:text-stone-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && <p className="text-sm text-stone-400">טוען…</p>}
            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {data && !loading && k && (
          <>
            {/* KPI row — DATA FIRST */}
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label={`סה״כ פניות (${periodLabel})`}
                value={num(k.contacts)}
                sub={<Delta cur={k.contacts} prev={k.contactsPrev} unit={periodLabel === "יומיים" ? "היומיים" : "טווח"} />}
              />
              <KpiCard label="שיעור המרה (צפייה→פנייה)" value={`${k.conversionPct.toFixed(1)}%`} />
              <KpiCard label={'"ניתוח אישי" (AI)'} value={num(k.explainClicks)} />
              <KpiCard label="צפיות פרופיל" value={num(k.profileViews)} />
            </div>

            {/* Supply tier breakdown */}
            <SupplyPanel s={data.supply} />

            {/* Targets vs actuals — short, one row per metric, click for explanation */}
            <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-1 text-base font-black text-stone-800">יעדים מול ביצוע</h2>
              <p className="mb-4 text-xs text-stone-500">יעד לחודש הנוכחי. לחצו על שורה להסבר.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="px-2 py-2 text-right font-semibold">מדד</th>
                    <th className="px-2 py-2 text-center font-semibold">יעד</th>
                    <th className="px-2 py-2 text-center font-semibold">בפועל</th>
                    <th className="px-2 py-2 text-center font-semibold">סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTargets(data.targets).map((t) => {
                    const verdict = evalTarget(t);
                    const info = METRIC_INFO[t.metric];
                    const open = openMetric === t.metric;
                    return (
                      <Fragment key={t.metric}>
                        <tr
                          onClick={() => setOpenMetric(open ? null : t.metric)}
                          className="cursor-pointer border-b border-stone-100 hover:bg-stone-50"
                        >
                          <td className="px-2 py-2.5 font-semibold text-stone-700">
                            <span className="mr-1 text-stone-400">{open ? "▾" : "◂"}</span>
                            {info?.label ?? t.metric}
                          </td>
                          <td className="px-2 text-center text-stone-600">
                            <span className="text-stone-400">{t.direction === "ceiling" ? "≤ " : "≥ "}</span>
                            {fmtMetricVal(t.metric, t.target)}
                          </td>
                          <td className="px-2 text-center font-bold text-stone-900">
                            {t.actual == null ? "—" : fmtMetricVal(t.metric, t.actual)}
                          </td>
                          <td className="px-2 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${verdict.cls}`}>
                              {verdict.label}
                            </span>
                          </td>
                        </tr>
                        {open && info && (
                          <tr key={`${t.metric}-x`} className="border-b border-stone-100 bg-stone-50">
                            <td colSpan={4} className="px-3 py-3 text-xs leading-6 text-stone-600">
                              {info.explain}
                              {t.metric === "therapists_total" && (
                                <span className="mt-1 block font-semibold text-[#2A6462]">
                                  מתוכם {num(data.supply.paid)} בתשלום, {num(data.supply.trial)} מקודמים במתנה,{" "}
                                  {num(data.supply.free)} חינמיים. ({num(data.supply.incomplete)} הרשמות לא-גמורות לא נספרות.)
                                </span>
                              )}
                              {t.metric === "churn_max_pct" && (
                                <span className="mt-1 block font-semibold text-[#2A6462]">
                                  {num(data.churn.everPaid)} מטפלים שילמו אי-פעם · {num(data.churn.churned)} נטשו ·{" "}
                                  {num(data.churn.active)} פעילים כעת.
                                </span>
                              )}
                              <span className="mt-1 block text-stone-400">
                                יעד לחודש {formatMonth(t.month)} · תרחיש {SCENARIO_LABELS[t.scenario] ?? t.scenario}
                              </span>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI insight — ON DEMAND, collapsible sections */}
            <div className="mb-6">
              {!showAi ? (
                <button
                  onClick={() => setShowAi(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#C2DFDE] bg-[#EAF4F3] px-4 py-2 text-sm font-bold text-[#2A6462] hover:bg-[#dcefed]"
                >
                  ✦ הצג תובנת AI מהדוח השבועי
                </button>
              ) : (
                <div className="rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex flex-wrap items-center gap-2 text-base font-black text-[#2A6462]">
                      ✦ תובנת AI
                      {data.ai?.weekStart && data.ai?.weekEnd && (
                        <span className="text-xs font-semibold text-[#3D8C8A]">
                          שבוע {data.ai.weekStart} – {data.ai.weekEnd}
                        </span>
                      )}
                    </h2>
                    <button onClick={() => setShowAi(false)} className="text-xs font-semibold text-stone-500 hover:text-stone-800">
                      הסתר ✕
                    </button>
                  </div>
                  {data.ai && (data.ai.summary || data.ai.recommendations || data.ai.silentTherapists || data.ai.marketing) ? (
                    <div className="space-y-2">
                      {(
                        [
                          ["📊 סיכום", data.ai.summary, true],
                          ["🎯 המלצות פעולה", data.ai.recommendations, true],
                          ["🔕 מטפלים שקטים", data.ai.silentTherapists, false],
                          ["📣 שיווק", data.ai.marketing, false],
                        ] as [string, string | null, boolean][]
                      )
                        .filter(([, txt]) => txt)
                        .map(([title, txt, openByDefault]) => (
                          <details key={title} open={openByDefault} className="rounded-xl border border-[#C2DFDE] bg-white p-3">
                            <summary className="cursor-pointer select-none text-sm font-bold text-[#2A6462]">{title}</summary>
                            <div className="mt-2">
                              <MarkdownText text={txt as string} />
                            </div>
                          </details>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">עדיין אין דוח שבועי עם תובנת AI. הדוח הבא יופק ביום ראשון.</p>
                  )}
                </div>
              )}
            </div>

            <p className="text-xs text-stone-400">עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}</p>
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
