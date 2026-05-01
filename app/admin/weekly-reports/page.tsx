"use client";

import { useEffect, useState } from "react";

type FilterEntry = { name: string; count: number };

type PatientData = {
  pageViews: number;
  impressions: number;
  profileViews: number;
  contactClicks: number;
  popularFilters: FilterEntry[];
  byRegion: FilterEntry[];
  byIssue: FilterEntry[];
  byAgeBand: FilterEntry[];
  byGender: FilterEntry[];
  clickTypeBreakdown: Record<string, number>;
  quizStarted: { adults: number; kids: number };
  quizCompleted: { adults: number; kids: number };
};

type TherapistData = {
  totalActive: number;
  paying: number;
  free: number;
  byTherapistType: FilterEntry[];
  byTrainingArea: FilterEntry[];
  byRegion: FilterEntry[];
  byGender: FilterEntry[];
  rareTrainingAreas: FilterEntry[];
  newThisWeek: number;
};

type Report = {
  id: string;
  week_start: string;
  week_end: string;
  patient_data: PatientData;
  therapist_data: TherapistData;
  ai_summary: string | null;
  ai_recommendations: string | null;
  email_status: string | null;
  created_at: string;
};

function formatTextWithBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>,
  );
}

function MarkdownText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-7 text-stone-700">
      {blocks.map((block, i) => {
        if (/^\s*-\s/.test(block)) {
          const items = block.split(/\n/).filter(l => /^\s*-\s/.test(l));
          return (
            <ul key={i} className="list-disc pr-5 space-y-1">
              {items.map((item, j) => (
                <li key={j}>{formatTextWithBold(item.replace(/^\s*-\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{formatTextWithBold(block)}</p>;
      })}
    </div>
  );
}

function MiniBars({ title, data, color = "#2e7d8c", limit = 6 }: { title: string; data: FilterEntry[]; color?: string; limit?: number }) {
  if (!data || data.length === 0) return null;
  const max = data[0]?.count ?? 1;
  const slice = data.slice(0, limit);
  return (
    <div>
      <h4 className="text-xs font-black text-stone-500 mb-2 uppercase tracking-wide">{title}</h4>
      <div className="space-y-1">
        {slice.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-20 text-xs text-stone-600 text-left shrink-0 truncate" title={d.name}>{d.name}</span>
            <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full flex items-center justify-end px-1.5"
                style={{ width: `${Math.max((d.count / max) * 100, 8)}%`, background: color }}>
                <span className="text-[10px] font-bold text-white">{d.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportCard({ r, expanded, onToggle }: { r: Report; expanded: boolean; onToggle: () => void }) {
  const week = `${r.week_start} – ${r.week_end}`;
  const sentOk = r.email_status === "sent";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden mb-4">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors text-right"
      >
        <div className="flex items-center gap-3">
          <span className="text-stone-400 text-xs">{expanded ? "▼" : "◀"}</span>
          <span className="font-black text-stone-800">שבוע {week}</span>
          <span className="text-xs text-stone-400">
            {r.patient_data.contactClicks} פניות · {r.therapist_data.totalActive} מטפלים
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sentOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {sentOk ? "מייל נשלח" : "מייל נכשל"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-200 px-6 py-5 bg-stone-50/30 space-y-6">
          {r.ai_summary && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">סיכום</h3>
              <MarkdownText text={r.ai_summary} />
            </section>
          )}

          {r.ai_recommendations && (
            <section>
              <h3 className="text-sm font-black text-[#0F5468] mb-2">המלצות פעולה</h3>
              <MarkdownText text={r.ai_recommendations} />
            </section>
          )}

          <section>
            <h3 className="text-sm font-black text-[#0F5468] mb-3">מספרים מרכזיים</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              <Stat label="כניסות" value={r.patient_data.pageViews} />
              <Stat label="צפיות" value={r.patient_data.profileViews} />
              <Stat label="פניות" value={r.patient_data.contactClicks} highlight />
              <Stat label="סיומי שאלון" value={r.patient_data.quizCompleted.adults + r.patient_data.quizCompleted.kids} />
              <Stat label="מטפלים" value={r.therapist_data.totalActive} />
            </div>
          </section>

          <section className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F5468]">ביקוש (מטופלים)</h3>
              <MiniBars title="אזורים נצפים" data={r.patient_data.byRegion} color="#2e7d8c" />
              <MiniBars title="נושאים" data={r.patient_data.byIssue} color="#1a3a5c" />
              <MiniBars title="פילטרים" data={r.patient_data.popularFilters} color="#9333ea" />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#0F5468]">היצע (מטפלים)</h3>
              <MiniBars title="סוג מטפל" data={r.therapist_data.byTherapistType} color="#0F5468" />
              <MiniBars title="תחומי הכשרה" data={r.therapist_data.byTrainingArea} color="#f59e0b" />
              <MiniBars title="אזורי פעילות" data={r.therapist_data.byRegion} color="#22c55e" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${highlight ? "bg-[#0F5468] text-white border-[#0F5468]" : "bg-white border-stone-200"}`}>
      <div className="text-xl font-black">{value.toLocaleString("he-IL")}</div>
      <div className={`text-[10px] mt-0.5 ${highlight ? "text-white/80" : "text-stone-500"}`}>{label}</div>
    </div>
  );
}

export default function WeeklyReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  function load() {
    setError("");
    fetch("/api/admin-weekly-reports", { cache: "no-store" })
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setReports(json.reports);
          if (json.reports.length > 0 && expanded === null) setExpanded(json.reports[0].id);
        } else setError(json.error ?? "שגיאה");
      })
      .catch(() => setError("שגיאת רשת"));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runNow() {
    setRunning(true);
    setRunMsg("");
    try {
      const r = await fetch("/api/cron/weekly-report", { cache: "no-store" });
      const json = await r.json();
      if (json.ok) {
        setRunMsg(`הופק דוח לשבוע ${json.week_start} (${json.emailStatus})`);
        load();
      } else {
        setRunMsg(`שגיאה: ${json.error}`);
      }
    } catch (e) {
      setRunMsg(`שגיאה: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-stone-900">דוחות שבועיים</h1>
          <p className="text-xs text-stone-400 mt-1">סיכום אוטומטי של ביקוש מול היצע, רץ כל יום ראשון בבוקר.</p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="rounded-xl bg-[#0F5468] text-white px-4 py-2 text-sm font-bold hover:bg-[#0a3f4f] disabled:opacity-50 transition-colors"
        >
          {running ? "מפיק..." : "הפק דוח עכשיו"}
        </button>
      </div>

      {runMsg && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          {runMsg}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 mb-6">
          <p className="font-bold mb-1">שגיאה: {error}</p>
          <p className="text-xs text-red-500">ייתכן שטבלת weekly_reports עדיין לא נוצרה ב-Supabase.</p>
        </div>
      )}

      {reports === null && !error && <p className="text-sm text-stone-400">טוען...</p>}

      {reports && reports.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-stone-500 mb-4">עדיין אין דוחות שבועיים.</p>
          <p className="text-xs text-stone-400">הדוח הראשון יתפרסם ביום ראשון הקרוב, או לחץ על &quot;הפק דוח עכשיו&quot;.</p>
        </div>
      )}

      {reports && reports.map(r => (
        <ReportCard
          key={r.id}
          r={r}
          expanded={expanded === r.id}
          onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
        />
      ))}
    </main>
  );
}
