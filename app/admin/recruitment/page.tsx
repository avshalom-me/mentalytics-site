"use client";

import { useEffect, useState } from "react";
import { CHANNEL_LABELS } from "@/app/lib/attribution";

type Period = "week" | "month" | "all";

type CampaignRow = {
  campaign: string;
  channel: string | null;
  visitors: number;
  signups: number;
  approved: number;
  paying: number;
};
type ChannelRow = {
  channel: keyof typeof CHANNEL_LABELS;
  signups: number;
  approved: number;
  paying: number;
};

type Data = {
  period: Period;
  totalSignups: number;
  campaigns: CampaignRow[];
  channels: ChannelRow[];
  generated_at: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 ימים" },
  { value: "month", label: "30 ימים" },
  { value: "all", label: "כל הזמנים" },
];

// Friendly Hebrew labels for the known recruitment campaigns. Any other
// campaign value falls back to its raw utm_campaign string.
const CAMPAIGN_LABELS: Record<string, string> = {
  "therapist-direct": "מטפלים — ישירה (A)",
  "therapist-evocative": "מטפלים — מעוררת (B)",
};
function campaignLabel(c: string): string {
  return CAMPAIGN_LABELS[c] ?? c;
}

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
function pct(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export default function RecruitmentPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-therapist-campaigns?period=${period}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [period]);

  const direct = data?.campaigns.find((c) => c.campaign === "therapist-direct");
  const evocative = data?.campaigns.find((c) => c.campaign === "therapist-evocative");

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-black text-stone-900">גיוס מטפלים — תוצאות קמפיינים</h1>
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
          כמה <strong>מבקרים</strong> כל מודעה הביאה, כמה מהם <strong>נרשמו</strong>, ומי עברו אישור/הפכו למקודמים — הכל מהצד שלנו, בלי הממשק המבלבל של פייסבוק. כך רואים איזו מודעה מביאה את הלידים הטובים יותר.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Total */}
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 mb-8 inline-block min-w-[200px] text-center">
              <div className="text-3xl font-black text-teal-800">{num(data.totalSignups)}</div>
              <div className="text-xs font-semibold mt-1 text-teal-700">סך הרשמות מטפלים (בטווח)</div>
            </div>

            {/* A/B head-to-head — always shown as the scoreboard, even at 0:0 */}
            <ABCompare direct={direct} evocative={evocative} />

            {/* All campaigns */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
              <h2 className="text-base font-black text-stone-800 mb-4">מבקרים והרשמות לפי קמפיין</h2>
              {data.campaigns.length === 0 ? (
                <p className="text-sm text-stone-400">
                  עדיין אין תנועה או הרשמות מקמפיינים. הנתונים יופיעו כאן ברגע שמישהו יגיע דרך מודעה מתויגת.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-stone-500 text-xs border-b border-stone-200">
                      <th className="text-right font-semibold py-2 px-2">קמפיין</th>
                      <th className="text-center font-semibold py-2 px-2">מבקרים</th>
                      <th className="text-center font-semibold py-2 px-2">הרשמות</th>
                      <th className="text-center font-semibold py-2 px-2">המרה</th>
                      <th className="text-center font-semibold py-2 px-2">אושרו</th>
                      <th className="text-center font-semibold py-2 px-2">מקודמים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
                      <tr key={c.campaign} className="border-b border-stone-100">
                        <td className="py-2.5 px-2 font-semibold text-stone-700">{campaignLabel(c.campaign)}</td>
                        <td className="text-center px-2 font-bold text-stone-900">{num(c.visitors)}</td>
                        <td className="text-center px-2 font-bold text-stone-900">{num(c.signups)}</td>
                        <td className="text-center px-2 text-stone-600">{c.visitors > 0 ? `${pct(c.signups, c.visitors)}%` : "—"}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.approved)}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.paying)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Channel breakdown */}
            {data.channels.length > 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
                <h2 className="text-base font-black text-stone-800 mb-4">הרשמות לפי מקור</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-stone-500 text-xs border-b border-stone-200">
                      <th className="text-right font-semibold py-2 px-2">מקור</th>
                      <th className="text-center font-semibold py-2 px-2">הרשמות</th>
                      <th className="text-center font-semibold py-2 px-2">אושרו</th>
                      <th className="text-center font-semibold py-2 px-2">מקודמים</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channels.map((c) => (
                      <tr key={c.channel} className="border-b border-stone-100">
                        <td className="py-2.5 px-2">
                          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${CHANNEL_COLOR[c.channel] ?? CHANNEL_COLOR.unknown}`}>
                            {CHANNEL_LABELS[c.channel] ?? c.channel}
                          </span>
                        </td>
                        <td className="text-center px-2 font-bold text-stone-900">{num(c.signups)}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.approved)}</td>
                        <td className="text-center px-2 text-stone-600">{num(c.paying)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

function ABCompare({ direct, evocative }: { direct?: CampaignRow; evocative?: CampaignRow }) {
  const aS = direct?.signups ?? 0;
  const bS = evocative?.signups ?? 0;
  const aV = direct?.visitors ?? 0;
  const bV = evocative?.visitors ?? 0;
  // Decide by signups (the real goal); fall back to visitors while signups are
  // still tied (e.g. both 0), so the card shows who leads on traffic meanwhile.
  const leader = aS !== bS ? (aS > bS ? "a" : "b") : aV === bV ? null : aV > bV ? "a" : "b";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6">
      <h2 className="text-base font-black text-stone-800 mb-1">השוואת A/B — איזו מודעה מנצחת</h2>
      <p className="text-xs text-stone-500 mb-4">היעד הוא <strong>הרשמות</strong>. עד שיהיו — המובילה נקבעת לפי <strong>מבקרים</strong> (תנועה).</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ABCard title="מטפלים — ישירה (A)" row={direct} isLeader={leader === "a"} accent="#3D8C8A" />
        <ABCard title="מטפלים — מעוררת (B)" row={evocative} isLeader={leader === "b"} accent="#D49018" />
      </div>
      {aV === 0 && bV === 0 ? (
        <p className="mt-4 text-center text-sm text-stone-500">
          עדיין אין תנועה מהמודעות — יופיע כאן ברגע שמישהו ילחץ על מודעה A או B. 🟢
        </p>
      ) : aS === 0 && bS === 0 ? (
        <p className="mt-4 text-center text-sm text-stone-500">
          יש תנועה, אבל עדיין אין הרשמות. המנצחת תיקבע לפי הרשמות — צריך עוד מבקרים (עוד ימים או תקציב) כדי להכריע. 🟡
        </p>
      ) : leader === null ? (
        <p className="mt-4 text-center text-sm font-semibold text-stone-500">תיקו כרגע — צריך עוד נתונים כדי להכריע.</p>
      ) : null}
    </div>
  );
}

function ABCard({
  title,
  row,
  isLeader,
  accent,
}: {
  title: string;
  row?: CampaignRow;
  isLeader: boolean;
  accent: string;
}) {
  const visitors = row?.visitors ?? 0;
  const signups = row?.signups ?? 0;
  return (
    <div
      className="rounded-2xl p-5 relative"
      style={{
        border: isLeader ? `2px solid ${accent}` : "1px solid var(--line, #DDE9E8)",
        background: isLeader ? "rgba(61,140,138,0.04)" : "#fff",
      }}
    >
      {isLeader && (
        <span
          className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ background: accent }}
        >
          🏆 מובילה
        </span>
      )}
      <div className="text-sm font-black text-stone-800 mb-3">{title}</div>
      <div className="flex items-end gap-8">
        <div>
          <div className="text-4xl font-black" style={{ color: accent }}>{num(visitors)}</div>
          <div className="text-xs font-semibold text-stone-500 mt-1">מבקרים מהמודעה</div>
        </div>
        <div>
          <div className="text-4xl font-black text-stone-800">{num(signups)}</div>
          <div className="text-xs font-semibold text-stone-500 mt-1">נרשמו</div>
        </div>
      </div>
      <div className="mt-4 text-sm text-stone-600">
        המרה: <span className="font-bold text-stone-800">{pct(signups, visitors)}%</span>
        {signups > 0 && (
          <span> · {num(row?.approved ?? 0)} אושרו · {num(row?.paying ?? 0)} מקודמים</span>
        )}
      </div>
    </div>
  );
}
