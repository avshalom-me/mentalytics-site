"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import {
  BOARD_NOTE_KINDS,
  DEFAULT_FOLDER,
  FILES_BUCKET,
  FILE_MAX_BYTES,
  fileSizeLabel,
  reminderOpen,
  type BoardNote,
  type BoardNoteKind,
} from "@/app/lib/schools-workspace";
import { Field, Modal, Notice, btnGhost, btnPrimary, cardCls, errText, getJson, hebStamp, inputCls, sendJson } from "../shared";
import { REMINDERS_CHANGED } from "../Reminders";

// לוח העבודה של הענף: המקום שבו נשמר מה שהיה נשאר בדרייב או בוואטסאפ. פתקים,
// החלטות, נוסחים מוכנים להעתקה, קישורים, ונקודות לפגישה הבאה, כל אחד עם תזכורת
// אפשרית למי מהצוות שצריך (היא קופצת לו בתוך ה-CRM). ולצידם הקבצים: טיוטות
// ומסמכים בדלי פרטי, עם תיקיות ושיוך לשלב בתוכנית.

type FileRow = {
  id: string;
  name: string;
  size_bytes: number | null;
  mime: string | null;
  folder: string;
  description: string | null;
  plan_item_id: string | null;
  uploaded_by: string;
  created_at: string;
  archived_at: string | null;
};
type Tab = "notes" | "files" | "archive";

const kindOf = (k: string) => BOARD_NOTE_KINDS.find((x) => x.value === k) ?? BOARD_NOTE_KINDS[0];

/** חותמת זמן לשדה datetime-local, בשעון של הדפדפן. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function BoardPage() {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<BoardNote[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<BoardNote[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<FileRow[]>([]);
  const [planItems, setPlanItems] = useState<{ id: string; title: string }[]>([]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [me, setMe] = useState("");
  const [kindFilter, setKindFilter] = useState<BoardNoteKind | "">("");
  const [editing, setEditing] = useState<BoardNote | "new" | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState("");

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 3500);
  };

  const load = useCallback(async () => {
    try {
      const [n, f] = await Promise.all([
        getJson<{ notes: BoardNote[]; me: string; recipients: string[] }>("/api/admin-schools/board"),
        getJson<{ files: FileRow[] }>("/api/admin-schools/files"),
      ]);
      setNotes(n.notes);
      setMe(n.me);
      setRecipients(n.recipients);
      setFiles(f.files);
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      const [n, f] = await Promise.all([
        getJson<{ notes: BoardNote[] }>("/api/admin-schools/board?archived=1"),
        getJson<{ files: FileRow[] }>("/api/admin-schools/files?archived=1"),
      ]);
      setArchivedNotes(n.notes);
      setArchivedFiles(f.files);
    } catch (e) {
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    void load();
    getJson<{ items: { id: string; title: string }[] }>("/api/admin-schools/plan")
      .then((j) => setPlanItems(j.items.map((i) => ({ id: i.id, title: i.title }))))
      .catch(() => setPlanItems([]));
  }, [load]);
  useEffect(() => {
    if (tab === "archive") void loadArchive();
  }, [tab, loadArchive]);
  // תזכורת שנסגרה או נדחתה מהחלונית הקופצת: הפתק בלוח מתעדכן.
  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener(REMINDERS_CHANGED, onChange);
    return () => window.removeEventListener(REMINDERS_CHANGED, onChange);
  }, [load]);

  // קישור מתזכורת (#note-<id>): גוללים לפתק ומדגישים אותו לרגע.
  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.match(/^#note-(.+)$/)?.[1];
    if (!id) return;
    setTab("notes");
    setKindFilter("");
    setHighlight(id);
    window.setTimeout(() => document.getElementById(`note-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    const t = window.setTimeout(() => setHighlight(""), 4000);
    return () => window.clearTimeout(t);
  }, [loading]);

  async function act(n: BoardNote, action: string, extra: Record<string, unknown> = {}, msg = "") {
    try {
      await sendJson("/api/admin-schools/board", { action, id: n.id, ...extra });
      await load();
      if (tab === "archive") await loadArchive();
      if (msg) say(msg);
    } catch (e) {
      setError(errText(e));
    }
  }

  const agenda = notes.filter((n) => n.kind === "agenda");
  const shown = notes.filter((n) => (kindFilter ? n.kind === kindFilter : n.kind !== "agenda"));
  const counts = useMemo(() => Object.fromEntries(BOARD_NOTE_KINDS.map((k) => [k.value, notes.filter((n) => n.kind === k.value).length])), [notes]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">לוח עבודה וקבצים</h1>
          <p className="text-sm text-stone-500">מה שמשותף לצוות הענף: פתקים, החלטות, נוסחים, קישורים, תזכורות וטיוטות.</p>
        </div>
        {tab === "notes" ? (
          <button type="button" onClick={() => setEditing("new")} className={btnPrimary}>
            + פתק חדש
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex gap-1.5">
        {(
          [
            ["notes", `פתקים (${notes.length})`],
            ["files", `קבצים (${files.length})`],
            ["archive", "ארכיון"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === k ? "bg-[#3D8C8A] text-white" : "border border-stone-200 bg-white text-stone-600"}`}>
            {label}
          </button>
        ))}
      </div>
      <Notice error={error} flash={flash} />

      {loading ? (
        <p className="text-sm text-stone-500">טוען...</p>
      ) : tab === "notes" ? (
        <>
          {agenda.length && !kindFilter ? (
            <div className="mb-5 rounded-2xl border border-[#F0D9A8] bg-[#FDF6E3] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black text-stone-900">🗓️ לפגישה הבאה ({agenda.length})</h2>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm("לסמן את כל הנקודות כטופלו ולהעביר לארכיון?")) return;
                    try {
                      await Promise.all(agenda.map((n) => sendJson("/api/admin-schools/board", { action: "archive", id: n.id })));
                      await load();
                      say("הפגישה סוכמה. הנקודות בארכיון.");
                    } catch (e) {
                      setError(errText(e));
                    }
                  }}
                  className={btnGhost}
                >
                  סיימנו את הפגישה
                </button>
              </div>
              <ul className="space-y-1.5">
                {agenda.map((n) => (
                  <li key={n.id} id={`note-${n.id}`} className={`flex items-start gap-2 rounded-lg bg-white/70 p-2 text-sm ${highlight === n.id ? "ring-2 ring-[#D49018]" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-stone-900">{n.title ?? n.body}</span>
                      {n.title && n.body ? <span className="text-stone-600"> · {n.body}</span> : null}
                      <span className="text-xs text-stone-400"> · {n.created_by}</span>
                    </div>
                    <button type="button" onClick={() => setEditing(n)} className="text-xs text-stone-500 hover:underline">
                      עריכה
                    </button>
                    <button type="button" onClick={() => act(n, "archive", {}, "טופל.")} className="text-xs font-bold text-[#2A6462] hover:underline">
                      טופל
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setKindFilter("")} className={`rounded-full px-3 py-1 text-xs font-bold ${!kindFilter ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600"}`}>
              הכול
            </button>
            {BOARD_NOTE_KINDS.map((k) => (
              <button key={k.value} type="button" onClick={() => setKindFilter(k.value)} className={`rounded-full px-3 py-1 text-xs font-bold ${kindFilter === k.value ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600"}`}>
                {k.icon} {k.label} ({counts[k.value] ?? 0})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-stone-500">אין כאן עדיין כלום. &quot;+ פתק חדש&quot; למעלה.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {shown.map((n) => (
                <NoteCard key={n.id} n={n} me={me} highlight={highlight === n.id} onEdit={() => setEditing(n)} onAct={act} onCopied={() => say("הנוסח הועתק.")} />
              ))}
            </div>
          )}
        </>
      ) : tab === "files" ? (
        <Files files={files} planItems={planItems} onChanged={load} onError={setError} onSay={say} />
      ) : (
        <Archive notes={archivedNotes} files={archivedFiles} onRestoreNote={(n) => act(n, "restore", {}, "הפתק חזר ללוח.")} onRestoreFile={async (f) => {
          try {
            await sendJson("/api/admin-schools/files", { action: "restore", id: f.id });
            await Promise.all([load(), loadArchive()]);
            say("הקובץ חזר לרשימה.");
          } catch (e) {
            setError(errText(e));
          }
        }} />
      )}

      {editing ? (
        <Modal title={editing === "new" ? "פתק חדש" : "עריכת פתק"} onClose={() => setEditing(null)}>
          <NoteForm
            note={editing === "new" ? null : editing}
            defaultKind={kindFilter || "note"}
            recipients={recipients}
            onCancel={() => setEditing(null)}
            onDone={async (msg) => {
              setEditing(null);
              say(msg);
              await load();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function NoteCard({
  n,
  me,
  highlight,
  onEdit,
  onAct,
  onCopied,
}: {
  n: BoardNote;
  me: string;
  highlight: boolean;
  onEdit: () => void;
  onAct: (n: BoardNote, action: string, extra?: Record<string, unknown>, msg?: string) => Promise<void>;
  onCopied: () => void;
}) {
  const k = kindOf(n.kind);
  const [open, setOpen] = useState(false);
  const long = (n.body?.length ?? 0) > 420;
  const reminder = n.remind_at && n.remind_to.length ? n : null;
  return (
    <div id={`note-${n.id}`} className={`${cardCls} flex flex-col gap-2 ${n.pinned ? "border-[#D49018]" : ""} ${highlight ? "ring-2 ring-[#D49018]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold text-stone-500">
            {k.icon} {k.label}
            {n.pinned ? " · 📌 נעוץ" : ""}
          </div>
          {n.title ? <div className="font-black text-stone-900">{n.title}</div> : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" title={n.pinned ? "ביטול נעיצה" : "נעיצה למעלה"} onClick={() => onAct(n, "update", { pinned: !n.pinned })} className="rounded-full px-1.5 text-sm hover:bg-stone-100">
            {n.pinned ? "📌" : "📍"}
          </button>
          <button type="button" onClick={onEdit} className={btnGhost}>
            עריכה
          </button>
        </div>
      </div>
      {n.body ? (
        <div className={`whitespace-pre-line text-sm leading-6 text-stone-700 ${long && !open ? "line-clamp-6" : ""}`}>{n.body}</div>
      ) : null}
      {long ? (
        <button type="button" onClick={() => setOpen(!open)} className="self-start text-xs font-bold text-[#2A6462] hover:underline">
          {open ? "פחות" : "להמשך הקריאה"}
        </button>
      ) : null}
      {n.url ? (
        <a href={n.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-bold text-[#2A6462] underline">
          {n.url}
        </a>
      ) : null}
      {reminder ? (
        <div className={`rounded-lg px-2 py-1.5 text-xs ${reminderOpen(reminder) ? "bg-[#FDF6E3] text-[#A87010]" : "bg-stone-50 text-stone-500"}`}>
          ⏰ {hebStamp(reminder.remind_at, true)} ·{" "}
          {reminder.remind_to.map((name, i) => {
            const s = reminder.reminder_state?.[name];
            return (
              <span key={name}>
                {i ? ", " : ""}
                {name}
                {s?.dismissed_at ? " ✓" : s?.snooze_until ? ` (נדחה ל-${hebStamp(s.snooze_until, true)})` : ""}
              </span>
            );
          })}
          {reminder.remind_to.includes(me) && !reminder.reminder_state?.[me]?.dismissed_at && reminder.remind_at && new Date(reminder.remind_at) <= new Date() ? (
            <button type="button" onClick={() => onAct(n, "dismiss", {}, "התזכורת נסגרה אצלך.")} className="ms-2 font-bold underline">
              לסגור אצלי
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2 text-[11px] text-stone-400">
        <span>
          {n.created_by} · {hebStamp(n.created_at)}
          {n.updated_at.slice(0, 16) !== n.created_at.slice(0, 16) ? ` · עודכן ${hebStamp(n.updated_at)}` : ""}
        </span>
        <span className="ms-auto flex gap-2">
          {n.kind === "template" && n.body ? (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  .writeText(n.body ?? "")
                  .then(onCopied)
                  .catch(() => window.prompt("להעתקה:", n.body ?? ""));
              }}
              className="font-bold text-[#2A6462] hover:underline"
            >
              העתקת הנוסח
            </button>
          ) : null}
          <button type="button" onClick={() => onAct(n, "archive", {}, "הפתק עבר לארכיון.")} className="hover:text-stone-600 hover:underline">
            לארכיון
          </button>
        </span>
      </div>
    </div>
  );
}

// פתק חדש נשמר כטיוטה בדפדפן עד שהשמירה בשרת מצליחה (REVIEW.md, סעיף 4): נוסח
// ארוך לא הולך לאיבוד בגלל חלון שנסגר או חיבור שנפל.
const DRAFT_KEY = "school_board_note_draft_v1";
type Draft = { kind: BoardNoteKind; title: string; body: string; url: string };

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Partial<Draft> | null;
    if (!d || typeof d !== "object") return null;
    const kind = BOARD_NOTE_KINDS.find((k) => k.value === d.kind)?.value ?? "note";
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const out = { kind, title: str(d.title), body: str(d.body), url: str(d.url) };
    return out.title || out.body || out.url ? out : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // דפדפן בלי אחסון מקומי: אין טיוטה לנקות.
  }
}

function NoteForm({
  note,
  defaultKind,
  recipients,
  onCancel,
  onDone,
}: {
  note: BoardNote | null;
  defaultKind: BoardNoteKind;
  recipients: string[];
  onCancel: () => void;
  onDone: (msg: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => (note ? null : readDraft()));
  const [kind, setKind] = useState<BoardNoteKind>(note?.kind ?? draft?.kind ?? defaultKind);
  const [title, setTitle] = useState(note?.title ?? draft?.title ?? "");
  const [body, setBody] = useState(note?.body ?? draft?.body ?? "");
  const [url, setUrl] = useState(note?.url ?? draft?.url ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [remind, setRemind] = useState(!!note?.remind_at);
  const [remindAt, setRemindAt] = useState(toLocalInput(note?.remind_at ?? null));
  const [remindTo, setRemindTo] = useState<string[]>(note?.remind_to ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (note) return;
    try {
      if (title || body || url) localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind, title, body, url }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      // בלי אחסון מקומי אין טיוטה; הטופס עצמו ממשיך לעבוד.
    }
  }, [note, kind, title, body, url]);

  async function save() {
    setError("");
    if (remind && (!remindAt || remindTo.length === 0)) return setError("לתזכורת צריך מועד ולפחות אדם אחד");
    setBusy(true);
    const fields = {
      kind,
      title: title || null,
      body: body || null,
      url: url || null,
      pinned,
      remind_at: remind && remindAt ? new Date(remindAt).toISOString() : null,
      remind_to: remind ? remindTo : [],
    };
    try {
      if (note) await sendJson("/api/admin-schools/board", { action: "update", id: note.id, ...fields });
      else {
        await sendJson("/api/admin-schools/board", { action: "create", ...fields });
        clearDraft();
      }
      await onDone(note ? "נשמר." : "הפתק נוסף ללוח.");
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      {draft ? (
        <div className="flex items-center gap-2 rounded-xl bg-[#FDF6E3] p-2 text-xs text-[#A87010]">
          חזרה טיוטה שלא נשמרה.
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setBody("");
              setUrl("");
              setDraft(null);
              clearDraft();
            }}
            className="font-bold underline"
          >
            להתחיל מחדש
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {BOARD_NOTE_KINDS.map((k) => (
          <button key={k.value} type="button" onClick={() => setKind(k.value)} className={`rounded-full px-3 py-1 text-xs font-bold ${kind === k.value ? "bg-[#3D8C8A] text-white" : "border border-stone-200 text-stone-600"}`}>
            {k.icon} {k.label}
          </button>
        ))}
      </div>
      <Field label="כותרת">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus={!note} />
      </Field>
      <Field label={kind === "template" ? "הנוסח" : kind === "decision" ? "מה הוחלט, ולמה" : "תוכן"}>
        <textarea className={inputCls} rows={kind === "template" ? 8 : 4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={8000} />
      </Field>
      <Field label={kind === "link" ? "קישור" : "קישור (לא חובה)"}>
        <input className={inputCls} dir="ltr" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={1000} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        לנעוץ למעלה
      </label>
      <div className="rounded-xl border border-stone-200 p-3">
        <label className="flex items-center gap-2 text-sm font-bold text-stone-800">
          <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />⏰ להקפיץ תזכורת
        </label>
        {remind ? (
          <div className="mt-2 space-y-2">
            <input type="datetime-local" className={inputCls} value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...recipients, ...remindTo])].map((a) => {
                const on = remindTo.includes(a);
                return (
                  <button key={a} type="button" onClick={() => setRemindTo(on ? remindTo.filter((x) => x !== a) : [...remindTo, a])} className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-[#D49018] text-white" : "border border-stone-200 text-stone-600"}`}>
                    {on ? "✓ " : ""}
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-stone-500">התזכורת קופצת בתוך ה-CRM למי שסומן, מהמועד והלאה, עד שהוא סוגר אותה. לא נשלח מייל.</p>
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "שומר..." : note ? "שמירה" : "הוספה ללוח"}
        </button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-stone-500 hover:text-stone-700">
          ביטול
        </button>
      </div>
    </div>
  );
}

function Files({
  files,
  planItems,
  onChanged,
  onError,
  onSay,
}: {
  files: FileRow[];
  planItems: { id: string; title: string }[];
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onSay: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [description, setDescription] = useState("");
  const [planItem, setPlanItem] = useState("");
  const [progress, setProgress] = useState("");
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<FileRow | null>(null);
  const folders = useMemo(() => [...new Set([DEFAULT_FOLDER, ...files.map((f) => f.folder)])].sort((a, b) => a.localeCompare(b, "he")), [files]);
  const planTitle = (id: string | null) => planItems.find((p) => p.id === id)?.title;
  const shown = files.filter((f) => !filter || f.folder === filter);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    onError("");
    const all = [...list];
    const tooBig = all.filter((f) => f.size > FILE_MAX_BYTES);
    if (tooBig.length) return onError(`גדול מ-50MB: ${tooBig.map((f) => f.name).join(", ")}. אפשר לשים קישור בלוח במקום.`);
    let done = 0;
    let failed = "";
    try {
      for (const f of all) {
        setProgress(`מעלה ${done + 1} מתוך ${all.length}: ${f.name}`);
        const sign = await sendJson<{ path: string; token: string }>("/api/admin-schools/files", { action: "sign", name: f.name, size: f.size });
        const up = await supabase.storage.from(FILES_BUCKET).uploadToSignedUrl(sign.path, sign.token, f, { contentType: f.type || undefined });
        if (up.error) {
          console.warn("school file upload failed", up.error.message);
          throw new Error(`ההעלאה של "${f.name}" לא הצליחה. אפשר לנסות שוב; אם זה חוזר, לבדוק את החיבור לאינטרנט.`);
        }
        await sendJson("/api/admin-schools/files", {
          action: "commit",
          path: sign.path,
          name: f.name,
          size: f.size,
          mime: f.type || null,
          folder,
          description: description || null,
          plan_item_id: planItem || null,
        });
        done++;
      }
      setDescription("");
      onSay(all.length === 1 ? "הקובץ הועלה." : `${all.length} קבצים הועלו.`);
    } catch (e) {
      failed = errText(e);
    } finally {
      setProgress("");
      if (input.current) input.current.value = "";
      // הרשימה נטענת מחדש קודם (גם אחרי כישלון, כי חלק מהקבצים אולי עלו), וההודעה
      // אחריה: טעינה מוצלחת מנקה את שורת השגיאה, וכך היא הייתה נמחקת מיד.
      await onChanged();
      if (failed) onError(failed);
    }
  }

  async function download(f: FileRow) {
    try {
      const j = await sendJson<{ url: string }>("/api/admin-schools/files", { action: "download", id: f.id });
      window.location.href = j.url;
    } catch (e) {
      onError(errText(e));
    }
  }

  return (
    <div className="space-y-4">
      <div className={`${cardCls} space-y-3`}>
        <div className="text-sm font-black text-stone-800">העלאת קבצים</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="תיקייה">
            <input className={inputCls} list="school-file-folders" value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={60} />
            <datalist id="school-file-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
          <Field label="שייך לשלב בתוכנית">
            <select className={inputCls} value={planItem} onChange={(e) => setPlanItem(e.target.value)}>
              <option value="">לא משויך</option>
              {planItems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תיאור (לא חובה)">
            <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="למשל: טיוטה 2 אחרי הערות" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={input} type="file" multiple onChange={(e) => upload(e.target.files)} disabled={!!progress} className="text-sm" />
          {progress ? <span className="text-xs font-bold text-[#A87010]">{progress}</span> : <span className="text-xs text-stone-500">עד 50MB לקובץ. נשמר בדלי פרטי; רק הצוות מוריד.</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setFilter("")} className={`rounded-full px-3 py-1 text-xs font-bold ${!filter ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600"}`}>
          כל התיקיות ({files.length})
        </button>
        {folders
          .filter((f) => files.some((x) => x.folder === f))
          .map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === f ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600"}`}>
              📁 {f} ({files.filter((x) => x.folder === f).length})
            </button>
          ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-stone-500">אין עדיין קבצים.</p>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {shown.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <button type="button" onClick={() => download(f)} className="min-w-0 flex-1 truncate text-start font-bold text-[#2A6462] hover:underline" title="הורדה">
                ⬇ {f.name}
              </button>
              <span className="text-xs text-stone-500">📁 {f.folder}</span>
              {planTitle(f.plan_item_id) ? <span className="text-xs text-stone-500">🗓️ {planTitle(f.plan_item_id)}</span> : null}
              <span className="text-xs text-stone-400">
                {fileSizeLabel(f.size_bytes)} · {f.uploaded_by} · {hebStamp(f.created_at)}
              </span>
              <button type="button" onClick={() => setEdit(f)} className={btnGhost}>
                עריכה
              </button>
              {f.description ? <div className="basis-full text-xs text-stone-600">{f.description}</div> : null}
            </div>
          ))}
        </div>
      )}

      {edit ? (
        <Modal title="פרטי הקובץ" onClose={() => setEdit(null)}>
          <FileForm
            file={edit}
            folders={folders}
            planItems={planItems}
            onCancel={() => setEdit(null)}
            onDone={async (msg) => {
              setEdit(null);
              onSay(msg);
              await onChanged();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function FileForm({
  file,
  folders,
  planItems,
  onCancel,
  onDone,
}: {
  file: FileRow;
  folders: string[];
  planItems: { id: string; title: string }[];
  onCancel: () => void;
  onDone: (msg: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(file.name);
  const [folder, setFolder] = useState(file.folder);
  const [description, setDescription] = useState(file.description ?? "");
  const [planItem, setPlanItem] = useState(file.plan_item_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-schools/files", { id: file.id, ...body });
      await onDone(msg);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}
      <Field label="שם">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="תיקייה">
          <input className={inputCls} list="school-file-folders-edit" value={folder} onChange={(e) => setFolder(e.target.value)} maxLength={60} />
          <datalist id="school-file-folders-edit">
            {folders.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="שייך לשלב בתוכנית">
          <select className={inputCls} value={planItem} onChange={(e) => setPlanItem(e.target.value)}>
            <option value="">לא משויך</option>
            {planItems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="תיאור">
        <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => send({ action: "update", name, folder, description, plan_item_id: planItem || null }, "נשמר.")} className={btnPrimary}>
          שמירה
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => window.confirm(`להעביר את "${file.name}" לארכיון? הקובץ נשמר ואפשר להחזיר אותו.`) && send({ action: "archive" }, "הקובץ עבר לארכיון.")}
          className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
        >
          לארכיון
        </button>
        <button type="button" onClick={onCancel} className="px-2 text-sm text-stone-500 hover:text-stone-700">
          ביטול
        </button>
      </div>
    </div>
  );
}

function Archive({ notes, files, onRestoreNote, onRestoreFile }: { notes: BoardNote[]; files: FileRow[]; onRestoreNote: (n: BoardNote) => void; onRestoreFile: (f: FileRow) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h2 className="mb-2 text-sm font-black text-stone-800">פתקים ({notes.length})</h2>
        {notes.length === 0 ? <p className="text-sm text-stone-500">ריק.</p> : null}
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className={`${cardCls} flex items-start justify-between gap-2 text-sm`}>
              <div className="min-w-0">
                <div className="text-xs text-stone-500">
                  {kindOf(n.kind).icon} {kindOf(n.kind).label} · {n.created_by} · לארכיון ב-{hebStamp(n.archived_at)}
                </div>
                <div className="truncate font-bold text-stone-800">{n.title ?? n.body ?? n.url}</div>
              </div>
              <button type="button" onClick={() => onRestoreNote(n)} className={btnGhost}>
                החזרה ללוח
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-black text-stone-800">קבצים ({files.length})</h2>
        {files.length === 0 ? <p className="text-sm text-stone-500">ריק.</p> : null}
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className={`${cardCls} flex items-start justify-between gap-2 text-sm`}>
              <div className="min-w-0">
                <div className="truncate font-bold text-stone-800">{f.name}</div>
                <div className="text-xs text-stone-500">
                  📁 {f.folder} · {f.uploaded_by} · לארכיון ב-{hebStamp(f.archived_at)}
                </div>
              </div>
              <button type="button" onClick={() => onRestoreFile(f)} className={btnGhost}>
                החזרה
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
