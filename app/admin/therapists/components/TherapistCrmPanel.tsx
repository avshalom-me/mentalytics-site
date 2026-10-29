"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../../components/HelpTip";
import { gmailSearchUrl } from "@/app/lib/crm";

// The CRM strip inside the expanded therapist card: unified timeline,
// internal notes and follow-up tasks — plus a Gmail deep-link. Self-contained
// (fetches its own data lazily per tab) so the therapists page only mounts it.

type TimelineEvent = {
  kind: "audit" | "email" | "note" | "lead" | "click" | "payment" | "registered";
  ts: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
};

type Note = { id: string; body: string; author: string; pinned: boolean; created_at: string };

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  status: string;
};

const KIND_ICONS: Record<TimelineEvent["kind"], string> = {
  audit: "⚙️",
  email: "✉️",
  note: "📝",
  lead: "📥",
  click: "👆",
  payment: "💳",
  registered: "🌱",
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

export default function TherapistCrmPanel({
  therapistId,
  therapistName,
  email,
}: {
  therapistId: string;
  therapistName: string;
  email: string | null;
}) {
  const [tab, setTab] = useState<"timeline" | "notes" | "tasks">("timeline");
  // לשונית שנפתחה פעם אחת נשארת טעונה: עד 29/10/26 כל מעבר ללשונית טען אותה
  // מחדש מאפס ("טוען…" בכל לחיצה על "משימות"). עכשיו הפעם הראשונה בלבד.
  const [visited, setVisited] = useState<Record<"timeline" | "notes" | "tasks", boolean>>({
    timeline: true,
    notes: false,
    tasks: false,
  });
  const openTab = (next: "timeline" | "notes" | "tasks") => {
    setTab(next);
    setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
  };

  return (
    <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-stone-200 bg-white">
          <PanelTab label="ציר זמן" active={tab === "timeline"} onClick={() => openTab("timeline")} />
          <PanelTab label="הערות" active={tab === "notes"} onClick={() => openTab("notes")} />
          <PanelTab label="משימות" active={tab === "tasks"} onClick={() => openTab("tasks")} />
        </div>
        <HelpTip id={tab === "timeline" ? "timeline" : tab === "notes" ? "notes" : "tasks"} />
        {email && (
          <a
            href={gmailSearchUrl(email)}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100"
            title="כל התכתובת עם הכתובת הזו בג'ימייל"
          >
            פתח בג'ימייל ↗
          </a>
        )}
      </div>

      {visited.timeline && <div className={tab === "timeline" ? "" : "hidden"}><TimelinePane therapistId={therapistId} /></div>}
      {visited.notes && <div className={tab === "notes" ? "" : "hidden"}><NotesPane therapistId={therapistId} /></div>}
      {visited.tasks && (
        <div className={tab === "tasks" ? "" : "hidden"}>
          <TasksPane therapistId={therapistId} therapistName={therapistName} />
        </div>
      )}
    </div>
  );
}

function PanelTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-bold transition-colors ${
        active ? "bg-stone-800 text-white" : "bg-white text-stone-500 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}

function TimelinePane({ therapistId }: { therapistId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin-crm/timeline?therapist_id=${therapistId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvents(j.events);
        else setError(j.error || "שגיאה");
      })
      .catch(() => setError("שגיאה בטעינה"));
  }, [therapistId]);

  if (error) return <div className="p-2 text-xs text-red-600">{error}</div>;
  if (!events) return <div className="p-2 text-xs text-stone-400">טוען ציר זמן…</div>;
  if (events.length === 0) return <div className="p-2 text-xs text-stone-400">אין אירועים עדיין.</div>;

  return (
    <div className="max-h-72 overflow-y-auto rounded-lg bg-white p-2">
      {events.map((e, i) => (
        <div key={i} className="flex gap-2 border-b border-stone-50 px-1 py-1.5 last:border-b-0">
          <span className="w-5 shrink-0 text-center text-xs">{KIND_ICONS[e.kind]}</span>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-stone-700">{e.title}</span>
            {e.detail && <span className="ms-2 break-words text-xs text-stone-500">{e.detail}</span>}
          </div>
          <span className="shrink-0 text-[11px] text-stone-400">
            {e.actor ? `${e.actor} · ` : ""}
            {fmt(e.ts)}
          </span>
        </div>
      ))}
    </div>
  );
}

function NotesPane({ therapistId }: { therapistId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin-crm/notes?entity_type=therapist&entity_id=${therapistId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setNotes(j.notes);
        else setError(j.error || "שגיאה");
      })
      .catch(() => setError("שגיאה בטעינה"));
  }, [therapistId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin-crm/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_type: "therapist", entity_id: therapistId, body: draft.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setDraft("");
        // ההערה שהשרת החזיר נכנסת מיד; הרענון השקט מיישר את הסדר.
        if (j.note) setNotes((prev) => [j.note as Note, ...(prev ?? [])]);
        load();
      } else setError(j?.error || "שגיאה בשמירה");
    } catch {
      setError("שגיאה בשמירה - בדקו את החיבור");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(n: Note) {
    setNotes((prev) => (prev ?? []).map((x) => (x.id === n.id ? { ...x, pinned: !n.pinned } : x)));
    try {
      const res = await fetch("/api/admin-crm/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, pinned: !n.pinned }),
      });
      if (!res.ok) setError("הנעיצה לא נשמרה - נסו שוב");
    } catch {
      setError("הנעיצה לא נשמרה - בדקו את החיבור");
    } finally {
      load();
    }
  }

  async function remove(n: Note) {
    if (!confirm("למחוק את ההערה?")) return;
    setNotes((prev) => (prev ?? []).filter((x) => x.id !== n.id));
    try {
      const res = await fetch("/api/admin-crm/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      if (!res.ok) setError("ההערה לא נמחקה - נסו שוב");
    } catch {
      setError("ההערה לא נמחקה - בדקו את החיבור");
    } finally {
      load();
    }
  }

  return (
    <div>
      <form onSubmit={addNote} className="mb-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="הערה פנימית חדשה… (המטפל לא רואה)"
          className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          הוספה
        </button>
      </form>
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      {!notes && <div className="p-2 text-xs text-stone-400">טוען…</div>}
      {notes && notes.length === 0 && (
        <div className="p-2 text-xs text-stone-400">אין הערות עדיין — שיחה חשובה? שורה אחת כאן.</div>
      )}
      <div className="max-h-60 space-y-1.5 overflow-y-auto">
        {notes?.map((n) => (
          <div key={n.id} className="rounded-lg bg-white p-2.5">
            <div className="whitespace-pre-wrap text-xs text-stone-700">{n.body}</div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
              <span>
                {n.author} · {fmt(n.created_at)}
              </span>
              <button
                type="button"
                onClick={() => togglePin(n)}
                title={n.pinned ? "ביטול נעיצה" : "נעיצה למעלה"}
                className={n.pinned ? "" : "opacity-40 hover:opacity-100"}
              >
                📌
              </button>
              <button type="button" onClick={() => remove(n)} className="opacity-40 hover:opacity-100 hover:text-red-500">
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TasksPane({ therapistId, therapistName }: { therapistId: string; therapistName: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin-crm/tasks?status=open&entity_type=therapist&entity_id=${therapistId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setTasks(j.tasks);
        else setError(j.error || "שגיאה");
      })
      .catch(() => setError("שגיאה בטעינה"));
  }, [therapistId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin-crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          entity_type: "therapist",
          entity_id: therapistId,
          entity_label: therapistName,
          due_date: due || null,
        }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setTitle("");
        setDue("");
        // המשימה שהשרת החזיר נכנסת מיד, לפי התאריך (בלי תאריך בסוף), כמו בשרת.
        if (j.task) {
          setTasks((prev) =>
            [...(prev ?? []).filter((x) => x.id !== (j.task as Task).id), j.task as Task].sort((a, b) =>
              a.due_date === b.due_date ? 0 : a.due_date === null ? 1 : b.due_date === null ? -1 : a.due_date < b.due_date ? -1 : 1
            )
          );
        }
        load();
      } else setError(j?.error || "שגיאה בשמירה");
    } catch {
      setError("שגיאה בשמירה - בדקו את החיבור");
    } finally {
      setBusy(false);
    }
  }

  async function complete(t: Task) {
    // יורדת מהרשימה מיד; כישלון מוצג והרענון השקט מחזיר אותה.
    setTasks((prev) => (prev ?? []).filter((x) => x.id !== t.id));
    try {
      const res = await fetch("/api/admin-crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, status: "done" }),
      });
      if (!res.ok) setError("המשימה לא סומנה כבוצעה - נסו שוב");
    } catch {
      setError("המשימה לא סומנה כבוצעה - בדקו את החיבור");
    } finally {
      load();
    }
  }

  return (
    <div>
      <form onSubmit={addTask} className="mb-2 flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="משימת מעקב חדשה…"
          className="min-w-32 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-full bg-stone-800 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          הוספה
        </button>
      </form>
      {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
      {!tasks && <div className="p-2 text-xs text-stone-400">טוען…</div>}
      {tasks && tasks.length === 0 && <div className="p-2 text-xs text-stone-400">אין משימות פתוחות למטפל/ת.</div>}
      <div className="space-y-1">
        {tasks?.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => complete(t)}
              title="סימון בוצע"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-stone-300 text-[10px] text-transparent hover:border-teal-500 hover:text-teal-500"
            >
              ✓
            </button>
            <span className="flex-1 text-xs font-bold text-stone-700">{t.title}</span>
            {t.due_date && <span className="text-[11px] text-stone-400">{fmt(t.due_date)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
