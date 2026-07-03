"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { TASK_PRIORITIES, labelOf } from "@/app/lib/crm";

type Task = {
  id: string;
  title: string;
  details: string | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  snoozed_until: string | null;
  created_at: string;
  completed_at: string | null;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [done, setDone] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/admin-crm/tasks?status=open").then((r) => r.json()),
      fetch("/api/admin-crm/tasks?status=done").then((r) => r.json()),
    ])
      .then(([openJ, doneJ]) => {
        if (openJ.ok) setTasks(openJ.tasks);
        else setError(openJ.error || "שגיאה בטעינה");
        if (doneJ.ok) setDone(doneJ.tasks.slice(0, 20));
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

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
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setNewTitle("");
        setNewDue("");
        setNewPriority("normal");
        load();
      } else {
        setError(j.error || "שגיאה ביצירה");
      }
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    try {
      await fetch("/api/admin-crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את המשימה לצמיתות?")) return;
    setBusy(id);
    try {
      await fetch("/api/admin-crm/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      load();
    } finally {
      setBusy(null);
    }
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
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {!loading && tasks.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
            אין משימות פתוחות 🎉
          </div>
        )}

        <TaskGroup title={`באיחור (${overdue.length})`} tone="text-red-600" tasks={overdue} busy={busy} onPatch={patch} onRemove={remove} today={today} />
        <TaskGroup title={`להיום (${dueToday.length})`} tone="text-teal-700" tasks={dueToday} busy={busy} onPatch={patch} onRemove={remove} today={today} />
        <TaskGroup title={`בהמשך (${upcoming.length})`} tone="text-stone-500" tasks={upcoming} busy={busy} onPatch={patch} onRemove={remove} today={today} />
        <TaskGroup title={`בלי תאריך (${noDate.length})`} tone="text-stone-400" tasks={noDate} busy={busy} onPatch={patch} onRemove={remove} today={today} />

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
}: {
  title: string;
  tone: string;
  tasks: Task[];
  busy: string | null;
  onPatch: (id: string, body: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  today: string;
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
