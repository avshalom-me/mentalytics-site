"use client";

import { useEffect, useState } from "react";

type Rec = {
  id: string;
  type: "recruit_therapists" | "promote_region_organic" | "low_conversion_therapist" | string;
  title: string;
  rationale: string;
  suggested_action: string;
  priority: number;
  status: string;
  created_at: string;
};

type Data = {
  pending: Rec[];
  accepted: Rec[];
  dismissed: Rec[];
  generated_at: string;
};

const TYPE_META: Record<string, { label: string; icon: string; cls: string }> = {
  recruit_therapists: { label: "גיוס מטפלים", icon: "👥", cls: "bg-amber-50 border-amber-200 text-amber-800" },
  promote_region_organic: { label: "ביקוש מטופלים", icon: "📣", cls: "bg-blue-50 border-blue-200 text-blue-800" },
  low_conversion_therapist: { label: "פרופיל לא ממיר", icon: "⚠️", cls: "bg-red-50 border-red-200 text-red-800" },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { label: "המלצה", icon: "💡", cls: "bg-stone-50 border-stone-200 text-stone-600" };
}

export default function RecommendationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    fetch("/api/admin-recommendations")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setData(j);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/admin-recommendations", { method: "POST" });
      const j = await res.json();
      if (!j.ok) setError(j.error || "שגיאה ביצירת המלצות");
      load();
    } catch {
      setError("שגיאה ביצירת המלצות");
    } finally {
      setGenerating(false);
    }
  }

  async function resolve(id: string, status: "accepted" | "dismissed" | "pending") {
    setBusyId(id);
    try {
      await fetch("/api/admin-recommendations", {
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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-black text-stone-900">המלצות שיווק</h1>
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {generating ? "מרענן…" : "רענן המלצות"}
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          הסוכן מציע פעולות אורגניות על בסיס הנתונים. אשר/י מה שרלוונטי — הביצוע ידני בשלב הזה.
          (המלצות פרסום בתשלום יתווספו אחרי חיבור חשבונות הפרסום.)
        </p>

        {loading && <p className="text-sm text-stone-400">טוען…</p>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">{error}</div>}

        {data && !loading && (
          <>
            {data.pending.length === 0 && data.accepted.length === 0 && (
              <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
                אין המלצות פתוחות. לחצ/י &quot;רענן המלצות&quot; כדי לחשב מהנתונים הנוכחיים.
              </div>
            )}

            {/* Pending */}
            {data.pending.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-black text-stone-500 mb-3">ממתינות לאישור ({data.pending.length})</h2>
                <div className="space-y-3">
                  {data.pending.map((r) => {
                    const m = typeMeta(r.type);
                    return (
                      <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-black text-stone-900">{r.title}</h3>
                          <span className={`shrink-0 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${m.cls}`}>
                            {m.icon} {m.label}
                          </span>
                        </div>
                        <p className="text-sm text-stone-600 leading-6">{r.rationale}</p>
                        <p className="text-sm text-stone-800 leading-6 mt-2">
                          <span className="font-bold">פעולה: </span>{r.suggested_action}
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => resolve(r.id, "accepted")}
                            disabled={busyId === r.id}
                            className="rounded-full bg-[#2e7d8c] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            ✓ אשר
                          </button>
                          <button
                            onClick={() => resolve(r.id, "dismissed")}
                            disabled={busyId === r.id}
                            className="rounded-full border border-stone-300 px-4 py-1.5 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                          >
                            ✕ דחה
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Accepted */}
            {data.accepted.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-black text-stone-500 mb-3">אושרו — לטיפול ({data.accepted.length})</h2>
                <div className="space-y-2">
                  {data.accepted.map((r) => {
                    const m = typeMeta(r.type);
                    return (
                      <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{m.icon}</span>
                            <span className="font-bold text-stone-800 text-sm">{r.title}</span>
                          </div>
                          <p className="text-xs text-stone-500 mt-1">{r.suggested_action}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => resolve(r.id, "dismissed")}
                            disabled={busyId === r.id}
                            className="rounded-full border border-stone-300 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-50 disabled:opacity-50"
                          >
                            סיים
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recently dismissed */}
            {data.dismissed.length > 0 && (
              <section>
                <h2 className="text-sm font-black text-stone-400 mb-3">טופלו / נדחו לאחרונה</h2>
                <div className="space-y-1">
                  {data.dismissed.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-100 pb-1">
                      <span>{typeMeta(r.type).icon} {r.title}</span>
                      <button
                        onClick={() => resolve(r.id, "pending")}
                        disabled={busyId === r.id}
                        className="text-stone-400 hover:text-stone-600 underline disabled:opacity-50"
                      >
                        החזר
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="mt-6 text-xs text-stone-400">עודכן: {new Date(data.generated_at).toLocaleString("he-IL")}</p>
          </>
        )}
      </div>
    </div>
  );
}
