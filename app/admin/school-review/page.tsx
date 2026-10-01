"use client";

// ביקורת שאלון היועצות - מי בודק, ומה נכתב.
//
// A reviewer gets a personal link from here and works on /school itself; the
// notes come back to this page. The page exists to move a note from "written"
// to "in the code": read it, open the exact state it was written on, decide,
// answer - and export what was decided on for a panel check before it is
// implemented. See supabase/migrations/20261001_school_review.sql.

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import {
  NOTE_KINDS, NOTE_KIND_LABELS, NOTE_SEVERITIES, NOTE_SEVERITY_LABELS, NOTE_STATUSES, NOTE_STATUS_LABELS, ATLAS_STEP, sourceHint,
  type NoteKind, type NoteSeverity, type NoteStatus, type ReviewNote,
} from "@/app/lib/school-review";
import { notesToCsv, notesToJson, notesToMarkdown, type ExportNames } from "@/app/lib/school-review-export";
import { PAGES, type PageId } from "@/app/kids/quiz-logic";
import { PAGE_NAMES, coverageGroups, coverageTotals } from "@/app/kids/review/coverage";
import { REVIEW_CASES, findCase } from "@/app/kids/review/cases";
import { stashRestore } from "@/app/kids/review/session";

interface ReviewerRow {
  id: string;
  name: string;
  token: string;
  active: boolean;
  created_at: string;
  last_seen_at: string | null;
  seen: string[];
}
interface Data { reviewers: ReviewerRow[]; notes: ReviewNote[] }

const SCREEN_ORDER: readonly string[] = [...PAGES, ATLAS_STEP];
const screenName = (step: string) => (step === ATLAS_STEP ? "אטלס הוועדות" : PAGE_NAMES[step as PageId] ?? step);
const dateHe = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

const STATUS_CLS: Record<NoteStatus, string> = {
  open: "bg-stone-100 text-stone-700",
  accepted: "bg-teal-50 text-teal-800",
  rejected: "bg-rose-50 text-rose-700",
  done: "bg-emerald-50 text-emerald-800",
};
const SEVERITY_CLS: Record<NoteSeverity, string> = { high: "text-rose-700", medium: "text-amber-700", low: "text-stone-500" };
const rowBtn = "rounded-full border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50";
const primaryBtn = "rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50";
const input = "rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm";

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; note?: ReviewNote }> {
  const res = await fetch("/api/admin-school-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ ok: false, error: "השרת לא ענה" }));
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Reviewers ────────────────────────────────────────────────────────────────

function Reviewer({ r, notes, onChanged }: { r: ReviewerRow; notes: ReviewNote[]; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const own = notes.filter(n => n.reviewer_id === r.id && !n.withdrawn_at);
  const coverage = useMemo(() => coverageTotals(coverageGroups(new Set(r.seen), REVIEW_CASES)), [r.seen]);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/school#review=${r.token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the link is on screen to be copied by hand */ }
  };
  const toggle = async () => {
    setBusy(true);
    await post({ action: "set_reviewer_active", id: r.id, active: !r.active });
    setBusy(false);
    onChanged();
  };
  return (
    <tr className="border-b border-stone-100 last:border-b-0 align-top">
      <td className="px-4 py-2.5 font-bold text-stone-800">
        {r.name}
        {!r.active && <span className="ms-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">הקישור כבוי</span>}
      </td>
      <td className="px-4 py-2.5 text-stone-600">{dateHe(r.last_seen_at)}</td>
      <td className="px-4 py-2.5 text-stone-600">{own.length} ({own.filter(n => n.status === "open").length} חדשות)</td>
      <td className="px-4 py-2.5 text-stone-600">{coverage.seen} מתוך {coverage.total}</td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={link} onFocus={e => e.currentTarget.select()} dir="ltr" className={`${input} w-56 text-xs text-stone-500`} />
          <button type="button" onClick={copy} className={rowBtn}>{copied ? "הועתק" : "העתקת הקישור"}</button>
          <button type="button" onClick={toggle} disabled={busy} className={rowBtn}>{r.active ? "כיבוי הקישור" : "הפעלה מחדש"}</button>
        </div>
      </td>
    </tr>
  );
}

function Reviewers({ data, onChanged }: { data: Data; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setMsg("");
    const j = await post({ action: "create_reviewer", name });
    setBusy(false);
    if (!j.ok) { setMsg(j.error || "היצירה נכשלה"); return; }
    setName("");
    onChanged();
  };
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-lg font-black text-stone-900">בודקים</h2>
      <p className="mb-3 text-sm leading-relaxed text-stone-600">
        כל בודק/ת מקבל/ת קישור אישי. פתיחת הקישור מעלה את שאלון היועצות עם סרגל ביקורת: מקרים מוכנים, מעבר לכל מסך, אטלס הוועדות, וכתיבת הערה על כל חלק. מה שנפתח דרך הקישור לא נספר במדידה.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} placeholder="שם הבודק/ת" className={`${input} w-56`} />
        <button type="button" onClick={add} disabled={busy || !name.trim()} className={primaryBtn}>{busy ? "יוצר…" : "יצירת קישור"}</button>
        {msg && <span className="text-sm text-rose-700">{msg}</span>}
      </div>
      {data.reviewers.length === 0
        ? <p className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-500">עוד אין בודקים. הוסיפו שם כדי לקבל קישור.</p>
        : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="px-4 py-2.5 text-start font-bold">שם</th>
                  <th className="px-4 py-2.5 text-start font-bold">נראה לאחרונה</th>
                  <th className="px-4 py-2.5 text-start font-bold">הערות</th>
                  <th className="px-4 py-2.5 text-start font-bold">ראה/תה</th>
                  <th className="px-4 py-2.5 text-start font-bold">הקישור האישי</th>
                </tr>
              </thead>
              <tbody>{data.reviewers.map(r => <Reviewer key={r.id} r={r} notes={data.notes} onChanged={onChanged} />)}</tbody>
            </table>
          </div>
        )}
    </section>
  );
}

// ── One note ─────────────────────────────────────────────────────────────────

function NoteCard({ n, reviewer, picked, onPick, onChanged }: {
  n: ReviewNote;
  reviewer: string;
  picked: boolean;
  onPick: (id: string, on: boolean) => void;
  onChanged: (note: ReviewNote) => void;
}) {
  const [response, setResponse] = useState(n.response ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const caseTitle = findCase(n.case_id)?.title ?? null;
  const ctx = n.context ?? {};
  const shown = (["referrals", "tracks", "tips"] as const)
    .map(k => (Array.isArray(ctx[k]) && (ctx[k] as unknown[]).length ? `${k === "referrals" ? "הפניות" : k === "tracks" ? "מסלולים" : "כלים"}: ${(ctx[k] as unknown[]).join(", ")}` : null))
    .filter(Boolean);

  const update = async (patch: { status?: NoteStatus; response?: string }) => {
    setBusy(true);
    setErr("");
    const j = await post({ action: "update_note", id: n.id, ...patch });
    setBusy(false);
    if (!j.ok || !j.note) { setErr(j.error || "העדכון נכשל"); return; }
    onChanged(j.note);
  };
  const openState = () => {
    if (!n.answers) return;
    stashRestore({
      A: n.answers,
      step: n.step,
      note: { reviewer, kindLabel: NOTE_KIND_LABELS[n.kind], text: n.note, quote: n.quote, blockLabel: n.block_label },
    });
    window.open("/school#review-restore", "_blank", "noopener");
  };

  return (
    <div className={`rounded-2xl border bg-white p-4 ${n.withdrawn_at ? "border-stone-200 opacity-60" : "border-stone-200"}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <input type="checkbox" checked={picked} onChange={e => onPick(n.id, e.target.checked)} aria-label="בחירת ההערה" className="h-4 w-4" />
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_CLS[n.status]}`}>{NOTE_STATUS_LABELS[n.status]}</span>
        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-stone-700">{NOTE_KIND_LABELS[n.kind]}</span>
        <span className={`text-xs font-bold ${SEVERITY_CLS[n.severity]}`}>חומרה {NOTE_SEVERITY_LABELS[n.severity]}</span>
        {n.withdrawn_at && <span className="text-xs font-bold text-stone-500">בוטלה בידי הבודק/ת</span>}
        <span className="ms-auto text-xs text-stone-400">{reviewer} · {dateHe(n.created_at)}</span>
      </div>
      <div className="text-xs text-stone-500">
        {n.block_label ?? "המסך כולו"}
        {n.variant ? ` · גרסה: ${n.variant}` : ""}
        {caseTitle ? ` · ${caseTitle}${n.case_modified ? " (התשובות שונו)" : ""}` : ""}
        {typeof ctx.scenario === "string" ? ` · ${ctx.scenario}` : ""}
      </div>
      {n.quote && <blockquote className="my-2 whitespace-pre-wrap border-s-2 border-amber-400 ps-3 text-sm leading-relaxed text-stone-600">{n.quote}</blockquote>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-900">{n.note}</p>
      {n.suggestion && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-teal-50 p-2 text-sm leading-relaxed text-teal-900"><strong>נוסח מוצע:</strong> {n.suggestion}</p>}

      <details className="mt-2 text-xs text-stone-500">
        <summary className="cursor-pointer font-bold">הקשר ומקום בקוד</summary>
        <div className="mt-1 space-y-1 leading-relaxed">
          {n.block_id && <div>מזהה בלוק: <code dir="ltr">{n.block_id}</code></div>}
          <div>איפה בקוד (השערה לפי המיקום): <span dir="ltr">{sourceHint(n.step, n.block_id)}</span></div>
          {shown.length > 0 && <div>מה הוצג באותו מצב: {shown.join(" · ")}</div>}
          {typeof ctx.explain_text === "string" && <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-2">ההסבר שהוצג: {ctx.explain_text}</div>}
          <div>מזהה: <code dir="ltr">{n.id}</code></div>
        </div>
      </details>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {n.answers && <button type="button" onClick={openState} className={rowBtn}>לפתוח את המצב בשאלון</button>}
        {NOTE_STATUSES.filter(s => s !== n.status).map(s => (
          <button key={s} type="button" disabled={busy} onClick={() => update({ status: s })} className={rowBtn}>
            {s === "open" ? "להחזיר לחדשות" : NOTE_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <textarea value={response} onChange={e => setResponse(e.target.value)} rows={2} placeholder="תשובה לבודק/ת - מה הוחלט ולמה. היא מופיעה אצלו/ה ליד ההערה." className={`${input} min-w-[240px] flex-1 leading-relaxed`} />
        <button type="button" disabled={busy || response === (n.response ?? "")} onClick={() => update({ response })} className={rowBtn}>שמירת התשובה</button>
      </div>
      {err && <p className="mt-1 text-xs text-rose-700">{err}</p>}
    </div>
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

type StatusFilter = NoteStatus | "all" | "withdrawn";

export default function SchoolReviewPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [fReviewer, setFReviewer] = useState("all");
  const [fStatus, setFStatus] = useState<StatusFilter>("open");
  const [fKind, setFKind] = useState<NoteKind | "all">("all");
  const [fSeverity, setFSeverity] = useState<NoteSeverity | "all">("all");
  const [fStep, setFStep] = useState("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    setError("");
    fetch("/api/admin-school-review")
      .then(r => r.json())
      .then(j => { if (j.ok) setData({ reviewers: j.reviewers, notes: j.notes }); else setError(j.error || "שגיאה בטעינה"); })
      .catch(() => setError("שגיאה בטעינה"));
  }, []);
  useEffect(() => { load(); }, [load]);

  const names: ExportNames = useMemo(() => ({
    screenName,
    screenOrder: SCREEN_ORDER,
    reviewerName: id => data?.reviewers.find(r => r.id === id)?.name ?? "-",
    caseTitle: id => findCase(id)?.title ?? null,
  }), [data]);

  const live = useMemo(() => (data?.notes ?? []).filter(n => !n.withdrawn_at), [data]);
  const filtered = useMemo(() => {
    const needle = q.trim();
    return (data?.notes ?? []).filter(n =>
      (fStatus === "withdrawn" ? !!n.withdrawn_at : !n.withdrawn_at && (fStatus === "all" || n.status === fStatus)) &&
      (fReviewer === "all" || n.reviewer_id === fReviewer) &&
      (fKind === "all" || n.kind === fKind) &&
      (fSeverity === "all" || n.severity === fSeverity) &&
      (fStep === "all" || n.step === fStep) &&
      (!needle || [n.note, n.quote, n.suggestion, n.block_label, n.response].some(t => t?.includes(needle))));
  }, [data, fKind, fReviewer, fSeverity, fStatus, fStep, q]);

  // Grouped by screen, in the order of the questionnaire.
  const groups = useMemo(() => {
    const steps = SCREEN_ORDER.filter(s => filtered.some(n => n.step === s));
    const other = Array.from(new Set(filtered.map(n => n.step).filter(s => !SCREEN_ORDER.includes(s))));
    return [...steps, ...other].map(step => ({ step, notes: filtered.filter(n => n.step === step) }));
  }, [filtered]);
  const stepsWithNotes = useMemo(() => SCREEN_ORDER.filter(s => live.some(n => n.step === s)), [live]);

  const chosen = picked.size ? filtered.filter(n => picked.has(n.id)) : filtered;
  const say = (text: string) => { setFlash(text); setTimeout(() => setFlash(""), 2500); };
  const replaceNote = (note: ReviewNote) => setData(d => (d ? { ...d, notes: d.notes.map(n => (n.id === note.id ? note : n)) } : d));
  const pick = (id: string, on: boolean) => setPicked(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

  const copyMarkdown = async () => {
    try { await navigator.clipboard.writeText(notesToMarkdown(chosen, names)); say(`הועתקו ${chosen.length} הערות`); }
    catch { say("ההעתקה נכשלה - אפשר להוריד את הקובץ"); }
  };
  const bulk = async (status: NoteStatus) => {
    const ids = chosen.map(n => n.id);
    if (!ids.length || !window.confirm(`לסמן ${ids.length} הערות כ"${NOTE_STATUS_LABELS[status]}"?`)) return;
    const j = await post({ action: "set_status", ids, status });
    if (!j.ok) { say(j.error || "העדכון נכשל"); return; }
    setPicked(new Set());
    load();
  };
  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen bg-stone-50" dir="rtl">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">ביקורת שאלון היועצות</h1>
          <HelpTip id="school-review" />
        </div>
        {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {!data && !error && <p className="text-sm text-stone-500">טוען…</p>}

        {data && (
          <>
            <Reviewers data={data} onChanged={load} />

            <section>
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <h2 className="text-lg font-black text-stone-900">הערות</h2>
                <span className="text-sm text-stone-500">
                  {NOTE_STATUSES.map(s => `${NOTE_STATUS_LABELS[s]}: ${live.filter(n => n.status === s).length}`).join(" · ")}
                </span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select value={fStatus} onChange={e => setFStatus(e.target.value as StatusFilter)} className={input}>
                  <option value="all">כל הסטטוסים</option>
                  {NOTE_STATUSES.map(s => <option key={s} value={s}>{NOTE_STATUS_LABELS[s]}</option>)}
                  <option value="withdrawn">בוטלו בידי הבודק/ת</option>
                </select>
                <select value={fReviewer} onChange={e => setFReviewer(e.target.value)} className={input}>
                  <option value="all">כל הבודקים</option>
                  {data.reviewers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select value={fKind} onChange={e => setFKind(e.target.value as NoteKind | "all")} className={input}>
                  <option value="all">כל הסוגים</option>
                  {NOTE_KINDS.map(k => <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>)}
                </select>
                <select value={fSeverity} onChange={e => setFSeverity(e.target.value as NoteSeverity | "all")} className={input}>
                  <option value="all">כל החומרות</option>
                  {NOTE_SEVERITIES.map(s => <option key={s} value={s}>חומרה {NOTE_SEVERITY_LABELS[s]}</option>)}
                </select>
                <select value={fStep} onChange={e => setFStep(e.target.value)} className={input}>
                  <option value="all">כל המסכים</option>
                  {stepsWithNotes.map(s => <option key={s} value={s}>{screenName(s)}</option>)}
                </select>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש בטקסט" className={`${input} w-40`} />
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3">
                <span className="text-sm font-bold text-stone-700">
                  {picked.size ? `${chosen.length} הערות נבחרו` : `${filtered.length} הערות בסינון`}
                </span>
                <button type="button" onClick={copyMarkdown} disabled={!chosen.length} className={primaryBtn}>העתקה לבדיקת פאנל</button>
                <button type="button" disabled={!chosen.length} onClick={() => download(`school-review-${stamp}.md`, notesToMarkdown(chosen, names), "text/markdown;charset=utf-8")} className={rowBtn}>הורדה כ-Markdown</button>
                <button type="button" disabled={!chosen.length} onClick={() => download(`school-review-${stamp}.json`, notesToJson(chosen, names), "application/json;charset=utf-8")} className={rowBtn}>הורדה כ-JSON, עם התשובות</button>
                <button type="button" disabled={!chosen.length} onClick={() => download(`school-review-${stamp}.csv`, notesToCsv(chosen, names), "text/csv;charset=utf-8")} className={rowBtn}>הורדה כ-CSV</button>
                <span className="mx-1 text-stone-300">|</span>
                <button type="button" disabled={!chosen.length} onClick={() => bulk("accepted")} className={rowBtn}>לסמן: אושרה ליישום</button>
                <button type="button" disabled={!chosen.length} onClick={() => bulk("done")} className={rowBtn}>לסמן: טופלה</button>
                {picked.size > 0 && <button type="button" onClick={() => setPicked(new Set())} className={rowBtn}>ניקוי הבחירה</button>}
                {flash && <span className="text-sm font-bold text-teal-700">{flash}</span>}
              </div>

              {groups.length === 0
                ? <p className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-500">אין הערות בסינון הזה.</p>
                : groups.map(g => (
                  <div key={g.step} className="mb-6">
                    <h3 className="mb-2 text-sm font-black text-stone-700">{screenName(g.step)} <span className="font-normal text-stone-400">({g.notes.length})</span></h3>
                    <div className="space-y-3">
                      {g.notes.map(n => (
                        <NoteCard key={n.id} n={n} reviewer={names.reviewerName(n.reviewer_id)} picked={picked.has(n.id)} onPick={pick} onChanged={replaceNote} />
                      ))}
                    </div>
                  </div>
                ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
