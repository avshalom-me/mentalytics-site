"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Notice, btnGhost, cardCls, errText, getJson, hebDate, sendJson, todayIso, useSchoolsBase } from "../shared";

// המשימות של ענף בתי הספר, ב-CRM המשותף (לבעלים ב-/admin/schools/tasks ולשותפה
// ב-/partner/schools/tasks). ברירת המחדל: המשימות שמשויכות למי שמחובר; אפשר
// לראות את כל משימות הענף. משימה חדשה נפתחת מעמוד בית הספר.

type Task = {
  id: string;
  title: string;
  details: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  due_date: string | null;
  assignee: string | null;
  status: string;
};

export default function SchoolTasksPage() {
  const base = useSchoolsBase();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mine, setMine] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ tasks: Task[] }>(`/api/admin-schools/tasks?status=active${mine ? "&mine=1" : ""}`);
      setTasks(j.tasks);
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [mine]);
  useEffect(() => {
    void load();
  }, [load]);

  async function markDone(t: Task) {
    try {
      await sendJson("/api/admin-schools/tasks", { id: t.id, status: "done" }, "PATCH");
      await load();
      setFlash("המשימה סומנה כבוצעה.");
      window.setTimeout(() => setFlash(""), 3000);
    } catch (e) {
      setError(errText(e));
    }
  }

  const today = todayIso();
  const href = (t: Task) => (t.entity_type === "school" && t.entity_id ? `${base}/${t.entity_id}` : t.entity_type === "school_license" ? `${base}/payments` : `${base}/pipeline`);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-stone-900">משימות</h1>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setMine(true)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${mine ? "bg-[#3D8C8A] text-white" : "border border-stone-200 text-stone-600"}`}>
            שלי
          </button>
          <button type="button" onClick={() => setMine(false)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${!mine ? "bg-[#3D8C8A] text-white" : "border border-stone-200 text-stone-600"}`}>
            כל משימות הענף
          </button>
        </div>
      </div>
      <Notice error={error} flash={flash} />
      {loading ? (
        <p className="text-sm text-stone-500">טוען...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-stone-500">{mine ? "אין משימות פתוחות שמשויכות אליך." : "אין משימות פתוחות בענף."} משימה חדשה פותחים מעמוד בית הספר.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const late = !!t.due_date && t.due_date < today;
            return (
              <div key={t.id} className={`${cardCls} flex flex-wrap items-start justify-between gap-3`}>
                <div className="min-w-0 text-sm">
                  <div className="font-bold text-stone-900">{t.title}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone-500">
                    {t.entity_label ? (
                      <Link href={href(t)} className="font-bold text-[#2A6462] underline">
                        {t.entity_label}
                      </Link>
                    ) : null}
                    {t.due_date ? <span className={late ? "font-bold text-red-700" : ""}>עד {hebDate(t.due_date)}{late ? " (באיחור)" : ""}</span> : <span>בלי תאריך</span>}
                    {!mine && t.assignee ? <span>{t.assignee}</span> : null}
                  </div>
                  {t.details ? <div className="mt-1 whitespace-pre-line text-xs text-stone-600">{t.details}</div> : null}
                </div>
                <button type="button" onClick={() => markDone(t)} className={btnGhost}>
                  בוצע
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
