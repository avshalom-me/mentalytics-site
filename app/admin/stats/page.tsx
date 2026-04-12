"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TherapistStat, Period } from "@/app/api/admin-stats/route";

type StatsData = {
  paying: TherapistStat[];
  free: TherapistStat[];
  generated_at: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week",  label: "7 ימים אחרונים" },
  { value: "month", label: "30 ימים אחרונים" },
  { value: "all",   label: "כל הזמנים" },
];

function StatsBadge({ value, color }: { value: number; color: string }) {
  if (value === 0) return <span className="text-gray-300 text-sm">—</span>;
  return <span className={`font-bold text-sm ${color}`}>{value}</span>;
}

function StatsTable({ title, rows, badge }: { title: string; rows: TherapistStat[]; badge: React.ReactNode }) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? rows.filter(r =>
        r.full_name.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const totalWa   = filtered.reduce((s, r) => s + r.whatsapp, 0);
  const totalPh   = filtered.reduce((s, r) => s + r.phone, 0);
  const totalEm   = filtered.reduce((s, r) => s + r.email_clicks, 0);
  const totalAll  = filtered.reduce((s, r) => s + r.total, 0);
  const totalMatch = filtered.reduce((s, r) => s + r.match_clicks, 0);
  const totalDir  = filtered.reduce((s, r) => s + r.directory_clicks, 0);

  return (
    <section className="mb-12">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-black text-stone-900">{title}</h2>
        {badge}
        <span className="text-sm text-stone-400">
          {search.trim() ? `${filtered.length} מתוך ${rows.length}` : `${rows.length} מטפלים`}
        </span>
        <div className="mr-auto">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או מייל..."
            className="rounded-xl border border-stone-200 px-4 py-2 text-sm outline-none focus:border-[#0F5468] w-56"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center text-stone-400 text-sm">
          אין מטפלים בקטגוריה זו
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 bg-white px-6 py-8 text-center text-stone-400 text-sm">
          לא נמצאו תוצאות עבור &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs">#</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs">שם מטפל</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs">מייל</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">💬 וואטסאפ</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">📞 טלפון</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">✉️ מייל</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">🎯 התאמה</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">🔍 מאגר</th>
                <th className="px-5 py-3 font-semibold text-stone-500 text-xs text-center">סה&quot;כ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${r.total === 0 ? "opacity-40" : ""}`}>
                  <td className="px-5 py-3.5 text-stone-400 text-xs">{i + 1}</td>
                  <td className="px-5 py-3.5 font-semibold text-stone-800">{r.full_name || "—"}</td>
                  <td className="px-5 py-3.5 text-stone-400 text-xs">{r.email || "—"}</td>
                  <td className="px-5 py-3.5 text-center"><StatsBadge value={r.whatsapp} color="text-green-600" /></td>
                  <td className="px-5 py-3.5 text-center"><StatsBadge value={r.phone} color="text-stone-700" /></td>
                  <td className="px-5 py-3.5 text-center"><StatsBadge value={r.email_clicks} color="text-blue-600" /></td>
                  <td className="px-5 py-3.5 text-center"><StatsBadge value={r.match_clicks} color="text-purple-600" /></td>
                  <td className="px-5 py-3.5 text-center"><StatsBadge value={r.directory_clicks} color="text-orange-600" /></td>
                  <td className="px-5 py-3.5 text-center">
                    {r.total > 0
                      ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-stone-100 font-black text-stone-800 text-sm">{r.total}</span>
                      : <span className="text-stone-200 text-sm">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 border-t-2 border-stone-200">
                <td className="px-5 py-3" colSpan={3}>
                  <span className="text-xs font-black text-stone-500 uppercase tracking-wide">
                    {search.trim() ? "סיכום תוצאות" : "סיכום"}
                  </span>
                </td>
                <td className="px-5 py-3 text-center font-black text-green-600">{totalWa}</td>
                <td className="px-5 py-3 text-center font-black text-stone-700">{totalPh}</td>
                <td className="px-5 py-3 text-center font-black text-blue-600">{totalEm}</td>
                <td className="px-5 py-3 text-center font-black text-purple-600">{totalMatch}</td>
                <td className="px-5 py-3 text-center font-black text-orange-600">{totalDir}</td>
                <td className="px-5 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-stone-800 font-black text-white text-base">{totalAll}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminStatsPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-stats?period=${period}`, { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (json.ok) setData({ paying: json.paying, free: json.free, generated_at: json.generated_at });
        else setError(json.error ?? "שגיאה לא ידועה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [period]);

  const totalAll = data ? [...data.paying, ...data.free].reduce((s, r) => s + r.total, 0) : 0;
  const periodLabel = PERIODS.find(p => p.value === period)?.label ?? "";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');`}</style>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900">סטטיסטיקת לחיצות</h1>
          {data?.generated_at && (
            <p className="text-xs text-stone-400 mt-1">
              עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!loading && data && (
            <div className="rounded-2xl bg-stone-900 text-white px-5 py-2.5 text-center min-w-[80px]">
              <div className="text-2xl font-black leading-none">{totalAll}</div>
              <div className="text-xs text-stone-400 mt-0.5">לחיצות</div>
            </div>
          )}
          <Link href="/admin/therapists" className="text-sm text-stone-500 underline hover:text-stone-700">
            ← חזרה
          </Link>
        </div>
      </div>

      {/* Period toggle */}
      <div className="mb-8 flex items-center gap-3">
        <span className="text-sm font-semibold text-stone-600">תקופה:</span>
        <div className="flex rounded-xl border border-stone-200 overflow-hidden text-sm font-semibold">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 transition-colors ${
                period === p.value
                  ? "bg-[#0F5468] text-white"
                  : "bg-white text-stone-500 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-stone-400 animate-pulse">טוען...</span>}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 mb-6">
          <p className="font-bold mb-1">שגיאה: {error}</p>
          <p className="text-xs text-red-500">ייתכן שטבלת המעקב עדיין לא נוצרה ב-Supabase. הרץ את קובץ <code>supabase_migration_contact_clicks.sql</code>.</p>
        </div>
      )}

      {!loading && data && (
        <>
          <StatsTable
            title="מטפלים מקודמים"
            rows={data.paying}
            badge={<span className="rounded-full px-2.5 py-0.5 text-xs font-black bg-yellow-100 text-yellow-800 border border-yellow-300">★ מקודם</span>}
          />
          <StatsTable
            title="מטפלים חינמיים"
            rows={data.free}
            badge={<span className="rounded-full px-2.5 py-0.5 text-xs font-black bg-green-100 text-green-800">חינמי</span>}
          />

          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-5 text-sm text-stone-600 leading-6">
            <p className="font-bold text-stone-800 mb-1">🤖 חיבור סוכן AI</p>
            <p>
              הנתונים זמינים דרך{" "}
              <code className="bg-stone-200 px-1.5 py-0.5 rounded text-xs">/api/admin-stats?period={period}</code>{" "}
              כ-JSON מובנה עם פילוח לפי {periodLabel}. סוכן AI יוכל לקרוא לנקודה זו, לעבד את הנתונים ולשלוח מיילים מותאמים אישית לכל מטפל.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
