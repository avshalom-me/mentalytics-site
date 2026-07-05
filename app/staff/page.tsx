"use client";

import { useState } from "react";
import { Clock, LogIn, LogOut, Plus, Trash2, Loader2 } from "lucide-react";

// עמוד נוכחות לעובדי טיפול חכם. זיהוי בקוד אישי (PIN) שמקבלים מהאדמין;
// כל הפעולות עוברות דרך /api/staff-hours ומאומתות מול הקוד בכל בקשה.

type Session = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
  source: string;
};

type Status = {
  name: string;
  openSession: { id: string; clock_in: string } | null;
  sessions: Session[];
  monthTotalMinutes: number;
};

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

// datetime-local ערך מקומי → ISO (השרת שומר UTC)
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function StaffHoursPage() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [mIn, setMIn] = useState("");
  const [mOut, setMOut] = useState("");
  const [mNote, setMNote] = useState("");

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/staff-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pin, ...extra }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "שגיאה");
        return false;
      }
      setStatus(json);
      return true;
    } catch {
      setError("שגיאת רשת — נסו שוב");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function addManual() {
    const inIso = localToIso(mIn);
    const outIso = localToIso(mOut);
    if (!inIso || !outIso) {
      setError("יש למלא שעת כניסה ויציאה");
      return;
    }
    const ok = await call("add_manual", { clock_in: inIso, clock_out: outIso, note: mNote });
    if (ok) {
      setShowManual(false);
      setMIn(""); setMOut(""); setMNote("");
    }
  }

  return (
    <main
      className="mx-auto max-w-lg px-5 py-10 pb-20 min-h-screen"
      dir="rtl"
      style={{ fontFamily: "'Heebo', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700;800;900&display=swap');`}</style>

      <div className="text-center mb-8">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--teal-pale)" }}>
          <Clock size={26} style={{ color: "var(--teal)" }} />
        </div>
        <h1 className="text-2xl font-black text-stone-900">דיווח שעות עבודה</h1>
        <p className="text-sm text-stone-500 mt-1">טיפול חכם — צוות</p>
      </div>

      {!status ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (pin) call("status"); }}
          className="rounded-3xl border border-[#E8E0D8] bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-bold text-stone-700 mb-2">קוד אישי</label>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 text-center text-2xl tracking-[0.5em] focus:border-[var(--teal)] outline-none"
            placeholder="••••"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={pin.length < 4 || loading}
            className="mt-4 w-full rounded-full py-3 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}
          >
            {loading ? <Loader2 size={18} className="inline animate-spin" /> : "כניסה"}
          </button>
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
          <p className="mt-4 text-center text-xs text-stone-400">אין לך קוד? פנה/י לאבשלום</p>
        </form>
      ) : (
        <div className="space-y-4">
          {/* כותרת אישית + סיכום חודש */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-black text-stone-900">שלום, {status.name} 👋</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  סה&quot;כ החודש: <strong className="text-[var(--teal-dark)]">{fmtMinutes(status.monthTotalMinutes)} שעות</strong>
                </p>
              </div>
              <button
                onClick={() => { setStatus(null); setPin(""); }}
                className="text-xs text-stone-400 hover:text-stone-600 underline"
              >
                יציאה
              </button>
            </div>
          </div>

          {/* פעולה ראשית: כניסה/יציאה */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-sm text-center">
            {status.openSession ? (
              <>
                <p className="text-sm text-stone-600 mb-3">
                  משמרת פתוחה מאז{" "}
                  <strong>{fmtDate(status.openSession.clock_in)} {fmtTime(status.openSession.clock_in)}</strong>
                </p>
                <button
                  onClick={() => call("clock_out")}
                  disabled={loading}
                  className="w-full rounded-full py-3.5 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#8B2E0A,#B54A1E)" }}
                >
                  <LogOut size={18} className="inline ml-2" />
                  דיווח יציאה — עכשיו
                </button>
              </>
            ) : (
              <button
                onClick={() => call("clock_in")}
                disabled={loading}
                className="w-full rounded-full py-3.5 text-base font-bold text-white transition hover:opacity-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,var(--teal-dark),var(--teal))" }}
              >
                <LogIn size={18} className="inline ml-2" />
                דיווח כניסה — עכשיו
              </button>
            )}
          </div>

          {/* הזנה ידנית רטרואקטיבית */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-sm">
            <button
              onClick={() => setShowManual(!showManual)}
              className="flex w-full items-center justify-between text-sm font-bold text-stone-700"
            >
              <span><Plus size={14} className="inline ml-1" /> הזנת שעות ידנית (רטרואקטיבית)</span>
              <span className="text-stone-400">{showManual ? "▲" : "▼"}</span>
            </button>
            {showManual && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">כניסה</label>
                  <input type="datetime-local" value={mIn} onChange={(e) => setMIn(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">יציאה</label>
                  <input type="datetime-local" value={mOut} onChange={(e) => setMOut(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">הערה (אופציונלי)</label>
                  <input type="text" value={mNote} onChange={(e) => setMNote(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" placeholder="למשל: עבודה מהבית" />
                </div>
                <button
                  onClick={addManual}
                  disabled={loading || !mIn || !mOut}
                  className="w-full rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: "var(--teal)" }}
                >
                  שמירה
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          {/* רישומי החודש */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-stone-800 mb-3">הרישומים שלי החודש</h2>
            {status.sessions.length === 0 ? (
              <p className="text-sm text-stone-400">אין עדיין רישומים החודש</p>
            ) : (
              <div className="space-y-1.5">
                {status.sessions.map((s) => {
                  const min = s.clock_out
                    ? Math.round((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60_000)
                    : null;
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
                      <span className="font-bold text-stone-700 w-12">{fmtDate(s.clock_in)}</span>
                      <span className="text-stone-600" dir="ltr">
                        {fmtTime(s.clock_in)}–{s.clock_out ? fmtTime(s.clock_out) : "…"}
                      </span>
                      <span className="mr-auto font-black text-[var(--teal-dark)]">
                        {min != null ? fmtMinutes(min) : "פתוח"}
                      </span>
                      {s.note && <span className="text-xs text-stone-400 max-w-[80px] truncate" title={s.note}>{s.note}</span>}
                      <button
                        onClick={() => { if (confirm("למחוק את הרישום?")) call("delete", { session_id: s.id }); }}
                        className="text-stone-300 hover:text-red-500"
                        aria-label="מחיקת רישום"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
