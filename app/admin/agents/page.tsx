"use client";

import { useEffect, useState } from "react";

// עמוד השליטה בסוכנים (גל 1): יומן ריצות, תור ההצעות המאוחד, ותצוגה
// מקדימה של דוח הבוקר. מינימלי בכוונה - מתרחב עם כל סוכן חדש.

type AgentRun = {
  id: string;
  agent: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "ok" | "empty" | "error";
  mode: string | null;
  summary: string | null;
  error: string | null;
};

type PendingAction = {
  id: string;
  agent: string;
  action_type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_label: string | null;
  created_at: string;
};

type ResolvedAction = {
  id: string;
  agent: string;
  title: string;
  status: string;
  status_changed_at: string | null;
};

type DigestSection = {
  key: string;
  label: string;
  count: number;
  urgent: boolean;
  lines: string[];
  link: string;
};

type DigestPreview = {
  empty: boolean;
  sections: DigestSection[];
  ai_summary: string | null;
  recipients: string[];
};

const AGENT_LABELS: Record<string, string> = {
  daily_digest: "בקר הבוקר",
};

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  ok: { label: "תקין", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  empty: { label: "אין חדש", cls: "bg-stone-50 border-stone-200 text-stone-500" },
  error: { label: "שגיאה", cls: "bg-red-50 border-red-200 text-red-700" },
  running: { label: "רץ...", cls: "bg-blue-50 border-blue-200 text-blue-700" },
};

function agentLabel(agent: string): string {
  return AGENT_LABELS[agent] ?? agent;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [resolved, setResolved] = useState<ResolvedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [previewError, setPreviewError] = useState("");

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin-agents")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setRuns(j.runs ?? []);
          setPending(j.pending_actions ?? []);
          setResolved(j.resolved_actions ?? []);
        } else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function runPreview() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const res = await fetch("/api/admin-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "digest_preview" }),
      });
      const j = await res.json();
      if (j.ok) setPreview(j);
      else setPreviewError(j.error || "שגיאה בהפקת התצוגה המקדימה");
      load(); // הריצה נרשמת ביומן
    } catch {
      setPreviewError("שגיאה בהפקת התצוגה המקדימה");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function resolveAction(id: string, status: "approved" | "dismissed" | "pending") {
    setBusyId(id);
    try {
      await fetch("/api/admin-agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-black text-stone-900 mb-2">סוכנים אוטונומיים</h1>
        <p className="text-sm text-stone-500 mb-6">
          מרכז השליטה בסוכני האוטומציה: יומן הריצות, תור ההצעות, ותצוגה מקדימה של דוח הבוקר.
          שום סוכן לא שולח מייל או מבצע פעולה בלי אישור.
        </p>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {/* בקר הבוקר */}
        <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="font-black text-stone-900">☀️ בקר הבוקר</h2>
            <button
              onClick={runPreview}
              disabled={previewLoading}
              className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {previewLoading ? "מפיק..." : "הצג תצוגה מקדימה"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mb-4">
            רץ כל בוקר במצב תצוגה מקדימה (לא שולח מייל). אחרי שתבחן כאן את התוכן ותאשר,
            נחמש את השליחה היומית.
          </p>

          {previewError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-3">
              {previewError}
            </div>
          )}

          {preview && preview.empty && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
              אין כרגע אף פריט שדורש תשומת לב - ביום כזה לא נשלח מייל בכלל.
            </div>
          )}

          {preview && !preview.empty && (
            <div className="space-y-4">
              {preview.ai_summary && (
                <div className="rounded-xl bg-[#EAF4F3] p-4 text-sm text-[#2A6462] leading-7 whitespace-pre-line">
                  {preview.ai_summary}
                </div>
              )}
              {preview.sections.map((s) => (
                <div key={s.key} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-stone-900 text-sm">
                      {s.label} ({s.count})
                    </span>
                    {s.urgent && (
                      <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                        דורש טיפול
                      </span>
                    )}
                  </div>
                  <ul className="list-disc ps-5 text-sm text-stone-600 leading-6">
                    {s.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-stone-400">
                כשיחומש, המייל יישלח אל: {preview.recipients.join(", ")}
              </p>
            </div>
          )}
        </section>

        {/* תור ההצעות */}
        <section className="mb-8">
          <h2 className="text-sm font-black text-stone-500 mb-3">
            הצעות ממתינות לאישור ({pending.length})
          </h2>
          {loading && <p className="text-sm text-stone-400">טוען...</p>}
          {!loading && pending.length === 0 && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-400">
              אין הצעות ממתינות. כשסוכן יציע פעולה (טיוטת מייל, המלצה, התראה) - היא תופיע כאן
              לאישור או דחייה.
            </div>
          )}
          <div className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-black text-stone-900 text-sm">{a.title}</h3>
                  <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-bold text-stone-500">
                    {agentLabel(a.agent)}
                  </span>
                </div>
                {a.entity_label && <p className="text-xs text-stone-400 mb-1">{a.entity_label}</p>}
                {a.body && <p className="text-sm text-stone-600 leading-6 whitespace-pre-line">{a.body}</p>}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => resolveAction(a.id, "approved")}
                    disabled={busyId === a.id}
                    className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    ✓ אשר
                  </button>
                  <button
                    onClick={() => resolveAction(a.id, "dismissed")}
                    disabled={busyId === a.id}
                    className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    ✕ דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
          {resolved.length > 0 && (
            <div className="mt-4 space-y-1">
              <h3 className="text-xs font-black text-stone-400 mb-1">הוכרעו לאחרונה</h3>
              {resolved.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-100 pb-1"
                >
                  <span>
                    {a.status === "approved" ? "✓" : "✕"} {a.title}
                  </span>
                  <button
                    onClick={() => resolveAction(a.id, "pending")}
                    disabled={busyId === a.id}
                    className="underline hover:text-stone-600 disabled:opacity-50"
                  >
                    החזר
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* יומן ריצות */}
        <section>
          <h2 className="text-sm font-black text-stone-500 mb-3">יומן ריצות</h2>
          {!loading && runs.length === 0 && (
            <p className="text-sm text-stone-400">עדיין אין ריצות - הקרון ירוץ מחר בבוקר, או הפק תצוגה מקדימה עכשיו.</p>
          )}
          {runs.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-right text-xs text-stone-500">
                    <th className="px-4 py-2 font-bold">סוכן</th>
                    <th className="px-4 py-2 font-bold">מתי</th>
                    <th className="px-4 py-2 font-bold">מצב</th>
                    <th className="px-4 py-2 font-bold">סטטוס</th>
                    <th className="px-4 py-2 font-bold">סיכום</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const st = RUN_STATUS[r.status] ?? RUN_STATUS.running;
                    return (
                      <tr key={r.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2 font-bold text-stone-700 whitespace-nowrap">
                          {agentLabel(r.agent)}
                        </td>
                        <td className="px-4 py-2 text-stone-500 whitespace-nowrap">
                          {fmtDateTime(r.started_at)}
                        </td>
                        <td className="px-4 py-2 text-stone-500 whitespace-nowrap">
                          {r.mode === "send" ? "שליחה" : r.mode === "preview" ? "תצוגה מקדימה" : ""}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {r.error ? <span className="text-red-600">{r.error}</span> : r.summary}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
