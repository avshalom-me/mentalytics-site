"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Notice, cardCls, errText, getJson, hebDate, shekel, useSchoolsBase } from "../shared";

// "מבט על": המסך הראשון של ה-CRM המשותף לבעלים ולשותפה.
//
// הסדר הוא לפי השאלות שנשאלות כל בוקר:
// 1. איפה אנחנו מול ההסכם: השיעור החל, בתי ספר משלמים, תקבולי הרבעון, פתוח לגבייה.
// 2. מה חסר לשלב הבא בסולם (שני השערים והמועד, סעיף 9), ומה דורש טיפול היום.
// 3. המגמה: תקבולים לפי חודש, הצינור לפי שלב, השימוש בשאלון לפי שבוע.
// 4. הלקוחות: תקבולים לפי בית ספר (סעיף 16.1).
// הסכומים נטו, בלי מע"מ, כמו בהסכם; "פתוח לגבייה" כולל מע"מ, כי זה מה שנגבה.
// בית ספר הדגמה לא נספר. הנתונים: app/lib/schools-api/overview.ts.

type Overview = {
  today: string;
  school_year: string;
  quarter: { label: string; start: string; end: string; received_net: number };
  ladder: {
    start_date: string | null;
    schools_now: number;
    receipts_now: number;
    current: { stage: number; rate: number; since: string | null };
    next: null | { stage: number; rate: number; not_before: string | null; gate_schools: number | null; gate_receipts: number | null; gates_met_on: string | null; applies_from: string | null };
  };
  money: { received_total_net: number; received_year_net: number; open_gross: number; overdue_gross: number; overdue_count: number; due_30_gross: number };
  months: { month: string; net: number }[];
  customers: { paying: number; active_licenses: number; schools_by_status: Record<string, number>; top: { school_id: string; name: string; net: number }[] };
  pipeline: { stages: { stage: string; label: string; count: number; value: number }[]; open_count: number; open_value: number; won_year: number; lost_year: number };
  usage: { weeks: { week: string; count: number }[]; last30: number; idle_active: number };
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
const pct = (r: number) => `${Math.round(r * 100)}%`;
const num = (n: number) => Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });
/** "תשלום אחד באיחור" / "3 תשלומים באיחור". */
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${num(n)} ${many}`);
const HE_MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const monthLabel = (ym: string) => `${HE_MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const tooltipStyle = { fontFamily: "Heebo", fontSize: 12, direction: "rtl" as const, borderRadius: 12, border: "1px solid #e7e5e4" };
const axisTick = { fontSize: 11, fill: "#78716c" };

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

  const { ladder, money, attention } = d;
  const next = ladder.next;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">מבט על</h1>
        <p className="mt-1 text-sm text-stone-500">
          ענף שאלון היועצות · שנת הלימודים {d.school_year} · {d.quarter.label} (עד {hebDate(d.quarter.end)})
          {ladder.start_date ? ` · יום ההתחלה ${hebDate(ladder.start_date)}` : ""}
        </p>
      </div>

      {/* 1. איפה אנחנו */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="השיעור החל" value={pct(ladder.current.rate)} sub={`שלב ${ladder.current.stage} מתוך 5${ladder.current.since ? `, מ-${hebDate(ladder.current.since)}` : ""}`} />
        <Tile label="בתי ספר משלמים" value={num(d.customers.paying)} sub={`${num(d.customers.active_licenses)} רישיונות פעילים`} />
        <Tile label={`תקבולים נטו, ${d.quarter.label}`} value={shekel(d.quarter.received_net)} sub={`בשנת הלימודים: ${shekel(money.received_year_net)}`} />
        <Tile
          label="פתוח לגבייה"
          value={shekel(money.open_gross)}
          sub={money.overdue_count ? `${money.overdue_count} באיחור, ${shekel(money.overdue_gross)}` : money.due_30_gross ? `צפוי ב-30 יום: ${shekel(money.due_30_gross)}` : "אין תשלום באיחור"}
          alert={money.overdue_count > 0}
        />
      </div>

      {/* 2. השלב הבא ומה דורש טיפול */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardCls}>
          <h2 className="text-base font-black text-stone-900">{next ? `הדרך לשלב ${next.stage} (${pct(next.rate)})` : "השלב האחרון בסולם"}</h2>
          {next ? (
            <>
              <p className="mt-1 text-xs text-stone-500">שלב חל רק כשגם המועד הגיע וגם שני השערים הושגו (סעיף 9). השיעור אינו יורד.</p>
              <div className="mt-4 space-y-4">
                {next.gate_schools != null && <Meter label="בתי ספר משלמים" now={ladder.schools_now} goal={next.gate_schools} fmt={num} />}
                {next.gate_receipts != null && <Meter label="תקבולים נטו מצטברים" now={ladder.receipts_now} goal={next.gate_receipts} fmt={shekel} />}
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-stone-700">המועד</span>
                  <span className={next.not_before && next.not_before <= d.today ? "font-bold text-[#2A6462]" : "text-stone-600"}>
                    {next.not_before ? (next.not_before <= d.today ? `הגיע (${hebDate(next.not_before)})` : `מ-${hebDate(next.not_before)}`) : "אחרי שנקבע יום ההתחלה"}
                  </span>
                </div>
              </div>
              {next.applies_from && <p className="mt-3 rounded-xl bg-[#EAF4F3] p-2.5 text-sm font-bold text-[#2A6462]">שני השערים הושגו. השלב חל מ-{hebDate(next.applies_from)}.</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-600">השיעור נשאר {pct(ladder.current.rate)} כל עוד ההסכם בתוקף (סעיף 9.4).</p>
          )}
          <p className="mt-3 text-xs text-stone-400">לפי הנתונים במערכת. העמידה בשערים מאושרת בידי רואה החשבון בסוף כל רבעון (סעיף 9.2).</p>
        </section>

        <section className={cardCls}>
          <h2 className="text-base font-black text-stone-900">מה דורש טיפול</h2>
          <AttentionList base={base} a={attention} overdueGross={money.overdue_gross} />
        </section>
      </div>

      {/* 3. המגמה */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={cardCls}>
          <h2 className="text-base font-black text-stone-900">תקבולים נטו לפי חודש</h2>
          <p className="mt-0.5 text-xs text-stone-500">מצטבר מיום ההתחלה: {shekel(money.received_total_net)}</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.months.map((m) => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} />
                <YAxis tickFormatter={(v) => `₪${num(Number(v))}`} tick={axisTick} width={64} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
                <Tooltip cursor={{ fill: "rgba(61,140,138,0.08)" }} formatter={(v) => [shekel(Number(v)), "תקבולים נטו"]} contentStyle={tooltipStyle} />
                <Bar dataKey="net" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-black text-stone-900">הצינור: עסקאות פתוחות לפי שלב</h2>
            <Link href={`${base}/pipeline`} className="text-xs font-bold text-[#2A6462] underline">ללוח הצינור</Link>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {num(d.pipeline.open_count)} פתוחות בשווי {shekel(d.pipeline.open_value)} · בשנת הלימודים: {num(d.pipeline.won_year)} נסגרו, {num(d.pipeline.lost_year)} אבדו
          </p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.pipeline.stages} layout="vertical" margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} reversed />
                <YAxis type="category" dataKey="label" tick={axisTick} width={118} tickLine={false} axisLine={false} orientation="right" />
                <Tooltip
                  cursor={{ fill: "rgba(61,140,138,0.08)" }}
                  formatter={(v, _n, item) => [`${num(Number(v))} עסקאות${item?.payload?.value ? `, ${shekel(item.payload.value)}` : ""}`, ""]}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="count" fill={TEAL} radius={[4, 0, 0, 4]} maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="text-base font-black text-stone-900">שימוש בשאלון: שאלונים שמולאו בבתי ספר ברישיון, לפי שבוע</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            ב-30 הימים האחרונים: {num(d.usage.last30)}
            {d.usage.idle_active ? ` · ${d.usage.idle_active === 1 ? "בית ספר אחד ברישיון לא השתמש" : `${num(d.usage.idle_active)} בתי ספר ברישיון לא השתמשו`} בחודש האחרון` : ""}
          </p>
          <div className="mt-3 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.usage.weeks.map((w) => ({ ...w, label: hebDate(w.week).split(".").slice(0, 2).join(".") }))} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f1" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#e7e5e4" }} interval={1} />
                <YAxis tick={axisTick} width={36} allowDecimals={false} tickLine={false} axisLine={false} orientation="right" />
                <Tooltip cursor={{ fill: "rgba(61,140,138,0.08)" }} formatter={(v) => [num(Number(v)), "שאלונים"]} labelFormatter={(l) => `שבוע מ-${l}`} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 4. הלקוחות */}
        <section className={cardCls}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-black text-stone-900">תקבולים לפי בית ספר</h2>
            <Link href={`${base}/payments`} className="text-xs font-bold text-[#2A6462] underline">לרישיונות ולתשלומים</Link>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {Object.entries(d.customers.schools_by_status).length
              ? `בתי ספר ברשימה: ${num(Object.values(d.customers.schools_by_status).reduce((a, b) => a + b, 0))}, מהם ${num(d.customers.schools_by_status.customer ?? 0)} לקוחות`
              : "עדיין אין בתי ספר ברשימה."}
          </p>
          {d.customers.top.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">עדיין לא התקבל תשלום מבית ספר.</p>
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

function Meter({ label, now, goal, fmt }: { label: string; now: number; goal: number; fmt: (n: number) => string }) {
  const share = goal > 0 ? Math.min(1, now / goal) : 1;
  const done = now >= goal;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-bold text-stone-700">{label}</span>
        <span className={done ? "font-bold text-[#2A6462]" : "text-stone-600"}>
          {fmt(now)} מתוך {fmt(goal)}{done ? " ✓" : ""}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100" role="meter" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={now} aria-label={label}>
        <div className="h-full rounded-full bg-[#3D8C8A]" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
    </div>
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
