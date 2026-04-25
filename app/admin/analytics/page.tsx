"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

type Period = "week" | "month" | "all";
type Tab = "funnel" | "quiz" | "stats";

type Funnel = { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
type FilterEntry = { name: string; count: number };
type TrendEntry = { week: string; page_view: number; profile_impression: number; profile_view: number; contact_click: number };
type CTRRow = { id: string; full_name: string; status: string; impressions: number; profile_views: number; clicks: number; ctr: number };
type QuizStepRow = { step: string; count: number };
type QuizFunnel = { steps: QuizStepRow[]; started: number; completed: number };

type AnalyticsData = {
  funnel: Funnel;
  popularFilters: FilterEntry[];
  trends: TrendEntry[];
  therapistCTR: CTRRow[];
  quizDropout: { adults: QuizFunnel; kids: QuizFunnel };
  demographics: { byRegion: FilterEntry[]; byIssue: FilterEntry[]; byAgeBand: FilterEntry[]; byGender: FilterEntry[] };
  clickTypeBreakdown: Record<string, number>;
  generated_at: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 ימים" },
  { value: "month", label: "30 ימים" },
  { value: "all", label: "כל הזמנים" },
];

const TABS: { value: Tab; label: string }[] = [
  { value: "funnel", label: "Funnel דירקטוריה" },
  { value: "quiz", label: "נשירה מהשאלון" },
  { value: "stats", label: "סטטיסטיקות" },
];

const COLORS = ["#2e7d8c", "#1a3a5c", "#f59e0b", "#22c55e", "#9333ea", "#ef4444", "#6366f1", "#ec4899"];

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

// ── TAB 1: Funnel ──────────────────────────────────────────────────

function FunnelCards({ f }: { f: Funnel }) {
  const steps = [
    { label: "כניסות לדירקטוריה", value: f.pageViews, color: "bg-blue-50 border-blue-200 text-blue-800" },
    { label: "חשיפות כרטיס", value: f.impressions, color: "bg-purple-50 border-purple-200 text-purple-800" },
    { label: "צפיות בפרופיל", value: f.profileViews, color: "bg-amber-50 border-amber-200 text-amber-800" },
    { label: "יצירת קשר", value: f.contactClicks, color: "bg-green-50 border-green-200 text-green-800" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {steps.map((s, i) => (
        <div key={s.label} className="relative">
          <div className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <div className="text-3xl font-black">{s.value.toLocaleString("he-IL")}</div>
            <div className="text-xs font-semibold mt-1">{s.label}</div>
          </div>
          {i > 0 && steps[i - 1].value > 0 && (
            <div className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full bg-stone-800 text-white text-xs font-bold px-2 py-0.5">
              {pct(s.value, steps[i - 1].value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PopularFilters({ filters }: { filters: FilterEntry[] }) {
  if (filters.length === 0) return null;
  const max = filters[0]?.count ?? 1;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-4">פילטרים פופולריים</h2>
      <div className="space-y-2">
        {filters.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <span className="w-20 text-xs font-semibold text-stone-600 text-left shrink-0">{f.name}</span>
            <div className="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#2e7d8c] rounded-full flex items-center justify-end px-2"
                style={{ width: `${Math.max((f.count / max) * 100, 8)}%` }}>
                <span className="text-xs font-bold text-white">{f.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ trends }: { trends: TrendEntry[] }) {
  if (trends.length === 0) return null;
  const data = trends.map(t => ({ ...t, week: t.week.slice(5) }));
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-4">טרנד שבועי</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#78716c" }} />
          <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
          <Tooltip contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl" }} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Heebo" }} />
          <Line type="monotone" dataKey="page_view" stroke="#3b82f6" name="כניסות" strokeWidth={2} />
          <Line type="monotone" dataKey="profile_impression" stroke="#9333ea" name="חשיפות" strokeWidth={2} />
          <Line type="monotone" dataKey="profile_view" stroke="#f59e0b" name="צפיות" strokeWidth={2} />
          <Line type="monotone" dataKey="contact_click" stroke="#22c55e" name="קשר" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CTRTable({ rows }: { rows: CTRRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200">
        <h2 className="text-base font-black text-stone-800">חשיפות מול קליקים למטפל</h2>
      </div>
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs">#</th>
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs">שם מטפל</th>
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">חשיפות</th>
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">צפיות</th>
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">קליקים</th>
            <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">CTR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
              <td className="px-5 py-3 text-stone-400 text-xs">{i + 1}</td>
              <td className="px-5 py-3 font-semibold text-stone-800">
                {r.full_name}
                {r.status === "paying" && <span className="mr-2 rounded-full bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 text-xs text-yellow-800">★</span>}
              </td>
              <td className="px-5 py-3 text-center text-purple-600 font-bold">{r.impressions}</td>
              <td className="px-5 py-3 text-center text-amber-600 font-bold">{r.profile_views}</td>
              <td className="px-5 py-3 text-center text-green-600 font-bold">{r.clicks}</td>
              <td className="px-5 py-3 text-center">
                <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-black ${
                  r.ctr >= 10 ? "bg-green-100 text-green-800" : r.ctr >= 5 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"
                }`}>{r.ctr}%</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-stone-50 border-t-2 border-stone-200">
            <td className="px-5 py-3" colSpan={2}><span className="text-xs font-black text-stone-500">סה&quot;כ</span></td>
            <td className="px-5 py-3 text-center font-black text-purple-600">{rows.reduce((s, r) => s + r.impressions, 0)}</td>
            <td className="px-5 py-3 text-center font-black text-amber-600">{rows.reduce((s, r) => s + r.profile_views, 0)}</td>
            <td className="px-5 py-3 text-center font-black text-green-600">{rows.reduce((s, r) => s + r.clicks, 0)}</td>
            <td className="px-5 py-3 text-center">
              {(() => {
                const totalImp = rows.reduce((s, r) => s + r.impressions, 0);
                const totalClk = rows.reduce((s, r) => s + r.clicks, 0);
                return <span className="text-xs font-black text-stone-600">{totalImp > 0 ? `${Math.round((totalClk / totalImp) * 1000) / 10}%` : "—"}</span>;
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FunnelTab({ data }: { data: AnalyticsData }) {
  return (
    <>
      <FunnelCards f={data.funnel} />
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <PopularFilters filters={data.popularFilters} />
        <TrendChart trends={data.trends} />
      </div>
      <CTRTable rows={data.therapistCTR} />
    </>
  );
}

// ── TAB 2: Quiz Dropout ────────────────────────────────────────────

const ADULTS_GROUPS: Record<string, { label: string; steps: string[] }> = {
  intro:    { label: "פתיחה",         steps: ["disclaimer", "intake", "domains"] },
  e1:       { label: "E1 — דיכאון",   steps: ["e1", "e1-q"] },
  e2:       { label: "E2 — מאניה",    steps: ["e2", "e2-2", "e2-q"] },
  e3:       { label: "E3 — פסיכוזה",  steps: ["e3", "e3-q"] },
  e4:       { label: "E4 — חרדה",     steps: ["e4", "e4-chronic", "e4-medical", "e4-q", "e4-social", "e4-social-sev", "e4-flight", "e4-medanx", "e4-stresspain"] },
  e5:       { label: "E5 — OCD",      steps: ["e5", "e5-q"] },
  e6:       { label: "E6 — אכילה",    steps: ["e6", "e6-q"] },
  e7:       { label: "E7 — שינה",     steps: ["e7-q"] },
  e8:       { label: "E8 — סומטי",    steps: ["e8", "e8c", "e8d"] },
  e9:       { label: "E9 — טראומה",   steps: ["e9", "e9-q"] },
  e10:      { label: "E10 — אישיות",  steps: ["e10", "e10a", "e10b", "e10c"] },
  style:    { label: "סגנון טיפול",    steps: ["therapist-style"] },
  func:     { label: "תפקוד",         steps: ["f-vision", "f1", "f1-subs", "f1-adhd", "f1-ld", "f1-ld-q", "f2", "f2-q", "f3", "f3-type", "f3-a", "f3-b"] },
  relation: { label: "זוגיות / משפחה", steps: ["r-intake", "r1", "r1-scale", "r2-q", "r3", "r3-partner"] },
  addiction:{ label: "התמכרויות",      steps: ["a-types", "a-substances", "a-gaming", "a-porn-type", "a-porn-q", "a-sex-q", "a-gambling", "a-phone"] },
  end:      { label: "סיום",          steps: ["scoring"] },
};

const KIDS_GROUPS: Record<string, { label: string; steps: string[] }> = {
  intro:   { label: "פתיחה",      steps: ["p-consent", "p-demo", "p-areas"] },
  anxiety: { label: "חרדה",       steps: ["p-q1", "p-aq", "p-aq-grade", "p-q1-ga"] },
  mood:    { label: "מצב רוח",    steps: ["p-q2", "p-q2-grade"] },
  mania:   { label: "מאניה",      steps: ["p-q3", "p-mq", "p-mq-sui"] },
  addict:  { label: "התמכרות",    steps: ["p-q4", "p-q4-types", "p-q4-s", "p-q4-g", "p-q4-b", "p-q4-ctrl"] },
  ocd:     { label: "OCD",        steps: ["p-q5", "p-oq", "p-oq-grade"] },
  trauma:  { label: "טראומה",     steps: ["p-q6", "p-tq"] },
  psycho:  { label: "פסיכוזה",    steps: ["p-q7", "p-pq"] },
  eating:  { label: "אכילה",      steps: ["p-q8", "p-eq"] },
  behav:   { label: "התנהגות",    steps: ["p-q9", "p-bq"] },
  distress:{ label: "מצוקה כללית", steps: ["p-q10", "p-q10-par", "p-q10-grade"] },
  extra:   { label: "התפתחות",    steps: ["p-ga-traits", "p-acad", "p-dev-toilet", "p-dev-sensory", "p-beh", "p-soc"] },
  end:     { label: "תוצאות",     steps: ["p-result"] },
};

type GroupedStep = {
  groupKey: string;
  label: string;
  count: number;
  subSteps: QuizStepRow[];
};

function groupSteps(quiz: QuizFunnel, groups: Record<string, { label: string; steps: string[] }>): GroupedStep[] {
  const stepMap = new Map(quiz.steps.map(s => [s.step, s.count]));
  return Object.entries(groups).map(([groupKey, { label, steps }]) => {
    const subSteps = steps
      .map(step => ({ step, count: stepMap.get(step) ?? 0 }))
      .filter(s => s.count > 0);
    const count = subSteps.length > 0 ? Math.max(...subSteps.map(s => s.count)) : 0;
    return { groupKey, label, count, subSteps };
  }).filter(g => g.count > 0);
}

function QuizDropoutChart({
  quiz, title, groups,
}: {
  quiz: QuizFunnel;
  title: string;
  groups: Record<string, { label: string; steps: string[] }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (quiz.steps.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
        <h2 className="text-base font-black text-stone-800 mb-2">{title}</h2>
        <p className="text-sm text-stone-400">אין נתונים עדיין</p>
      </div>
    );
  }

  const grouped = groupSteps(quiz, groups);
  const max = quiz.started || 1;
  const completionRate = quiz.started > 0 ? Math.round((quiz.completed / quiz.started) * 100) : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-black text-stone-800">{title}</h2>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xl font-black text-blue-700">{quiz.started}</div>
            <div className="text-xs text-stone-500">התחילו</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-black text-green-700">{quiz.completed}</div>
            <div className="text-xs text-stone-500">סיימו</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-black ${completionRate >= 50 ? "text-green-700" : completionRate >= 25 ? "text-amber-700" : "text-red-700"}`}>
              {completionRate}%
            </div>
            <div className="text-xs text-stone-500">השלמה</div>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {grouped.map((g, i) => {
          const prevCount = i > 0 ? grouped[i - 1].count : max;
          const dropPct = prevCount > 0 ? Math.round(((prevCount - g.count) / prevCount) * 100) : 0;
          const isHighDrop = dropPct >= 20;
          const isOpen = expanded === g.groupKey;
          const hasSubSteps = g.subSteps.length > 1;

          return (
            <div key={g.groupKey}>
              <div
                className={`flex items-center gap-2 ${hasSubSteps ? "cursor-pointer" : ""}`}
                onClick={() => hasSubSteps && setExpanded(isOpen ? null : g.groupKey)}
              >
                <span className="w-28 text-xs font-semibold text-stone-700 text-right shrink-0 flex items-center gap-1">
                  {hasSubSteps && <span className="text-stone-400 text-[10px]">{isOpen ? "▼" : "◀"}</span>}
                  {g.label}
                </span>
                <div className="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full flex items-center justify-end px-2 transition-all ${isHighDrop ? "bg-red-400" : "bg-[#2e7d8c]"}`}
                    style={{ width: `${Math.max((g.count / max) * 100, 3)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{g.count}</span>
                  </div>
                </div>
                {i > 0 && dropPct > 0 && (
                  <span className={`text-xs font-bold shrink-0 w-12 text-left ${isHighDrop ? "text-red-600" : "text-stone-400"}`}>
                    -{dropPct}%
                  </span>
                )}
              </div>

              {isOpen && (
                <div className="mr-8 mt-1 mb-2 space-y-1 border-r-2 border-stone-200 pr-3">
                  {g.subSteps.map((s, si) => {
                    const subPrev = si > 0 ? g.subSteps[si - 1].count : g.subSteps[0].count;
                    const subDrop = si > 0 && subPrev > 0 ? Math.round(((subPrev - s.count) / subPrev) * 100) : 0;
                    return (
                      <div key={s.step} className="flex items-center gap-2">
                        <span className="w-24 text-[11px] font-mono text-stone-400 text-left shrink-0 truncate" title={s.step}>
                          {s.step}
                        </span>
                        <div className="flex-1 h-4 bg-stone-50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full flex items-center justify-end px-1.5 ${subDrop >= 15 ? "bg-red-300" : "bg-[#2e7d8c]/60"}`}
                            style={{ width: `${Math.max((s.count / max) * 100, 2)}%` }}
                          >
                            <span className="text-[10px] font-bold text-white">{s.count}</span>
                          </div>
                        </div>
                        {si > 0 && subDrop > 0 && (
                          <span className={`text-[10px] font-bold w-10 text-left ${subDrop >= 15 ? "text-red-500" : "text-stone-300"}`}>
                            -{subDrop}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuizTab({ data }: { data: AnalyticsData }) {
  return (
    <>
      <QuizDropoutChart quiz={data.quizDropout.adults} title="שאלון מבוגרים — נשירה לפי שלב" groups={ADULTS_GROUPS} />
      <QuizDropoutChart quiz={data.quizDropout.kids} title="שאלון ילדים — נשירה לפי שלב" groups={KIDS_GROUPS} />
    </>
  );
}

// ── TAB 3: Stats (Demographics + Breakdown) ────────────────────────

function HorizontalBars({ title, data, color }: { title: string; data: FilterEntry[]; color: string }) {
  if (data.length === 0) return null;
  const max = data[0]?.count ?? 1;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-black text-stone-800 mb-3">{title}</h3>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-16 text-xs font-semibold text-stone-600 text-left shrink-0">{d.name}</span>
            <div className="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full flex items-center justify-end px-2"
                style={{ width: `${Math.max((d.count / max) * 100, 8)}%`, background: color }}>
                <span className="text-xs font-bold text-white">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ title, data }: { title: string; data: FilterEntry[] }) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-black text-stone-800 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => [`${value} (${Math.round((Number(value) / total) * 100)}%)`, ""]}
            contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl" }} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Heebo" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ClickBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const labels: Record<string, string> = { whatsapp: "וואטסאפ", phone: "טלפון", email: "מייל" };
  const colors: Record<string, string> = { whatsapp: "bg-green-500", phone: "bg-stone-700", email: "bg-blue-500" };
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="text-sm font-black text-stone-800 mb-3">התפלגות ערוצי קשר</h3>
      <div className="flex gap-4 items-end justify-center">
        {Object.entries(breakdown).map(([type, count]) => (
          <div key={type} className="text-center">
            <div className={`mx-auto rounded-xl ${colors[type] ?? "bg-stone-400"} text-white font-black text-lg px-4 py-3`}>
              {count}
            </div>
            <div className="text-xs text-stone-600 mt-1 font-semibold">{labels[type] ?? type}</div>
            <div className="text-xs text-stone-400">{pct(count, total)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsTab({ data }: { data: AnalyticsData }) {
  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-black text-stone-800">פילוח צפיות לפי פרמטרים</h2>
        <p className="text-xs text-stone-400">נתונים מתוך צפיות בפרופיל מטפל (מערכת התאמה + דירקטוריה)</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <HorizontalBars title="לפי אזור" data={data.demographics.byRegion} color="#2e7d8c" />
        <HorizontalBars title="לפי נושא" data={data.demographics.byIssue} color="#1a3a5c" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <DonutChart title="לפי קבוצת גיל" data={data.demographics.byAgeBand} />
        <DonutChart title="לפי מגדר" data={data.demographics.byGender} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <ClickBreakdown breakdown={data.clickTypeBreakdown} />
        <PopularFilters filters={data.popularFilters} />
      </div>
    </>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [tab, setTab] = useState<Tab>("funnel");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-analytics?period=${period}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setData({
            funnel: json.funnel,
            popularFilters: json.popularFilters,
            trends: json.trends,
            therapistCTR: json.therapistCTR,
            quizDropout: json.quizDropout,
            demographics: json.demographics,
            clickTypeBreakdown: json.clickTypeBreakdown,
            generated_at: json.generated_at,
          });
        } else {
          setError(json.error ?? "שגיאה לא ידועה");
        }
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-stone-900">אנליטיקס</h1>
        <p className="text-xs text-stone-400 mt-1">דשבורד מרכזי — funnel, נשירה, סטטיסטיקות</p>
      </div>

      {/* Period + Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-600">תקופה:</span>
          <div className="flex rounded-xl border border-stone-200 overflow-hidden text-sm font-semibold">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 transition-colors ${period === p.value ? "bg-[#0F5468] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {loading && <span className="text-xs text-stone-400 animate-pulse">טוען...</span>}
      </div>

      {/* Tabs */}
      <div className="mb-8 flex rounded-xl border border-stone-200 overflow-hidden text-sm font-semibold">
        {TABS.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`flex-1 px-4 py-2.5 transition-colors ${tab === t.value ? "bg-stone-800 text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 mb-6">
          <p className="font-bold mb-1">שגיאה: {error}</p>
          <p className="text-xs text-red-500">ייתכן שטבלת analytics_events עדיין לא נוצרה ב-Supabase.</p>
        </div>
      )}

      {!loading && data && (
        <>
          {tab === "funnel" && <FunnelTab data={data} />}
          {tab === "quiz" && <QuizTab data={data} />}
          {tab === "stats" && <StatsTab data={data} />}

          {data.generated_at && (
            <p className="text-xs text-stone-400 mt-6 text-left">
              עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}
            </p>
          )}
        </>
      )}
    </main>
  );
}
