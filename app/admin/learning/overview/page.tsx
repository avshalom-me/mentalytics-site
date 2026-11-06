"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import HelpTip from "../../components/HelpTip";
import { AttentionList, ChartCard, GOLD, Section, TEAL, Tile, chartAxisTick, chartCursor, chartTooltipStyle, num, type AttentionRow } from "../../components/BranchWidgets";
import { SIGNUP_CHANNEL_LABELS, VIEW_SOURCE_LABELS, btn, getJson } from "../shared";

// "מבט על" של ענף לימוד חכם: שישה מספרים, מה דורש טיפול, וארבעה גרפים
// שבועיים. אותו פורמט כמו מבט העל של ענף בתי הספר; הנתונים מ-
// app/api/admin-teachers/overview. גרף ריק מציג מתי יתמלא.

type Week = {
  week: string;
  signups: Record<string, number>;
  searches: number;
  contacts: number;
  impressions: number;
  views: Record<string, number>;
};
type Overview = {
  today: string;
  tiles: { listed: number; pending: number; with_photo: number; searches_30d: number; contacts_30d: number; impressions_30d: number; signups_30d: number; door_views_30d: number; join_views_30d: number };
  attention: { pending: number; oldest_pending_days: number; drafts: number; drafts_by_kind: Record<string, number>; no_contacts: number; empty_searches_30d: number };
  weeks: Week[];
  supply_demand: { region: string; teachers: number; searches: number; empty_searches: number }[];
  channels: Record<string, { total: number; last30: number }>;
};

const weekLabel = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;
const SIGNUP_COLORS: Record<string, string> = { ai: TEAL, community: GOLD, google: "#7FB3B1", direct: "#C2DFDE", other: "#d6d3d1" };
const VIEW_COLORS: Record<string, string> = { google: TEAL, ai: GOLD, direct: "#C2DFDE", social: "#7FB3B1", other: "#d6d3d1" };
const DRAFT_KIND_LABELS: Record<string, string> = { certificate_request: "בקשת תעודה", photo_request: "בקשת תמונה", profile_completion: "השלמת פרופיל", founding_note: "מייל למורים הראשונים" };

export default function LearningOverviewPage() {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const load = useCallback(() => {
    getJson<Overview>("/api/admin-teachers/overview")
      .then((j) => (j.ok ? setD(j) : setError(j.error || "שגיאה בטעינה")))
      .catch(() => setError("שגיאה בטעינה"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function careRun() {
    setRunning(true);
    try {
      const r = await fetch("/api/admin-teachers/overview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "care_run" }) });
      const j = await r.json().catch(() => null);
      if (!j?.ok) alert(j?.error || `הבדיקה נכשלה (${r.status})`);
      else alert(`נבדקו ${j.result.teachers} מורים. טיוטות חדשות: ${j.result.created}, עודכנו: ${j.result.refreshed}, נסגרו מעצמן: ${j.result.recovered}.`);
      load();
    } finally {
      setRunning(false);
    }
  }

  if (error) return <div className="p-6 text-sm text-red-700">{error}</div>;
  if (!d) return <div className="p-6 text-sm text-stone-500">טוען...</div>;

  const a = d.attention;
  const rows: AttentionRow[] = [];
  if (a.pending) rows.push({ level: "high", text: a.pending === 1 ? `מורה אחד/ת ממתין/ה לאישור${a.oldest_pending_days >= 3 ? ` (${a.oldest_pending_days} ימים)` : ""}` : `${num(a.pending)} מורים ממתינים לאישור${a.oldest_pending_days >= 3 ? ` (הוותיק/ה ${a.oldest_pending_days} ימים)` : ""}`, action: "לאישור", href: "/admin/learning?tab=pending" });
  if (a.drafts) {
    const parts = Object.entries(a.drafts_by_kind).map(([k, n]) => `${DRAFT_KIND_LABELS[k] ?? k}: ${n}`).join(", ");
    rows.push({ level: a.drafts_by_kind.certificate_request ? "high" : "mid", text: `${a.drafts === 1 ? "טיוטת מייל אחת ממתינה" : `${num(a.drafts)} טיוטות מייל ממתינות`} לשליחה שלך (${parts})`, action: "לטיוטות", href: "/admin/learning?tab=care" });
  }
  if (a.no_contacts) rows.push({ level: "low", text: a.no_contacts === 1 ? "מורה אחד/ת עם חשיפות ובלי פניות" : `${num(a.no_contacts)} מורים עם חשיפות ובלי פניות`, action: "לבדיקה", href: "/admin/learning?tab=care" });
  if (a.empty_searches_30d) rows.push({ level: "mid", text: `${num(a.empty_searches_30d)} חיפושים ב-30 יום חזרו בלי אף מורה`, action: "לביקוש", href: "/admin/learning/demand" });

  const t = d.tiles;
  const weeks = d.weeks.map((w) => ({ ...w, label: weekLabel(w.week), ...Object.fromEntries(Object.entries(w.signups).map(([k, v]) => [`s_${k}`, v])), ...Object.fromEntries(Object.entries(w.views).map(([k, v]) => [`v_${k}`, v])) }));
  const noSignups = d.weeks.every((w) => Object.values(w.signups).every((v) => v === 0));
  const noActivity = d.weeks.every((w) => w.searches === 0 && w.contacts === 0);
  const noViews = d.weeks.every((w) => Object.values(w.views).every((v) => v === 0));
  const sd = d.supply_demand.slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black text-stone-900">מבט על</h1>
        <HelpTip id="teachers" />
        <span className="text-xs text-stone-400">נכון ל-{weekLabel(d.today)}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="מורים מוצגים" value={num(t.listed)} sub={`${num(t.with_photo)} עם תמונה`} href="/admin/learning?tab=listed" />
        <Tile label="ממתינים לאישור" value={num(t.pending)} alert={t.pending > 0} sub={t.pending ? "לאישור או לדחייה" : "אין ממתינים"} href="/admin/learning?tab=pending" />
        <Tile label="חיפושים, 30 יום" value={num(t.searches_30d)} sub="במאגר ובתוצאות השאלון" href="/admin/learning/demand" />
        <Tile label="פניות, 30 יום" value={num(t.contacts_30d)} sub={`${num(t.impressions_30d)} חשיפות כרטיס`} />
        <Tile label="הרשמות, 30 יום" value={num(t.signups_30d)} sub={`${num(t.join_views_30d)} ביקורים בדף ההצטרפות`} href="/admin/learning/recruitment" />
        <Tile label="צפיות בדלת, 30 יום" value={num(t.door_views_30d)} sub="ביקורים ב-/learning ובמאגר" />
      </div>

      <Section
        title="דורש טיפול"
        sub="הכללים רצים כל בוקר בקרון של המורים ומכינים טיוטות; שום מייל לא יוצא בלי לחיצה שלך."
        right={
          <button type="button" disabled={running} onClick={careRun} className={btn}>
            {running ? "בודק..." : "בדיקה עכשיו"}
          </button>
        }
      >
        <AttentionList rows={rows} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="הרשמות לפי שבוע וערוץ" sub="לפי מה שהקישור של המורה נשא: עוזרי AI, קבוצות, גוגל, ישירות" link={{ href: "/admin/learning/recruitment", label: "לגיוס" }} empty={noSignups} emptyText="עדיין אין הרשמות ב-12 השבועות האחרונים. כל מורה שנרשם/ת בדף ההצטרפות נספר/ת כאן לפי הערוץ שממנו הגיע/ה.">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={chartAxisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
            <YAxis tick={chartAxisTick} width={32} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={chartCursor} contentStyle={chartTooltipStyle} labelFormatter={(l) => `שבוע מ-${l}`} formatter={(v, name) => [num(Number(v)), SIGNUP_CHANNEL_LABELS[String(name).replace("s_", "")] ?? String(name)]} />
            <Legend formatter={(v) => SIGNUP_CHANNEL_LABELS[String(v).replace("s_", "")] ?? String(v)} wrapperStyle={{ fontSize: 11 }} />
            {Object.keys(SIGNUP_COLORS).map((k) => (
              <Bar key={k} dataKey={`s_${k}`} stackId="s" fill={SIGNUP_COLORS[k]} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ChartCard>

        <ChartCard title="חיפושים מול פניות, לפי שבוע" sub="חיפוש = הורה שסינן במאגר או לחץ 'חיפוש מורה' בדוח; פנייה = לחיצה על וואטסאפ או טלפון" empty={noActivity} emptyText="עדיין אין חיפושים ופניות ב-12 השבועות האחרונים. הם נרשמים מהמאגר ומכרטיסי המורים בדוח השאלון.">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={chartAxisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
            <YAxis tick={chartAxisTick} width={32} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={chartCursor} contentStyle={chartTooltipStyle} labelFormatter={(l) => `שבוע מ-${l}`} formatter={(v, name) => [num(Number(v)), name === "searches" ? "חיפושים" : "פניות"]} />
            <Legend formatter={(v) => (v === "searches" ? "חיפושים" : "פניות")} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="searches" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="contacts" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard title="היצע מול ביקוש לפי אזור, 30 יום" sub="מורים מוצגים שמלמדים באזור, מול חיפושים של הורים באותו אזור" link={{ href: "/admin/learning/demand", label: "לביקוש המלא" }} empty={sd.length === 0} emptyText="עדיין אין מורים ולא חיפושים לפי אזור. כשיהיו, הגרף יראה איפה הורים מחפשים ואין להם את מי למצוא." height="h-64">
          <BarChart data={sd} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={chartAxisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} reversed />
            <YAxis type="category" dataKey="region" tick={chartAxisTick} width={104} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={chartCursor} contentStyle={chartTooltipStyle} formatter={(v, name) => [num(Number(v)), name === "teachers" ? "מורים" : "חיפושים"]} />
            <Legend formatter={(v) => (v === "teachers" ? "מורים" : "חיפושים")} wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="teachers" fill={TEAL} radius={[4, 0, 0, 4]} maxBarSize={12} isAnimationActive={false} />
            <Bar dataKey="searches" fill={GOLD} radius={[4, 0, 0, 4]} maxBarSize={12} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard title="צפיות בדלת לפי מקור, לפי שבוע" sub="ביקורים ב-/learning ובמאגר, לפי מאיפה הגיעו" empty={noViews} emptyText="עדיין אין צפיות ב-12 השבועות האחרונים. כל ביקור בדף הנחיתה או במאגר נספר כאן לפי המקור (גוגל, עוזרי AI, ישירות).">
          <BarChart data={weeks} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={chartAxisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
            <YAxis tick={chartAxisTick} width={32} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={chartCursor} contentStyle={chartTooltipStyle} labelFormatter={(l) => `שבוע מ-${l}`} formatter={(v, name) => [num(Number(v)), VIEW_SOURCE_LABELS[String(name).replace("v_", "")] ?? String(name)]} />
            <Legend formatter={(v) => VIEW_SOURCE_LABELS[String(v).replace("v_", "")] ?? String(v)} wrapperStyle={{ fontSize: 11 }} />
            {Object.keys(VIEW_COLORS).map((k) => (
              <Bar key={k} dataKey={`v_${k}`} stackId="v" fill={VIEW_COLORS[k]} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ChartCard>
      </div>

      <Section title="ערוצי הרשמה" sub="מאיפה המורים הגיעו, מאז פתיחת הענף" right={<Link href="/admin/learning/recruitment" className="text-xs font-bold text-[#2A6462] underline">לקישורי הגיוס</Link>}>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400">
              <th className="py-1 text-start font-bold">ערוץ</th>
              <th className="py-1 text-start font-bold">30 יום</th>
              <th className="py-1 text-start font-bold">סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(d.channels).map(([k, v]) => (
              <tr key={k} className="border-t border-stone-100">
                <td className="py-1.5 font-bold text-stone-800">{SIGNUP_CHANNEL_LABELS[k] ?? k}</td>
                <td className="py-1.5 text-stone-700">{num(v.last30)}</td>
                <td className="py-1.5 text-stone-700">{num(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
