"use client";

import { useEffect, useState, Fragment } from "react";

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

type Data = {
  ai: Ai | null;
  kpis: Record<string, PeriodKpis>;
  targets: Target[];
  payingTherapists: number;
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
    label: "מטפלים רשומים",
    explain:
      "סך המטפלים הרשומים בפלטפורמה (כל הסטטוסים) — ראש משפך ההיצע. בפועל מחושב מספר כל המטפלים במערכת.",
  },
  questionnaires_month: {
    label: "שאלונים בחודש",
    explain: "כמה שאלוני התאמה הושלמו החודש — ראש המשפך של מסלול השאלון. טרם מחובר למדידה אוטומטית כאן.",
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
      "אחוז המטפלים המשלמים שנוטשים בחודש — מדד בריאות מרכזי. תקרה שיורדת עם הזמן. עדיין לא מחושב — אפשר לגזור מתשלומים שנכשלו/מנויים שפגו.",
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

export default function MarketingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("d7");
  const [showAi, setShowAi] = useState(false);
  const [openMetric, setOpenMetric] = useState<string | null>(null);

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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-stone-900">שיווק ופניות</h1>
            <p className="mt-1 text-sm text-stone-500">תמונת מצב שיווקית — מדדים, יעדים, ותובנת AI לפי דרישה.</p>
          </div>
          {/* Period toggle */}
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
                            {num(t.target)}
                          </td>
                          <td className="px-2 text-center font-bold text-stone-900">{t.actual == null ? "—" : num(t.actual)}</td>
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
                                  מתוכם {num(data.payingTherapists)} משלמים ומאושרים.
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
      </div>
    </div>
  );
}
