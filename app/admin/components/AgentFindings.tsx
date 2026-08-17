"use client";

import { useEffect, useState } from "react";

// ממצאי סוכן שמוצגים בעמוד שהנושא שייך לו, ולא בתור הפעולות.
//
// ממצא הוא תיאור מצב ("אין מספיק מטפלים ל-DBT בדרום השרון"), לא משימה
// שממתינה להכרעה - ולכן מקומו ליד הנתונים שהוא מדבר עליהם. התור בעמוד
// הסוכנים נשאר רק למה שבאמת דורש החלטה, וכך הוא לא מתארך עם כל סוכן חדש.
//
// שימוש: <AgentFindings agent="supply_gaps" title="פערי היצע שהסוכן מצא" />

type Finding = {
  id: string;
  agent: string;
  kind?: "action" | "finding";
  action_type: string;
  title: string;
  body: string | null;
  created_at: string;
};

export default function AgentFindings({
  agent,
  title,
  emptyText,
  limit = 12,
}: {
  agent: string;
  title: string;
  emptyText?: string;
  limit?: number;
}) {
  const [findings, setFindings] = useState<Finding[] | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin-agents", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (ignore || !j.ok) return;
        const rows: Finding[] = (j.pending_actions ?? []).filter(
          (a: Finding) => a.agent === agent && a.kind === "finding"
        );
        setFindings(rows);
      })
      .catch(() => {
        if (!ignore) setFindings([]);
      });
    return () => {
      ignore = true;
    };
  }, [agent]);

  // בלי ממצאים אין מה להציג - הרכיב לא תופס מקום בעמוד.
  if (!findings || findings.length === 0) {
    return emptyText && findings ? (
      <p className="mb-6 text-xs text-stone-400">{emptyText}</p>
    ) : null;
  }

  const shown = findings.slice(0, limit);

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-black text-stone-800">🤖 {title}</h2>
        <span className="text-xs text-stone-500">({findings.length})</span>
      </div>
      <ul className="space-y-1.5">
        {shown.map((f) => (
          <li key={f.id} className="text-sm text-stone-700">
            <span className="font-bold">{f.title}</span>
            {f.body && <span className="block text-xs text-stone-500 leading-5">{f.body}</span>}
          </li>
        ))}
      </ul>
      {findings.length > shown.length && (
        <p className="mt-2 text-xs text-stone-500">ועוד {findings.length - shown.length}...</p>
      )}
      <p className="mt-3 text-[11px] text-stone-400">
        ממצאים נסגרים מעצמם כשהמצב שיצר אותם משתנה. אין כאן מה לאשר.
      </p>
    </section>
  );
}
