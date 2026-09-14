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
  payload?: { severity?: "high" | "medium" | "low" } | null;
};

// דחיפות: high/medium = הכנסה בסיכון, low = מידע (למשל מקודם במתנה).
// ההפרדה נוספה 20/8/26 אחרי שרשימת השימור הציגה לקוח משלם בסיכון ביטול
// ומקודם-מתנה באותה שורה בדיוק, בלי שום דרך להבחין ביניהם.
const SEV_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
function sevOf(f: Finding): "high" | "medium" | "low" {
  return f.payload?.severity ?? "medium";
}

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

  const sorted = [...findings].sort((a, b) => SEV_RANK[sevOf(a)] - SEV_RANK[sevOf(b)]);
  const urgent = sorted.filter((f) => sevOf(f) !== "low");
  const info = sorted.filter((f) => sevOf(f) === "low");
  // המכסה נשמרת לדחופים: פריט אחד שדורש כסף לא נדחק ע"י עשרה אינפורמטיביים.
  const shownUrgent = urgent.slice(0, limit);
  const shownInfo = info.slice(0, Math.max(0, limit - shownUrgent.length) + 3);
  const hiddenCount = urgent.length - shownUrgent.length + (info.length - shownInfo.length);

  const renderItem = (f: Finding) => (
    <li key={f.id} className="text-sm text-stone-700">
      <span className="font-bold">
        {sevOf(f) === "high" && <span className="text-red-600">● </span>}
        {f.title}
      </span>
      {f.body && <span className="block text-xs text-stone-500 leading-5">{f.body}</span>}
    </li>
  );

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-black text-stone-800">🤖 {title}</h2>
        <span className="text-xs text-stone-500">({findings.length})</span>
      </div>
      {shownUrgent.length > 0 && (
        <>
          {info.length > 0 && (
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-red-700">
              דורש טיפול · הכנסה בסיכון ({urgent.length})
            </p>
          )}
          <ul className="space-y-1.5">{shownUrgent.map(renderItem)}</ul>
        </>
      )}
      {shownInfo.length > 0 && (
        <div className={shownUrgent.length > 0 ? "mt-3 border-t border-amber-200/70 pt-2.5" : ""}>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
            לידיעה · מקודמים במתנה, אין הכנסה בסיכון ({info.length})
          </p>
          <ul className="space-y-1.5 opacity-75">{shownInfo.map(renderItem)}</ul>
        </div>
      )}
      {hiddenCount > 0 && <p className="mt-2 text-xs text-stone-500">ועוד {hiddenCount}...</p>}
      <p className="mt-3 text-[11px] text-stone-400">
        ממצאים נסגרים מעצמם כשהמצב שיצר אותם משתנה. אין כאן מה לאשר.
      </p>
    </section>
  );
}
