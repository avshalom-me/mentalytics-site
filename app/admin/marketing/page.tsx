"use client";

import { useEffect, useState, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
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
  /** מקודמים דרך מנוי של מרכז - הכנסה, לא מתנה. הופרד מ-trial ב-21/8/2026. */
  center: number;
  trial: number;
  free: number;
  listed: number;
  paying: number;
  revenueBearing: number;
  pendingNamed: number;
  incomplete: number;
};

type CenterTherapistRow = {
  id: string;
  name: string;
  is_entity: boolean;
  views30: number;
  contacts30: number;
  daysSinceContact: number | null;
};
type CenterRow = {
  id: string;
  name: string;
  track: string;
  status: string | null;
  seats: number | null;
  monthly: number | null;
  promoted: number;
  views30: number;
  contacts30: number;
  starving: number;
  tooNew: number;
  therapists: CenterTherapistRow[];
};
type CentersBlock = {
  centers: CenterRow[];
  totals: { centers: number; promoted: number; views30: number; contacts30: number; starving: number; monthly: number } | null;
};

type Churn = { everPaid: number; active: number; churned: number; pct: number | null };

type StarvingRow = { id: string; name: string; tier: "paid" | "center" | "trial"; views30: number; daysSinceContact: number | null };
type Coverage = {
  paidTotal: number;
  centerTotal: number;
  trialTotal: number;
  periods: Record<string, { paid: number; center: number; trial: number; paidAds: number; centerAds: number; trialAds: number }>;
  starving: StarvingRow[];
  tooNew?: number;
};

type Data = {
  ai: Ai | null;
  kpis: Record<string, PeriodKpis>;
  targets: Target[];
  supply: Supply;
  centers?: CentersBlock;
  churn: Churn;
  coverage: Coverage | null;
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

// THE goal metric: does every paying (then promoted) therapist get inquiries?
// A coverage chip per tier for the selected period, plus the 30-day "starving"
// list — who to act on (promote harder / point campaigns at their region).
function CoverageChip({ label, covered, total, fromAds }: { label: string; covered: number; total: number; fromAds: number }) {
  const ratio = total > 0 ? covered / total : 1;
  const cls =
    ratio >= 1 ? "bg-green-100 text-green-800 border-green-200"
    : ratio >= 0.5 ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-red-100 text-red-700 border-red-200";
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-center ${cls}`}>
      <div className="text-2xl font-black leading-tight">
        {num(covered)}<span className="text-sm font-bold opacity-60"> / {num(total)}</span>
      </div>
      <div className="text-xs font-semibold">{label}</div>
      <div className="mt-1.5 border-t border-black/10 pt-1 text-[11px] font-semibold opacity-75">
        מתוכם {num(fromAds)} מגוגל אדס
      </div>
    </div>
  );
}

// רובריקת המרכזים הטיפוליים - נפרדת לגמרי מ"מקודמים במתנה".
//
// למה נפרדת: מרכז הוא **לקוח משלם**. עד 21/8/2026 מטפליו נספרו כמקודמי
// מתנה (הסינון היה "כל מי שאינו paid"), ולכן מרכז ששילם הוצג כמי שקיבל
// חשיפה חינם - וגם מדד כיסוי הפניות של הלקוחות המשלמים יצא נמוך מהאמת.
//
// שתי רמות: שורה מסכמת לכל מכון, ופירוט מטפליו בלחיצה - כי לשאלה "מה
// המכון מקבל" יש שתי תשובות שונות: הסך הכולל, ומי בתוכו מייצר ומי שקוף.
function CentersPanel({ b }: { b: CentersBlock }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!b?.totals || b.centers.length === 0) return null;
  const t = b.totals;
  return (
    <div className="mb-5 rounded-2xl border-2 border-indigo-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">🏢 מרכזים טיפוליים</h2>
        <span className="text-xs text-stone-400">לקוחות משלמים - נספרים בנפרד ממקודמי מתנה</span>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        {num(t.centers)} מרכזים · {num(t.promoted)} מטפלים מקודמים דרכם
        {t.monthly > 0 && <> · ₪{num(Math.round(t.monthly))} לחודש</>}
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5">
          <div className="text-xl font-black text-indigo-900">{num(t.views30)}</div>
          <div className="text-xs font-semibold text-stone-600">צפיות פרופיל (30 י׳)</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-2.5">
          <div className="text-xl font-black text-indigo-900">{num(t.contacts30)}</div>
          <div className="text-xs font-semibold text-stone-600">לחיצות ליצירת קשר (30 י׳)</div>
        </div>
        <div className={`rounded-xl border px-4 py-2.5 ${t.starving > 0 ? "border-red-200 bg-red-50/60" : "border-stone-200 bg-stone-50"}`}>
          <div className={`text-xl font-black ${t.starving > 0 ? "text-red-700" : "text-stone-500"}`}>{num(t.starving)}</div>
          <div className="text-xs font-semibold text-stone-600">ללא פנייה מעל 30 יום</div>
          <div className="text-[10px] text-stone-400">מי שקודם החודש אינו נספר</div>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-500">
            <th className="px-2 py-1.5 text-right font-semibold">מרכז</th>
            <th className="px-2 py-1.5 text-center font-semibold">מסלול</th>
            <th className="px-2 py-1.5 text-center font-semibold">מקודמים</th>
            <th className="px-2 py-1.5 text-center font-semibold">צפיות 30 י׳</th>
            <th className="px-2 py-1.5 text-center font-semibold">פניות 30 י׳</th>
            <th className="px-2 py-1.5 text-center font-semibold">שקטים</th>
          </tr>
        </thead>
        <tbody>
          {b.centers.map((c) => (
            <Fragment key={c.id}>
              <tr
                className="cursor-pointer border-b border-stone-100 hover:bg-stone-50"
                onClick={() => setOpen(open === c.id ? null : c.id)}
              >
                <td className="px-2 py-1.5 font-bold text-stone-800">
                  <span className="text-stone-400">{open === c.id ? "▾ " : "▸ "}</span>{c.name}
                </td>
                <td className="px-2 py-1.5 text-center text-xs text-stone-500">
                  {c.track === "center_entity" ? "ישות אחת" : `לפי מטפלים${c.seats ? ` (${c.seats})` : ""}`}
                </td>
                <td className="px-2 py-1.5 text-center text-stone-700">{num(c.promoted)}</td>
                <td className="px-2 py-1.5 text-center text-stone-700">{num(c.views30)}</td>
                <td className="px-2 py-1.5 text-center font-bold text-stone-900">{num(c.contacts30)}</td>
                <td className={`px-2 py-1.5 text-center font-bold ${c.starving > 0 ? "text-red-600" : "text-stone-300"}`}>
                  {c.starving > 0 ? num(c.starving) : "—"}
                  {c.tooNew > 0 && <span className="ms-1 text-[10px] font-semibold text-stone-400">({num(c.tooNew)} חדשים)</span>}
                </td>
              </tr>
              {open === c.id && (
                <tr className="border-b border-stone-100 bg-stone-50">
                  <td colSpan={6} className="px-3 py-2">
                    {c.therapists.length === 0 ? (
                      <span className="text-xs text-stone-400">אין מטפלים מקודמים</span>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-stone-400">
                            <th className="py-1 text-right font-semibold">מטפל/ת</th>
                            <th className="py-1 text-center font-semibold">צפיות 30 י׳</th>
                            <th className="py-1 text-center font-semibold">פניות 30 י׳</th>
                            <th className="py-1 text-center font-semibold">פנייה אחרונה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {c.therapists.map((x) => (
                            <tr key={x.id} className="border-t border-stone-200/70">
                              <td className="py-1 text-stone-700">{x.is_entity ? "🏢 " : ""}{x.name}</td>
                              <td className="py-1 text-center text-stone-600">{num(x.views30)}</td>
                              <td className="py-1 text-center font-bold text-stone-800">{num(x.contacts30)}</td>
                              <td className="py-1 text-center text-stone-500">
                                {x.daysSinceContact === null
                                  ? <span className="font-bold text-red-600">מעולם לא</span>
                                  : `לפני ${num(x.daysSinceContact)} ימים`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-stone-400">
        לניהול המרכזים עצמם (תמחור, מנוי, שיוך מטפלים) - <a href="/admin/centers" className="font-semibold text-[#3D8C8A] hover:underline">עמוד המרכזים</a>.
      </p>
    </div>
  );
}

function CoveragePanel({ c, periodKey, periodLabel }: { c: Coverage; periodKey: string; periodLabel: string }) {
  const p = c.periods[periodKey] ?? { paid: 0, center: 0, trial: 0, paidAds: 0, centerAds: 0, trialAds: 0 };
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? c.starving : c.starving.slice(0, 6);
  return (
    <div className="mb-5 rounded-2xl border-2 border-[#C2DFDE] bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-800">🎯 כיסוי פניות — מטפלים בתשלום</h2>
        <span className="text-xs text-stone-400">המדד המרכזי: שכל מטפל משלם יקבל פניות</span>
      </div>
      <p className="mb-3 text-xs text-stone-500">כמה מהמטפלים המוצגים קיבלו לפחות פנייה אחת ({periodLabel} אחרונים).</p>
      <div className="mb-4 flex flex-wrap gap-2">
        <CoverageChip label={`בתשלום · קיבלו פנייה ב${periodLabel}`} covered={p.paid} total={c.paidTotal} fromAds={p.paidAds} />
        {/* מרכזים בשבב נפרד: עד 21/8/2026 הם נספרו בתוך "מתנה", ולכן מרכז
            משלם הוצג כמי שקיבל חשיפה חינם - וכיסוי הפניות של הלקוחות
            המשלמים נראה גרוע ממה שהוא. */}
        <CoverageChip label={`מטפלי מרכזים · קיבלו פנייה ב${periodLabel}`} covered={p.center} total={c.centerTotal} fromAds={p.centerAds} />
        <CoverageChip label={`מקודמים (מתנה) · קיבלו פנייה ב${periodLabel}`} covered={p.trial} total={c.trialTotal} fromAds={p.trialAds} />
      </div>
      {c.starving.length > 0 ? (
        <>
          <div className="mb-1.5 text-xs font-black text-stone-600">
            ללא פנייה מעל 30 יום ({num(c.starving.length)}) — כאן צריך לפעול:
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="px-2 py-1.5 text-right font-semibold">מטפל/ת</th>
                <th className="px-2 py-1.5 text-center font-semibold">מסלול</th>
                <th className="px-2 py-1.5 text-center font-semibold">צפיות פרופיל (30 י׳)</th>
                <th className="px-2 py-1.5 text-center font-semibold">פנייה אחרונה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-stone-100">
                  <td className="px-2 py-1.5 font-semibold text-stone-700">{s.name}</td>
                  <td className="px-2 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      s.tier === "paid" ? "bg-[#FDF6E3] text-[#A87010] border border-[#D49018]/30"
                        : s.tier === "center" ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                        : "bg-[#EAF4F3] text-[#2A6462]"
                    }`}>
                      {s.tier === "paid" ? "בתשלום" : s.tier === "center" ? "מרכז" : "מתנה"}
                    </span>
                  </td>
                  {/* Low views → an exposure problem (region/profile); decent views with
                      no contacts → a conversion problem (photo/bio/pricing). */}
                  <td className="px-2 text-center text-stone-600">{num(s.views30)}</td>
                  <td className="px-2 text-center text-stone-500">
                    {s.daysSinceContact == null ? (
                      <span className="font-bold text-red-600">אף פעם</span>
                    ) : (
                      `לפני ${num(s.daysSinceContact)} ימים`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.starving.length > 6 && (
            <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-[#3D8C8A] hover:underline">
              {showAll ? "הצג פחות ▴" : `הצג את כל ${num(c.starving.length)} ▾`}
            </button>
          )}
          <p className="mt-2 text-[11px] text-stone-400">
            צפיות נמוכות = בעיית חשיפה (אזור/קידום) · צפיות תקינות בלי פניות = בעיית המרה בפרופיל (תמונה/תיאור).
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold text-green-700">🎉 כל המטפלים בתשלום קיבלו פנייה ב-30 הימים האחרונים.</p>
      )}
    </div>
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
type TierExposure = { therapists: number; impressions: number; profileViews: number; contactClicks: number };
type ExposureByTier = { paying: TierExposure; free: TierExposure };
type AcqRow = {
  key: string;
  label: string;
  pageViews: number;
  contactClicks: number;
  viewToClick: number;
  shareOfClicks: number;
};

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

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Daily Google Ads spend. Replaces the old 48px label-less bar strip (thin bars,
// value only on hover, no axes/dates) with a proper charted view: ₪ y-axis,
// dated x-axis, gridlines, an interactive tooltip, the peak day highlighted, and
// an avg/peak summary line.
function DailySpendChart({ data }: { data: { date: string; cost: number }[] }) {
  if (!data || data.length < 2) return null;
  const rows = data.map((d) => ({ ...d, label: dayLabel(d.date), costR: Math.round(d.cost) }));
  const total = rows.reduce((s, d) => s + d.cost, 0);
  const avg = total / rows.length;
  const peak = rows.reduce((m, d) => (d.cost > m.cost ? d : m), rows[0]);
  // Cap x-axis labels to ~7 so 30-day ranges stay readable.
  const interval = Math.max(0, Math.ceil(rows.length / 7) - 1);
  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-black text-stone-700">הוצאה יומית</p>
        <p className="text-xs text-stone-500">
          ממוצע <span className="font-bold text-stone-700">₪{num(Math.round(avg))}</span>/יום · שיא{" "}
          <span className="font-bold text-stone-700">₪{num(peak.costR)}</span> ב-{peak.label}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
          <XAxis
            dataKey="label"
            interval={interval}
            tick={{ fontSize: 10, fill: "#78716c" }}
            tickLine={false}
            axisLine={{ stroke: "#e7e5e4" }}
          />
          <YAxis
            tickFormatter={(v) => `₪${v}`}
            tick={{ fontSize: 10, fill: "#78716c" }}
            width={48}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(61,140,138,0.08)" }}
            formatter={(v) => [`₪${num(Math.round(Number(v)))}`, "הוצאה"]}
            labelFormatter={(l) => `יום ${l}`}
            contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl", borderRadius: 12, border: "1px solid #e7e5e4" }}
          />
          <Bar dataKey="cost" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false}>
            {rows.map((d) => (
              <Cell key={d.date} fill={d.date === peak.date ? "#D49018" : "#3D8C8A"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CLICK_TYPE_LABELS: Record<string, string> = {
  whatsapp: "💬 וואטסאפ",
  phone: "📞 טלפון",
  email: "✉️ מייל",
  site_message: "📝 הודעה באתר",
};

function FunnelCard({
  eyebrow,
  title,
  steps,
  headline,
  note,
  clickTypes,
}: {
  eyebrow: string;
  title: string;
  steps: { label: string; value: number; color: string }[];
  headline: number;
  note?: string;
  clickTypes?: Record<string, number>;
}) {
  const clickEntries = Object.entries(clickTypes ?? {}).filter(([, n]) => n > 0);
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
      {clickEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clickEntries.map(([type, n]) => (
            <span key={type} className="rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-xs text-stone-600">
              {CLICK_TYPE_LABELS[type] ?? type} <b className="text-stone-900">{num(n)}</b>
            </span>
          ))}
        </div>
      )}
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
  quiz_completed: number;
  viewed_profile: number;
  contacts: number;
  contacting_people: number;
  whatsapp: number;
  phone: number;
  email: number;
  site_message: number;
  from_match: number;
  from_directory: number;
  /** Contacts clicked on the therapist's profile page (source added 29/7/26). */
  from_profile?: number;
};
type RecruitRow = { campaign: string; signups: number };

function FunnelsCampaigns() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [channels, setChannels] = useState<AttrChannel[] | null>(null);
  const [acquisition, setAcquisition] = useState<AcqRow[] | null>(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [campaigns, setCampaigns] = useState<{ campaign: string; contactClicks: number }[] | null>(null);
  const [funnel, setFunnel] = useState<{ directory: FunnelSrc; match: FunnelSrc } | null>(null);
  const [clickTypes, setClickTypes] = useState<{ directory: Record<string, number>; match: Record<string, number> } | null>(null);
  const [exposure, setExposure] = useState<ExposureByTier | null>(null);
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
        setAcquisition(a.acquisition ?? []);
        setTotalContacts(a.totals?.contactClicks ?? 0);
        setCampaigns(a.topCampaigns ?? []);
        setFunnel(an.funnelBySource ?? null);
        setClickTypes(an.clickTypeBySource ?? null);
        setExposure(an.exposureByTier ?? null);
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
                clickTypes={clickTypes?.directory}
                note="במאגר אפשר לפנות גם ישירות מהכרטיס — בלי כניסה לפרופיל."
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
                clickTypes={clickTypes?.match}
                note={`${num(funnel.match.impressions)} כרטיסי מטפל הוצגו בהתאמות`}
              />
            </div>
          )}
          {!funnel && <p className="mb-5 text-sm text-stone-400">אין נתוני משפך לטווח זה.</p>}

          {/* Exposure fairness: paying+promoted share of exposure vs their share of supply.
              The promotion promise is a bigger stage — this is its scoreboard. */}
          {exposure &&
            (() => {
              const p = exposure.paying;
              const f = exposure.free;
              const share = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);
              const supplyShare = share(p.therapists, f.therapists);
              const rows = [
                { label: "חשיפות", v: share(p.impressions, f.impressions) },
                { label: "צפיות פרופיל", v: share(p.profileViews, f.profileViews) },
                { label: "פניות", v: share(p.contactClicks, f.contactClicks) },
              ];
              const working = rows[0].v >= supplyShare;
              return (
                <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-5">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-black text-stone-800">האם המשלמים מקבלים את הבמה?</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${working ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {working ? "הקידום עובד" : "⚠ חשיפת המשלמים נמוכה מחלקם"}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-stone-500">
                    מטפלים בתשלום ומקודמים הם <b>{supplyShare}%</b> מההיצע המוצג ({num(p.therapists)} מתוך{" "}
                    {num(p.therapists + f.therapists)}) — כמה מהחשיפה הם מקבלים בטווח שנבחר:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {rows.map((r) => (
                      <div key={r.label} className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-center">
                        <div className={`text-2xl font-black ${r.v >= supplyShare ? "text-[#2A6462]" : "text-red-600"}`}>{r.v}%</div>
                        <div className="mt-0.5 text-xs font-semibold text-stone-600">{r.label}</div>
                        <div className="text-[10px] text-stone-400">מתוך כלל {r.label === "פניות" ? "הפניות" : r.label === "חשיפות" ? "החשיפות" : "הצפיות"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* Per-campaign funnel: billed clicks -> site sessions -> profile view -> contact (by type + source) */}
          {campFunnel && campFunnel.some((r) => r.campaign.startsWith("g-")) && (
            <div className="mb-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5">
              <h3 className="mb-1 text-base font-black text-stone-800">משפך לפי קמפיין ממומן</h3>
              <p className="mb-3 text-xs text-stone-500">
                מה עשו מי שהגיעו מכל קמפיין: קליקים בגוגל ← כניסות לאתר ← מילאו שאלון ← צפו בפרופיל ← פנו (לפי סוג ומקור).
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="px-2 py-2 text-right font-semibold">קמפיין</th>
                    <th className="px-2 py-2 text-center font-semibold">קליקים (גוגל)</th>
                    <th className="px-2 py-2 text-center font-semibold">כניסות לאתר</th>
                    <th className="px-2 py-2 text-center font-semibold">מילאו שאלון</th>
                    <th className="px-2 py-2 text-center font-semibold">צפו בפרופיל</th>
                    <th className="px-2 py-2 text-center font-semibold">פנו (אנשים)</th>
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
                      // Billed clicks from Google Ads = the REAL top-of-funnel. Site
                      // "sessions" over-counts (bots + our own setup/test loads that
                      // hit the tagged URL), so conversion is measured against billed
                      // clicks when available, falling back to sessions only if the
                      // Ads API is absent.
                      const billed =
                        ads?.ok && ads.configured
                          ? ads.campaigns?.find((a) => a.utmCampaign === r.campaign)?.clicks
                          : undefined;
                      const denom = billed && billed > 0 ? billed : r.sessions;
                      // Conversion is measured in PEOPLE, not clicks — one
                      // enthusiastic visitor tapping whatsapp+phone 5 times is
                      // one lead (learned the hard way 20/7: 22 click-events
                      // that were really 2-4 people read as a paid-ads boom).
                      const conv = denom > 0 ? Math.round((r.contacting_people / denom) * 1000) / 10 : 0;
                      return (
                        <tr key={r.campaign} className="border-b border-stone-100">
                          <td className="px-2 py-2 font-semibold text-stone-700">{r.campaign}</td>
                          <td className="px-2 text-center font-bold text-stone-900">
                            {billed != null ? num(billed) : "—"}
                          </td>
                          <td className="px-2 text-center text-stone-400">{num(r.sessions)}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.quiz_completed)}</td>
                          <td className="px-2 text-center text-stone-600">{num(r.viewed_profile)}</td>
                          <td className="px-2 py-1 text-center">
                            <div className="font-bold text-stone-900">
                              {num(r.contacting_people)}
                              {/* conv = contacting PEOPLE ÷ billed clicks; hide when >100% */}
                              {r.contacting_people > 0 && conv <= 100 && (
                                <span className="font-normal text-stone-400"> · {conv}%</span>
                              )}
                            </div>
                            {r.contacts > 0 && (
                              <div className="text-[10px] text-stone-400">
                                {r.contacts} לחיצות · 🎯 {r.from_match} · 📁 {r.from_directory}
                                {(r.from_profile ?? 0) > 0 && <> · 👤 {r.from_profile}</>}
                              </div>
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
              <p className="mt-2 text-[11px] leading-5 text-stone-400">
                💬 וואטסאפ · 📞 טלפון · ✉️ מייל · 📝 טופס-אתר · 🎯 מהתאמות · 📁 ממאגר המטפלים · 👤 מדף הפרופיל.{" "}
                <span className="font-semibold text-stone-500">פנו (אנשים)</span> = בני אדם ייחודיים שיצרו קשר — מבקר
                שלחץ וואטסאפ+טלפון כמה פעמים נספר פעם אחת (מספר הלחיצות מוצג מתחת).{" "}
                <span className="font-semibold text-stone-500">קליקים (גוגל)</span> = לחיצות בתשלום בפועל — המספר האמיתי.{" "}
                <span className="font-semibold text-stone-500">כניסות לאתר</span> = ביקורים (sessions) שהשאירו פעילות
                מתועדת כלשהי עם תיוג הקמפיין — מכל עמוד נחיתה, כולל בוטים ובדיקות — ולכן גבוהות מהקליקים; אחוז ההמרה
                מחושב באנשים מול הקליקים בפועל. הכל לפי utm_campaign.
              </p>
            </div>
          )}

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5 lg:col-span-2">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h3 className="text-base font-black text-stone-800">פניות לפי מנוע רכישה</h3>
                <a href="/admin/attribution" className="text-xs font-semibold text-[#3D8C8A] hover:underline">
                  ניתוח מלא ←
                </a>
              </div>
              {/* Summary only, in the same three-lever vocabulary the canonical
                  page uses - the per-channel breakdown, referring sites and
                  efficiency all live on /admin/attribution. Keeping the tables
                  identical in two places is what made the admin confusing. */}
              {acquisition && acquisition.some((a) => a.contactClicks > 0) ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="px-2 py-2 text-right font-semibold">מנוע</th>
                      <th className="px-2 py-2 text-center font-semibold">פניות</th>
                      <th className="px-2 py-2 text-center font-semibold">תרומה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acquisition
                      .filter((a) => a.contactClicks > 0)
                      .map((a) => (
                        <tr key={a.key} className="border-b border-stone-100">
                          <td className="px-2 py-2 font-semibold text-stone-700">{a.label}</td>
                          <td className="px-2 text-center font-bold text-stone-900">{num(a.contactClicks)}</td>
                          <td className="px-2 text-center text-stone-500">{a.shareOfClicks}%</td>
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
                  {ads.byDay && ads.byDay.length > 1 && <DailySpendChart data={ads.byDay} />}
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
                      <td className="px-2 py-2 font-semibold text-stone-700">
                        {c.campaign}
                        {/* Recruitment campaigns (therapist-*) target THERAPISTS; a patient
                            contact attributed to one means a recruitment visitor browsed
                            the patient site. Tag it so it isn't read as a patient campaign. */}
                        {c.campaign.startsWith("therapist") && (
                          <span className="mr-1.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                            קמפיין גיוס
                          </span>
                        )}
                      </td>
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
              {/* "כל המטפלים" במפורש: המספר סופר גם חינמיים וגם מרכזים, בעוד
                  פאנל הכיסוי שמתחתיו סופר משלמים בלבד - בלי התיוג שני המספרים
                  נראים כסתירה (נשאל בפועל, 19/8/26: "לאן הלכו שאר הפניות?"). */}
              <KpiCard
                label={`סה״כ פניות - כל המטפלים (${periodLabel})`}
                value={num(k.contacts)}
                sub={<Delta cur={k.contacts} prev={k.contactsPrev} unit={periodLabel === "יומיים" ? "היומיים" : "טווח"} />}
              />
              <KpiCard label="שיעור המרה (צפייה→פנייה)" value={`${k.conversionPct.toFixed(1)}%`} />
              <KpiCard label={'"ניתוח אישי" (AI)'} value={num(k.explainClicks)} />
              <KpiCard label="צפיות פרופיל" value={num(k.profileViews)} />
            </div>

            {/* Contact coverage of paying therapists — the core goal */}
            {data.coverage && <CoveragePanel c={data.coverage} periodKey={period} periodLabel={periodLabel} />}
            {data.centers && <CentersPanel b={data.centers} />}

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
                                  מתוכם {num(data.supply.paid)} בתשלום, {num(data.supply.center)} דרך מרכזים,{" "}
                                  {num(data.supply.trial)} מקודמים במתנה, {num(data.supply.free)} חינמיים. ({num(data.supply.incomplete)} הרשמות לא-גמורות לא נספרות.)
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
