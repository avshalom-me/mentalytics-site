"use client";

import { useEffect, useState } from "react";

type Period = "week" | "month" | "all";
type RegionStatus = "needs_therapists" | "needs_patients" | "balanced" | "empty";

type RegionRow = {
  region: string;
  label: string;
  therapists: number;
  demand: number;
  demandPerTherapist: number | null;
  status: RegionStatus;
};

type TherapistLead = {
  id: string;
  full_name: string;
  online: boolean;
  regionLabels: string[];
  profileViews: number;
  contactClicks: number;
};

type Data = {
  period: Period;
  regions: RegionRow[];
  therapistLeads: TherapistLead[];
  onlineTherapistCount: number;
  payingTherapistCount: number;
  starvingCount: number;
  demandNoRegion: number;
  totals: { demand: number };
  generated_at: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "week", label: "7 ימים" },
  { value: "month", label: "30 ימים" },
  { value: "all", label: "כל הזמנים" },
];

const STATUS_META: Record<RegionStatus, { label: string; cls: string }> = {
  needs_therapists: { label: "צריך עוד מטפלים", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  needs_patients: { label: "צריך עוד מטופלים", cls: "bg-blue-50 border-blue-200 text-blue-800" },
  balanced: { label: "מאוזן", cls: "bg-green-50 border-green-200 text-green-800" },
  empty: { label: "אין נתונים", cls: "bg-stone-50 border-stone-200 text-stone-400" },
};

function num(n: number) {
  return n.toLocaleString("he-IL");
}

export default function SupplyDemandPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-supply-demand?period=${period}`)
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
          <h1 className="text-2xl font-black text-stone-900">היצע וביקוש לפי אזור</h1>
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
          איפה יש עודף מטפלים (לפרסם למטופלים) ואיפה עודף ביקוש (לגייס מטפלים). ביקוש = צפיות בפרופיל לפי אזור המטופל.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {data && !loading && (
          <>
            {/* Top cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
              <Card value={data.payingTherapistCount} label="מטפלים משלמים" cls="bg-teal-50 border-teal-200 text-teal-800" />
              <Card value={data.onlineTherapistCount} label="מתוכם אונליין (גמישים)" cls="bg-sky-50 border-sky-200 text-sky-800" />
              <Card value={data.totals.demand} label="ביקוש (צפיות עם אזור)" cls="bg-amber-50 border-amber-200 text-amber-800" />
              <Card
                value={data.starvingCount}
                label="מטפלים בלי אף פנייה"
                cls={data.starvingCount > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"}
              />
            </div>

            {/* Region balance table */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
              <h2 className="text-base font-black text-stone-800 mb-4">מאזן אזורי</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-500 text-xs border-b border-stone-200">
                    <th className="text-right font-semibold py-2 px-2">אזור</th>
                    <th className="text-center font-semibold py-2 px-2">מטפלים מקומיים</th>
                    <th className="text-center font-semibold py-2 px-2">ביקוש (צפיות)</th>
                    <th className="text-center font-semibold py-2 px-2">ביקוש למטפל</th>
                    <th className="text-center font-semibold py-2 px-2">מצב</th>
                  </tr>
                </thead>
                <tbody>
                  {data.regions.map((r) => (
                    <tr key={r.region} className="border-b border-stone-100">
                      <td className="py-2.5 px-2 font-semibold text-stone-700">{r.label}</td>
                      <td className="text-center px-2 text-stone-600">{num(r.therapists)}</td>
                      <td className="text-center px-2 text-stone-600">{num(r.demand)}</td>
                      <td className="text-center px-2 text-stone-600">
                        {r.demandPerTherapist == null ? "—" : r.demandPerTherapist}
                      </td>
                      <td className="text-center px-2">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_META[r.status].cls}`}>
                          {STATUS_META[r.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-stone-400 leading-5">
                מטפלי אונליין ({num(data.onlineTherapistCount)}) משלימים כל אזור ולא נספרים בעמודת &quot;מקומיים&quot;.
                {data.demandNoRegion > 0 && ` ${num(data.demandNoRegion)} צפיות ללא אזור מזוהה אינן בטבלה.`}
              </p>
            </div>

            {/* Per-therapist leads */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 mb-6 overflow-x-auto">
              <h2 className="text-base font-black text-stone-800 mb-1">פניות לכל מטפל משלם</h2>
              <p className="text-xs text-stone-400 mb-4">
                היעד: כל מטפל משלם מקבל לפחות פנייה אחת. מטפלים עם 0 פניות מסומנים — הם בסיכון נטישה.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-stone-500 text-xs border-b border-stone-200">
                    <th className="text-right font-semibold py-2 px-2">מטפל/ת</th>
                    <th className="text-right font-semibold py-2 px-2">אזור</th>
                    <th className="text-center font-semibold py-2 px-2">צפיות</th>
                    <th className="text-center font-semibold py-2 px-2">פניות</th>
                  </tr>
                </thead>
                <tbody>
                  {data.therapistLeads.map((t) => (
                    <tr key={t.id} className={`border-b border-stone-100 ${t.contactClicks === 0 ? "bg-red-50/40" : ""}`}>
                      <td className="py-2.5 px-2 font-semibold text-stone-700">{t.full_name}</td>
                      <td className="px-2 text-stone-500 text-xs">
                        {t.regionLabels.length ? t.regionLabels.join(", ") : "—"}
                        {t.online && <span className="text-sky-600"> · אונליין</span>}
                      </td>
                      <td className="text-center px-2 text-stone-600">{num(t.profileViews)}</td>
                      <td className="text-center px-2">
                        <span className={`font-bold ${t.contactClicks === 0 ? "text-red-600" : "text-green-700"}`}>
                          {num(t.contactClicks)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-stone-400">עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}</p>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ value, label, cls }: { value: number; label: string; cls: string }) {
  return (
    <div className={`rounded-2xl border p-4 text-center ${cls}`}>
      <div className="text-3xl font-black">{value.toLocaleString("he-IL")}</div>
      <div className="text-xs font-semibold mt-1">{label}</div>
    </div>
  );
}
