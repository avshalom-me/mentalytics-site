"use client";

import { useEffect, useState } from "react";
import { hebrewMonth } from "@/app/lib/budget-agent";
import type { BudgetMonthlyReport, ChapterStatus, ReportChapter } from "@/app/lib/budget-report";

// The monthly budget report: fourteen chapters, each computed on its own
// (app/lib/budget-report.ts). A chapter the system cannot measure yet says so.

const STATUS: Record<ChapterStatus, { label: string; cls: string }> = {
  ok: { label: "", cls: "" },
  partial: { label: "חלקי", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { label: "לא נמדד", cls: "border-stone-200 bg-stone-100 text-stone-500" },
  error: { label: "שגיאה", cls: "border-red-200 bg-red-50 text-red-700" },
};

function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d}/${m}`;
}

export default function BudgetReportPage() {
  const [data, setData] = useState<BudgetMonthlyReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin-budget/report")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black text-stone-900">
            הדוח החודשי{data ? ` · ${hebrewMonth(data.month)} ${data.month.slice(0, 4)}` : ""}
          </h1>
          <a href="/admin/budget" className="text-sm font-bold text-teal-700 hover:underline">
            ← לעמוד תקציב הפרסום
          </a>
        </div>
        <p className="mb-6 text-sm text-stone-500">
          ארבעה-עשר פרקים, כל אחד מחושב מהנתונים במערכת. אין כאן מספר שמודל שפה המציא. פרק שעוד אין לו נתונים אומר את זה
          במפורש.
          {data && ` 30 הימים הנמדדים: ${shortDate(data.window.from)}-${shortDate(data.window.to)}.`}
        </p>

        {loading && <p className="text-sm text-stone-400">מחשב… (כמה שניות)</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {data && (
          <>
            <div className="mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <p className="text-lg font-bold leading-relaxed text-teal-900">{data.sentence}</p>
            </div>

            <nav className="mb-6 flex flex-wrap gap-2 text-xs">
              {data.chapters.map((c) => (
                <a
                  key={c.key}
                  href={`#ch-${c.n}`}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1 font-bold text-stone-600 hover:bg-stone-100"
                >
                  {c.n}. {c.title}
                </a>
              ))}
            </nav>

            <div className="space-y-4">
              {data.chapters.map((c) => (
                <Chapter key={c.key} c={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Chapter({ c }: { c: ReportChapter }) {
  const s = STATUS[c.status];
  return (
    <section id={`ch-${c.n}`} className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-black text-stone-900">
          {c.n}. {c.title}
        </h2>
        {s.label && <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>}
      </div>
      <p className="text-sm leading-relaxed text-stone-700">{c.summary}</p>
      {c.table && c.table.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-stone-200 text-stone-400">
                {c.table.head.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-start font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.table.rows.map((row, i) => (
                <tr key={i} className="border-b border-stone-100 last:border-b-0">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-2 py-1.5 ${j === 0 ? "font-bold text-stone-800" : "text-stone-600"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {c.notes && c.notes.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs leading-relaxed text-stone-400">
          {c.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
