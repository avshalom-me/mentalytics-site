"use client";

import { useState } from "react";
import type { DistributionReport } from "@/app/lib/match-distribution";
import { TARGET_PEOPLE_PER_MONTH } from "@/app/lib/match-distribution-rules";

// רובריקת חלוקת הפניות (29/10/2026), בעמוד סוכן פערי ההיצע: איך הפניות
// מהשאלון מתחלקות בין המקודמים, החלון הנוכחי מול הקודם, לפי אזור ולפי
// מטפל/ת. שורה = חומרה + שם + מספרים + "מה לעשות" + כפתור. נטענת רק כשפותחים
// אותה, כמו היסטוריית הצעות המתנה.
//
// הכפתור היחיד שפועל מכאן הוא ההקפאה השקטה לשבוע (אותה פעולה ואותה מדיניות
// כמו בעמוד המטפלים: set_match_pause). הודעה למטפל/ת נשלחת מעמוד המטפלים.

const SEVERITY_DOT: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🟡",
  low: "⚪",
};

const SOURCE_LABEL: Record<string, string> = {
  paid: "משלם/ת",
  trial: "מתנה",
  manual: "ידני",
  gift_trial: "חודשי מתנה",
  center: "מרכז",
};

function Delta({ now, prev, suffix = "" }: { now: number; prev: number; suffix?: string }) {
  const d = now - prev;
  const color = d === 0 ? "text-stone-400" : d > 0 ? "text-[#A87010]" : "text-[#2A6462]";
  return (
    <span className="text-xs text-stone-400">
      {" "}
      (קודם {prev}
      {suffix}
      {d !== 0 && <span className={color}>{d > 0 ? ` +${d}` : ` ${d}`}</span>})
    </span>
  );
}

function Section({ title, count, children, open }: { title: string; count: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="rounded-xl border border-stone-200 bg-stone-50/60" open={open}>
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-black text-stone-500 hover:text-stone-700">
        {title}
        <span className="font-normal text-stone-400"> ({count})</span>
      </summary>
      <div className="rounded-b-xl border-t border-stone-200 bg-white px-4 py-3">{children}</div>
    </details>
  );
}

export default function DistributionPanel() {
  const [report, setReport] = useState<DistributionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-match-distribution");
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `שגיאה ${res.status}`);
      setReport(json as DistributionReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הטעינה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  async function pause(id: string, name: string) {
    if (!window.confirm(`להקפיא את ${name} לשבוע מתוצאות השאלון?\n\nבמאגר ובפרופיל אין שינוי, לא נשלחת הודעה, והחיוב לא משתנה.`)) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin-therapists", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "set_match_pause", days: 7, reason: "חלוקת פניות: עמוס/ה" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        window.alert(json?.error || `ההקפאה נכשלה (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const rows = report?.rows ?? [];
  const attention = rows.filter((r) => r.verdict.severity === "high");
  const watch = rows.filter((r) => r.verdict.severity === "normal");
  const fine = rows.filter((r) => r.verdict.severity === "low");

  return (
    <details
      className="rounded-2xl border border-[#C2DFDE] bg-white"
      onToggle={(e) => {
        if (e.currentTarget.open && report === null && !loading) void load();
      }}
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-black text-[#2A6462] hover:bg-[#EAF4F3]/60">
        ⚖️ חלוקת הפניות בין המקודמים
        <span className="mr-2 text-xs font-normal text-stone-400">30 יום מול 30 הקודמים · היעד: {TARGET_PEOPLE_PER_MONTH} פונים בחודש למשלם/ת</span>
      </summary>
      <div className="space-y-3 border-t border-[#EAF4F3] px-4 py-3 text-sm">
        {loading && <p className="text-xs text-stone-400">טוען...</p>}
        {error && <p className="text-xs text-red-700">{error}</p>}
        {report && (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <div className="text-[11px] text-stone-400">פונים ל-{report.summary.promoted} מקודמים</div>
                <div className="text-lg font-black text-stone-800">
                  {report.summary.people}
                  <Delta now={report.summary.people} prev={report.summary.people_prev} />
                </div>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <div className="text-[11px] text-stone-400">חלק 10 המובילים</div>
                <div className="text-lg font-black text-stone-800">
                  {report.summary.top10_share}%
                  <Delta now={report.summary.top10_share} prev={report.summary.top10_share_prev} suffix="%" />
                </div>
                <div className="text-[11px] text-stone-400">5 המובילים: {report.summary.top5_share}% (קודם {report.summary.top5_share_prev}%)</div>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <div className="text-[11px] text-stone-400">מקודמים בלי אף פנייה</div>
                <div className="text-lg font-black text-stone-800">
                  {report.summary.zero_share}%
                  <Delta now={report.summary.zero_share} prev={report.summary.zero_share_prev} suffix="%" />
                </div>
              </div>
              <div className="rounded-xl bg-stone-50 px-3 py-2">
                <div className="text-[11px] text-stone-400">משלמים שהגיעו ליעד</div>
                <div className="text-lg font-black text-stone-800">
                  {report.summary.paid_on_target} / {report.summary.paid_total}
                </div>
                <div className="text-[11px] text-stone-400">מועלמים אוטומטית עכשיו: {report.summary.shed_now}</div>
              </div>
            </div>

            <Section title="לפי האזור שהמטופל ביקש" count={report.regions.length}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-right text-stone-400">
                    <th className="py-1 font-semibold">אזור</th>
                    <th className="py-1 font-semibold">חיפושים</th>
                    <th className="py-1 font-semibold">פונים</th>
                    <th className="py-1 font-semibold">מקודמים</th>
                    <th className="py-1 font-semibold">קיבלו</th>
                    <th className="py-1 font-semibold">המוביל/ה</th>
                    <th className="py-1 font-semibold">מצב</th>
                  </tr>
                </thead>
                <tbody>
                  {report.regions.map((r) => (
                    <tr key={r.region} className="border-t border-stone-100 text-stone-700">
                      <td className="py-1 font-bold">{r.region}</td>
                      <td className="py-1">{r.searches}</td>
                      <td className="py-1">{r.people}</td>
                      <td className="py-1">{r.covering}</td>
                      <td className="py-1">{r.therapists_with_contacts}</td>
                      <td className="py-1">{r.top1}</td>
                      <td className="py-1">
                        {SEVERITY_DOT[r.verdict.severity]} {r.verdict.label}
                        {r.verdict.note && <span className="text-stone-400"> · {r.verdict.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="דורש תשומת לב - עמוסים, וחשיפה בלי פניות" count={attention.length} open>
              <TherapistRows rows={attention} busyId={busyId} onPause={pause} />
            </Section>
            <Section title="למעקב - מעל היעד, בלי חשיפה, שקטים" count={watch.length}>
              <TherapistRows rows={watch} busyId={busyId} onPause={pause} />
            </Section>
            <Section title="ביעד וחדשים" count={fine.length}>
              <TherapistRows rows={fine} busyId={busyId} onPause={pause} />
            </Section>
          </>
        )}
      </div>
    </details>
  );
}

function TherapistRows({
  rows,
  busyId,
  onPause,
}: {
  rows: DistributionReport["rows"];
  busyId: string | null;
  onPause: (id: string, name: string) => void;
}) {
  if (rows.length === 0) return <p className="text-xs text-stone-400">אין.</p>;
  return (
    <ul className="divide-y divide-stone-100 text-xs">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
          <span className="shrink-0">{SEVERITY_DOT[r.verdict.severity]}</span>
          <a href={`/admin/therapists?therapist=${r.id}`} className="font-bold text-stone-800 underline-offset-2 hover:underline">
            {r.name}
          </a>
          <span className="text-stone-400">
            {SOURCE_LABEL[r.promotion_source ?? ""] ?? r.promotion_source ?? "-"}
            {r.promoted_days !== null ? ` · ${r.promoted_days} ימים` : ""}
            {r.paused_now ? " · ❄️ מוקפא/ת" : ""}
          </span>
          <span className="text-stone-700">
            <b>{r.people}</b> פונים
            <span className="text-stone-400"> (קודם {r.people_prev}, מהשאלון {r.match_people})</span>
            {" · "}
            {r.appearances} הופעות, {r.opens} פתיחות
          </span>
          <span className="font-bold text-stone-600">{r.verdict.label}</span>
          {r.verdict.advice && <span className="text-stone-500">{r.verdict.advice}</span>}
          {r.verdict.canPause && r.verdict.kind === "busy" && (
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => onPause(r.id, r.name)}
              className="rounded-full border border-[#3D8C8A] bg-white px-3 py-0.5 text-[11px] font-bold text-[#2A6462] hover:bg-[#EAF4F3] disabled:opacity-50"
            >
              {busyId === r.id ? "מקפיא..." : "❄️ הקפא שבוע"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
