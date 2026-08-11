"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

type Period = "week" | "month" | "all";
type Tab = "funnel" | "quiz" | "stats" | "explain" | "therapists";

type Funnel = { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
type FunnelBySource = { directory: Funnel; match: Funnel };
type FilterEntry = { name: string; count: number };
type TrendEntry = {
  week: string;
  page_view: number; profile_impression: number; profile_view: number; contact_click: number;
  /** השבוע הנוכחי - דלי שעדיין מתמלא; מצויר כנקודות מנותקות ולא כהמשך הקו */
  partial?: boolean; partial_days?: number;
};
type CTRCell = { impressions: number; profile_views: number; clicks: number; ctr: number };
type CTRRow = { id: string; full_name: string; status: string; all: CTRCell; directory: CTRCell; match: CTRCell };
type QuizStepRow = { step: string; count: number };
type QuizFunnel = { steps: QuizStepRow[]; started: number; completed: number };
type ExplainAnalytics = {
  total: number;
  byQuestionnaireType: FilterEntry[];
  byTreatment: FilterEntry[];
  byAgeBand: FilterEntry[];
  byGender: FilterEntry[];
  byRegion: FilterEntry[];
  byDomain: FilterEntry[];
};
type TherapistBreakdowns = {
  total: number;
  paid: number;
  gifted: number;
  free: number;
  withPhoto: number;
  acceptingNew: number;
  onlineCount: number;
  byType: FilterEntry[];
  byTraining: FilterEntry[];
  byAgeGroup: FilterEntry[];
  byRegion: FilterEntry[];
  byArrangement: FilterEntry[];
  byGender: FilterEntry[];
  byLanguage: FilterEntry[];
  byCulturalPref: FilterEntry[];
};

type ClickTypeBySource = { directory: Record<string, number>; match: Record<string, number> };

type AnalyticsData = {
  funnel: Funnel;
  funnelBySource: FunnelBySource;
  popularFilters: FilterEntry[];
  trends: TrendEntry[];
  therapistCTR: CTRRow[];
  quizDropout: { adults: QuizFunnel; kids: QuizFunnel };
  demographics: { byRegion: FilterEntry[]; byIssue: FilterEntry[]; byAgeBand: FilterEntry[]; byGender: FilterEntry[] };
  clickTypeBreakdown: Record<string, number>;
  clickTypeBySource: ClickTypeBySource;
  explainAnalytics: ExplainAnalytics;
  therapistBreakdowns: TherapistBreakdowns;
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
  { value: "therapists", label: "פרופיל מטפלים" },
  { value: "explain", label: "✦ ניתוחים אישיים" },
];

const COLORS = ["#2e7d8c", "#1a3a5c", "#f59e0b", "#22c55e", "#9333ea", "#ef4444", "#6366f1", "#ec4899"];

function pct(a: number, b: number): string {
  if (b === 0) return "—";
  return `${Math.round((a / b) * 100)}%`;
}

// Click-to-expand explanation shown under a rubric, so the admin can learn
// what each metric actually means without cluttering the view.
function Info({ title = "מה זה אומר?", children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="analytics-info mb-3 rounded-xl border border-stone-200 bg-stone-50 text-sm">
      <summary className="cursor-pointer select-none list-none px-4 py-2 font-semibold text-stone-600 hover:text-stone-800 flex items-center gap-1.5">
        <span className="text-[#2e7d8c]">ℹ️</span> {title}
      </summary>
      <div className="px-4 pb-3 pt-1 text-stone-600 leading-7 space-y-1.5">{children}</div>
    </details>
  );
}

// A single "term — meaning" line inside an Info box.
function Term({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <p><span className="font-bold text-stone-800">{k}</span> — {children}</p>
  );
}

// ── TAB 1: Funnel ──────────────────────────────────────────────────

type FunnelStep = { label: string; value: number; color: string };

function FunnelCards({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {steps.map((s, i) => (
        <div key={s.label} className="relative">
          <div className={`rounded-2xl border p-4 text-center ${s.color}`}>
            <div className="text-3xl font-black">{s.value.toLocaleString("he-IL")}</div>
            <div className="text-xs font-semibold mt-1">{s.label}</div>
          </div>
          {/* Step conversion — hidden when the step EXCEEDS the previous one
              (e.g. one directory entry exposes ~11 cards, one quiz spawns many
              card impressions): ">100%" reads as nonsense, same rule as the
              marketing funnel cards. */}
          {i > 0 && steps[i - 1].value > 0 && s.value <= steps[i - 1].value && (
            <div className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full bg-stone-800 text-white text-xs font-bold px-2 py-0.5">
              {pct(s.value, steps[i - 1].value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const FUNNEL_COLORS = [
  "bg-blue-50 border-blue-200 text-blue-800",
  "bg-purple-50 border-purple-200 text-purple-800",
  "bg-amber-50 border-amber-200 text-amber-800",
  "bg-green-50 border-green-200 text-green-800",
];
type FunnelView = "all" | "directory" | "match";
const FUNNEL_VIEWS: { value: FunnelView; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "directory", label: "מאגר המטפלים" },
  { value: "match", label: "מערכת ההתאמה" },
];

function buildFunnelSteps(view: FunnelView, data: AnalyticsData): FunnelStep[] {
  const C = FUNNEL_COLORS;
  if (view === "directory") {
    const f = data.funnelBySource.directory;
    return [
      { label: "כניסות למאגר", value: f.pageViews, color: C[0] },
      { label: "חשיפות כרטיס", value: f.impressions, color: C[1] },
      { label: "צפיות בפרופיל", value: f.profileViews, color: C[2] },
      { label: "יצירת קשר", value: f.contactClicks, color: C[3] },
    ];
  }
  if (view === "match") {
    const f = data.funnelBySource.match;
    return [
      { label: "השלמות שאלון", value: f.pageViews, color: C[0] },
      { label: "חשיפות במאטצ'ינג", value: f.impressions, color: C[1] },
      { label: "צפיות בפרופיל", value: f.profileViews, color: C[2] },
      { label: "יצירת קשר", value: f.contactClicks, color: C[3] },
    ];
  }
  const f = data.funnel;
  return [
    { label: "כניסות (מאגר + שאלון)", value: f.pageViews, color: C[0] },
    { label: "חשיפות כרטיס", value: f.impressions, color: C[1] },
    { label: "צפיות בפרופיל", value: f.profileViews, color: C[2] },
    { label: "יצירת קשר", value: f.contactClicks, color: C[3] },
  ];
}

// The online toggle sends filter_value="true" — show a human label for it.
const FILTER_VALUE_LABELS: Record<string, string> = { true: "אונליין", false: "לא אונליין" };

function PopularFilters({ filters }: { filters: FilterEntry[] }) {
  if (filters.length === 0) return null;
  const max = filters[0]?.count ?? 1;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-4">פילטרים פופולריים</h2>
      <Info>הפילטרים שמשתמשים הכי בחרו בהם במאגר המטפלים (למשל אזור או עיר). המספר = כמה פעמים הפילטר הופעל. עוזר להבין מה הכי מחפשים.</Info>
      <div className="space-y-2">
        {filters.map((f) => (
          <div key={f.name} className="flex items-center gap-3">
            <span className="w-20 text-xs font-semibold text-stone-600 text-left shrink-0">{FILTER_VALUE_LABELS[f.name] ?? f.name}</span>
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

const TREND_METRICS = [
  { key: "page_view", name: "כניסות למאגר", color: "#3b82f6" },
  { key: "profile_impression", name: "חשיפות", color: "#9333ea" },
  { key: "profile_view", name: "צפיות", color: "#f59e0b" },
  { key: "contact_click", name: "קשר", color: "#22c55e" },
] as const;

function TrendChart({ trends }: { trends: TrendEntry[] }) {
  if (trends.length === 0) return null;
  const partialEntry = trends.find(t => t.partial);
  // השבוע החלקי יורד מהקו הרציף ומצויר כנקודות חלולות מנותקות: קו שיורד אליו
  // נקרא כקריסה ("2000 חשיפות וכמעט אפס פניות"), כשבפועל אלה יומיים של נתונים
  // ליד שבועות מלאים. filterNull של ה-Tooltip מציג בכל נקודה רק את הסדרה החיה.
  const data = trends.map(t => {
    const row: Record<string, string | number | null> = {
      week: t.week.slice(5) + (t.partial ? ` (${t.partial_days ?? 1} ימים)` : ""),
    };
    for (const m of TREND_METRICS) {
      row[m.key] = t.partial ? null : t[m.key];
      row[`${m.key}_p`] = t.partial ? t[m.key] : null;
    }
    return row;
  });
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-4">טרנד שבועי</h2>
      <Info>אותם מדדי משפך (כניסות למאגר, חשיפות, צפיות, קשר) לאורך הזמן — כל נקודה היא שבוע מלא (שני עד ראשון). השבוע הנוכחי מוצג כנקודות חלולות עם מספר הימים שנצברו — אין להשוות אותו לשבועות שלמים.</Info>
      {partialEntry && (
        <p className="mb-3 -mt-1 text-xs text-stone-500">
          ◌ הנקודות החלולות מימין = השבוע הנוכחי, {partialEntry.partial_days ?? 1} ימים בלבד.
        </p>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#78716c" }} />
          <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
          <Tooltip contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl" }} />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Heebo" }} />
          {TREND_METRICS.map(m => (
            <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} name={m.name} strokeWidth={2} />
          ))}
          {TREND_METRICS.map(m => (
            <Line key={`${m.key}_p`} type="monotone" dataKey={`${m.key}_p`} stroke={m.color} name={m.name}
              strokeWidth={0} legendType="none"
              dot={{ r: 4, strokeWidth: 2, stroke: m.color, fill: "#fff" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CTRTable({ rows }: { rows: CTRRow[] }) {
  const [view, setView] = useState<FunnelView>("all");
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b[view].impressions - a[view].impressions);
  const totImp = sorted.reduce((s, r) => s + r[view].impressions, 0);
  const totVw = sorted.reduce((s, r) => s + r[view].profile_views, 0);
  const totClk = sorted.reduce((s, r) => s + r[view].clicks, 0);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-black text-stone-800">חשיפות מול קליקים למטפל</h2>
          <div className="flex rounded-xl border border-stone-200 overflow-hidden text-xs font-semibold">
            {FUNNEL_VIEWS.map(v => (
              <button key={v.value} onClick={() => setView(v.value)}
                className={`px-3 py-1.5 transition-colors ${view === v.value ? "bg-[#0F5468] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Info>
            <p>טבלה לכל מטפל — כמה נחשף, נצפה, ונוצר איתו קשר. ניתן לפצל לפי מסלול באתר (מאגר / התאמה):</p>
            <Term k="חשיפות">כמה פעמים הכרטיס שלו הוצג למשתמשים.</Term>
            <Term k="צפיות">כמה נכנסו לעמוד הפרופיל שלו.</Term>
            <Term k="קליקים">כמה לחצו ליצירת קשר (וואטסאפ/טלפון/מייל).</Term>
            <Term k="CTR">אחוז ההמרה: קליקים חלקי חשיפות. ירוק = 10%+ (מצוין), כתום = 5%+ (סביר), אפור = פחות. ★ = מטפל משלם.</Term>
          </Info>
        </div>
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
          {sorted.map((r, i) => {
            const c = r[view];
            return (
              <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                <td className="px-5 py-3 text-stone-400 text-xs">{i + 1}</td>
                <td className="px-5 py-3 font-semibold text-stone-800">
                  {r.full_name}
                  {r.status === "paying" && <span className="mr-2 rounded-full bg-yellow-100 border border-yellow-300 px-1.5 py-0.5 text-xs text-yellow-800">★</span>}
                </td>
                <td className="px-5 py-3 text-center text-purple-600 font-bold">{c.impressions}</td>
                <td className="px-5 py-3 text-center text-amber-600 font-bold">{c.profile_views}</td>
                <td className="px-5 py-3 text-center text-green-600 font-bold">{c.clicks}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-black ${
                    c.ctr >= 10 ? "bg-green-100 text-green-800" : c.ctr >= 5 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"
                  }`}>{c.ctr}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-stone-50 border-t-2 border-stone-200">
            <td className="px-5 py-3" colSpan={2}><span className="text-xs font-black text-stone-500">סה&quot;כ</span></td>
            <td className="px-5 py-3 text-center font-black text-purple-600">{totImp}</td>
            <td className="px-5 py-3 text-center font-black text-amber-600">{totVw}</td>
            <td className="px-5 py-3 text-center font-black text-green-600">{totClk}</td>
            <td className="px-5 py-3 text-center">
              <span className="text-xs font-black text-stone-600">{totImp > 0 ? `${Math.round((totClk / totImp) * 1000) / 10}%` : "—"}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ConvRow({ label, a, b, strong }: { label: string; a: number; b: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-500">{label}</span>
      <span className={`text-sm ${strong ? "font-black text-[#0F5468]" : "font-bold text-stone-700"}`}>{pct(a, b)}</span>
    </div>
  );
}

// Per-source contact-type chips: "כמה וואטסאפ / טלפון / מייל / הודעה" in each track.
function ClickTypeChips({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (entries.length === 0) return <span className="text-xs text-stone-300">אין פניות בטווח</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([type, n]) => (
        <span key={type} className="rounded-full bg-white border border-stone-200 px-2 py-0.5 text-xs text-stone-600">
          {CLICK_TYPE_LABELS[type] ?? type} <b className="text-stone-900">{n}</b>
        </span>
      ))}
    </div>
  );
}

function ConversionBySource({ fbs, clickTypes }: { fbs: FunnelBySource; clickTypes: ClickTypeBySource }) {
  const cols: { key: "directory" | "match"; label: string; f: Funnel }[] = [
    { key: "directory", label: "מאגר המטפלים", f: fbs.directory },
    { key: "match", label: "מערכת ההתאמה", f: fbs.match },
  ];
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-1">יחסי המרה לפי מסלול באתר</h2>
      <Info>
        <p>אחוז המעבר בין שלבי המשפך בכל מסלול — להשוות איזה <b>מסלול באתר</b> ממיר טוב יותר (מאגר מול התאמה). זה אינו ערוץ הרכישה: מאיפה הגיעו לאתר נמצא ב<a href="/admin/attribution" className="text-blue-700 underline">מקורות תנועה</a>.</p>
        <Term k="חשיפה→צפייה">כמה מהחשיפות הפכו לכניסה לפרופיל.</Term>
        <Term k="צפייה→פנייה">כמה מהצפיות בפרופיל הפכו ליצירת קשר.</Term>
        <Term k="חשיפה→פנייה">אחוז ההמרה הכולל — מחשיפה ועד פנייה.</Term>
        <Term k="הצ'יפים למטה">פירוק הפניות של המסלול לפי אמצעי (וואטסאפ / טלפון / מייל / הודעה באתר). במאגר אפשר לפנות גם ישירות מהכרטיס — בלי להיכנס לפרופיל.</Term>
      </Info>
      <div className="grid grid-cols-2 gap-3">
        {cols.map(c => (
          <div key={c.key} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-black text-stone-800 mb-2">{c.label}</div>
            <ConvRow label="חשיפה→צפייה" a={c.f.profileViews} b={c.f.impressions} />
            <ConvRow label="צפייה→פנייה" a={c.f.contactClicks} b={c.f.profileViews} />
            <ConvRow label="חשיפה→פנייה" a={c.f.contactClicks} b={c.f.impressions} strong />
            <div className="mt-2.5 pt-2.5 border-t border-stone-200">
              <ClickTypeChips counts={clickTypes[c.key]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelTab({ data }: { data: AnalyticsData }) {
  const [view, setView] = useState<FunnelView>("all");
  return (
    <>
      {/* שינוי מדידה - בלי זה משווים מספרים שנמדדו אחרת ומסיקים "קריסה". */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
        <strong>שינוי מדידה, 12/8/2026.</strong> (1) &quot;כניסות למאגר&quot; סופרות מעכשיו רק עמודים
        שמציגים מטפלים (מאגר, עיר, אזור, התמחות...) - עמודי תוכן (בית, מאמרים, אודות) שהצטרפו
        למדידה ב-6/8 ניפחו את ראש המשפך; התיקון חל גם אחורה, כך שהגרף אחיד. (2) תנועת
        בוטים וסורקים מסוננת מהרישום מהיום והלאה - חשיפות, צפיות וסשנים צפויים
        לרדת ביחס לשבועות קודמים. הירידה היא ניקוי, לא אובדן: ב-8/8 סורק אחד ייצר
        462 &quot;צפיות פרופיל&quot; ביום.
      </div>
      <Info title="מה זה אומר? משפך החשיפה→פנייה">
        <Term k="מאגר המטפלים">המסלול של מי שמגיע דרך עמוד מאגר המטפלים: כניסה לעמוד ← חשיפת כרטיס ← צפייה בפרופיל ← יצירת קשר. נספרות רק כניסות לעמודים שמציגים מטפלים.</Term>
        <Term k="מערכת ההתאמה">המסלול של מי שמילא/ה שאלון וקיבל/ה המלצות: השלמת שאלון ← חשיפת כרטיס בתוצאות ← צפייה בפרופיל ← יצירת קשר.</Term>
        <Term k="חשיפות כרטיס">כמה פעמים כרטיס של מטפל הוצג (לא בהכרח נלחץ).</Term>
        <Term k="צפיות בפרופיל">כניסות בפועל לעמוד הפרופיל המלא.</Term>
        <Term k="יצירת קשר">לחיצות על וואטסאפ / טלפון / מייל.</Term>
        <Term k="האחוז שמעל כל קופסה">שיעור המעבר מהשלב הקודם — ככל שגבוה יותר, המעבר יעיל יותר.</Term>
      </Info>

      <div className="mb-5 flex w-fit rounded-xl border border-stone-200 overflow-hidden text-sm font-semibold">
        {FUNNEL_VIEWS.map(v => (
          <button key={v.value} onClick={() => setView(v.value)}
            className={`px-4 py-2 transition-colors ${view === v.value ? "bg-[#0F5468] text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`}>
            {v.label}
          </button>
        ))}
      </div>

      <FunnelCards steps={buildFunnelSteps(view, data)} />
      <ConversionBySource fbs={data.funnelBySource} clickTypes={data.clickTypeBySource} />
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <PopularFilters filters={data.popularFilters} />
        <TrendChart trends={data.trends} />
      </div>
      <CTRTable rows={data.therapistCTR} />
    </>
  );
}

// ── TAB 2: Quiz Dropout ────────────────────────────────────────────

// הרשימות כוללות גם מזהי שלבים מגרסאות קודמות של השאלון (למשל e4-chronic,
// שמוזג לתוך e4-contexts) כדי שאירועים היסטוריים לא ייעלמו מהגרף.
const ADULTS_GROUPS: Record<string, { label: string; steps: string[] }> = {
  intro:    { label: "פתיחה",         steps: ["disclaimer", "intake", "domains"] },
  e1:       { label: "E1 — דיכאון",   steps: ["e1", "e1-q"] },
  e2:       { label: "E2 — מאניה",    steps: ["e2", "e2-2", "e2-q"] },
  e3:       { label: "E3 — פסיכוזה",  steps: ["e3", "e3-q"] },
  e4:       { label: "E4 — חרדה",     steps: ["e4", "e4-contexts", "e4-chronic", "e4-medical", "e4-q", "e4-social", "e4-social-sev", "e4-flight", "e4-medanx", "e4-stresspain"] },
  e5:       { label: "E5 — OCD",      steps: ["e5", "e5-q"] },
  e6:       { label: "E6 — אכילה",    steps: ["e6", "e6-q"] },
  e7:       { label: "E7 — שינה",     steps: ["e7-q"] },
  e8:       { label: "E8 — סומטי",    steps: ["e8", "e8c", "e8d"] },
  e9:       { label: "E9 — טראומה",   steps: ["e9", "e9-q"] },
  e10:      { label: "E10 — אישיות",  steps: ["e10", "e10a", "e10b", "e10c"] },
  style:    { label: "סגנון טיפול",    steps: ["therapist-style"] },
  func:     { label: "תפקוד",         steps: ["f-vision", "f1", "f1-subs", "f1-adhd", "f1-ld", "f1-ld-q", "f2", "f2-q", "f3", "f3-type", "f3-a", "f3-b", "f3-disability"] },
  relation: { label: "זוגיות / משפחה", steps: ["r-intake", "r-single", "r-single-no-detail", "r1", "r-abuse", "r1-scale", "r2-q", "r3-conflict", "r3-child", "r3-child-type", "r3", "r3-partner"] },
  addiction:{ label: "התמכרויות",      steps: ["a-types", "a-substances", "a-gaming", "a-porn-type", "a-porn-q", "a-sex-q", "a-gambling", "a-phone"] },
  end:      { label: "סיום",          steps: ["scoring"] },
};

const KIDS_GROUPS: Record<string, { label: string; steps: string[] }> = {
  intro:   { label: "פתיחה",      steps: ["p-consent", "p-demo", "p-areas"] },
  anxiety: { label: "חרדה",       steps: ["p-q1", "p-q1-pain", "p-aq", "p-aq-grade", "p-q1-ga"] },
  mood:    { label: "מצב רוח",    steps: ["p-q2", "p-q2-grade"] },
  mania:   { label: "מאניה",      steps: ["p-q3", "p-mq", "p-mq-sui"] },
  addict:  { label: "התמכרות",    steps: ["p-q4", "p-q4-types", "p-q4-s", "p-q4-g", "p-q4-b", "p-q4-ctrl"] },
  ocd:     { label: "OCD",        steps: ["p-q5", "p-oq", "p-oq-grade"] },
  trauma:  { label: "טראומה",     steps: ["p-q6", "p-tq"] },
  psycho:  { label: "פסיכוזה",    steps: ["p-q7", "p-pq"] },
  eating:  { label: "אכילה",      steps: ["p-q8", "p-eq"] },
  behav:   { label: "התנהגות",    steps: ["p-q9", "p-bq", "p-q9-adhd"] },
  distress:{ label: "מצוקה כללית", steps: ["p-q10", "p-q10-par", "p-q10-grade"] },
  extra:   { label: "התפתחות",    steps: ["p-ga-traits", "p-acad", "p-dev-toilet", "p-dev-sensory", "p-beh", "p-soc"] },
  // The retired per-domain trait screens stay listed in the groups above so
  // historical events keep landing somewhere; p-traits is where they went.
  traits:  { label: "מאפייני הילד", steps: ["p-traits"] },
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

      <Info title="מה זה אומר? נשירה לפי שלב">
        <Term k="התחילו / סיימו / השלמה">כמה משתמשים פתחו את השאלון, כמה הגיעו עד הסוף, והאחוז ביניהם. אדום = שיעור השלמה נמוך.</Term>
        <Term k="כל שורה (קבוצת שלבים)">המספר = כמה משתמשים הגיעו לאותו חלק בשאלון. ככל שהבר קצר יותר — פחות אנשים הגיעו לשם.</Term>
        <Term k="‎-% משמאל">שיעור הנשירה מהחלק הקודם. אדום (20%+) = נקודה שבה הרבה אנשים עוזבים — שווה לבדוק אותה.</Term>
        <Term k="לחיצה על שורה">פותחת את תת-השלבים הפנימיים כדי לאתר במדויק איפה הנשירה.</Term>
      </Info>
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

// ── ניתוח נשירה חכם (סוכן) ──────────────────────────────────────────

type DropoutStepStat = {
  step: string;
  group: string;
  desc: string;
  reached: number;
  exitedHere: number;
  exitRate: number;
  medianSec: number | null;
  tags: string[];
};
type DropoutQuizAnalysis = {
  started: number;
  completed: number;
  completionRate: number;
  medianDurationMin: number | null;
  dropouts: number;
  steps: DropoutStepStat[];
  topExits: DropoutStepStat[];
  postQuiz?: { results: number; matchForm: number; matchResults: number };
  sampleNote: string | null;
};
type DropoutAiFinding = {
  step: string;
  title: string;
  evidence: string;
  likely_reasons: string[];
  suggestions: string[];
};
type DropoutAiQuizReport = { summary: string; findings: DropoutAiFinding[]; quick_wins: string[] };
type DropoutAnalysisData = {
  adults: DropoutQuizAnalysis;
  kids: DropoutQuizAnalysis;
  ai: { adults: DropoutAiQuizReport; kids: DropoutAiQuizReport } | null;
  aiError: string | null;
  generated_at: string;
};

function fmtSec(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec} שנ'`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} דק'`;
}

function ExitPointsTable({ analysis }: { analysis: DropoutQuizAnalysis }) {
  if (analysis.topExits.length === 0) {
    return <p className="text-sm text-stone-400">אין נטישות בתקופה הזו 🎉</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-xs text-stone-500">
            <th className="px-3 py-2 font-semibold">שלב</th>
            <th className="px-3 py-2 font-semibold">מה מוצג שם</th>
            <th className="px-3 py-2 font-semibold text-center">הגיעו</th>
            <th className="px-3 py-2 font-semibold text-center">נטשו כאן</th>
            <th className="px-3 py-2 font-semibold text-center">% נטישה</th>
            <th className="px-3 py-2 font-semibold text-center">זמן חציוני</th>
          </tr>
        </thead>
        <tbody>
          {analysis.topExits.map(s => (
            <tr key={s.step} className="border-b border-stone-100 align-top">
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="font-mono text-xs text-stone-500">{s.step}</div>
                <div className="text-xs font-bold text-stone-700">{s.group}</div>
              </td>
              <td className="px-3 py-2.5 text-xs text-stone-600 leading-5 max-w-[300px]">
                {s.desc}
                {s.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.tags.map(t => (
                      <span key={t} className="rounded-full bg-stone-100 border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">{t}</span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5 text-center font-bold text-stone-700">{s.reached}</td>
              <td className="px-3 py-2.5 text-center font-black text-red-600">{s.exitedHere}</td>
              <td className="px-3 py-2.5 text-center">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-black ${s.exitRate >= 20 ? "bg-red-100 text-red-700" : s.exitRate >= 10 ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                  {s.exitRate}%
                </span>
              </td>
              <td className="px-3 py-2.5 text-center text-xs text-stone-500">{fmtSec(s.medianSec)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiFindings({ report }: { report: DropoutAiQuizReport }) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-sm leading-6 text-violet-900">✦ {report.summary}</p>
      {report.findings.map((f, i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="rounded bg-stone-800 text-white font-mono text-[10px] px-1.5 py-0.5">{f.step}</span>
            <h4 className="text-sm font-black text-stone-800">{f.title}</h4>
          </div>
          <p className="mt-1 text-xs text-stone-500">{f.evidence}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold text-amber-700 mb-1">סיבות אפשריות</div>
              <ul className="space-y-1">
                {f.likely_reasons.map((r, j) => (
                  <li key={j} className="text-xs text-stone-700 leading-5 flex gap-1.5"><span className="text-amber-500 mt-0.5">•</span>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-bold text-green-700 mb-1">איך לשפר</div>
              <ul className="space-y-1">
                {f.suggestions.map((r, j) => (
                  <li key={j} className="text-xs text-stone-700 leading-5 flex gap-1.5"><span className="text-green-500 mt-0.5">✓</span>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
      {report.quick_wins.length > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="text-xs font-black text-green-800 mb-1.5">⚡ צעדים מהירים</div>
          <ul className="space-y-1">
            {report.quick_wins.map((w, i) => (
              <li key={i} className="text-xs text-green-900 leading-5 flex gap-1.5"><span className="mt-0.5">→</span>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuizAnalysisSection({
  title, analysis, ai,
}: {
  title: string;
  analysis: DropoutQuizAnalysis;
  ai: DropoutAiQuizReport | null;
}) {
  const rate = analysis.completionRate;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <h3 className="text-base font-black text-stone-800">{title}</h3>
        <div className="flex items-center gap-3 text-center">
          <div><div className="text-lg font-black text-blue-700">{analysis.started}</div><div className="text-[10px] text-stone-500">התחילו</div></div>
          <div><div className="text-lg font-black text-green-700">{analysis.completed}</div><div className="text-[10px] text-stone-500">סיימו</div></div>
          <div><div className="text-lg font-black text-red-600">{analysis.dropouts}</div><div className="text-[10px] text-stone-500">נטשו</div></div>
          <div><div className={`text-lg font-black ${rate >= 50 ? "text-green-700" : rate >= 25 ? "text-amber-700" : "text-red-700"}`}>{rate}%</div><div className="text-[10px] text-stone-500">השלמה</div></div>
          {analysis.medianDurationMin != null && (
            <div><div className="text-lg font-black text-stone-700">{analysis.medianDurationMin}</div><div className="text-[10px] text-stone-500">דק' (חציון)</div></div>
          )}
        </div>
      </div>

      {analysis.sampleNote && (
        <p className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">⚠️ {analysis.sampleNote}</p>
      )}

      {analysis.postQuiz && analysis.completed > 0 && (
        <p className="mb-3 text-xs text-stone-500">
          אחרי סיום השאלון: {analysis.postQuiz.results} ראו תוצאות ← {analysis.postQuiz.matchForm} פתחו חיפוש מטפל ← {analysis.postQuiz.matchResults} הגיעו לרשימת מטפלים
        </p>
      )}

      <div className="mb-4">
        <div className="text-xs font-black text-stone-600 mb-2">📍 נקודות הנטישה המדויקות (השלב האחרון שנצפה לפני עזיבה)</div>
        <ExitPointsTable analysis={analysis} />
      </div>

      {ai && <AiFindings report={ai} />}
    </div>
  );
}

function QuizAiAnalysisPanel({ period }: { period: Period }) {
  const [data, setData] = useState<DropoutAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // תוצאה של תקופה אחת אינה רלוונטית לאחרת — לנקות כשמחליפים
  useEffect(() => { setData(null); setError(""); }, [period]);

  function run(force = false) {
    setLoading(true);
    setError("");
    fetch(`/api/admin-quiz-dropout?period=${period}${force ? "&force=1" : ""}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (json.ok) setData(json);
        else setError(json.error ?? "שגיאה לא ידועה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/40 p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-black text-stone-800">🧭 ניתוח נשירה חכם</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            איפה בדיוק כל משתמש נטש (לפי מסלול אמיתי, לא לפי מוני שלבים), סיבות אפשריות והצעות שיפור
          </p>
        </div>
        <button
          onClick={() => run(Boolean(data))}
          disabled={loading}
          className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 transition-colors"
        >
          {loading ? "מנתח… (עד ½ דקה)" : data ? "🔄 נתח מחדש" : "▶ הפעל ניתוח"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {data && !loading && (
        <div className="mt-4">
          {data.aiError && (
            <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">⚠️ {data.aiError}</p>
          )}
          <QuizAnalysisSection title="🧑 שאלון מבוגרים" analysis={data.adults} ai={data.ai?.adults ?? null} />
          <QuizAnalysisSection title="🧒 שאלון ילדים" analysis={data.kids} ai={data.ai?.kids ?? null} />
          <p className="text-[11px] text-stone-400 text-left">נותח: {new Date(data.generated_at).toLocaleString("he-IL")}</p>
        </div>
      )}
    </div>
  );
}

function QuizTab({ data, period }: { data: AnalyticsData; period: Period }) {
  return (
    <>
      <QuizAiAnalysisPanel period={period} />
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

const CLICK_TYPE_LABELS: Record<string, string> = {
  whatsapp: "וואטסאפ",
  phone: "טלפון",
  email: "מייל",
  site_message: "הודעה באתר",
};

function ClickBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const labels = CLICK_TYPE_LABELS;
  const colors: Record<string, string> = { whatsapp: "bg-green-500", phone: "bg-stone-700", email: "bg-blue-500", site_message: "bg-amber-500" };
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

// ── TAB 4: AI Explain Analytics ─────────────────────────────────────

function ExplainTab({ data }: { data: AnalyticsData }) {
  const ex = data.explainAnalytics;
  // Friendly relabeling for chart names (Hebrew labels for taxonomy keys)
  const labelize = (entries: FilterEntry[], map: Record<string, string>) =>
    entries.map(e => ({ name: map[e.name] ?? e.name, count: e.count }));

  const questionnaireLabels: Record<string, string> = { adult: "מבוגרים", child: "ילדים" };
  const ageBandLabels: Record<string, string> = {
    child: "ילדים/נוער",
    "18-30": "18-30",
    "31-45": "31-45",
    "46-60": "46-60",
    "60+": "60+",
  };
  const genderLabels: Record<string, string> = { m: "גברים", f: "נשים", other: "אחר" };
  const regionLabels: Record<string, string> = {
    center: "מרכז",
    sharon: "שרון",
    jerusalem: "ירושלים",
    haifa: "חיפה",
    north: "צפון",
    south: "דרום",
    online: "אונליין",
    other: "אחר",
  };

  if (ex.total === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <div className="text-4xl mb-2">✦</div>
        <p className="text-sm font-bold text-stone-800 mb-1">עדיין אין קליקים על &quot;למה הוצע לי?&quot;</p>
        <p className="text-xs text-stone-500">הנתונים יתחילו להופיע ברגע שמשתמשים יתחילו להשתמש בפיצ&apos;ר.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-black text-stone-800">קליקים על &quot;✦ למה הוצע לי?&quot;</h2>
        <p className="text-xs text-stone-400">משתמשים לוחצים על כפתור הניתוח האישי בכרטיס המלצה</p>
      </div>
      <Info>
        <p>כמה משתמשים לחצו על כפתור <b>"✦ ניתוח אישי"</b> בכרטיס ההמלצה במאטצ'ינג (סקרנות להבין למה הותאם להם מטפל מסוים).</p>
        <Term k="סה״כ קליקים + לפי שאלון">כמה לחיצות בסך הכל, ופילוח בין שאלון מבוגרים לילדים.</Term>
        <Term k="טיפולים שהכי הסקרנו לגביהם">לאיזה סוגי טיפול היו הכי הרבה לחיצות ניתוח.</Term>
        <Term k="פילוח דמוגרפי">מי לוחץ (גיל / מגדר / אזור / תחום) — מבוסס על תשובות השאלון בלבד, אנונימי.</Term>
      </Info>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-center">
          <div className="text-3xl font-black text-violet-800">{ex.total.toLocaleString("he-IL")}</div>
          <div className="text-xs font-semibold text-violet-700 mt-1">סה&quot;כ קליקים</div>
        </div>
        {ex.byQuestionnaireType.map(q => (
          <div key={q.name} className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
            <div className="text-3xl font-black text-stone-800">{q.count.toLocaleString("he-IL")}</div>
            <div className="text-xs font-semibold text-stone-600 mt-1">
              {questionnaireLabels[q.name] ?? q.name} — {pct(q.count, ex.total)}
            </div>
          </div>
        ))}
      </div>

      {/* Top treatments */}
      <div className="mb-6">
        <HorizontalBars
          title="טיפולים שהכי הסקרנו לגביהם"
          data={ex.byTreatment}
          color="#9333ea"
        />
      </div>

      {/* Demographics — who clicks */}
      <div className="mb-4">
        <h3 className="text-sm font-black text-stone-800">מי לוחץ? פילוח דמוגרפי</h3>
        <p className="text-xs text-stone-400">נתונים אנונימיים — מבוסס על תשובות השאלון בלבד</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <DonutChart title="לפי קבוצת גיל" data={labelize(ex.byAgeBand, ageBandLabels)} />
        <DonutChart title="לפי מגדר" data={labelize(ex.byGender, genderLabels)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HorizontalBars title="לפי אזור" data={labelize(ex.byRegion, regionLabels)} color="#2e7d8c" />
        <HorizontalBars title="לפי תחום" data={ex.byDomain} color="#1a3a5c" />
      </div>
    </>
  );
}

function StatsTab({ data }: { data: AnalyticsData }) {
  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-black text-stone-800">פילוח צפיות לפי פרמטרים</h2>
        <p className="text-xs text-stone-400">נתונים מתוך צפיות בפרופיל מטפל (מערכת התאמה + דירקטוריה)</p>
      </div>
      <Info>
        <p>פילוח של <b>מי המשתמשים שצפו בפרופילים</b> של מטפלים, לפי המידע האנונימי שמסרו (אזור / נושא הפנייה / קבוצת גיל / מגדר). עוזר להבין מי קהל המשתמשים בפועל.</p>
        <p className="text-stone-500">שים/י לב: המידע הדמוגרפי מגיע ממשתמשי <b>מערכת ההתאמה</b> בלבד (נגזר מהשאלון) — גולשי מאגר המטפלים אינם מספקים נתונים דמוגרפיים, ולכן אין כאן פיצול לפי מקור.</p>
        <Term k="לפי אזור / נושא">מאיפה הצופים ועל איזה תחום (חרדה, זוגיות וכו').</Term>
        <Term k="התפלגות ערוצי קשר">מאיזה אמצעי (וואטסאפ/טלפון/מייל) משתמשים בוחרים ליצור קשר.</Term>
      </Info>

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

// ── TAB 5: Therapist profile breakdowns ────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${color}`}>
      <div className="text-3xl font-black">{value}</div>
      {sub && <div className="text-xs font-semibold mt-0.5 opacity-70">{sub}</div>}
      <div className="text-xs font-semibold mt-1">{label}</div>
    </div>
  );
}

function TherapistsTab({ data }: { data: TherapistBreakdowns }) {
  const { total, paid, gifted, free, withPhoto, acceptingNew, onlineCount } = data;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <div className="text-4xl mb-2">🧑‍⚕️</div>
        <p className="text-sm font-bold text-stone-800 mb-1">אין עדיין מטפלים פעילים מוצגים</p>
        <p className="text-xs text-stone-500">הפילוח יופיע ברגע שיהיו מטפלים מאושרים במערכת ההתאמות.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-black text-stone-800">פרופיל המטפלים הפעילים</h2>
        <p className="text-xs text-stone-400">פילוח לפי שדות הפרופיל — מטפלים מוצגים בהתאמות (משלמים + חינמיים מאושרים)</p>
      </div>
      <Info>
        <p>כאן הפילוח הוא של <b>המטפלים עצמם</b> (היצע), לא של המשתמשים. כלומר הרכב המאגר הפעיל.</p>
        <Term k="מטפלים פעילים">סך המטפלים המוצגים בהתאמות, ובתוכם כמה משלמים / מקודמים (מתנה) / חינמיים.</Term>
        <Term k="מקבלים פניות / אונליין / עם תמונה">איזה אחוז מהמטפלים פתוחים לפניות חדשות, מטפלים אונליין, ויש להם תמונת פרופיל.</Term>
        <Term k="הגרפים למטה">התפלגות המטפלים לפי סוג, שיטות טיפול, גיל מטופלים, אזור, מגדר, הסדרי תשלום, שפות והעדפות תרבותיות — לזהות פערי היצע.</Term>
      </Info>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="מטפלים פעילים" value={total}
          sub={`${paid} משלמים · ${gifted} מקודמים · ${free} חינמיים`}
          color="bg-blue-50 border-blue-200 text-blue-800" />
        <StatCard label="מקבלים פניות חדשות" value={acceptingNew} sub={pct(acceptingNew, total)}
          color="bg-green-50 border-green-200 text-green-800" />
        <StatCard label="מטפלים אונליין" value={onlineCount} sub={pct(onlineCount, total)}
          color="bg-purple-50 border-purple-200 text-purple-800" />
        <StatCard label="עם תמונת פרופיל" value={withPhoto} sub={pct(withPhoto, total)}
          color="bg-amber-50 border-amber-200 text-amber-800" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <HorizontalBars title="סוג מטפל" data={data.byType} color="#1a3a5c" />
        <HorizontalBars title="שיטות טיפול" data={data.byTraining} color="#2e7d8c" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <HorizontalBars title="קבוצות גיל שמטפלים בהן" data={data.byAgeGroup} color="#7c3aed" />
        <HorizontalBars title="אזורי פעילות" data={data.byRegion} color="#0f766e" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <DonutChart title="מגדר" data={data.byGender} />
        <HorizontalBars title="הסדרי תשלום" data={data.byArrangement} color="#b45309" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <HorizontalBars title="שפות" data={data.byLanguage} color="#0369a1" />
        <HorizontalBars title="העדפות תרבותיות" data={data.byCulturalPref} color="#9f1239" />
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
            funnelBySource: json.funnelBySource ?? {
              directory: { pageViews: 0, impressions: 0, profileViews: 0, contactClicks: 0 },
              match: { pageViews: 0, impressions: 0, profileViews: 0, contactClicks: 0 },
            },
            popularFilters: json.popularFilters,
            trends: json.trends,
            therapistCTR: json.therapistCTR,
            quizDropout: json.quizDropout,
            demographics: json.demographics,
            clickTypeBreakdown: json.clickTypeBreakdown,
            clickTypeBySource: json.clickTypeBySource ?? { directory: {}, match: {} },
            explainAnalytics: json.explainAnalytics ?? {
              total: 0,
              byQuestionnaireType: [],
              byTreatment: [],
              byAgeBand: [],
              byGender: [],
              byRegion: [],
              byDomain: [],
            },
            therapistBreakdowns: json.therapistBreakdowns ?? {
              total: 0, paid: 0, gifted: 0, free: 0, withPhoto: 0, acceptingNew: 0, onlineCount: 0,
              byType: [], byTraining: [], byAgeGroup: [], byRegion: [],
              byArrangement: [], byGender: [], byLanguage: [], byCulturalPref: [],
            },
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
      <style>{`.analytics-info summary::-webkit-details-marker{display:none}`}</style>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-stone-900">אנליטיקס</h1>
        <p className="text-xs text-stone-400 mt-1">דשבורד מרכזי — funnel, נשירה, סטטיסטיקות, פרופיל מטפלים</p>
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
          {tab === "quiz" && <QuizTab data={data} period={period} />}
          {tab === "stats" && <StatsTab data={data} />}
          {tab === "therapists" && <TherapistsTab data={data.therapistBreakdowns} />}
          {tab === "explain" && <ExplainTab data={data} />}

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
