"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { MapPin, Activity, Users, TrendingUp, Lock, Stethoscope, ClipboardList } from "lucide-react";

export interface BucketRow {
  key: string;
  label: string;
  views: number;
}

export interface EnrichedStatsData {
  by_region: BucketRow[];
  by_issue: BucketRow[];
  by_treatment: BucketRow[];
  by_symptom: BucketRow[];
  by_age_band: BucketRow[];
  by_gender: BucketRow[];
  conversion: {
    total_views: number;
    unique_sessions: number;
    contacted: number;
    no_click_rate: number;
  };
  data_quality: {
    enough_data: boolean;
    period_days: number;
    total_views: number;
  };
}

// Adjacent entries are deliberately DIFFERENT hues (teal → gold → purple →
// terracotta → blue → green → pink → brown): with 2-4 buckets per chart the
// old blue-gradient palette made neighbouring slices indistinguishable.
const PALETTE = ["#2A6462", "#D49018", "#7C5CBF", "#C96B55", "#3E7CB1", "#5C9E6E", "#D4739E", "#8B6F47"];

function SectionCard({ icon: Icon, title, subtitle, children, accentColor = "#0F5468" }: {
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E0D8] bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${accentColor}15` }}>
          <Icon size={18} style={{ color: accentColor }} />
        </div>
        <div>
          <h3 className="font-bold text-stone-900">{title}</h3>
          {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6 text-sm text-stone-500 italic">{message}</div>
  );
}

function HorizontalBars({ data }: { data: BucketRow[] }) {
  if (data.length === 0) return <EmptyState message="אין מספיק נתונים להצגה" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 12, fill: "#374151" }}
          width={110}
          reversed
          orientation="right"
        />
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #E8E0D8", borderRadius: 8, fontSize: 12, direction: "rtl" }}
          formatter={(v: any) => [`${v} צפיות`, ""]}
          labelStyle={{ color: "#111" }}
        />
        <Bar dataKey="views" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ data }: { data: BucketRow[] }) {
  if (data.length === 0) return <EmptyState message="אין מספיק נתונים להצגה" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="views"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "white", border: "1px solid #E8E0D8", borderRadius: 8, fontSize: 12, direction: "rtl" }}
          formatter={(v: any, name: any) => [`${v} צפיות`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Ranked list with proportional bars - for long labels (specific findings)
// that don't fit as chart axis text.
function RankedList({ data, emptyMessage }: { data: BucketRow[]; emptyMessage: string }) {
  if (data.length === 0) return <EmptyState message={emptyMessage} />;
  const max = Math.max(...data.map((d) => d.views), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.key}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[13px] leading-5 text-stone-700">{d.label}</span>
            <span className="text-xs font-bold text-stone-500 flex-shrink-0">{d.views}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(6, Math.round((d.views / max) * 100))}%`, background: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EnrichedStatsPanel({ data }: { data: EnrichedStatsData }) {
  const { by_region, by_issue, by_treatment, by_symptom, by_age_band, by_gender, conversion, data_quality } = data;
  const contactRate = conversion.total_views > 0
    ? Math.round((conversion.contacted / conversion.total_views) * 1000) / 10
    : 0;

  if (!data_quality.enough_data) {
    return (
      <div className="mb-6 rounded-2xl border border-[#E8E0D8] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100">
            <Lock size={18} className="text-stone-400" />
          </div>
          <h3 className="font-bold text-stone-900">ניתוח מעמיק של יצירות הקשר שלך</h3>
        </div>
        <p className="text-sm text-stone-600 leading-6 mt-3">
          עדיין לא נאספו מספיק נתונים לניתוח מפורט. נציג פילוח מלא לפי איזור, סוג קושי, גילאים והמרה - כשיצטברו לפחות <strong>20 צפיות</strong> בפרופיל.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-center">
            <div className="text-2xl font-black text-stone-900">{conversion.total_views}</div>
            <div className="text-[11px] text-stone-500">צפיות בפרופיל (מצטבר)</div>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-center">
            <div className="text-2xl font-black text-stone-900">{conversion.contacted}</div>
            <div className="text-[11px] text-stone-500">לחיצות ליצירת קשר</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-extrabold text-stone-900">ניתוח מעמיק של יצירות הקשר שלך</h2>
        <span className="text-xs text-stone-500">מאז ההצטרפות ({data_quality.period_days} ימים)</span>
      </div>

      {/* Conversion summary */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,#F0F7FA,#E6F4F7)", border: "1px solid #D8E4E8" }}>
          <div className="text-3xl font-black text-[#0F5468]">{conversion.total_views.toLocaleString("he-IL")}</div>
          <div className="text-xs text-stone-600 mt-1">כניסות לפרופיל</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,#FDF6EE,#F5E8DC)", border: "1px solid #E8DCC8" }}>
          <div className="text-3xl font-black text-[#8B2E0A]">{conversion.unique_sessions.toLocaleString("he-IL")}</div>
          <div className="text-xs text-stone-600 mt-1">אנשים שונים</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,#F0F7F2,#DFF0E6)", border: "1px solid #C8DDD0" }}>
          <div className="text-3xl font-black text-[#2A5C3A]">{conversion.contacted.toLocaleString("he-IL")}</div>
          <div className="text-xs text-stone-600 mt-1">לחצו ליצור קשר</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "linear-gradient(135deg,#F8F0F4,#F0EBF8)", border: "1px solid #D4C4DC" }}>
          <div className="text-3xl font-black text-[#6B4080]">{contactRate}%</div>
          {/* "המרה" מופיע גם למעלה בדשבורד, שם היא חשיפה←כניסה. כאן זה שלב
              אחר במשפך (כניסה←פנייה), ובלי ההבחנה שני מספרים שונים נראים
              כמו סתירה - בדיוק הבלבול שדווח על הפרופיל האישי. */}
          <div className="text-xs text-stone-600 mt-1">מצפייה לפנייה</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard icon={MapPin} title="מאיפה פונים אליך" subtitle="פילוח גיאוגרפי של הצופים" accentColor="#0F5468">
          <HorizontalBars data={by_region} />
        </SectionCard>

        <SectionCard icon={Activity} title="מה הצורך שלהם" subtitle="סוגי הקשיים שהביאו אותם אליך" accentColor="#8B2E0A">
          <DonutChart data={by_issue} />
        </SectionCard>

        <SectionCard icon={Stethoscope} title="איזה טיפול הוביל אותם אליך" subtitle="ההמלצה שקיבלו בשאלון לפני שנכנסו לפרופיל שלך" accentColor="#7C5CBF">
          <RankedList data={by_treatment} emptyMessage="נאסף החל מ-19/7 - יוצג כשיצטברו מספיק כניסות מהשאלון" />
        </SectionCard>

        <SectionCard icon={ClipboardList} title="ואילו קשיים ספציפיים" subtitle="הממצא המדויק בשאלון שבגללו הופנו אליך" accentColor="#C96B55">
          <RankedList data={by_symptom} emptyMessage="נאסף החל מ-19/7 - יוצג כשיצטברו מספיק כניסות מהשאלון" />
        </SectionCard>

        <SectionCard icon={Users} title="גילאים עיקריים" subtitle="התפלגות הגילאים של הפונים" accentColor="#2A5C3A">
          <HorizontalBars data={by_age_band} />
        </SectionCard>

        <SectionCard icon={TrendingUp} title="התפלגות מגדרית" subtitle="" accentColor="#6B4080">
          <DonutChart data={by_gender} />
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-stone-400 leading-5">
        🔒 לשמירה על אנונימיות המטופלים - קבוצות עם פחות מ-3 צפיות מוצגות כ"אחר" או מוסתרות.
        הנתונים נאספים בצורה אנונימית מלאה ואינם כוללים פרטים מזהים.
      </p>
    </div>
  );
}
