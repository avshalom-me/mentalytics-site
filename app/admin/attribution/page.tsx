"use client";

import { useEffect, useState } from "react";
import { CHANNEL_LABELS } from "@/app/lib/attribution";

type Period = "week" | "month" | "all";

type ChannelRow = {
  channel: keyof typeof CHANNEL_LABELS;
  pageViews: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  viewToClick: number;
  impressionToClick: number;
};

type Totals = { pageViews: number; impressions: number; profileViews: number; contactClicks: number };
type CampaignRow = { campaign: string; contactClicks: number };

type Data = {
  period: Period;
  totals: Totals;
  channels: ChannelRow[];
  topCampaigns: CampaignRow[];
  generated_at: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 ימים" },
  { value: "month", label: "30 ימים" },
  { value: "all", label: "כל הזמנים" },
];

// Channel chip colours (matching the brand palette feel)
const CHANNEL_COLOR: Record<string, string> = {
  google_paid: "bg-blue-50 border-blue-200 text-blue-800",
  google_organic: "bg-sky-50 border-sky-200 text-sky-800",
  meta_paid: "bg-indigo-50 border-indigo-200 text-indigo-800",
  meta_organic: "bg-violet-50 border-violet-200 text-violet-800",
  whatsapp: "bg-green-50 border-green-200 text-green-800",
  direct: "bg-stone-50 border-stone-200 text-stone-700",
  referral: "bg-amber-50 border-amber-200 text-amber-800",
  other: "bg-stone-50 border-stone-200 text-stone-600",
  unknown: "bg-stone-50 border-stone-200 text-stone-400",
};

function num(n: number) {
  return n.toLocaleString("he-IL");
}

export default function AttributionPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-attribution?period=${period}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-black text-stone-900">מקורות לידים</h1>
          <div className="flex rounded-lg border border-stone-200 overflow-hidden bg-white">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  period === p.value ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          מאיפה מגיעים המבקרים, וכמה מהם מגיעים עד יצירת קשר עם מטפל (=ההמרה).
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Totals funnel */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              {[
                { label: "כניסות לעמודים", value: data.totals.pageViews, color: "bg-blue-50 border-blue-200 text-blue-800" },
                { label: "חשיפות כרטיס מטפל", value: data.totals.impressions, color: "bg-purple-50 border-purple-200 text-purple-800" },
                { label: "צפיות בפרופיל", value: data.totals.profileViews, color: "bg-amber-50 border-amber-200 text-amber-800" },
                { label: "יצירת קשר (המרה)", value: data.totals.contactClicks, color: "bg-green-50 border-green-200 text-green-800" },
              ].map((s) => (
                <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.color}`}>
                  <div className="text-3xl font-black">{num(s.value)}</div>
                  <div className="text-xs font-semibold mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Lead-source mix bar */}
            {data.channels.length > 0 && (
              <SourceMix channels={data.channels} />
            )}

            {/* Per-channel funnel table */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
              <h2 className="text-base font-black text-stone-800 mb-4">משפך לפי מקור</h2>
              {data.channels.length === 0 ? (
                <p className="text-sm text-stone-400">
                  אין עדיין נתוני מקור. האיסוף מתחיל מרגע שהקוד עולה לאוויר — נתונים היסטוריים מסומנים &quot;לא ידוע&quot;.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-stone-500 text-xs border-b border-stone-200">
                      <th className="text-right font-semibold py-2 px-2">מקור</th>
                      <th className="text-center font-semibold py-2 px-2">כניסות</th>
                      <th className="text-center font-semibold py-2 px-2">חשיפות</th>
                      <th className="text-center font-semibold py-2 px-2">צפיות פרופיל</th>
                      <th className="text-center font-semibold py-2 px-2">יצירת קשר</th>
                      <th className="text-center font-semibold py-2 px-2">צפייה→קשר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((c) => (
                      <tr key={c.channel} className="border-b border-stone-100">
                        <td className="py-2.5 px-2">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${CHANNEL_COLOR[c.channel] ?? CHANNEL_COLOR.other}`}>
                            {CHANNEL_LABELS[c.channel] ?? c.channel}
                          </span>
                        </td>
                        <td className="text-center px-2 text-stone-600">{num(c.pageViews)}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.impressions)}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.profileViews)}</td>
                        <td className="text-center px-2 font-bold text-stone-900">{num(c.contactClicks)}</td>
                        <td className="text-center px-2">
                          <span className={`font-bold ${c.viewToClick >= 20 ? "text-green-700" : c.viewToClick > 0 ? "text-amber-700" : "text-stone-300"}`}>
                            {c.profileViews > 0 ? `${c.viewToClick}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top campaigns */}
            {data.topCampaigns.length > 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
                <h2 className="text-base font-black text-stone-800 mb-4">קמפיינים מובילים (לפי יצירות קשר)</h2>
                <div className="space-y-2">
                  {data.topCampaigns.map((c) => (
                    <div key={c.campaign} className="flex items-center justify-between text-sm border-b border-stone-100 pb-1.5">
                      <span className="font-semibold text-stone-700">{c.campaign}</span>
                      <span className="font-bold text-stone-900">{num(c.contactClicks)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-stone-400">
              עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SourceMix({ channels }: { channels: ChannelRow[] }) {
  const total = channels.reduce((s, c) => s + c.contactClicks, 0);
  if (total === 0) return null;
  const withClicks = channels.filter((c) => c.contactClicks > 0);
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-4">תמהיל מקורות ההמרה (יצירות קשר)</h2>
      <div className="flex h-7 w-full overflow-hidden rounded-full border border-stone-200">
        {withClicks.map((c) => {
          const w = (c.contactClicks / total) * 100;
          const bar: Record<string, string> = {
            google_paid: "bg-blue-500", google_organic: "bg-sky-400", meta_paid: "bg-indigo-500",
            meta_organic: "bg-violet-400",
            whatsapp: "bg-green-500", direct: "bg-stone-400", referral: "bg-amber-500",
            other: "bg-stone-300", unknown: "bg-stone-200",
          };
          return (
            <div key={c.channel} className={`${bar[c.channel] ?? "bg-stone-300"} h-full`} style={{ width: `${w}%` }}
              title={`${CHANNEL_LABELS[c.channel]}: ${Math.round(w)}%`} />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {withClicks.map((c) => (
          <span key={c.channel}>
            {CHANNEL_LABELS[c.channel]} — {Math.round((c.contactClicks / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
