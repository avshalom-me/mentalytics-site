"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CHANNEL_LABELS } from "@/app/lib/attribution";
import { triggerReport } from "@/app/lib/trigger-report";

// עמוד הדוחות המאוחד: שבועי וחודשי במסך אחד עם מתג. מחליף את שני העמודים
// הקודמים שהיו זהים ב-97% (600 שורות כל אחד, 36 שורות הבדל של תוויות
// ותאריכים) - הכתובות הישנות מפנות לכאן. ההבדלים חיים ב-MODE_CONFIG אחד.

type ReportMode = "weekly" | "monthly";

type ModeConfig = {
  listApi: string;
  triggerApi: string;
  toggleLabel: string;
  subtitle: string;
  periodPrefix: string;
  comparisonTitle: string;
  compareMidLabel: string;
  compareLongLabel: string;
  trendTitle: (len: number) => string;
  trendColCurrent: string;
  trendColAvg: string;
  noTrendUp: string;
  noTrendDown: string;
  silentTitle: string;
  silentAllOk: string;
  runMsgPrefix: string;
  errorHint: string;
  emptyTitle: string;
  emptyHint: string;
};

const MODE_CONFIG: Record<ReportMode, ModeConfig> = {
  weekly: {
    listApi: "/api/admin-weekly-reports",
    triggerApi: "/api/admin-trigger-weekly-report",
    toggleLabel: "שבועי",
    subtitle: "סיכום אוטומטי של ביקוש מול היצע, רץ כל יום ראשון בבוקר.",
    periodPrefix: "שבוע",
    comparisonTitle: "השבוע מול חודשי ורבעוני",
    compareMidLabel: "חודשי",
    compareLongLabel: "רבעוני",
    trendTitle: () => "מגמה — 13 שבועות אחרונים",
    trendColCurrent: "השבוע",
    trendColAvg: "ממוצע חודשי",
    noTrendUp: "אין מטפלים בולטים בעלייה השבוע.",
    noTrendDown: "אין מטפלים בולטים בירידה השבוע.",
    silentTitle: "מטפלים ממומנים בלי פניות",
    silentAllOk: "🎉 כל המטפלים הממומנים קיבלו לפחות פנייה אחת השבוע.",
    runMsgPrefix: "הופק דוח לשבוע",
    errorHint: "ייתכן שטבלת weekly_reports עדיין לא נוצרה ב-Supabase.",
    emptyTitle: "עדיין אין דוחות שבועיים.",
    emptyHint: 'הדוח הראשון יתפרסם ביום ראשון הקרוב, או לחץ על "הפק דוח עכשיו".',
  },
  monthly: {
    listApi: "/api/admin-monthly-reports",
    triggerApi: "/api/admin-trigger-monthly-report",
    toggleLabel: "חודשי",
    subtitle: "סיכום אגרגטיבי של חודש שלם, רץ אוטומטית ב-1 בכל חודש בבוקר.",
    periodPrefix: "חודש",
    comparisonTitle: "החודש מול ממוצעים ארוכי טווח",
    compareMidLabel: "3 חודשי",
    compareLongLabel: "6 חודשי",
    trendTitle: (len) => `מגמה — ${len} חודשים אחרונים`,
    trendColCurrent: "החודש",
    trendColAvg: "ממוצע 3-חודשי",
    noTrendUp: "אין מטפלים בולטים בעלייה החודש.",
    noTrendDown: "אין מטפלים בולטים בירידה החודש.",
    silentTitle: "מטפלים ממומנים בלי פניות החודש",
    silentAllOk: "🎉 כל המטפלים הממומנים קיבלו לפחות פנייה אחת החודש.",
    runMsgPrefix: "הופק דוח לחודש",
    errorHint: "ייתכן שטבלת monthly_admin_reports עדיין לא נוצרה ב-Supabase.",
    emptyTitle: "עדיין אין דוחות חודשיים.",
    emptyHint: 'הדוח הראשון יתפרסם ב-1 לחודש הקרוב, או לחץ על "הפק דוח עכשיו".',
  },
};

type FilterEntry = { name: string; count: number };

type ChannelFunnel = {
  channel: string;
  pageViews: number;
  sessions?: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  viewToClick: number;
  impressionToClick: number;
};
type MarketingData = {
  channels?: ChannelFunnel[];
  topCampaigns?: { campaign: string; contactClicks: number }[];
};

type TrendPoint = {
  week_start: string; // שם השדה זהה בשני הסוגים (תאילות לאחור בנתוני החודשי)
  pageViews: number;
  profileViews: number;
  contactClicks: number;
  quizCompletions: number;
};

type ComparisonStats = {
  current: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
  monthAvg: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
  quarterAvg: { pageViews: number; profileViews: number; contactClicks: number; quizCompletions: number };
};

type PatientData = {
  pageViews: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  popularFilters: FilterEntry[];
  byRegion: FilterEntry[];
  byIssue: FilterEntry[];
  byAgeBand: FilterEntry[];
  byGender: FilterEntry[];
  clickTypeBreakdown: Record<string, number>;
  quizStarted: { adults: number; kids: number };
  quizCompleted: { adults: number; kids: number };
  trend?: TrendPoint[];
  comparison?: ComparisonStats;
};

type TherapistTrendRow = {
  id: string;
  full_name: string;
  weeklyClicks: number[];
  currentWeek: number;
  prior4WeekAvg: number;
  changePct: number | null;
  category: "grower" | "decliner" | "stalled" | "new" | "stable";
};

type SilentTherapist = {
  id: string;
  full_name: string;
  email: string | null;
  views: number;
  clicks: number;
  bio_length: number;
  training_count: number;
  region_count: number;
  has_photo: boolean;
  days_promoted: number | null;
};

type TherapistData = {
  totalActive: number;
  paying: number;
  free: number;
  byTherapistType: FilterEntry[];
  byTrainingArea: FilterEntry[];
  byRegion: FilterEntry[];
  byGender: FilterEntry[];
  rareTrainingAreas: FilterEntry[];
  newThisWeek: number;
  silentPayingTherapists?: SilentTherapist[];
  invisiblePayingCount?: number;
  viewedNoClickPayingCount?: number;
  growers?: TherapistTrendRow[];
  decliners?: TherapistTrendRow[];
};

// צורת השורה על החוט: week_start/week_end (שבועי) או month_start/month_end
// (חודשי). מנורמלת מיד אחרי הטעינה - הקומפוננטות רואות רק period_start/end,
// כך שאי אפשר לקרוא בטעות שדה שקיים רק במצב אחד (ממצא ביקורת).
type ReportShared = {
  id: string;
  patient_data: PatientData;
  therapist_data: TherapistData;
  ai_summary: string | null;
  ai_recommendations: string | null;
  ai_silent_therapists_advice: string | null;
  marketing_data?: MarketingData;
  ai_marketing?: string | null;
  email_status: string | null;
  created_at: string;
};

type RawReport = ReportShared & {
  week_start?: string;
  week_end?: string;
  month_start?: string;
  month_end?: string;
};

type Report = ReportShared & {
  period_start: string;
  period_end: string;
};

function normalizeReport(r: RawReport): Report {
  const { week_start, week_end, month_start, month_end, ...shared } = r;
  return {
    ...shared,
    period_start: week_start ?? month_start ?? "",
    period_end: week_end ?? month_end ?? "",
  };
}

function MarketingSection({ marketing, advice }: { marketing?: MarketingData; advice?: string | null }) {
  const channels = marketing?.channels ?? [];
  if (channels.length === 0 && !advice) return null;
  return (
    <section>
      <h3 className="text-sm font-black text-[#0F5468] mb-3">ערוצי שיווק — מאיפה הגיעו המבקרים</h3>
      {channels.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white overflow-hidden mb-3">
          <table className="w-full text-right text-sm">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs">
              <tr>
                <th className="px-3 py-2 font-semibold text-stone-500">ערוץ</th>
                <th className="px-3 py-2 font-semibold text-stone-500 text-center">ביקורים</th>
                <th className="px-3 py-2 font-semibold text-stone-400 text-center">כניסות</th>
                <th className="px-3 py-2 font-semibold text-stone-500 text-center">צפיות</th>
                <th className="px-3 py-2 font-semibold text-stone-500 text-center">פניות</th>
                <th className="px-3 py-2 font-semibold text-stone-500 text-center">צפייה→פנייה</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(c => (
                <tr key={c.channel} className="border-b border-stone-100">
                  <td className="px-3 py-2 font-semibold text-stone-800">{CHANNEL_LABELS[c.channel as keyof typeof CHANNEL_LABELS] ?? c.channel}</td>
                  <td className="px-3 py-2 text-center text-stone-600">{c.sessions ?? "—"}</td>
                  <td className="px-3 py-2 text-center text-stone-400">{c.pageViews}</td>
                  <td className="px-3 py-2 text-center text-stone-600">{c.profileViews}</td>
                  <td className="px-3 py-2 text-center font-bold text-stone-800">{c.contactClicks}</td>
                  <td className="px-3 py-2 text-center text-stone-600">{c.profileViews > 0 ? `${c.viewToClick}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-stone-400 leading-5 px-3 py-2">
            <b>ביקורים</b> = מבקרים ייחודיים. <b>כניסות</b> = צפיות-עמוד גולמיות (כולל בוטים/פרי-פץ') — גבוה מהקליקים שגוגל מחייבת. ל-CPL השתמשו במשפך הקמפיינים בדשבורד, המיושר מול הקליקים המחויבים.
          </p>
        </div>
      )}
      {advice && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <MarkdownText text={advice} />
        </div>
      )}
    </section>
  );
}

function formatTextWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>,
  );
}

function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-7 text-stone-700">
      {blocks.map((block, i) => {
        if (/^\s*-\s/.test(block)) {
          const items = block.split(/\n/).filter(l => /^\s*-\s/.test(l));
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

function MiniBars({ title, data, color = "#2e7d8c", limit = 6 }: { title: string; data: FilterEntry[]; color?: string; limit?: number }) {
  if (!data || data.length === 0) return null;
  const max = data[0]?.count ?? 1;
  const slice = data.slice(0, limit);
  return (
    <div>
      <h4 className="text-xs font-black text-stone-500 mb-2 uppercase tracking-wide">{title}</h4>
      <div className="space-y-1">
        {slice.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-20 text-xs text-stone-600 text-left shrink-0 truncate" title={d.name}>{d.name}</span>
            <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full flex items-center justify-end px-1.5"
                style={{ width: `${Math.max((d.count / max) * 100, 8)}%`, background: color }}>
                <span className="text-[10px] font-bold text-white">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const HEB_MONTHS_ABBR = ["", "ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function formatHebrewBucketLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(5);
  return `${d.getDate()} ${HEB_MONTHS_ABBR[d.getMonth() + 1]}`;
}

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (!trend || trend.length === 0) return null;
  const data = trend.map(t => ({ ...t, label: formatHebrewBucketLabel(t.week_start) }));
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#78716c" }} />
          <YAxis tick={{ fontSize: 10, fill: "#78716c" }} />
          <Tooltip contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl" }} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Heebo" }} />
          <Line type="monotone" dataKey="pageViews" stroke="#3b82f6" name="כניסות" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="profileViews" stroke="#9333ea" name="צפיות" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="contactClicks" stroke="#22c55e" name="פניות" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="quizCompletions" stroke="#f59e0b" name="סיומי שאלון" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonCard({ label, current, monthAvg, quarterAvg, color, cfg }: {
  label: string; current: number; monthAvg: number; quarterAvg: number; color: string; cfg: ModeConfig;
}) {
  function pctOf(curr: number, base: number) {
    if (base === 0) return curr === 0 ? "—" : "חדש";
    const p = Math.round(((curr - base) / base) * 100);
    return p > 0 ? `+${p}%` : `${p}%`;
  }
  function color4(curr: number, base: number) {
    if (base === 0) return "text-stone-400";
    const p = (curr - base) / base;
    if (p >= 0.05) return "text-green-600";
    if (p <= -0.05) return "text-red-600";
    return "text-stone-400";
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-xs font-bold text-stone-700">{label}</span>
      </div>
      <div className="text-2xl font-black text-stone-900 mb-2">{current.toLocaleString("he-IL")}</div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-lg bg-stone-50 px-2 py-1.5">
          <div className="text-stone-400">{cfg.compareMidLabel}</div>
          <div className="font-bold text-stone-700">{monthAvg}</div>
          <div className={`font-bold ${color4(current, monthAvg)}`}>{pctOf(current, monthAvg)}</div>
        </div>
        <div className="rounded-lg bg-stone-50 px-2 py-1.5">
          <div className="text-stone-400">{cfg.compareLongLabel}</div>
          <div className="font-bold text-stone-700">{quarterAvg}</div>
          <div className={`font-bold ${color4(current, quarterAvg)}`}>{pctOf(current, quarterAvg)}</div>
        </div>
      </div>
    </div>
  );
}

function ComparisonCards({ comparison, cfg }: { comparison: ComparisonStats; cfg: ModeConfig }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <ComparisonCard cfg={cfg} label="כניסות" current={comparison.current.pageViews} monthAvg={comparison.monthAvg.pageViews} quarterAvg={comparison.quarterAvg.pageViews} color="#3b82f6" />
      <ComparisonCard cfg={cfg} label="צפיות בפרופיל" current={comparison.current.profileViews} monthAvg={comparison.monthAvg.profileViews} quarterAvg={comparison.quarterAvg.profileViews} color="#9333ea" />
      <ComparisonCard cfg={cfg} label="פניות" current={comparison.current.contactClicks} monthAvg={comparison.monthAvg.contactClicks} quarterAvg={comparison.quarterAvg.contactClicks} color="#22c55e" />
      <ComparisonCard cfg={cfg} label="סיומי שאלון" current={comparison.current.quizCompletions} monthAvg={comparison.monthAvg.quizCompletions} quarterAvg={comparison.quarterAvg.quizCompletions} color="#f59e0b" />
    </div>
  );
}

function TherapistTrendList({ rows, direction, cfg }: { rows: TherapistTrendRow[]; direction: "up" | "down"; cfg: ModeConfig }) {
  if (rows.length === 0) {
    return <p className="text-xs text-stone-400">{direction === "up" ? cfg.noTrendUp : cfg.noTrendDown}</p>;
  }
  const arrow = direction === "up" ? "▲" : "▼";
  const colorCls = direction === "up" ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50";

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <table className="w-full text-right text-sm">
        <thead className="bg-stone-50 border-b border-stone-200 text-xs">
          <tr>
            <th className="px-3 py-2 font-semibold text-stone-500">מטפל</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">{cfg.trendColCurrent}</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">{cfg.trendColAvg}</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">שינוי</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const pctText = r.changePct == null ? "חדש" : `${arrow} ${Math.abs(r.changePct)}%`;
            return (
              <tr key={r.id} className="border-b border-stone-100">
                <td className="px-3 py-2 font-semibold text-stone-800">{r.full_name}</td>
                <td className="px-3 py-2 text-center font-bold text-stone-700">{r.currentWeek}</td>
                <td className="px-3 py-2 text-center text-stone-500">{r.prior4WeekAvg}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${colorCls}`}>
                    {pctText}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SilentTherapistsTable({ rows }: { rows: SilentTherapist[] }) {
  function concerns(t: SilentTherapist): string[] {
    const c: string[] = [];
    if (t.bio_length < 80) c.push("ביו קצר");
    if (!t.has_photo) c.push("אין תמונה");
    if (t.training_count <= 2) c.push("מעט תחומים");
    if (t.region_count <= 1) c.push("מעט אזורים");
    return c;
  }
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <table className="w-full text-right text-sm">
        <thead className="bg-stone-50 border-b border-stone-200 text-xs">
          <tr>
            <th className="px-3 py-2 font-semibold text-stone-500">מטפל</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">סטטוס</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">צפיות</th>
            <th className="px-3 py-2 font-semibold text-stone-500 text-center">ימים בקידום</th>
            <th className="px-3 py-2 font-semibold text-stone-500">דגלים בפרופיל</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 25).map(t => {
            const flags = concerns(t);
            const invisible = t.views === 0;
            const dp = t.days_promoted;
            const dpCls = dp == null ? "text-stone-400" : dp >= 30 ? "text-red-600 font-bold" : dp >= 14 ? "text-amber-600 font-bold" : "text-stone-600";
            return (
              <tr key={t.id} className="border-b border-stone-100">
                <td className="px-3 py-2 font-semibold text-stone-800">{t.full_name}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${invisible ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {invisible ? "🔇 לא נצפה" : "👁️ נצפה — לא לחצו"}
                  </span>
                </td>
                <td className="px-3 py-2 text-center font-bold text-stone-700">{t.views}</td>
                <td className={`px-3 py-2 text-center ${dpCls}`}>{dp == null ? "—" : dp}</td>
                <td className="px-3 py-2 text-xs text-stone-500">{flags.length > 0 ? flags.join(" · ") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 25 && (
        <p className="text-xs text-stone-400 px-3 py-2">מציג 25 ראשונים מתוך {rows.length}.</p>
      )}
    </div>
  );
}

function ReportCard({ r, cfg, expanded, onToggle }: { r: Report; cfg: ModeConfig; expanded: boolean; onToggle: () => void }) {
  const period = `${r.period_start} – ${r.period_end}`;
  const sentOk = r.email_status === "sent";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden mb-4">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <span className="text-stone-400 text-xs">{expanded ? "▼" : "◀"}</span>
          <span className="font-black text-stone-800">{cfg.periodPrefix} {period}</span>
          <span className="text-xs text-stone-400">
            {r.patient_data.contactClicks} פניות · {r.therapist_data.totalActive} מטפלים
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sentOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {sentOk ? "מייל נשלח" : "מייל נכשל"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-200 px-6 py-5 bg-stone-50/30 space-y-6">
          {r.ai_summary && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">סיכום</h3>
              <MarkdownText text={r.ai_summary} />
            </section>
          )}

          {r.patient_data.comparison && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-3">{cfg.comparisonTitle}</h3>
              <ComparisonCards comparison={r.patient_data.comparison} cfg={cfg} />
            </section>
          )}

          {r.patient_data.trend && r.patient_data.trend.length > 1 && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-3">{cfg.trendTitle(r.patient_data.trend.length)}</h3>
              <TrendChart trend={r.patient_data.trend} />
            </section>
          )}

          {r.ai_recommendations && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">המלצות פעולה</h3>
              <MarkdownText text={r.ai_recommendations} />
            </section>
          )}

          <MarketingSection marketing={r.marketing_data} advice={r.ai_marketing} />

          {(r.therapist_data.growers || r.therapist_data.decliners) && (
            <section className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-black text-[#0F5468] mb-2">מטפלים בעלייה</h3>
                <TherapistTrendList rows={r.therapist_data.growers ?? []} direction="up" cfg={cfg} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#0F5468] mb-2">מטפלים בירידה</h3>
                <TherapistTrendList rows={r.therapist_data.decliners ?? []} direction="down" cfg={cfg} />
              </div>
            </section>
          )}

          {r.therapist_data.silentPayingTherapists && r.therapist_data.silentPayingTherapists.length > 0 && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">
                {cfg.silentTitle}
                <span className="mr-2 text-xs text-stone-400 font-normal">
                  ({r.therapist_data.silentPayingTherapists.length})
                </span>
              </h3>
              <p className="text-xs text-stone-500 mb-3">
                🔇 {r.therapist_data.invisiblePayingCount ?? 0} לא נצפו · 👁️ {r.therapist_data.viewedNoClickPayingCount ?? 0} נצפו ולא לחצו
              </p>
              <SilentTherapistsTable rows={r.therapist_data.silentPayingTherapists} />
              {r.ai_silent_therapists_advice && (
                <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
                  <MarkdownText text={r.ai_silent_therapists_advice} />
                </div>
              )}
            </section>
          )}

          {r.therapist_data.silentPayingTherapists && r.therapist_data.silentPayingTherapists.length === 0 && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">{cfg.silentTitle}</h3>
              <p className="text-sm text-green-700">{cfg.silentAllOk}</p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-black text-[#0F5468] mb-3">מספרים מרכזיים</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <Stat label="כניסות" value={r.patient_data.pageViews} />
              <Stat label="צפיות" value={r.patient_data.profileViews} />
              <Stat label="פניות" value={r.patient_data.contactClicks} highlight />
              <Stat label="סיומי שאלון" value={r.patient_data.quizCompleted.adults + r.patient_data.quizCompleted.kids} />
              <Stat label="מטפלים" value={r.therapist_data.totalActive} />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F5468]">ביקוש (מטופלים)</h3>
              <MiniBars title="אזורים נצפים" data={r.patient_data.byRegion} color="#2e7d8c" />
              <MiniBars title="נושאים" data={r.patient_data.byIssue} color="#1a3a5c" />
              <MiniBars title="פילטרים" data={r.patient_data.popularFilters} color="#9333ea" />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F5468]">היצע (מטפלים)</h3>
              <MiniBars title="סוג מטפל" data={r.therapist_data.byTherapistType} color="#0F5468" />
              <MiniBars title="תחומי הכשרה" data={r.therapist_data.byTrainingArea} color="#f59e0b" />
              <MiniBars title="אזורי פעילות" data={r.therapist_data.byRegion} color="#22c55e" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${highlight ? "bg-[#0F5468] text-white border-[#0F5468]" : "bg-white border-stone-200"}`}>
      <div className="text-xl font-black">{value.toLocaleString("he-IL")}</div>
      <div className={`text-[10px] mt-0.5 ${highlight ? "text-white/80" : "text-stone-500"}`}>{label}</div>
    </div>
  );
}

export default function ReportsPage() {
  // מצב מתחיל null עד שקוראים את ה-URL - כך יש בדיוק טעינה אחת ואין מרוץ
  // בין שתי בקשות במקביל (ממצא ביקורת: קישור ?type=monthly הציג שורות
  // שבועיות תחת תוויות חודשיות כשהתשובה השבועית הגיעה אחרונה).
  const [mode, setMode] = useState<ReportMode | null>(null);
  // מטמון לכל מצב: מעבר טאב חוזר לא מוריד מחדש חצי מגה של דוחות.
  const [cache, setCache] = useState<Record<ReportMode, Report[] | null>>({
    weekly: null,
    monthly: null,
  });
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  // מונה רענון: הפקת דוח מאלצת טעינה מחדש של המצב הנוכחי.
  const [reloadKey, setReloadKey] = useState(0);

  const cfg = mode ? MODE_CONFIG[mode] : MODE_CONFIG.weekly;
  const reports = mode ? cache[mode] : null;

  // קריאת ?type מהכתובות הישנות - פעם אחת, לפני כל טעינה.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    setMode(t === "monthly" ? "monthly" : "weekly");
  }, []);

  useEffect(() => {
    if (mode === null) return;
    // יש מטמון - אין בקשה נוספת. רענון (runNow) מאפס את המטמון של המצב
    // הנוכחי לפני העלאת reloadKey, ולכן עובר את השער הזה.
    if (cache[mode] !== null) return;
    let ignore = false; // שומר תשובה מאוחרת של מצב קודם מלדרוס את הנוכחי
    setError("");
    fetch(MODE_CONFIG[mode].listApi, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (ignore) return;
        if (json.ok) {
          const normalized: Report[] = (json.reports as RawReport[]).map(normalizeReport);
          setCache(prev => ({ ...prev, [mode]: normalized }));
          setExpanded(prev => prev ?? normalized[0]?.id ?? null);
        } else setError(json.error ?? "שגיאה");
      })
      .catch(() => {
        if (!ignore) setError("שגיאת רשת");
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reloadKey]);

  function switchMode(m: ReportMode) {
    if (m === mode) return;
    setMode(m);
    setExpanded(null);
    setRunMsg("");
    window.history.replaceState(null, "", `/admin/reports${m === "monthly" ? "?type=monthly" : ""}`);
  }

  async function runNow() {
    if (mode === null) return;
    setRunning(true);
    setRunMsg("מפיק דוח — כולל ניתוח AI, עשוי לקחת 2-3 דקות…");
    const json = await triggerReport(cfg.triggerApi);
    if (json.ok) {
      // הבאנר נשאר על המסך; רק הרשימה של המצב הנוכחי נטענת מחדש.
      setRunMsg(`${cfg.runMsgPrefix} ${json.period_start} (${json.emailStatus})`);
      setCache(prev => ({ ...prev, [mode]: null }));
      setReloadKey(k => k + 1);
    } else {
      setRunMsg(`שגיאה: ${json.error}`);
    }
    setRunning(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-stone-900">דוחות</h1>
            <div className="flex rounded-full border border-stone-300 overflow-hidden text-sm font-bold">
              {(Object.keys(MODE_CONFIG) as ReportMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`px-4 py-1.5 transition-colors ${mode === m ? "bg-stone-800 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
                >
                  {MODE_CONFIG[m].toggleLabel}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-1">{cfg.subtitle}</p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-xl bg-[#0F5468] text-white px-4 py-2 text-sm font-bold hover:bg-[#0a3f4f] disabled:opacity-50 transition-colors"
        >
          {running ? "מפיק..." : "הפק דוח עכשיו"}
        </button>
      </div>

      {runMsg && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          {runMsg}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 mb-6">
          <p className="font-bold mb-1">שגיאה: {error}</p>
          <p className="text-xs text-red-500">{cfg.errorHint}</p>
        </div>
      )}

      {reports === null && !error && <p className="text-sm text-stone-400">טוען...</p>}

      {reports && reports.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-stone-500 mb-4">{cfg.emptyTitle}</p>
          <p className="text-xs text-stone-400">{cfg.emptyHint}</p>
        </div>
      )}

      {reports && reports.map(r => (
        <ReportCard
          key={r.id}
          r={r}
          cfg={cfg}
          expanded={expanded === r.id}
          onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
        />
      ))}
    </main>
  );
}
