"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { ResponsiveContainer } from "recharts";

// רכיבי "מבט על" של ענף באדמין: אריח מספר, כרטיס גרף עם מצב ריק, ורשימת
// "דורש טיפול". חולצו ממבט העל של ענף בתי הספר (6/11/2026) כדי שענף לימוד
// חכם ייראה אותו דבר. גרף בלי נתונים מציג הסבר מתי יתמלא, כדי שגרף ריק לא
// ייראה כמו גרף חסר.

export const cardCls = "rounded-2xl border border-stone-200 bg-white p-4";
export const TEAL = "#3D8C8A";
export const GOLD = "#D49018";
export const chartTooltipStyle = { fontFamily: "Heebo", fontSize: 12, direction: "rtl" as const, borderRadius: 12, border: "1px solid #e7e5e4" };
export const chartAxisTick = { fontSize: 11, fill: "#78716c" };
export const chartCursor = { fill: "rgba(61,140,138,0.08)" };
export const num = (n: number) => Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });

export function Tile({ label, value, sub, alert, href }: { label: string; value: string; sub?: string; alert?: boolean; href?: string }) {
  const body = (
    <>
      <div className="text-xs font-bold text-stone-500">{label}</div>
      <div className={`mt-1 text-2xl font-black ${alert ? "text-[#A87010]" : "text-[#2A6462]"}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${alert ? "font-bold text-[#A87010]" : "text-stone-500"}`}>{sub}</div>}
    </>
  );
  const cls = "rounded-2xl border border-stone-200 bg-white p-4";
  return href ? (
    <Link href={href} className={`${cls} block hover:border-[#3D8C8A]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** כרטיס גרף. בלי נתונים: הצירים נשארים, ומעליהם הסבר מתי הגרף יתמלא. */
export function ChartCard({
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
  children: ReactElement;
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
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="max-w-xs rounded-xl bg-white/90 px-4 py-3 text-center text-sm leading-6 text-stone-500 shadow-sm">{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export type AttentionRow = { level: "high" | "mid" | "low"; text: string; action: string; href: string };

/** רובריקות: חומרה + מה + כפתור. שורה מופיעה רק כשיש בה משהו. */
export function AttentionList({ rows, emptyText = "אין כרגע משהו פתוח." }: { rows: AttentionRow[]; emptyText?: string }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-stone-500">{emptyText}</p>;
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
          <Link href={r.href} className="shrink-0 rounded-full border border-[#3D8C8A] px-3 py-1 text-xs font-bold text-[#2A6462]">
            {r.action}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Section({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-black text-stone-900">{title}</h2>
        {right}
      </div>
      {sub && <p className="mt-0.5 text-xs text-stone-500">{sub}</p>}
      {children}
    </section>
  );
}
