"use client";

import { useEffect, useState } from "react";

/**
 * "מאיפה מגיעות הכניסות האורגניות" - organic entries per landing-page family.
 *
 * The site had one organic number and 117 landing pages behind it, so the
 * question "is the SEO work paying off" could only be answered for the whole
 * pile at once. Split by family it answers itself, and on 3/9/2026 it answered
 * three things the aggregate was hiding:
 *
 *   - `region` looked like a working family until `online` was pulled out of
 *     it. The eight geographic region pages earn 15 entries between them all
 *     time; region:online alone earns 42. The RPC splits them for that reason.
 *   - Concentration is the norm, not the exception: 91% of הסדרים is one page
 *     (משרד הביטחון), 44% of נושאים is OCD. A family average describes no page
 *     that actually exists, so every row carries its leader and that leader's
 *     share.
 *   - Per page, סוגי טיפול beats ערים roughly 2:1, which is the opposite of
 *     where the page count went.
 *
 * Entries, not impressions: this counts people who arrived. Position and
 * impressions live in Search Console, which is deliberately not wired up.
 */

type Row = {
  family: string;
  label: string;
  is_landing: boolean;
  organic: number;
  organic_30d: number;
  organic_7d: number;
  pages: number;
  top_page: string | null;
  top_page_organic: number | null;
};

const PERIODS: { key: string; label: string }[] = [
  { key: "all", label: 'סה"כ' },
  { key: "quarter", label: "90 יום" },
  { key: "month", label: "30 יום" },
];

/** Single-page families have no meaningful "leader", and region:online is the
 *  whole family - printing "region:online 100%" beside it says nothing. */
function leaderLabel(r: Row): string {
  if (!r.top_page || r.pages <= 1 || r.organic === 0) return "-";
  const pct = Math.round((100 * (r.top_page_organic ?? 0)) / r.organic);
  return `${r.top_page} (${pct}%)`;
}

export default function OrganicByFamily() {
  const [period, setPeriod] = useState("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setErr(null);
    fetch(`/api/admin-organic-families?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) setRows(d.rows as Row[]);
        else setErr(d.error ?? "שגיאה");
      })
      .catch((e) => alive && setErr(String(e)));
    return () => {
      alive = false;
    };
  }, [period]);

  const landing = (rows ?? []).filter((r) => r.is_landing);
  const other = (rows ?? []).filter((r) => !r.is_landing);
  const landingTotal = landing.reduce((s, r) => s + r.organic, 0);
  const landingPages = landing.reduce((s, r) => s + r.pages, 0);

  const body = (list: Row[]) =>
    list.map((r) => {
      const perPage = r.pages > 0 ? r.organic / r.pages : 0;
      return (
        <tr key={r.family} className="border-b border-stone-100">
          <td className="py-2 font-semibold text-stone-800">{r.label}</td>
          <td className="py-2 text-xs text-stone-400">{r.pages}</td>
          <td className="py-2 font-bold text-stone-800">{r.organic}</td>
          {/* The number the page-count decision should have been made on */}
          <td className="py-2 font-semibold text-teal-700">{perPage.toFixed(1)}</td>
          <td className="py-2 text-stone-500">{r.organic_30d}</td>
          <td className="py-2 text-stone-500">{r.organic_7d || "-"}</td>
          <td className="py-2 text-xs text-stone-500">{leaderLabel(r)}</td>
        </tr>
      );
    });

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-black text-stone-700">מאיפה מגיעות הכניסות האורגניות</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                period === p.key
                  ? "border-stone-700 bg-stone-700 text-white"
                  : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        כניסות אורגניות לפי משפחת עמודים. עמודת &quot;לעמוד&quot; היא המדד שקובע איפה כדאי לבנות עוד.
      </p>

      {err && <p className="text-sm text-red-600">שגיאה: {err}</p>}
      {!err && rows === null && <p className="text-sm text-stone-400">טוען...</p>}

      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-stone-500">אין כניסות אורגניות בתקופה הזו.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 font-semibold text-teal-800">
              עמודי נחיתה: {landingTotal} כניסות מ-{landingPages} עמודים
            </span>
            {other.map((r) => (
              <span
                key={r.family}
                className="rounded-md border border-stone-200 bg-white px-2.5 py-1 font-semibold text-stone-600"
              >
                {r.label}: {r.organic}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-right text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="py-2 font-semibold">משפחה</th>
                  <th className="py-2 font-semibold">עמודים</th>
                  <th className="py-2 font-semibold">כניסות</th>
                  <th className="py-2 font-semibold">לעמוד</th>
                  <th className="py-2 font-semibold">30 יום</th>
                  <th className="py-2 font-semibold">7 ימים</th>
                  <th className="py-2 font-semibold">העמוד המוביל</th>
                </tr>
              </thead>
              <tbody>
                {body(landing)}
                {other.length > 0 && (
                  <tr className="border-b border-stone-200">
                    <td colSpan={7} className="pt-4 pb-1 text-[11px] font-bold text-stone-400">
                      לא עמודי נחיתה
                    </td>
                  </tr>
                )}
                {body(other)}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-stone-400">
            אלה <strong>כניסות</strong>, לא חשיפות ולא מיקום - נספר מי שהגיע בפועל מחיפוש אורגני. מיקום ממוצע
            וחשיפות נמצאים ב-Search Console בלבד. <strong>אונליין מופרד מהאזורים הגיאוגרפיים</strong> בכוונה:
            הוא היה 74% ממה שנקרא &quot;אזורים&quot;, וללא ההפרדה המשפחה נראתה בריאה בזמן שהחצי הגיאוגרפי שלה
            כמעט לא מייצר. עמודת <strong>העמוד המוביל</strong> מראה את הריכוזיות - כשעמוד אחד הוא 90% ממשפחה,
            ממוצע המשפחה לא מתאר אף עמוד קיים.
          </p>
        </>
      )}
    </section>
  );
}
