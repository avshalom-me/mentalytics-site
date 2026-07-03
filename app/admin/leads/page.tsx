"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { LEAD_STATUSES, LEAD_TYPES, labelOf, gmailSearchUrl } from "@/app/lib/crm";

type Lead = {
  id: string;
  lead_type: string;
  name: string | null;
  contact: string | null;
  message: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
  source: string | null;
  channel: string | null;
  utm_campaign: string | null;
  status: string;
  created_at: string;
};

const SOURCE_LABELS: Record<string, string> = {
  site_message: "הודעה למטפל",
  contact_form: "טופס צור קשר",
  manual: "הוזן ידנית",
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function isEmail(s: string): boolean {
  return /\S+@\S+\.\S+/.test(s);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("lead_type", typeFilter);
    fetch(`/api/admin-crm/leads?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setLeads(j.leads);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await fetch("/api/admin-crm/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function createFollowupTask(l: Lead) {
    setBusy(l.id);
    try {
      await fetch("/api/admin-crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `מעקב ליד: ${l.name || l.contact || ""}`,
          entity_type: "lead",
          entity_id: l.id,
          entity_label: l.name || l.contact || "ליד",
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }),
      });
      alert("נוצרה משימת מעקב ליומיים מהיום");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-black text-stone-900">לידים ופניות</h1>
          <HelpTip id="leads" />
        </div>
        <p className="mb-5 text-sm text-stone-500">
          פניות שנקלטו מהאתר נשמרות כאן אוטומטית. שימו לב: פרטי פונים לטיפול נפשי — מידע רגיש, פנימי בלבד.
        </p>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-stone-200 bg-white">
            <FilterChip label="הכול" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            {LEAD_STATUSES.map((s) => (
              <FilterChip
                key={s.value}
                label={s.label}
                active={statusFilter === s.value}
                onClick={() => setStatusFilter(s.value)}
              />
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-600"
          >
            <option value="all">כל הסוגים</option>
            {LEAD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {!loading && leads.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center text-sm text-stone-400">
            אין לידים בסינון הנוכחי. פניות חדשות מהאתר יופיעו כאן אוטומטית.
          </div>
        )}

        <div className="space-y-2">
          {leads.map((l) => {
            const statusMeta = LEAD_STATUSES.find((s) => s.value === l.status);
            const contactIsEmail = l.contact ? isEmail(l.contact) : false;
            return (
              <div key={l.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusMeta?.cls ?? ""}`}>
                    {statusMeta?.label ?? l.status}
                  </span>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-semibold text-stone-500">
                    {labelOf(LEAD_TYPES, l.lead_type)}
                  </span>
                  <span className="text-sm font-black text-stone-800">{l.name || "ללא שם"}</span>
                  {l.contact && (
                    <a
                      href={contactIsEmail ? `mailto:${l.contact}` : `tel:${l.contact}`}
                      className="text-sm font-semibold text-teal-700 hover:underline"
                    >
                      {l.contact}
                    </a>
                  )}
                  <span className="ms-auto text-xs text-stone-400">{fmt(l.created_at)}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                  {l.source && <span>מקור: {SOURCE_LABELS[l.source] ?? l.source}</span>}
                  {l.therapist_name && <span>אל: {l.therapist_name}</span>}
                  {l.channel && <span>ערוץ: {l.channel}</span>}
                  {l.utm_campaign && <span>קמפיין: {l.utm_campaign}</span>}
                </div>

                {l.message && (
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className="mt-2 block w-full rounded-xl bg-stone-50 p-3 text-start text-sm text-stone-600"
                  >
                    <span className={expanded === l.id ? "whitespace-pre-wrap" : "line-clamp-2"}>{l.message}</span>
                  </button>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {l.status === "new" && (
                    <ActionBtn onClick={() => setStatus(l.id, "in_progress")} disabled={busy === l.id}>
                      התחל טיפול
                    </ActionBtn>
                  )}
                  {l.status !== "converted" && l.status !== "closed" && (
                    <ActionBtn onClick={() => setStatus(l.id, "converted")} disabled={busy === l.id}>
                      הומרה ✓
                    </ActionBtn>
                  )}
                  {l.status !== "closed" && (
                    <ActionBtn onClick={() => setStatus(l.id, "closed")} disabled={busy === l.id}>
                      סגירה
                    </ActionBtn>
                  )}
                  {(l.status === "converted" || l.status === "closed") && (
                    <ActionBtn onClick={() => setStatus(l.id, "new")} disabled={busy === l.id}>
                      החזרה לחדשה
                    </ActionBtn>
                  )}
                  <ActionBtn onClick={() => createFollowupTask(l)} disabled={busy === l.id}>
                    + משימת מעקב
                  </ActionBtn>
                  {l.contact && contactIsEmail && (
                    <a
                      href={gmailSearchUrl(l.contact)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-500 hover:bg-stone-100"
                    >
                      פתח בג'ימייל ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? "bg-stone-800 text-white" : "bg-white text-stone-500 hover:bg-stone-50"
      }`}
    >
      {label}
    </button>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
