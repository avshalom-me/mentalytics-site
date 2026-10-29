"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HelpTip from "../components/HelpTip";
import { TASK_PRIORITIES, TASK_STATUSES, labelOf } from "@/app/lib/crm";
import { applyTaskPatch, insertTask, removeTask, type TaskLists } from "@/app/lib/crm-tasks-local";

type Task = {
  id: string;
  title: string;
  details: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  due_date: string | null;
  priority: string;
  assignee: string | null;
  status: string;
  snoozed_until: string | null;
  created_at: string;
  completed_at: string | null;
  completion_note: string | null;
};

type Suggestion = {
  key: string;
  title: string;
  reason: string;
  due_date: string | null;
  priority: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

function addDays(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TasksPage() {
  // שתי הרשימות במצב אחד, כדי שפעולה שמעבירה משימה ביניהן תעדכן את שתיהן
  // בבת אחת (crm-tasks-local.ts). המסך מתעדכן מיד, והשרת מיישר ברענון שקט.
  const [lists, setLists] = useState<TaskLists<Task>>({ open: [], done: [] });
  const tasks = lists.open;
  const done = lists.done;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // "טוען" רק עד הטעינה הראשונה. רענון אחרי פעולה לא מסתיר את המסך.
  const [loaded, setLoaded] = useState(false);
  // טעינה שהוחלפה בטעינה חדשה לא דורסת אותה: שתי טעינות חופפות (שתי
  // לחיצות מהירות) החזירו לפעמים את הישנה אחרונה, והמסך הראה מצב ישן עד רענון.
  const loadSeq = useRef(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newAssignee, setNewAssignee] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setError("");
    // רשימת האחראים נטענת בנפרד ולא כאיבר ב-Promise.all: הפירוק למטה הוא
    // לפי מיקום, ואיבר נוסף בראש המערך היה מזיז את כל השאר בשקט.
    fetch("/api/admin-crm/assignees")
      .then((r) => r.json())
      .then((j) => setAssignees(j.ok ? j.assignees : []))
      .catch(() => setAssignees([]));
    Promise.all([
      fetch("/api/admin-crm/tasks?status=active&queue=1").then((r) => r.json()),
      fetch("/api/admin-crm/tasks?status=done&queue=1").then((r) => r.json()),
      fetch("/api/admin-crm/task-suggestions").then((r) => r.json()),
    ])
      .then(([openJ, doneJ, sugJ]) => {
        if (seq !== loadSeq.current) return;
        if (openJ.ok && doneJ.ok) setLists({ open: openJ.tasks, done: doneJ.tasks.slice(0, 20) });
        else setError(openJ.error || doneJ.error || "שגיאה בטעינה");
        if (sugJ.ok) setSuggestions(sugJ.suggestions);
      })
      .catch(() => {
        if (seq === loadSeq.current) setError("שגיאה בטעינה");
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoaded(true);
      });
  }, []);

  // תשובת שרת של פעולה: כישלון מוצג, ובכל מקרה רענון שקט מיישר את המסך.
  async function settle(res: Response | null, what: string) {
    const j = res ? await res.json().catch(() => null) : null;
    if (!res || !res.ok || !j?.ok) setError(j?.error || `${what} - נסו שוב`);
    load();
  }

  async function resolveSuggestion(s: Suggestion, action: "accept" | "dismiss") {
    setBusy(s.key);
    setSuggestions((prev) => prev.filter((x) => x.key !== s.key));
    let res: Response | null = null;
    try {
      res = await fetch("/api/admin-crm/task-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, action }),
      });
    } catch {
      res = null;
    } finally {
      setBusy(null);
      await settle(res, action === "accept" ? "ההצעה לא הפכה למשימה" : "ההצעה לא נדחתה");
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin-crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          due_date: newDue || null,
          priority: newPriority,
          assignee: newAssignee || null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        // המשימה שהשרת החזיר נכנסת לרשימה מיד, במקומה לפי התאריך.
        if (j.task) setLists((prev) => insertTask(prev, j.task as Task));
        setNewTitle("");
        setNewDue("");
        setNewPriority("normal");
        setNewAssignee("");
        load();
      } else {
        setError(j?.error || "שגיאה ביצירה");
      }
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setLists((prev) => applyTaskPatch(prev, id, body));
    let res: Response | null = null;
    try {
      res = await fetch("/api/admin-crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
    } catch {
      res = null;
    } finally {
      setBusy(null);
      await settle(res, "העדכון לא נשמר");
    }
  }

  // שני מסלולי סגירה מפורשים, לצד ה-✓ המהיר שסוגר ומשאיר בלי הערה.
  async function doneWithNote(id: string) {
    const note = window.prompt("מה יצא מזה? (הערת סיום)");
    // ביטול הדיאלוג מחזיר null - ואז לא סוגרים בכלל. מחרוזת ריקה = נסגר בלי הערה.
    if (note === null) return;
    patch(id, { status: "done", completion_note: note.trim() || null });
  }

  async function doneAndDelete(id: string) {
    if (!confirm("לסמן כבוצע ולמחוק לצמיתות? לא יישאר תיעוד שהמשימה הייתה.")) return;
    await deleteTask(id);
  }

  async function deleteTask(id: string) {
    setBusy(id);
    setLists((prev) => removeTask(prev, id));
    let res: Response | null = null;
    try {
      res = await fetch("/api/admin-crm/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      res = null;
    } finally {
      setBusy(null);
      await settle(res, "המחיקה לא בוצעה");
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את המשימה לצמיתות?")) return;
    await deleteTask(id);
  }

  const today = todayStr();
  const effectiveDue = (t: Task) =>
    t.snoozed_until && t.snoozed_until > (t.due_date ?? "") ? t.snoozed_until : t.due_date;
  const overdue = tasks.filter((t) => effectiveDue(t) && effectiveDue(t)! < today);
  const dueToday = tasks.filter((t) => effectiveDue(t) === today);
  const upcoming = tasks.filter((t) => effectiveDue(t) && effectiveDue(t)! > today);
  const noDate = tasks.filter((t) => !effectiveDue(t));

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">משימות</h1>
          <HelpTip id="tasks" />
        </div>

        {/* Quick create */}
        <form onSubmit={createTask} className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="משימה חדשה…"
            className="min-w-40 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
          >
            <option value="">ללא אחראי</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={creating || !newTitle.trim()}
            className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
          >
            הוספה
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {!loaded && <p className="text-sm text-stone-400">טוען…</p>}

        {/* System-generated suggestions: CRM data + business-plan milestones. */}
        {loaded && suggestions.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-teal-700">
              💡 הצעות מהמערכת ({suggestions.length}) <HelpTip id="suggestions" />
            </h2>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/40 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-stone-800">{s.title}</div>
                    <div className="text-xs text-stone-500">{s.reason}</div>
                  </div>
                  {s.due_date && <span className="text-xs font-semibold text-stone-400">{fmtDate(s.due_date)}</span>}
                  <button
                    type="button"
                    onClick={() => resolveSuggestion(s, "accept")}
                    disabled={busy === s.key}
                    className="rounded-full bg-stone-800 px-3 py-1 text-xs font-bold text-white hover:bg-stone-700 disabled:opacity-50"
                  >
                    קבל כמשימה ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveSuggestion(s, "dismiss")}
                    disabled={busy === s.key}
                    className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-400 hover:bg-stone-100 disabled:opacity-50"
                  >
                    דחה
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loaded && tasks.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
            אין משימות פתוחות 🎉
          </div>
        )}

        <TaskGroup title={`באיחור (${overdue.length})`} tone="text-red-600" tasks={overdue} busy={busy} onPatch={patch} onRemove={remove} today={today} assignees={assignees} onDoneNote={doneWithNote} onDoneDelete={doneAndDelete} />
        <TaskGroup title={`להיום (${dueToday.length})`} tone="text-teal-700" tasks={dueToday} busy={busy} onPatch={patch} onRemove={remove} today={today} assignees={assignees} onDoneNote={doneWithNote} onDoneDelete={doneAndDelete} />
        <TaskGroup title={`בהמשך (${upcoming.length})`} tone="text-stone-500" tasks={upcoming} busy={busy} onPatch={patch} onRemove={remove} today={today} assignees={assignees} onDoneNote={doneWithNote} onDoneDelete={doneAndDelete} />
        <TaskGroup title={`בלי תאריך (${noDate.length})`} tone="text-stone-400" tasks={noDate} busy={busy} onPatch={patch} onRemove={remove} today={today} assignees={assignees} onDoneNote={doneWithNote} onDoneDelete={doneAndDelete} />

        {done.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowDone(!showDone)}
              className="mb-2 text-sm font-black text-stone-400 hover:text-stone-600"
            >
              {showDone ? "▾" : "◂"} בוצעו לאחרונה ({done.length})
            </button>
            {showDone && (
              <div className="space-y-1 opacity-60">
                {done.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2">
                    <span className="text-sm text-stone-400 line-through">{t.title}</span>
                    {t.completion_note && (
                      <span className="min-w-0 truncate text-xs text-teal-700" title={t.completion_note}>
                        {t.completion_note}
                      </span>
                    )}
                    <span className="ms-auto text-xs text-stone-300">{fmtDate(t.completed_at)}</span>
                    <button
                      onClick={() => patch(t.id, { status: "open" })}
                      className="text-xs font-bold text-stone-400 hover:text-stone-600"
                    >
                      החזרה
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskGroup({
  title,
  tone,
  tasks,
  busy,
  onPatch,
  onRemove,
  today,
  assignees,
  onDoneNote,
  onDoneDelete,
}: {
  title: string;
  tone: string;
  tasks: Task[];
  busy: string | null;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  today: string;
  assignees: string[];
  onDoneNote: (id: string) => void;
  onDoneDelete: (id: string) => void;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className={`mb-2 text-sm font-black ${tone}`}>{title}</h2>
      <div className="space-y-1.5">
        {tasks.map((t) => {
          const pMeta = TASK_PRIORITIES.find((p) => p.value === t.priority);
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5">
              <button
                type="button"
                onClick={() => onPatch(t.id, { status: "done" })}
                disabled={busy === t.id}
                title="סימון בוצע"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-stone-300 text-xs text-transparent hover:border-teal-500 hover:text-teal-500"
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-stone-800">{t.title}</div>
                {(t.entity_label || t.details) && (
                  <div className="truncate text-xs text-stone-400">
                    {[t.entity_label, t.details].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <select
                value={t.status}
                onChange={(e) => onPatch(t.id, { status: e.target.value })}
                disabled={busy === t.id}
                title="סטטוס"
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  TASK_STATUSES.find((x) => x.value === t.status)?.cls ?? ""
                }`}
              >
                {TASK_STATUSES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
              {/* שינוי אחראי במקום, בלי לפתוח את המשימה. PATCH כבר תמך בשדה. */}
              <select
                value={t.assignee ?? ""}
                onChange={(e) => onPatch(t.id, { assignee: e.target.value || null })}
                disabled={busy === t.id}
                title="אחראי/ת"
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  t.assignee
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-stone-200 bg-white text-stone-300"
                }`}
              >
                <option value="">ללא אחראי</option>
                {(t.assignee && !assignees.includes(t.assignee) ? [t.assignee, ...assignees] : assignees).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {t.priority !== "normal" && (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${pMeta?.cls ?? ""}`}>
                  {labelOf(TASK_PRIORITIES, t.priority)}
                </span>
              )}
              {t.due_date && (
                <span className="text-xs font-semibold text-stone-400">{fmtDate(t.due_date)}</span>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDoneNote(t.id)}
                  disabled={busy === t.id}
                  title="סימון בוצע, המשימה נשארת עם הערת סיום"
                  className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-700 hover:bg-teal-100"
                >
                  בוצע + הערה
                </button>
                <button
                  type="button"
                  onClick={() => onDoneDelete(t.id)}
                  disabled={busy === t.id}
                  title="סימון בוצע ומחיקה לצמיתות"
                  className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-400 hover:bg-red-50 hover:text-red-500"
                >
                  בוצע ומחק
                </button>
                <button
                  type="button"
                  onClick={() => onPatch(t.id, { snoozed_until: addDays(today, 1) })}
                  disabled={busy === t.id}
                  title="דחייה למחר"
                  className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-400 hover:bg-stone-100"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => onPatch(t.id, { snoozed_until: addDays(today, 7) })}
                  disabled={busy === t.id}
                  title="דחייה בשבוע"
                  className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-400 hover:bg-stone-100"
                >
                  +7
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(t.id)}
                  disabled={busy === t.id}
                  title="מחיקה"
                  className="rounded-full px-1.5 py-0.5 text-stone-300 hover:text-red-500"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
