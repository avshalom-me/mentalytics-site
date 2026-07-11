"use client";

import { useEffect, useState } from "react";

// PHASE 1 marketing/leads dashboard. Read-only: the latest weekly AI insight,
// four 30-day KPIs, and business-plan targets vs. what we can measure today.
// Mirrors the fetch/loading/error + brand styling of /admin/attribution.

type Ai = {
  summary: string | null;
  recommendations: string | null;
  silentTherapists: string | null;
  marketing: string | null;
  weekStart: string | null;
  weekEnd: string | null;
};

type Kpis = {
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
  kpis: Kpis;
  targets: Target[];
  generated_at: string;
};

const METRIC_LABELS: Record<string, string> = {
  therapists_total: "מטפלים רשומים",
  teachers_total: "מורים",
  questionnaires_month: "שאלונים בחודש",
  cpl_max: "עלות מקס׳ לליד (CPL)",
  lead_to_treatment_pct: "המרה ליד→טיפול (%)",
  churn_max_pct: "נטישה מקס׳ (%)",
  cac_max: "עלות מקס׳ לרכישה (CAC)",
};

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

// --- Markdown rendering: mirrors the local helper used in the weekly/monthly
// report pages (not an importable shared component in this codebase). ---
function formatTextWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    )
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

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
      <div className="text-3xl font-black text-[#2A6462]">{value}</div>
      <div className="mt-1 text-xs font-semibold text-stone-500">{label}</div>
      {sub && <div className="mt-1.5 text-xs">{sub}</div>}
    </div>
  );
}

function ContactsDelta({ contacts, prev }: { contacts: number; prev: number }) {
  if (prev === 0) {
    return contacts > 0 ? (
      <span className="font-bold text-green-700">חדש</span>
    ) : (
      <span className="text-stone-300">—</span>
    );
  }
  const pct = Math.round(((contacts - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className={`font-bold ${up ? "text-green-700" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(pct)}% מול 30 הימים הקודמים
    </span>
  );
}

// Pass/fail evaluation for a single plan target. Green = meeting; amber = close;
// red = far off; gray "טרם מחושב" when we can't measure the actual yet.
function evalTarget(t: Target): { label: string; cls: string } {
  if (t.actual == null) {
    return { label: "טרם מחושב", cls: "bg-stone-100 text-stone-500" };
  }
  if (t.direction === "ceiling") {
    if (t.actual <= t.target) return { label: "עומד ביעד", cls: "bg-green-100 text-green-700" };
    if (t.actual <= t.target * 1.2) return { label: "חורג מעט", cls: "bg-amber-100 text-amber-700" };
    return { label: "חורג", cls: "bg-red-100 text-red-700" };
  }
  if (t.actual >= t.target) return { label: "עומד ביעד", cls: "bg-green-100 text-green-700" };
  if (t.actual >= t.target * 0.8) return { label: "קרוב ליעד", cls: "bg-amber-100 text-amber-700" };
  return { label: "מתחת ליעד", cls: "bg-red-100 text-red-700" };
}

export default function MarketingPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-marketing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-black text-stone-900">שיווק ופניות</h1>
        <p className="mb-6 text-sm text-stone-500">
          תמונת מצב שיווקית — תובנת ה-AI מהדוח השבועי האחרון, מדדי 30 הימים האחרונים, ויעדי התוכנית העסקית מול הביצוע בפועל.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* AI insight panel */}
            <div className="mb-8 rounded-2xl border border-[#C2DFDE] bg-[#EAF4F3] p-5">
              <h2 className="mb-3 flex flex-wrap items-center gap-2 text-base font-black text-[#2A6462]">
                תובנת AI — הדוח השבועי האחרון
                {data.ai?.weekStart && data.ai?.weekEnd && (
                  <span className="text-xs font-semibold text-[#3D8C8A]">
                    שבוע {data.ai.weekStart} – {data.ai.weekEnd}
                  </span>
                )}
              </h2>
              {data.ai && (data.ai.summary || data.ai.recommendations) ? (
                <div className="space-y-4">
                  {data.ai.summary && (
                    <div>
                      <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-[#3D8C8A]">סיכום</h3>
                      <MarkdownText text={data.ai.summary} />
                    </div>
                  )}
                  {data.ai.recommendations && (
                    <div>
                      <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-[#3D8C8A]">המלצות פעולה</h3>
                      <MarkdownText text={data.ai.recommendations} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-500">
                  עדיין אין דוח שבועי עם תובנת AI. הדוח הראשון יופק ביום ראשון הקרוב.
                </p>
              )}
            </div>

            {/* KPI row */}
            <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="סה״כ פניות (30 ימים)"
                value={num(data.kpis.contacts)}
                sub={<ContactsDelta contacts={data.kpis.contacts} prev={data.kpis.contactsPrev} />}
              />
              <KpiCard
                label="שיעור המרה (צפייה→פנייה)"
                value={`${data.kpis.conversionPct.toFixed(1)}%`}
              />
              <KpiCard label={'"ניתוח אישי" (AI)'} value={num(data.kpis.explainClicks)} />
              <KpiCard label="צפיות פרופיל (30 ימים)" value={num(data.kpis.profileViews)} />
            </div>

            {/* Targets vs. actuals */}
            <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="mb-1 text-base font-black text-stone-800">יעדים מול ביצוע</h2>
              <p className="mb-4 text-xs text-stone-500">
                יעדי התוכנית העסקית. ביצוע בפועל מחושב היכן שהנתונים זמינים כיום — היתר מסומן &quot;טרם מחושב&quot;.
              </p>
              {data.targets.length === 0 ? (
                <p className="text-sm text-stone-400">אין יעדים מוגדרים.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="px-2 py-2 text-right font-semibold">מדד</th>
                      <th className="px-2 py-2 text-center font-semibold">חודש</th>
                      <th className="px-2 py-2 text-center font-semibold">תרחיש</th>
                      <th className="px-2 py-2 text-center font-semibold">יעד</th>
                      <th className="px-2 py-2 text-center font-semibold">בפועל</th>
                      <th className="px-2 py-2 text-center font-semibold">סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.targets.map((t) => {
                      const verdict = evalTarget(t);
                      return (
                        <tr key={t.id} className="border-b border-stone-100">
                          <td className="px-2 py-2.5 font-semibold text-stone-700">
                            {METRIC_LABELS[t.metric] ?? t.metric}
                          </td>
                          <td className="px-2 text-center text-stone-500">{formatMonth(t.month)}</td>
                          <td className="px-2 text-center text-stone-500">
                            {SCENARIO_LABELS[t.scenario] ?? t.scenario}
                          </td>
                          <td className="px-2 text-center text-stone-600">
                            <span className="text-stone-400">{t.direction === "ceiling" ? "≤ " : "≥ "}</span>
                            {num(t.target)}
                          </td>
                          <td className="px-2 text-center font-bold text-stone-900">
                            {t.actual == null ? "—" : num(t.actual)}
                          </td>
                          <td className="px-2 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${verdict.cls}`}>
                              {verdict.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <p className="text-xs text-stone-400">
              עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
