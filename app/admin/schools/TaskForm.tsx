"use client";

import { useState } from "react";
import { BRANCH_TASK, PLAN_TASK } from "@/app/lib/schools-workspace";
import { Field, btnGhost, btnPrimary, errText, inputCls, sendJson } from "./shared";

// טופס משימה של הענף: חדשה (מהגנט, ממסך המשימות או מפריט בתוכנית) או עריכה.
// משימה חדשה שייכת לענף עצמו או לפריט בתוכנית; משימה של בית ספר, עסקה או רישיון
// נפתחת מעמוד בית הספר, וכאן אפשר רק לערוך אותה. תאריך התחלה ותאריך יעד מציירים
// אותה כפס על הגנט; עם תאריך יעד בלבד היא נקודה.

export type BranchTask = {
  id: string;
  title: string;
  details: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  start_date: string | null;
  due_date: string | null;
  assignee: string | null;
  status: string;
  priority?: string;
};

export default function TaskForm({
  task,
  planItems,
  assignees,
  defaultPlanItem,
  defaultStart,
  onDone,
  onCancel,
}: {
  task?: BranchTask | null;
  planItems: { id: string; title: string }[];
  assignees: string[];
  defaultPlanItem?: string;
  defaultStart?: string;
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const editing = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [link, setLink] = useState(task ? (task.entity_type === PLAN_TASK ? (task.entity_id ?? "") : "") : (defaultPlanItem ?? ""));
  const [start, setStart] = useState(task?.start_date ?? defaultStart ?? "");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [details, setDetails] = useState(task?.details ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const linkLocked = editing && task?.entity_type !== BRANCH_TASK && task?.entity_type !== PLAN_TASK;

  async function save() {
    if (!title.trim()) return setError("חסרה כותרת");
    if (start && due && due < start) return setError("תאריך היעד לפני תאריך ההתחלה");
    setBusy(true);
    setError("");
    try {
      if (editing && task) {
        await sendJson("/api/admin-schools/tasks", { id: task.id, title, details, assignee: assignee || null, start_date: start || null, due_date: due || null }, "PATCH");
        onDone("המשימה עודכנה.");
      } else {
        await sendJson("/api/admin-schools/tasks", {
          title,
          details: details || null,
          assignee: assignee || null,
          start_date: start || null,
          due_date: due || null,
          entity_type: link ? PLAN_TASK : BRANCH_TASK,
          entity_id: link || null,
        });
        onDone("המשימה נוספה.");
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function markDone() {
    if (!task) return;
    setBusy(true);
    try {
      await sendJson("/api/admin-schools/tasks", { id: task.id, status: "done" }, "PATCH");
      onDone("המשימה סומנה כבוצעה.");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      <Field label="מה צריך לעשות">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="באחריות">
          <select className={inputCls} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">לא משויך</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            {assignee && !assignees.includes(assignee) ? <option value={assignee}>{assignee}</option> : null}
          </select>
        </Field>
        <Field label="שייכת ל">
          {linkLocked ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{task?.entity_label ?? "בית ספר"}</div>
          ) : (
            <select className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} disabled={editing}>
              <option value="">הענף, כללי</option>
              {planItems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="התחלה (לא חובה)">
          <input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="תאריך יעד">
          <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </div>
      <Field label="פרטים">
        <textarea className={inputCls} rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
      </Field>
      {linkLocked ? null : <p className="text-xs text-stone-500">עם התחלה ויעד המשימה מופיעה כפס בתוכנית השנתית; עם יעד בלבד, כנקודה ביום היעד.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "שומר..." : editing ? "שמירה" : "הוספת המשימה"}
        </button>
        {editing && task?.status !== "done" ? (
          <button type="button" onClick={markDone} disabled={busy} className={btnGhost}>
            בוצע
          </button>
        ) : null}
        <button type="button" onClick={onCancel} className="px-2 text-sm text-stone-500 hover:text-stone-700">
          ביטול
        </button>
      </div>
    </div>
  );
}
