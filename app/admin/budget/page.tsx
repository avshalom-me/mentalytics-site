"use client";

import { useEffect, useState } from "react";
import {
  LEARNING_DAYS,
  MIN_DAILY,
  NOISE_SEEKERS,
  hebrewMonth,
  type BudgetCampaignPlan,
  type BudgetDecision,
  type BudgetProjection,
} from "@/app/lib/budget-agent";

type Data = {
  today: string;
  month: string;
  ceiling: { value: number; since: string } | null;
  cplTarget: { value: number; since: string } | null;
  sentence: string;
  projection: BudgetProjection;
  /** The last day with Google spend in the database. */
  adsDataThrough: string | null;
};

function nis(n: number | null | undefined): string {
  return n == null ? "—" : `₪${Math.round(n).toLocaleString("he-IL")}`;
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month: string): string {
  return `${hebrewMonth(month)} ${month.slice(0, 4)}`;
}

// The Google Ads script posts yesterday's spend at about 05:00 every night, so
// the newest day in the data is normally yesterday (the day before, before
// 05:00). Older than that means a night was missed.
const ADS_DATA_STALE_DAYS = 2;

function daysSince(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);
}

function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d}/${m}`;
}

const DECISION: Record<BudgetDecision, { label: string; cls: string }> = {
  keep: { label: "ללא שינוי", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  reduce: { label: "הורדה", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  pause: { label: "השהיה", cls: "bg-red-50 border-red-200 text-red-700" },
  report: { label: "לידיעה", cls: "bg-stone-50 border-stone-200 text-stone-500" },
};

export default function BudgetPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-budget${month ? `?month=${month}` : ""}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [month]);

  const shown = data?.month ?? month;
  const p = data?.projection;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-stone-900">תקציב פרסום</h1>
          {shown && (
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setMonth(shiftMonth(shown, -1))}
                className="rounded-full border border-stone-200 bg-white px-3 py-1 font-bold text-stone-600 hover:bg-stone-100"
                aria-label="החודש הקודם"
              >
                →
              </button>
              <span className="min-w-28 text-center font-black text-stone-800">{monthTitle(shown)}</span>
              <button
                onClick={() => setMonth(shiftMonth(shown, 1))}
                className="rounded-full border border-stone-200 bg-white px-3 py-1 font-bold text-stone-600 hover:bg-stone-100"
                aria-label="החודש הבא"
              >
                ←
              </button>
            </div>
          )}
        </div>
        <p className="mb-6 text-sm text-stone-500">
          התקרה החודשית, התקציבים שמוגדרים היום בגוגל, והצעת חלוקה. המלצה בלבד: שום דבר כאן לא משנה תקציב בגוגל אדס.
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {data && p && !loading && (
          <>
            <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="text-lg font-bold leading-relaxed text-teal-900">{data.sentence}</p>
            </div>

            {data.adsDataThrough && daysSince(data.adsDataThrough, data.today) > ADS_DATA_STALE_DAYS && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                נתוני ההוצאה מגוגל אדס מגיעים רק עד {shortDate(data.adsDataThrough)}: הסנכרון הלילי לא הגיע כמה לילות.
                הסקריפט שולח בכל לילה 30 יום אחורה, כך שהריצה הבאה משלימה את החסר.
              </div>
            )}

            {p.overCeiling && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                ⚠ הקמפיינים המוגנים והחדשים לבדם עוברים את התקרה. צריך להוריד הגנה, או להעלות את התקרה.
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card
                label={`תקרה ל${hebrewMonth(p.month)}`}
                value={data.ceiling ? nis(data.ceiling.value) : "לא הוגדרה"}
                sub={data.ceiling ? `לפני מע״מ, בתוקף מ-${monthTitle(data.ceiling.since)}` : "בלי תקרה אין הצעת חלוקה"}
                accent
              />
              <Card
                label="התקציבים בגוגל היום"
                value={nis(p.current.monthly)}
                sub={`${nis(p.current.daily)} ליום × ${p.daysInMonth} ימים`}
                tone={data.ceiling && p.current.monthly > data.ceiling.value ? "text-red-600" : undefined}
              />
              <Card
                label="לפי ההצעה"
                value={nis(p.plan.monthly)}
                sub={`${nis(p.plan.daily)} ליום · כ-${p.plan.seekers} פונים${p.plan.cpl != null ? ` · ${nis(p.plan.cpl)} לפונה` : ""}`}
              />
              <Card
                label="30 הימים האחרונים"
                value={nis(p.lastMonth.cost)}
                sub={`${p.lastMonth.seekers} פונים · ${nis(p.lastMonth.cpl)} לפונה${
                  data.cplTarget ? ` (יעד ${nis(data.cplTarget.value)})` : ""
                }`}
              />
            </div>

            <CampaignTable campaigns={p.campaigns} />

            <Protections campaigns={p.campaigns} />

            <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-500">
              <div className="mb-1 font-bold text-stone-700">איך ההצעה נבנית</div>
              <ol className="list-decimal space-y-0.5 ps-5">
                <li>קמפיין מוגן, וקמפיין שעוד לא מלאו לו {LEARNING_DAYS} יום מההוצאה הראשונה, נשארים בתקציב שיש להם.</li>
                <li>
                  השאר מדורגים לפי עלות לפונה: 30 הימים האחרונים כשיש מאחוריהם לפחות {NOISE_SEEKERS} פונים, אחרת 60 הימים.
                </li>
                <li>
                  מהזול ליקר, כל קמפיין נשאר בתקציב של היום כל עוד התקרה מאפשרת. זה שעל הגבול מקבל את מה שנשאר, אם זה לפחות ₪
                  {MIN_DAILY} ליום. השאר, וכל קמפיין בלי פונה אחד ב-60 יום, מועמדים להשהיה. אף תקציב לא עולה מעל מה שמוגדר היום.
                </li>
              </ol>
              <p className="mt-2">
                פונה = סשן אחד שלחץ ליצירת קשר עם מטפל/ת ממודעה בגוגל. עלויות לפני מע״מ, כפי שגוגל מדווחת (סנכרון לילי
                {data.adsDataThrough ? `, נתונים עד ${shortDate(data.adsDataThrough)}` : ""}
                ). התקציבים "היום" הם מה שמוגדר בגוגל לפי הסנכרון האחרון. טאבולה ומטא עוד לא כאן: ההוצאה שלהם לא
                נשמרת במערכת.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, accent, tone }: { label: string; value: string; sub?: string; accent?: boolean; tone?: string }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-xl font-black ${tone ?? (accent ? "text-teal-700" : "text-stone-900")}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function CampaignTable({ campaigns }: { campaigns: BudgetCampaignPlan[] }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-xs text-stone-400">
            <th className="px-3 py-2.5 text-start font-bold">קמפיין</th>
            <th className="px-3 py-2.5 text-start font-bold">ליום היום</th>
            <th className="px-3 py-2.5 text-start font-bold">מוצע</th>
            <th className="px-3 py-2.5 text-start font-bold">החלטה</th>
            <th className="px-3 py-2.5 text-start font-bold">30 יום</th>
            <th className="px-3 py-2.5 text-start font-bold">לפונה 30 / 60</th>
            <th className="px-3 py-2.5 text-start font-bold" title="מתוך הפונים ב-60 יום: כמה פנו למטפל/ת משלם/ת, וכמה למטפל/ת בניסיון">
              למשלמים · בניסיון
            </th>
            <th className="px-3 py-2.5 text-start font-bold">צפי פונים</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.googleName} className={`border-b border-stone-100 last:border-b-0 ${c.inPlan ? "" : "text-stone-400"}`}>
              <td className="px-3 py-2.5">
                <div className="font-bold text-stone-800">{c.googleName}</div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <span className="text-stone-400">{c.utmCampaign}</span>
                  {!c.active && <span className="text-stone-400">· מושהה</span>}
                  {c.isProtected && (
                    <span
                      className="rounded-full bg-sky-50 px-1.5 text-sky-800"
                      title={`מוגן: נשאר בתקציב שלו בכל חלוקה. ${c.protectedReason ?? ""}${
                        c.protectedUntil ? ` (עד ${shortDate(c.protectedUntil)})` : ""
                      }`}
                    >
                      🛡️ מוגן
                    </span>
                  )}
                  {c.learning && <span className="rounded-full bg-lime-50 px-1.5 text-lime-800">🌱 בלמידה</span>}
                  {c.noisy && (
                    <span className="rounded-full bg-stone-100 px-1.5 text-stone-500" title={`פחות מ-${NOISE_SEEKERS} פונים מאחורי העלות לפונה`}>
                      מעט נתונים
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5">{c.inPlan ? nis(c.dailyBudget) : c.budgetType === "total" ? "תקציב כולל" : "—"}</td>
              <td className="px-3 py-2.5 font-bold">{c.inPlan ? nis(c.proposedDaily) : "—"}</td>
              <td className="px-3 py-2.5">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${DECISION[c.decision].cls}`}>
                  {DECISION[c.decision].label}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs">
                {nis(c.cost30)} · {c.seekers30} פונים
              </td>
              <td className="px-3 py-2.5 text-xs">
                {nis(c.cpl30)} / {nis(c.cpl60)}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {c.paidSeekers60} · {c.trialSeekers60}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {!c.inPlan || c.proposedDaily === 0
                  ? "—"
                  : c.projectedSeekers == null
                    ? "אין עדיין נתונים"
                    : `כ-${Math.round(c.projectedSeekers)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Protections({ campaigns }: { campaigns: BudgetCampaignPlan[] }) {
  const list = campaigns.filter((c) => c.isProtected);
  return (
    <div className="mb-6 rounded-2xl border border-sky-100 bg-white p-4">
      <div className="mb-1 text-sm font-black text-stone-700">🛡️ קמפיינים מוגנים</div>
      <div className="mb-3 space-y-1 text-sm leading-relaxed text-stone-600">
        <p>
          <b>מה זה אומר:</b> ההצעה האוטומטית לא נוגעת בקמפיין מוגן. הוא נשאר בתקציב שמוגדר לו היום, גם כשהעלות לפונה שלו
          גבוהה, וגם כשבגללו קמפיינים זולים ממנו מקבלים פחות.
        </p>
        <p>
          <b>למה צריך את זה:</b> ההצעה מדרגת לפי עלות לפונה בלבד. היא לא יודעת שבאזור מסוים יש מרכז או מטפל שמשלמים לנו
          ומקבלים פניות רק מהקמפיין הזה. הגנה היא הדרך להכניס את הידיעה הזו לחישוב, עם הסיבה.
        </p>
        <p>
          <b>עד מתי:</b> להגנה יש תאריך סיום, ואחריו הקמפיין חוזר להיות מדורג כמו כולם. הוספה או הסרה של הגנה נעשות כרגע
          ידנית, לא מהעמוד הזה.
        </p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-stone-400">כרגע אין קמפיין מוגן.</p>
      ) : (
        <ul className="space-y-1 text-sm text-stone-700">
          {list.map((c) => (
            <li key={c.googleName}>
              <b>{c.googleName}</b>: {c.protectedReason}
              <span className="text-stone-400">
                {c.protectedUntil ? ` · עד ${shortDate(c.protectedUntil)}` : " · עד שיבוטל"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
