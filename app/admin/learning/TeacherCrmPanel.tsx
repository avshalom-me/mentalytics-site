"use client";

import { useCallback, useEffect, useState } from "react";
import { gmailSearchUrl } from "@/app/lib/crm";
import { btn, fmtStamp, getJson, inputCls, patchTeacher } from "./shared";

// פס ה-CRM בכרטיס המורה: ציר זמן (מיילים, היסטוריה, פניות וצפיות), הערות
// פנימיות ומשימות, וקישור לג׳ימייל. אותו מבנה כמו TherapistCrmPanel אצל
// המטפלים, מול הנתיבים של המורים (/api/admin-teachers ו-/api/admin-crm/tasks
// עם entity_type "teacher").

type Item = { kind: "email" | "note" | "system" | "contact" | "view"; ts: string; title: string; detail: string };
type Note = { id: string; body: string; author: string | null; created_at: string };
type Task = { id: string; title: string; due_date: string | null; priority: string; status: string };

const ICON: Record<Item["kind"], string> = { email: "✉️", note: "📝", system: "⚙️", contact: "👆", view: "👁️" };

export default function TeacherCrmPanel({ teacherId, teacherName, email, onChange }: { teacherId: string; teacherName: string; email: string; onChange?: () => void }) {
  const [tab, setTab] = useState<"timeline" | "notes" | "tasks">("timeline");
  const [visited, setVisited] = useState({ timeline: true, notes: false, tasks: false });
  const open = (t: typeof tab) => {
    setTab(t);
    setVisited((v) => (v[t] ? v : { ...v, [t]: true }));
  };
  const cls = (active: boolean) => `px-3 py-1 text-xs font-bold transition-colors ${active ? "bg-stone-800 text-white" : "bg-white text-stone-500 hover:bg-stone-50"}`;
  return (
    <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-full border border-stone-200 bg-white">
          <button type="button" className={cls(tab === "timeline")} onClick={() => open("timeline")}>ציר זמן</button>
          <button type="button" className={cls(tab === "notes")} onClick={() => open("notes")}>הערות</button>
          <button type="button" className={cls(tab === "tasks")} onClick={() => open("tasks")}>משימות</button>
        </div>
        <a href={gmailSearchUrl(email)} target="_blank" rel="noopener noreferrer" className={`${btn} ms-auto`} title="כל התכתובת עם הכתובת הזו בג׳ימייל">
          פתח בג׳ימייל ↗
        </a>
      </div>
      {visited.timeline && <div className={tab === "timeline" ? "" : "hidden"}><Timeline teacherId={teacherId} /></div>}
      {visited.notes && <div className={tab === "notes" ? "" : "hidden"}><Notes teacherId={teacherId} onChange={onChange} /></div>}
      {visited.tasks && <div className={tab === "tasks" ? "" : "hidden"}><Tasks teacherId={teacherId} teacherName={teacherName} /></div>}
    </div>
  );
}

function Timeline({ teacherId }: { teacherId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    getJson<{ items: Item[] }>(`/api/admin-teachers?timeline_for=${encodeURIComponent(teacherId)}`)
      .then((j) => setItems(j.ok ? j.items : []))
      .catch(() => setItems([]));
  }, [teacherId]);
  if (items === null) return <p className="text-xs text-stone-400">טוען...</p>;
  if (items.length === 0) return <p className="text-xs text-stone-400">עדיין אין רשומות.</p>;
  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 rounded-lg bg-white px-2 py-1.5">
          <span aria-hidden>{ICON[it.kind]}</span>
          <span className="shrink-0 text-stone-400">{fmtStamp(it.ts)}</span>
          <span className="min-w-0 text-stone-700">
            {it.title}
            {it.detail && <span className="text-stone-400"> · {it.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Notes({ teacherId, onChange }: { teacherId: string; onChange?: () => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    getJson<{ notes: Note[] }>(`/api/admin-teachers?notes_for=${encodeURIComponent(teacherId)}`)
      .then((j) => setNotes(j.ok ? j.notes : []))
      .catch(() => setNotes([]));
  }, [teacherId]);
  useEffect(() => {
    load();
  }, [load]);
  async function add() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await patchTeacher(teacherId, "add_note", { note: body });
      if (!r.ok) return alert(r.error);
      setText("");
      load();
      onChange?.();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="mb-2 flex gap-1.5">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="הערה פנימית חדשה" className={`${inputCls} min-w-0 flex-1 py-1 text-xs`} />
        <button type="button" disabled={busy || !text.trim()} onClick={add} className={btn}>הוספה</button>
      </div>
      {notes === null && <p className="text-xs text-stone-400">טוען...</p>}
      {notes && notes.length === 0 && <p className="text-xs text-stone-400">אין הערות.</p>}
      <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="rounded-lg bg-white px-2 py-1.5 text-stone-700">
            <span className="text-stone-400">{fmtStamp(n.created_at)} · {n.author === "admin" ? "הערה" : "מערכת"}: </span>
            {n.body}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tasks({ teacherId, teacherName }: { teacherId: string; teacherName: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    getJson<{ tasks: Task[] }>(`/api/admin-crm/tasks?entity_type=teacher&entity_id=${encodeURIComponent(teacherId)}&status=all`)
      .then((j) => setTasks(j.ok ? j.tasks : []))
      .catch(() => setTasks([]));
  }, [teacherId]);
  useEffect(() => {
    load();
  }, [load]);
  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin-crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), due_date: due || null, priority: "normal", entity_type: "teacher", entity_id: teacherId, entity_label: teacherName }),
      });
      const j = await r.json();
      if (!j.ok) return alert(j.error || "יצירת המשימה נכשלה");
      setTitle("");
      setDue("");
      load();
    } finally {
      setBusy(false);
    }
  }
  async function setStatus(id: string, status: "open" | "done") {
    await fetch("/api/admin-crm/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
  }
  const open = (tasks ?? []).filter((t) => t.status !== "done");
  const done = (tasks ?? []).filter((t) => t.status === "done");
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="משימה חדשה (למשל: להתקשר לגבי התעודה)" className={`${inputCls} min-w-0 flex-1 py-1 text-xs`} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputCls} w-36 py-1 text-xs`} />
        <button type="button" disabled={busy || !title.trim()} onClick={add} className={btn}>הוספה</button>
      </div>
      {tasks === null && <p className="text-xs text-stone-400">טוען...</p>}
      {tasks && tasks.length === 0 && <p className="text-xs text-stone-400">אין משימות. משימה שתוטל עליך תופיע גם בתור העבודה הראשי.</p>}
      <ul className="space-y-1 text-xs">
        {open.map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
            <button type="button" onClick={() => setStatus(t.id, "done")} className="h-4 w-4 shrink-0 rounded border border-stone-300" aria-label="סיום" />
            <span className="text-stone-700">{t.title}</span>
            {t.due_date && <span className="ms-auto text-stone-400">עד {t.due_date.split("-").reverse().join(".")}</span>}
          </li>
        ))}
        {done.slice(0, 5).map((t) => (
          <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-stone-400 line-through">
            <button type="button" onClick={() => setStatus(t.id, "open")} className="h-4 w-4 shrink-0 rounded border border-stone-300 bg-stone-200" aria-label="פתיחה מחדש" />
            {t.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
