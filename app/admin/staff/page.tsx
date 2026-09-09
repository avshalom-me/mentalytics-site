"use client";

import { useCallback, useEffect, useState } from "react";

// ניהול צוות ושעות עבודה: הוספת עובדים, קודי דיווח, ותיקון/צפייה ברישומי
// נוכחות לפי חודש. העובדים מדווחים בעצמם ב-/staff עם הקוד האישי שלהם.

import { WORK_KINDS, type WorkKind } from "@/app/lib/staff-work-kinds";

type Session = {
  id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  source: string;
  work_kinds: WorkKind[] | null;
};

type Employee = {
  id: string;
  full_name: string;
  pin: string | null;
  hourly_rate: number | null;
  active: boolean;
  sessions: Session[];
  openSession: Session | null;
  monthTotalMinutes: number;
};

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
// timestamptz → ערך ל-input datetime-local (בזמן מקומי)
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminStaffPage() {
  const [month, setMonth] = useState(currentMonth());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [neName, setNeName] = useState("");
  const [nePin, setNePin] = useState("");
  const [neRate, setNeRate] = useState("");

  const [editSession, setEditSession] = useState<Session | null>(null);
  const [addFor, setAddFor] = useState<Employee | null>(null);
  const [fIn, setFIn] = useState("");
  const [fOut, setFOut] = useState("");
  const [fNote, setFNote] = useState("");
  const [fKinds, setFKinds] = useState<WorkKind[]>([]);

  // נועל את גלילת העמוד שמאחורי המודל — בלעדיו, גלילה מעל הרקע הכהה מזיזה
  // את דף האדמין שמתחת במקום את תוכן המודל.
  const anyModalOpen = showNewEmployee || editSession !== null || addFor !== null;
  useEffect(() => {
    if (!anyModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [anyModalOpen]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`/api/admin-staff?month=${month}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEmployees(j.employees);
        else setError(j.error ?? "שגיאה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(load, [load]);

  async function post(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? "שגיאה");
        return false;
      }
      load();
      return true;
    } catch {
      setError("שגיאת רשת");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveNewEmployee() {
    const ok = await post({ action: "create_employee", full_name: neName, pin: nePin, hourly_rate: neRate === "" ? null : Number(neRate) });
    if (ok) { setShowNewEmployee(false); setNeName(""); setNePin(""); setNeRate(""); }
  }

  function openEdit(s: Session) {
    setEditSession(s);
    setFIn(isoToLocal(s.clock_in));
    setFOut(isoToLocal(s.clock_out));
    setFNote(s.note ?? "");
    setFKinds(s.work_kinds ?? []);
  }
  function openAdd(e: Employee) {
    setAddFor(e);
    setFIn(""); setFOut(""); setFNote(""); setFKinds([]);
  }

  async function saveSession() {
    if (editSession) {
      const ok = await post({
        action: "update_session",
        id: editSession.id,
        clock_in: localToIso(fIn),
        clock_out: fOut ? localToIso(fOut) : null,
        note: fNote,
        work_kinds: fKinds,
      });
      if (ok) setEditSession(null);
    } else if (addFor) {
      const ok = await post({
        action: "add_session",
        staff_id: addFor.id,
        clock_in: localToIso(fIn),
        clock_out: fOut ? localToIso(fOut) : null,
        note: fNote,
        work_kinds: fKinds,
      });
      if (ok) setAddFor(null);
    }
  }

  const totalAll = employees.reduce((s, e) => s + e.monthTotalMinutes, 0);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-stone-900">צוות ושעות עבודה</h1>
          <p className="text-xs text-stone-400 mt-1">
            העובדים מדווחים בעצמם בקישור{" "}
            <a href="/staff" target="_blank" className="underline font-bold text-[#0F5468]">mentalytics.co.il/staff</a>{" "}
            עם הקוד האישי שלהם
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => setShowNewEmployee(true)}
            className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700"
          >
            + עובד/ת חדש/ה
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && (
        <>
          <div className="mb-6 inline-block rounded-2xl border border-teal-200 bg-teal-50 px-6 py-3 text-center">
            <div className="text-2xl font-black text-teal-800">{fmtMinutes(totalAll)}</div>
            <div className="text-xs font-semibold text-teal-700">סה&quot;כ שעות צוות בחודש {month}</div>
          </div>

          {employees.map((e) => (
            <div key={e.id} className={`mb-5 rounded-2xl border bg-white p-5 ${e.active ? "border-stone-200" : "border-stone-200 opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-stone-800">{e.full_name}</h2>
                  {!e.active && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">לא פעיל/ה</span>}
                  {e.openSession && (
                    <span className="rounded-full bg-green-100 border border-green-300 px-2 py-0.5 text-xs font-bold text-green-800">
                      🟢 במשמרת מאז {fmtDateTime(e.openSession.clock_in)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xl font-black text-[#0F5468]">{fmtMinutes(e.monthTotalMinutes)}</div>
                    <div className="text-[10px] text-stone-400">שעות החודש</div>
                  </div>
                  {e.hourly_rate != null && (
                    <div className="text-center">
                      <div className="text-xl font-black text-stone-700">₪{Math.round((e.monthTotalMinutes / 60) * e.hourly_rate).toLocaleString("he-IL")}</div>
                      <div className="text-[10px] text-stone-400">עלות (₪{e.hourly_rate}/שעה)</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                <span className="text-stone-500">
                  קוד דיווח: {e.pin ? <strong className="font-mono">{e.pin}</strong> : <span className="text-red-600 font-bold">לא הוגדר — העובד/ת לא יכול/ה לדווח</span>}
                </span>
                <button
                  onClick={() => {
                    const p = prompt("קוד דיווח חדש (4-8 ספרות, ריק להסרה):", e.pin ?? "");
                    if (p !== null) post({ action: "update_employee", id: e.id, pin: p.trim() });
                  }}
                  className="rounded-full border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50"
                >
                  שינוי קוד
                </button>
                <button
                  onClick={() => {
                    const r = prompt("תעריף שעתי בש\"ח (ריק להסרה):", e.hourly_rate != null ? String(e.hourly_rate) : "");
                    if (r !== null) post({ action: "update_employee", id: e.id, hourly_rate: r.trim() === "" ? null : Number(r) });
                  }}
                  className="rounded-full border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50"
                >
                  תעריף
                </button>
                <button
                  onClick={() => post({ action: "update_employee", id: e.id, active: !e.active })}
                  className="rounded-full border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50"
                >
                  {e.active ? "השבתה" : "הפעלה"}
                </button>
                <button
                  onClick={() => openAdd(e)}
                  className="rounded-full border border-teal-300 bg-teal-50 px-2 py-0.5 font-bold text-teal-800 hover:bg-teal-100"
                >
                  + הוספת רישום
                </button>
              </div>

              {e.sessions.length === 0 ? (
                <p className="text-sm text-stone-400">אין רישומים בחודש הזה</p>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs text-stone-400">
                      <th className="py-1.5 font-semibold">כניסה</th>
                      <th className="py-1.5 font-semibold">יציאה</th>
                      <th className="py-1.5 font-semibold text-center">משך</th>
                      <th className="py-1.5 font-semibold">אופי העבודה</th>
                      <th className="py-1.5 font-semibold">הערה</th>
                      <th className="py-1.5 font-semibold text-center">מקור</th>
                      <th className="py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.sessions.map((s) => {
                      const min = s.clock_out
                        ? Math.round((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60_000)
                        : null;
                      return (
                        <tr key={s.id} className="border-b border-stone-50 hover:bg-stone-50">
                          <td className="py-1.5">{fmtDateTime(s.clock_in)}</td>
                          <td className="py-1.5">{s.clock_out ? fmtDateTime(s.clock_out) : <span className="text-green-700 font-bold">פתוח</span>}</td>
                          <td className="py-1.5 text-center font-bold text-[#0F5468]">{min != null ? fmtMinutes(min) : "—"}</td>
                          <td className="py-1.5 text-xs text-stone-600 max-w-[200px]" title={(s.work_kinds ?? []).join(", ")}>
                            {s.work_kinds?.length ? s.work_kinds.join(" · ") : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="py-1.5 text-xs text-stone-500 max-w-[180px] truncate" title={s.note ?? ""}>{s.note ?? ""}</td>
                          <td className="py-1.5 text-center text-xs text-stone-400">{s.source === "admin" ? "אדמין" : "עצמי"}</td>
                          <td className="py-1.5 text-left whitespace-nowrap">
                            <button onClick={() => openEdit(s)} className="text-xs text-stone-500 underline hover:text-stone-800 ml-2">עריכה</button>
                            <button
                              onClick={() => { if (confirm("למחוק את הרישום?")) post({ action: "delete_session", id: s.id }); }}
                              className="text-xs text-red-400 underline hover:text-red-600"
                            >
                              מחיקה
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}

      {/* מודל: עובד חדש */}
      {showNewEmployee && (
        <Modal title="עובד/ת חדש/ה" onClose={() => setShowNewEmployee(false)}>
          <Field label="שם מלא *">
            <input value={neName} onChange={(e) => setNeName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </Field>
          <Field label="קוד דיווח (4-8 ספרות)">
            <input value={nePin} onChange={(e) => setNePin(e.target.value.replace(/\D/g, "").slice(0, 8))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
          </Field>
          <Field label="תעריף שעתי בש&quot;ח (אופציונלי)">
            <input value={neRate} onChange={(e) => setNeRate(e.target.value.replace(/[^\d.]/g, ""))} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
          </Field>
          <button
            onClick={saveNewEmployee}
            disabled={busy || !neName.trim()}
            className="mt-2 w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            שמירה
          </button>
        </Modal>
      )}

      {/* מודל: הוספה/עריכת רישום */}
      {(editSession || addFor) && (
        <Modal
          title={editSession ? "עריכת רישום" : `רישום חדש — ${addFor?.full_name}`}
          onClose={() => { setEditSession(null); setAddFor(null); }}
        >
          <Field label="כניסה *">
            <input type="datetime-local" value={fIn} onChange={(e) => setFIn(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
          </Field>
          <Field label="יציאה (ריק = משמרת פתוחה)">
            <input type="datetime-local" value={fOut} onChange={(e) => setFOut(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
          </Field>
          <Field label="אופי העבודה * (אפשר לבחור כמה)">
            <div className="flex flex-wrap gap-1.5">
              {WORK_KINDS.map((k) => {
                const on = fKinds.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFKinds((prev) => (on ? prev.filter((x) => x !== k) : [...prev, k]))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      on
                        ? "border-[#0F5468] bg-[#0F5468] text-white"
                        : "border-stone-300 bg-white text-stone-600 hover:border-stone-400"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            {fKinds.length === 0 && (
              <p className="mt-1.5 text-[11px] text-red-500">חובה לבחור לפחות אחד כדי לשמור.</p>
            )}
          </Field>
          <Field label="הערה">
            <input value={fNote} onChange={(e) => setFNote(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </Field>
          <button
            onClick={saveSession}
            disabled={busy || !fIn || fKinds.length === 0}
            className="mt-2 w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            שמירה
          </button>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-black text-stone-800">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-stone-500">{label}</label>
      {children}
    </div>
  );
}
