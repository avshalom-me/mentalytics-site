"use client";

import { useEffect, useState } from "react";
import { Notice, cardCls, errText, getJson, hebDate, shekel } from "../shared";

// "מצב לפי ההסכם": השיעור החל, שלבי הסולם והשערים (סעיף 9 ונספח ב'). לא במבט
// העל ולא בתפריט הראשי, בהחלטת הבעלים (21/10/2026): "זה לא העיקר". הקישור
// אליו קטן, בתחתית תפריט הצד. ההסכם (16.1) מחייב שהשותפה תוכל לראות את השיעור
// ואת ההתקדמות מול השערים, ולכן המסך פתוח לשניהם. הנתונים מאותו נתיב של מבט העל.

type Step = { stage: number; rate: number; not_before: string | null; gate_schools: number | null; gate_receipts: number | null; gates_met_on: string | null; applies_from: string | null };
type Data = {
  today: string;
  quarter: { label: string; end: string; received_net: number };
  ladder: { start_date: string | null; schools_now: number; receipts_now: number; current: { stage: number; rate: number; since: string | null }; steps: Step[] };
};

const pct = (r: number) => `${Math.round(r * 100)}%`;
const num = (n: number) => Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function SchoolsAgreementPage() {
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getJson<Data>("/api/admin-schools/overview")
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

  const { ladder } = d;
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black text-stone-900">מצב לפי ההסכם</h1>
        <p className="mt-1 text-sm text-stone-500">
          השיעור החל: <strong className="text-stone-800">{pct(ladder.current.rate)}</strong> (שלב {ladder.current.stage}
          {ladder.current.since ? `, מ-${hebDate(ladder.current.since)}` : ""}){ladder.start_date ? ` · יום ההתחלה ${hebDate(ladder.start_date)}` : ""} · {d.quarter.label}: תקבולים נטו {shekel(d.quarter.received_net)}
        </p>
      </div>

      <section className={cardCls}>
        <h2 className="text-base font-black text-stone-900">שלבי הסולם</h2>
        <p className="mt-1 text-xs text-stone-500">
          שלב חל כשגם המועד שלו הגיע וגם שני השערים שלו הושגו, מהיום הראשון של החודש שאחרי השגת השערים (סעיף 9). השיעור אינו יורד. עכשיו: {num(ladder.schools_now)} בתי ספר משלמים, {shekel(ladder.receipts_now)} תקבולים נטו מצטברים.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-xs text-stone-500">
                <th className="py-1.5 text-start font-normal">שלב</th>
                <th className="py-1.5 text-start font-normal">שיעור</th>
                <th className="py-1.5 text-start font-normal">לא לפני</th>
                <th className="py-1.5 text-start font-normal">בתי ספר משלמים</th>
                <th className="py-1.5 text-start font-normal">תקבולים נטו מצטברים</th>
                <th className="py-1.5 text-start font-normal">מצב</th>
              </tr>
            </thead>
            <tbody>
              {ladder.steps.map((s) => {
                const applied = !!s.applies_from && s.applies_from <= d.today;
                const noGates = s.gate_schools == null && s.gate_receipts == null;
                return (
                  <tr key={s.stage} className={`border-t border-stone-100 ${s.stage === ladder.current.stage ? "bg-[#EAF4F3]" : ""}`}>
                    <td className="py-2 font-bold text-stone-800">{s.stage}</td>
                    <td className="py-2">{pct(s.rate)}</td>
                    <td className="py-2 text-stone-600">{s.not_before ? hebDate(s.not_before) : "-"}</td>
                    <td className="py-2 text-stone-600">{s.gate_schools == null ? "-" : `${num(Math.min(ladder.schools_now, s.gate_schools))} / ${num(s.gate_schools)}`}</td>
                    <td className="py-2 text-stone-600">{s.gate_receipts == null ? "-" : `${shekel(Math.min(ladder.receipts_now, s.gate_receipts))} / ${shekel(s.gate_receipts)}`}</td>
                    <td className="py-2 text-xs">
                      {applied ? (
                        <span className="font-bold text-[#2A6462]">חל מ-{hebDate(s.applies_from)}</span>
                      ) : s.applies_from ? (
                        <span className="font-bold text-[#2A6462]">{noGates ? "חל מיום ההתחלה" : "השערים הושגו"}, {hebDate(s.applies_from)}</span>
                      ) : (
                        <span className="text-stone-500">ממתין</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-stone-400">
          לפי הנתונים במערכת. העמידה בשערים מאושרת בידי רואה החשבון בסוף כל רבעון (סעיף 9.2). דמי הפלטפורמה, הרווח הנקי והתמורה לרבעון יתווספו כאן עם הדוח הרבעוני.
        </p>
      </section>
    </div>
  );
}
