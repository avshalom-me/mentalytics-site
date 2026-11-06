"use client";

import { useEffect, useMemo, useState } from "react";
import HelpTip from "../../components/HelpTip";
import { Section } from "../../components/BranchWidgets";
import { TEACHER_REFERRAL_KEYS, subjectLabel, teacherSearchFromKey } from "@/app/lib/teacher-options";
import { teacherSupplyForKeys } from "@/app/lib/teacher-match";
import { btn, getJson, type Teacher } from "../shared";

// ביקוש: מה הורים מחפשים ומה השאלון ממליץ, מול מה שיש. שער ההיצע: כפתור
// "חיפוש מורה" בדוח של ההורים מופיע רק להמלצה שיש לה מורה מוצג/ת.

type DemandRow = { subject: string; remedial: boolean; region: string; searches: number; empty_searches: number; avg_returned: number };
const SUPPLY_KEYS = [TEACHER_REFERRAL_KEYS.remedialMath, TEACHER_REFERRAL_KEYS.remedialReading, TEACHER_REFERRAL_KEYS.tutorMath, TEACHER_REFERRAL_KEYS.tutorEnglish];

export default function LearningDemandPage() {
  const [rows, setRows] = useState<Teacher[]>([]);
  const [days, setDays] = useState(30);
  // התשובה נושאת את החלון שלה: חלון שונה מהנבחר = עדיין טוען (בלי setState בתוך effect).
  const [loaded, setLoaded] = useState<{ days: number; demand: DemandRow[]; recommended: { key: string; reports: number }[] } | null>(null);
  useEffect(() => {
    getJson<{ teachers: Teacher[] }>("/api/admin-teachers").then((j) => j.ok && setRows(j.teachers)).catch(() => {});
  }, []);
  useEffect(() => {
    let cancelled = false;
    getJson<{ demand: DemandRow[]; recommended: { key: string; reports: number }[] }>(`/api/admin-teachers?demand=1&days=${days}`)
      .then((j) => !cancelled && setLoaded({ days, demand: j.ok ? j.demand : [], recommended: j.ok && Array.isArray(j.recommended) ? j.recommended : [] }))
      .catch(() => !cancelled && setLoaded({ days, demand: [], recommended: [] }));
    return () => {
      cancelled = true;
    };
  }, [days]);
  const demand = loaded?.days === days ? loaded.demand : null;
  const recommended = loaded?.days === days ? loaded.recommended : [];
  const supply = useMemo(() => teacherSupplyForKeys(rows, SUPPLY_KEYS, null), [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black text-stone-900">ביקוש</h1>
        <HelpTip id="teachers" />
        <div className="ms-auto flex gap-1 text-xs">
          {[30, 90, 180].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)} className={`${btn} ${days === d ? "bg-stone-800 text-white" : ""}`}>{d} יום</button>
          ))}
        </div>
      </div>

      <Section title="שער ההיצע" sub="כפתור 'חיפוש מורה' בדוח של ההורים מופיע רק להמלצה שיש לה לפחות מורה מוצג/ת אחד/ת (לפי תחום, סוג מורה ושכבת גיל). עד אז ההמלצה מוצגת בלי חיפוש, כדי שהורים לא יגיעו למאגר ריק.">
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUPPLY_KEYS.map((k) => (
            <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-bold ${supply[k] ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
              {supply[k] ? "✓" : "✗"} {teacherSearchFromKey(k).label}
            </span>
          ))}
        </div>
      </Section>

      <Section title={`דוחות שכללו המלצה למורה, ${days} יום`} sub="כמה הורים קיבלו מהשאלון כל אחת מההמלצות. זה הביקוש שקיים גם לפני שיש חיפושים, ולפיו כדאי לגייס.">
        {demand === null && <p className="mt-3 text-xs text-stone-400">טוען...</p>}
        {demand !== null && recommended.length === 0 && <p className="mt-3 text-xs text-stone-400">עדיין לא נרשמו דוחות כאלה.</p>}
        {recommended.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {recommended.map((r) => (
              <span key={r.key} className="rounded-full bg-stone-100 px-2.5 py-1 font-bold text-stone-700">{teacherSearchFromKey(r.key).label}: {r.reports}</span>
            ))}
          </div>
        )}
      </Section>

      <Section title={`חיפושי מורים, ${days} יום`} sub="כל חיפוש של הורה, מתוצאות השאלון או מהמאגר. 'חזרו ריקים' = לא נמצא אף מורה. זו הרשימה שלפיה מגייסים לפי אזור.">
        {demand === null && <p className="mt-3 text-xs text-stone-400">טוען...</p>}
        {demand !== null && demand.length === 0 && <p className="mt-3 text-xs text-stone-400">עדיין לא נרשמו חיפושים.</p>}
        {demand !== null && demand.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-400">
                  <th className="px-2 py-1.5 text-start font-bold">תחום</th>
                  <th className="px-2 py-1.5 text-start font-bold">סוג</th>
                  <th className="px-2 py-1.5 text-start font-bold">אזור</th>
                  <th className="px-2 py-1.5 text-start font-bold">חיפושים</th>
                  <th className="px-2 py-1.5 text-start font-bold">חזרו ריקים</th>
                  <th className="px-2 py-1.5 text-start font-bold">ממוצע תוצאות</th>
                </tr>
              </thead>
              <tbody>
                {demand.map((d, i) => (
                  <tr key={i} className="border-b border-stone-100 last:border-b-0">
                    <td className="px-2 py-1.5 font-bold text-stone-700">{d.subject === "-" ? "כללי" : subjectLabel(d.subject)}</td>
                    <td className="px-2 py-1.5 text-stone-600">{d.remedial ? "הוראה מתקנת" : "תגבור"}</td>
                    <td className="px-2 py-1.5 text-stone-600">{d.region}</td>
                    <td className="px-2 py-1.5 font-bold text-stone-800">{d.searches}</td>
                    <td className={`px-2 py-1.5 font-bold ${Number(d.empty_searches) > 0 ? "text-red-600" : "text-stone-400"}`}>{d.empty_searches}</td>
                    <td className="px-2 py-1.5 text-stone-600">{d.avg_returned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
