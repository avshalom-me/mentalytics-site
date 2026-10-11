"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// המודאל של סקירת השימור: קופץ בכניסה ללוח הבקרה כל עוד הסקירה של השבוע
// לא אושרה ("ראיתי" נשמר במסד, כך ששני האדמינים רואים אותו מצב). "אחר כך"
// משתיק אותו רק בדפדפן הזה עד לכניסה הבאה.

type Top = { therapist_id: string; name: string | null; tier: string; risk: string; risk_reason: string | null; todo: string | null; primary_action: string | null };
type Brief = {
  review: { id: string; week_start: string; created_at: string; summary: Record<string, unknown>; acknowledged_at: string | null } | null;
  top: Top[];
  pending_count: number;
};

const RISK_LABEL: Record<string, string> = { critical: "קריטי", high: "סיכון גבוה", medium: "סיכון בינוני" };
const RISK_TONE: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-amber-100 text-amber-800",
  medium: "bg-yellow-50 text-yellow-800",
};

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

export default function RetentionWeeklyModal() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin-retention?brief=1")
      .then((r) => r.json())
      .then((j: Brief & { ok?: boolean }) => {
        if (cancelled || !j.ok || !j.review || j.review.acknowledged_at) return;
        // סקירה ישנה משבוע קודם שלא אושרה לא קופצת לנצח: שבוע ואז די.
        const age = Date.now() - new Date(j.review.created_at).getTime();
        if (age > 8 * 86_400_000) return;
        let snoozed = false;
        try {
          snoozed = sessionStorage.getItem(`retention_modal_${j.review.id}`) === "1";
        } catch {
          /* אחסון חסום - מציגים */
        }
        if (snoozed) return;
        setBrief(j);
        setHidden(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || !brief?.review) return null;
  const s = (brief.review.summary ?? {}) as { byRisk?: Record<string, number>; checked?: number; holidayWeek?: string | null };
  const byRisk = s.byRisk ?? {};

  const later = () => {
    try {
      sessionStorage.setItem(`retention_modal_${brief.review!.id}`, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  };
  const ack = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ack", review_id: brief.review!.id }),
      });
    } finally {
      setBusy(false);
      setHidden(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 text-xs font-semibold text-stone-400">סקירת השימור השבועית · שבוע של {weekLabel(brief.review.week_start)}</div>
        <h2 className="mb-3 text-xl font-black text-stone-900">🤝 מי בסיכון השבוע</h2>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-red-100 px-3 py-1 font-bold text-red-800">{byRisk.critical ?? 0} קריטי</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">{byRisk.high ?? 0} גבוה</span>
          <span className="rounded-full bg-yellow-50 px-3 py-1 font-bold text-yellow-800">{byRisk.medium ?? 0} בינוני</span>
          <span className="rounded-full bg-stone-100 px-3 py-1 font-bold text-stone-600">{brief.pending_count} פעולות ממתינות</span>
          {s.holidayWeek && <span className="rounded-full bg-sky-50 px-3 py-1 font-bold text-sky-800">שבוע {s.holidayWeek}</span>}
        </div>
        {brief.top.length === 0 ? (
          <p className="mb-4 text-sm text-stone-500">כל {s.checked ?? ""} המקודמים תקינים השבוע.</p>
        ) : (
          <ul className="mb-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {brief.top.map((t) => (
              <li key={t.therapist_id} className="flex items-start gap-3 p-3 text-sm">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${RISK_TONE[t.risk] ?? "bg-stone-100 text-stone-600"}`}>{RISK_LABEL[t.risk] ?? t.risk}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-stone-900">{t.name}</span>
                  <span className="block text-xs text-stone-600">{t.todo ?? t.risk_reason}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/retention" onClick={later} className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700">
            לסקירה המלאה ←
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={later} className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50">
              אחר כך
            </button>
            <button type="button" onClick={ack} disabled={busy} className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-50">
              ראיתי
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
