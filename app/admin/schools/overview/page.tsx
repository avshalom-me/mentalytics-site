"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Notice, cardCls, errText, getJson, hebDate, shekel, useSchoolsBase } from "../shared";

// "מבט על": המסך הראשון של ה-CRM המשותף לבעלים ולשותפה. העבודה עצמה, לא ההסכם:
// 1. ארבעה מספרים: בתי ספר ברשימה, עסקאות פתוחות, תקבולי הרבעון, פתוח לגבייה.
// 2. מה דורש טיפול היום, ולצידו הפעילות שנרשמה לפי שבוע.
// 3. גרפים: תקבולים לפי חודש, הצינור לפי שלב, בתי ספר לפי סטטוס, שימוש בשאלון.
// 4. תקבולים לפי בית ספר.
// השיעור, שלבי הסולם והשערים אינם כאן, בהחלטת הבעלים (21/10/2026): הם במסך
// "מצב לפי ההסכם" (agreement/page.tsx), בקישור הקטן בתחתית תפריט הצד.
// גרף בלי נתונים מציג הסבר מתי יתמלא, כדי שגרף ריק לא ייראה כמו גרף חסר.
// הסכומים נטו, בלי מע"מ, כמו בהסכם; "פתוח לגבייה" כולל מע"מ, כי זה מה שנגבה.
// בית ספר הדגמה לא נספר. הנתונים: app/lib/schools-api/overview.ts.

type Overview = {
  today: string;
  school_year: string;
  quarter: { label: string; start: string; end: string; received_net: number };
  money: { received_total_net: number; received_year_net: number; open_gross: number; overdue_gross: number; overdue_count: number; due_30_gross: number };
  months: { month: string; net: number }[];
  customers: {
    paying: number;
    active_licenses: number;
    schools_by_status: Record<string, number>;
    status_rows: { status: string; label: string; count: number }[];
    top: { school_id: string; name: string; net: number }[];
  };
  pipeline: { stages: { stage: string; label: string; count: number; value: number }[]; open_count: number; open_value: number; won_year: number; lost_year: number };
  usage: { weeks: { week: string; count: number }[]; last30: number; idle_active: number };
  activity: { weeks: { week: string; count: number }[] };
  attention: {
    overdue_payments: number;
    overdue_tasks: number;
    my_overdue_tasks: number;
    stale_next_steps: number;
    new_inbound: number;
    renew_soon: number;
    idle_active: number;
    bank_waiting: number | null;
  };
};

const TEAL = "#3D8C8A";
const num = (n: number) => Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });
/** "תשלום אחד באיחור" / "3 תשלומים באיחור". */
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${num(n)} ${many}`);
const HE_MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const monthLabel = (ym: string) => `${HE_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const weekLabel = (iso: string) => hebDate(iso).split(".").slice(0, 2).join(".");
const tooltipStyle = { fontFamily: "Heebo", fontSize: 12, direction: "rtl" as const, borderRadius: 12, border: "1px solid #e7e5e4" };
const axisTick = { fontSize: 11, fill: "#78716c" };
const cursor = { fill: "rgba(61,140,138,0.08)" };

export default function SchoolsOverviewPage() {
  const base = useSchoolsBase();
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getJson<Overview>("/api/admin-schools/overview")
      .then((j) => {
        if (!cancelled) setD(j);
      })
      .catch((e) => {
        if (!cancelled) setError(errText(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!d) return <div className="p-6">{error ? <Notice error={error} /> : <span className="text-sm text-stone-500">טוען...</span>}</div>;

  const { money, attention } = d;
  const schoolsTotal = Object.values(d.customers.schools_by_status).reduce((a, b) => a + b, 0);
  const activityTotal = d.activity.weeks.reduce((a, w) => a + w.count, 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">מבט על</h1>
        <p className="mt-1 text-sm text-stone-500">
          ענף שאלון היועצות · שנת הלימודים {d.school_year} · {d.quarter.label} (עד {hebDate(d.quarter.end)})
        </p>
      </div>

      {/* 1. המספרים */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="בתי ספר ברשימה" value={num(schoolsTotal)} sub={`${num(d.customers.paying)} משלמים · ${num(d.customers.active_licenses)} רישיונות פעילים`} />
        <Tile label="עסקאות פתוחות" value={num(d.pipeline.open_count)} sub={d.pipeline.open_value ? `בשווי ${shekel(d.pipeline.open_value)}` : "בלי סכום משוער"} />
        <Tile label={`תקבולים נטו, ${d.quarter.label}`} value={shekel(d.quarter.received_net)} sub={`בשנת הלימודים: ${shekel(money.received_year_net)}`} />
        <Tile
          label="פתוח לגבייה"
          value={shekel(money.open_gross)}
          sub={money.overdue_count ? `${money.overdue_count} באיחור, ${shekel(money.overdue_gross)}` : money.due_30_gross ? `צפוי ב-30 יום: ${shekel(money.due_30_gross)}` : "אין תשלום באיחור"}
          alert={money.overdue_count > 0}
        />
      </div>

      {/* 2. מה דורש טיפול, והפעילות */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardCls}>
          <h2 className="text-base font-black text-stone-900">מה דורש טיפול</h2>
          <AttentionList base={base} a={attention} overdueGross={money.overdue_gross} />
        </section>

        <ChartCard
          title="פעילות שנרשמה, לפי שבוע"
          sub={activityTotal ? `${num(activityTotal)} שיחות, פגישות, הודעות והדרכות ב-12 השבועות האחרונים` : undefined}
          empty={activityTotal === 0}
          emptyText="עדיין לא נרשמה פעילות. כל שיחה, פגישה או הודעה שנרשמת בעמוד בית הספר ('רישום מהיר') נספרת כאן."
          height="h-44"
        >
          <BarChart data={d.activity.weeks.map((w) => ({ ...w, label: weekLabel(w.week) }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
            <YAxis tick={axisTick} width={32} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={cursor} formatter={(v) => [num(Number(v)), "פעולות"]} labelFormatter={(l) => `שבוע מ-${l}`} contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ChartCard>
      </div>

      {/* 3. הגרפים */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="תקבולים נטו לפי חודש"
          sub={`מצטבר מיום ההתחלה: ${shekel(money.received_total_net)}`}
          empty={money.received_total_net === 0}
          emptyText="עדיין לא התקבל תשלום. הגרף יתמלא עם התשלום הראשון מבית ספר."
        >
          <BarChart data={d.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
            <YAxis tickFormatter={(v) => `₪${num(Number(v))}`} tick={axisTick} width={64} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={cursor} formatter={(v) => [shekel(Number(v)), "תקבולים נטו"]} contentStyle={tooltipStyle} />
            <Bar dataKey="net" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="הצינור: עסקאות פתוחות לפי שלב"
          sub={`בשנת הלימודים: ${num(d.pipeline.won_year)} נסגרו, ${num(d.pipeline.lost_year)} אבדו`}
          link={{ href: `${base}/pipeline`, label: "ללוח הצינור" }}
          empty={d.pipeline.stages.every((s) => s.count === 0)}
          emptyText="עדיין אין עסקאות. כל פנייה מהטופס באתר, וכל עסקה שנפתחת בעמוד בית ספר, נכנסת לכאן."
        >
          <BarChart data={d.pipeline.stages} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} reversed />
            <YAxis type="category" dataKey="label" tick={axisTick} width={118} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip
              cursor={cursor}
              formatter={(v, _n, item) => [`${num(Number(v))} עסקאות${item?.payload?.value ? `, ${shekel(item.payload.value)}` : ""}`, ""]}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="count" fill={TEAL} radius={[4, 0, 0, 4]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="בתי ספר לפי סטטוס"
          sub={schoolsTotal ? `${num(schoolsTotal)} בתי ספר ברשימה` : undefined}
          link={{ href: base, label: "לרשימה" }}
          empty={schoolsTotal === 0}
          emptyText="עדיין אין בתי ספר ברשימה. בית ספר נוסף מהרשימה ('בית ספר חדש') או מטופס הפנייה באתר."
          height="h-44"
        >
          <BarChart data={d.customers.status_rows} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} reversed />
            <YAxis type="category" dataKey="label" tick={axisTick} width={92} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={cursor} formatter={(v) => [num(Number(v)), "בתי ספר"]} contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={TEAL} radius={[4, 0, 0, 4]} maxBarSize={16} isAnimationActive={false} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="שימוש בשאלון: שאלונים שמולאו בבתי ספר ברישיון, לפי שבוע"
          sub={
            d.usage.last30 || d.usage.idle_active
              ? `ב-30 הימים האחרונים: ${num(d.usage.last30)}${d.usage.idle_active ? ` · ${d.usage.idle_active === 1 ? "בית ספר אחד ברישיון לא השתמש" : `${num(d.usage.idle_active)} בתי ספר ברישיון לא השתמשו`} בחודש האחרון` : ""}`
              : undefined
          }
          empty={d.usage.weeks.every((w) => w.count === 0)}
          emptyText="עדיין אין בתי ספר ברישיון שמילאו שאלון. כל שאלון שיועצת ממלאת עם קוד הגישה של בית הספר נספר כאן, בלי תוכן."
          height="h-44"
        >
          <BarChart data={d.usage.weeks.map((w) => ({ ...w, label: weekLabel(w.week) }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
            <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
            <YAxis tick={axisTick} width={36} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
            <Tooltip cursor={cursor} formatter={(v) => [num(Number(v)), "שאלונים"]} labelFormatter={(l) => `שבוע מ-${l}`} contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ChartCard>
      </div>

      {/* 4. הלקוחות */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-black text-stone-900">תקבולים לפי בית ספר</h2>
          <Link href={`${base}/payments`} className="text-xs font-bold text-[#2A6462] underline">לרישיונות ולתשלומים</Link>
        </div>
        {d.customers.top.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">עדיין לא התקבל תשלום מבית ספר.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <tbody>
              {d.customers.top.map((c) => (
                <tr key={c.school_id} className="border-t border-stone-100">
                  <td className="py-2">
                    <Link href={`${base}/${c.school_id}`} className="font-bold text-stone-800 underline decoration-stone-300">{c.name}</Link>
                  </td>
                  <td className="py-2 text-end text-stone-700">{shekel(c.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="text-xs font-bold text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-black ${alert ? "text-[#A87010]" : "text-[#2A6462]"}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${alert ? "font-bold text-[#A87010]" : "text-stone-500"}`}>{sub}</div>}
    </div>
  );
}

/** כרטיס גרף. בלי נתונים: הצירים נשארים, ומעליהם הסבר מתי הגרף יתמלא. */
function ChartCard({
  title,
  sub,
  link,
  empty,
  emptyText,
  height = "h-52",
  children,
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
  empty: boolean;
  emptyText: string;
  height?: string;
  children: React.ReactElement;
}) {
  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-900">{title}</h2>
        {link && (
          <Link href={link.href} className="text-xs font-bold text-[#2A6462] underline">
            {link.label}
          </Link>
        )}
      </div>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
      <div className={`relative mt-3 ${height}`}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="max-w-xs rounded-xl bg-white/90 px-4 py-3 text-center text-sm leading-6 text-stone-500 shadow-sm">{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// רובריקות: חומרה + מה + כמה + כפתור. שורה מופיעה רק כשיש בה משהו.
function AttentionList({ base, a, overdueGross }: { base: string; a: Overview["attention"]; overdueGross: number }) {
  const rows: { level: "high" | "mid" | "low"; text: string; action: string; href: string }[] = [];
  if (a.overdue_payments) rows.push({ level: "high", text: `${count(a.overdue_payments, "תשלום אחד", "תשלומים")} באיחור (${shekel(overdueGross)})`, action: "לגבייה", href: `${base}/payments` });
  if (a.bank_waiting) rows.push({ level: "high", text: `${count(a.bank_waiting, "זיכוי אחד בבנק מתאים", "זיכויים בבנק מתאימים")} לתשלום צפוי`, action: "לשיוך", href: `${base}/payments` });
  if (a.new_inbound) rows.push({ level: "high", text: a.new_inbound === 1 ? "פנייה חדשה מהאתר מחכה לחזרה" : `${num(a.new_inbound)} פניות חדשות מהאתר מחכות לחזרה`, action: "לצינור", href: `${base}/pipeline` });
  if (a.overdue_tasks) rows.push({ level: "mid", text: `${count(a.overdue_tasks, "משימה אחת", "משימות")} באיחור בענף${a.my_overdue_tasks ? `, ${num(a.my_overdue_tasks)} שלך` : ""}`, action: "למשימות", href: `${base}/tasks` });
  if (a.stale_next_steps) rows.push({ level: "mid", text: a.stale_next_steps === 1 ? "עסקה אחת שמועד הצעד הבא שלה עבר" : `${num(a.stale_next_steps)} עסקאות שמועד הצעד הבא שלהן עבר`, action: "לצינור", href: `${base}/pipeline` });
  if (a.renew_soon) rows.push({ level: "mid", text: a.renew_soon === 1 ? "רישיון אחד מסתיים בחודשיים הקרובים" : `${num(a.renew_soon)} רישיונות מסתיימים בחודשיים הקרובים`, action: "לחידוש", href: `${base}/payments` });
  if (a.idle_active) rows.push({ level: "low", text: a.idle_active === 1 ? "בית ספר אחד ברישיון לא מילא שאלון בחודש האחרון" : `${num(a.idle_active)} בתי ספר ברישיון לא מילאו שאלון בחודש האחרון`, action: "לבתי הספר", href: base });
  if (rows.length === 0) return <p className="mt-3 text-sm text-stone-500">אין כרגע משהו פתוח.</p>;
  const dot = { high: "bg-[#A87010]", mid: "bg-[#D49018]", low: "bg-stone-300" };
  const word = { high: "דחוף", mid: "השבוע", low: "למעקב" };
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={r.text} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot[r.level]}`} />
            <span className="shrink-0 text-xs font-bold text-stone-500">{word[r.level]}</span>
            <span className="text-stone-800">{r.text}</span>
          </span>
          <Link href={r.href} className="shrink-0 rounded-full border border-[#3D8C8A] px-3 py-1 text-xs font-bold text-[#2A6462]">{r.action}</Link>
        </li>
      ))}
    </ul>
  );
}
