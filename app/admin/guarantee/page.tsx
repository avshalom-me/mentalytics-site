"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { gmailSearchUrl } from "@/app/lib/crm";

type GuaranteeRow = {
  therapist_id: string;
  full_name: string;
  email: string;
  window_start: string;
  window_end: string;
  days_left: number;
  contacts_in_window: number;
  contacts_certain: number;
  contacts_by_type: Record<string, number>;
  risk: "expired_no_contact" | "at_risk" | "watch" | "ok";
};

// שמות סוגי הפנייה כפי שהם מוצגים למטפל עצמו בדשבורד שלו - כדי ששתי
// הצדדים של שיחת ההחזר ידברו באותם מונחים.
const CLICK_TYPE_LABELS: Record<string, string> = {
  site_message: "הודעה באתר",
  whatsapp: "וואטסאפ",
  phone: "טלפון",
  email: "מייל",
  other: "אחר",
};

function breakdownText(byType: Record<string, number>): string {
  const order = ["site_message", "whatsapp", "phone", "email", "other"];
  return Object.entries(byType)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([type, n]) => `${n} ${CLICK_TYPE_LABELS[type] ?? type}`)
    .join(" · ");
}

const RISK_META: Record<GuaranteeRow["risk"], { label: string; cls: string }> = {
  expired_no_contact: { label: "חלון נסגר ללא פנייה", cls: "bg-red-50 border-red-200 text-red-700" },
  at_risk: { label: "בסיכון", cls: "bg-amber-50 border-amber-200 text-amber-700" },
  watch: { label: "במעקב", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  ok: { label: "יש פנייה ✓", cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

export default function GuaranteePage() {
  const [rows, setRows] = useState<GuaranteeRow[]>([]);
  const [days, setDays] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-crm/guarantee")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setRows(j.rows);
          setDays(j.guarantee_days);
        } else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTask(r: GuaranteeRow) {
    setBusy(r.therapist_id);
    try {
      await fetch("/api/admin-crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `ביטחון: לפעול עבור ${r.full_name} (${r.contacts_in_window} פניות, מתוכן ${r.contacts_certain} הודעות ודאיות, ${r.days_left} ימים)`,
          entity_type: "therapist",
          entity_id: r.therapist_id,
          entity_label: r.full_name,
          due_date: new Date().toISOString().slice(0, 10),
          priority: "high",
        }),
      });
      alert("נוצרה משימה להיום");
    } finally {
      setBusy(null);
    }
  }

  const attention = rows.filter((r) => r.risk === "at_risk" || r.risk === "expired_no_contact");

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">מעקב תקופת ביטחון</h1>
          <HelpTip id="guarantee" />
        </div>
        <p className="mb-2 text-sm text-stone-500">
          התחייבות החזר: פנייה אחת לפחות בתוך {days} יום מתחילת המנוי. {attention.length > 0 && (
            <span className="font-bold text-amber-700">{attention.length} מטפלים דורשים תשומת לב.</span>
          )}
        </p>
        <p className="mb-5 text-xs text-stone-400">
          הפילוח מתחת למספר מפריד בין <strong>הודעה באתר</strong> - פנייה ודאית שהטקסט שלה שמור
          אצלנו - לבין לחיצת וואטסאפ/טלפון/מייל, שהיא מדד כוונה ואינה מוכיחה ששיחה התקיימה.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
            אין כרגע מנויים בתשלום במעקב.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-start text-xs text-stone-400">
                  <th className="px-4 py-2.5 text-start font-bold">מטפל/ת</th>
                  <th className="px-4 py-2.5 text-start font-bold">סטטוס</th>
                  <th className="px-4 py-2.5 text-start font-bold">פניות בחלון</th>
                  <th className="px-4 py-2.5 text-start font-bold">ימים שנותרו</th>
                  <th className="px-4 py-2.5 text-start font-bold">חלון האחריות</th>
                  <th className="px-4 py-2.5 text-start font-bold">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = RISK_META[r.risk];
                  return (
                    <tr key={r.therapist_id} className="border-b border-stone-100 last:border-b-0">
                      <td className="px-4 py-3 font-bold text-stone-800">{r.full_name || r.email}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-black ${r.contacts_in_window === 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {r.contacts_in_window}
                        </div>
                        {r.contacts_in_window > 0 && (
                          <div className="mt-0.5 text-[11px] leading-4 text-stone-400">
                            {breakdownText(r.contacts_by_type)}
                            {r.contacts_certain === 0 && (
                              <span className="block font-bold text-amber-700">אין הודעה ודאית</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-stone-700">
                        {r.days_left >= 0 ? r.days_left : "נסגר"}
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-400">
                        {fmtDate(r.window_start)} — {fmtDate(r.window_end)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => createTask(r)}
                            disabled={busy === r.therapist_id}
                            className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                          >
                            + משימה
                          </button>
                          {r.email && (
                            <a
                              href={gmailSearchUrl(r.email)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100"
                            >
                              ג'ימייל ↗
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
