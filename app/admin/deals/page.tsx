"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { DEAL_STAGES, DEAL_TYPES, labelOf } from "@/app/lib/crm";

type Deal = {
  id: string;
  title: string;
  deal_type: string | null;
  stage: string;
  value_ils: number | null;
  owner: string | null;
  contact_name: string | null;
  contact_info: string | null;
  next_step: string | null;
  next_step_due: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// The kanban shows the open pipeline; closed stages collapse into one column.
const OPEN_STAGES = DEAL_STAGES.filter((s) => s.value !== "won" && s.value !== "lost");

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function fmtValue(v: number | null): string {
  if (v == null) return "";
  return `₪${Number(v).toLocaleString("he-IL")}`;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-crm/deals")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setDeals(j.deals);
        else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function moveStage(deal: Deal, dir: 1 | -1) {
    const idx = DEAL_STAGES.findIndex((s) => s.value === deal.stage);
    const next = DEAL_STAGES[idx + dir];
    if (!next) return;
    setBusy(deal.id);
    try {
      await fetch("/api/admin-crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, stage: next.value }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function setStage(deal: Deal, stage: string) {
    setBusy(deal.id);
    try {
      await fetch("/api/admin-crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, stage }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost");
  const pipelineValue = deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((sum, d) => sum + (Number(d.value_ils) || 0), 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-stone-900">עסקאות B2B</h1>
            <HelpTip id="deals" />
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700"
          >
            + עסקה חדשה
          </button>
        </div>
        <p className="mb-5 text-sm text-stone-500">
          שווי פייפליין פתוח: <span className="font-black text-stone-700">{fmtValue(pipelineValue)}</span>
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {/* Kanban */}
        {!loading && (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {OPEN_STAGES.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage.value);
              return (
                <div key={stage.value} className="w-60 shrink-0 rounded-2xl bg-stone-100 p-2">
                  <div className="mb-2 flex items-center justify-between px-2 pt-1">
                    <span className="text-sm font-black text-stone-600">{stage.label}</span>
                    <span className="text-xs font-bold text-stone-400">{stageDeals.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageDeals.map((d) => (
                      <div key={d.id} className="rounded-xl border border-stone-200 bg-white p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(d);
                            setShowForm(true);
                          }}
                          className="block w-full text-start"
                        >
                          <div className="text-sm font-black text-stone-800">{d.title}</div>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-stone-500">
                            {d.deal_type && <span>{labelOf(DEAL_TYPES, d.deal_type)}</span>}
                            {d.value_ils != null && <span className="font-bold text-teal-700">{fmtValue(d.value_ils)}</span>}
                            {d.owner && <span>{d.owner}</span>}
                          </div>
                          {d.next_step && (
                            <div className={`mt-1.5 rounded-lg px-2 py-1 text-xs ${
                              d.next_step_due && d.next_step_due < new Date().toISOString().slice(0, 10)
                                ? "bg-red-50 text-red-700"
                                : "bg-stone-50 text-stone-500"
                            }`}>
                              → {d.next_step}
                              {d.next_step_due ? ` (${fmtDate(d.next_step_due)})` : ""}
                            </div>
                          )}
                          {!d.next_step && (
                            <div className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              ⚠ אין צעד הבא מוגדר
                            </div>
                          )}
                        </button>
                        <div className="mt-2 flex items-center justify-between border-t border-stone-100 pt-1.5">
                          <button
                            onClick={() => moveStage(d, -1)}
                            disabled={busy === d.id || d.stage === "inquiry"}
                            title="שלב אחורה"
                            className="rounded px-1.5 text-stone-300 hover:text-stone-600 disabled:opacity-30"
                          >
                            →
                          </button>
                          <button
                            onClick={() => setStage(d, "lost")}
                            disabled={busy === d.id}
                            className="text-[11px] font-bold text-stone-300 hover:text-red-500"
                          >
                            אבודה
                          </button>
                          <button
                            onClick={() => moveStage(d, 1)}
                            disabled={busy === d.id}
                            title="שלב קדימה"
                            className="rounded px-1.5 text-stone-400 hover:text-teal-600 disabled:opacity-30"
                          >
                            ←
                          </button>
                        </div>
                      </div>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className="rounded-xl border border-dashed border-stone-200 p-3 text-center text-xs text-stone-300">
                        —
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Closed column */}
            <div className="w-60 shrink-0 rounded-2xl bg-stone-100 p-2 opacity-80">
              <div className="mb-2 px-2 pt-1 text-sm font-black text-stone-500">סגורות ({closed.length})</div>
              <div className="space-y-2">
                {closed.slice(0, 10).map((d) => (
                  <div key={d.id} className="rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black ${d.stage === "won" ? "text-emerald-600" : "text-red-400"}`}>
                        {d.stage === "won" ? "✓" : "✗"}
                      </span>
                      <span className="text-sm font-bold text-stone-600">{d.title}</span>
                    </div>
                    {d.value_ils != null && <div className="mt-0.5 text-xs text-stone-400">{fmtValue(d.value_ils)}</div>}
                    <button
                      onClick={() => setStage(d, "inquiry")}
                      disabled={busy === d.id}
                      className="mt-1 text-[11px] font-bold text-stone-300 hover:text-stone-500"
                    >
                      פתיחה מחדש
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <DealForm
            deal={editing}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
              load();
            }}
          />
        )}
      </div>
    </div>
  );
}

function DealForm({ deal, onClose, onSaved }: { deal: Deal | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(deal?.title ?? "");
  const [dealType, setDealType] = useState(deal?.deal_type ?? "school");
  const [value, setValue] = useState(deal?.value_ils != null ? String(deal.value_ils) : "");
  const [owner, setOwner] = useState(deal?.owner ?? "");
  const [contactName, setContactName] = useState(deal?.contact_name ?? "");
  const [contactInfo, setContactInfo] = useState(deal?.contact_info ?? "");
  const [nextStep, setNextStep] = useState(deal?.next_step ?? "");
  const [nextStepDue, setNextStepDue] = useState(deal?.next_step_due ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        ...(deal ? { id: deal.id } : {}),
        title: title.trim(),
        deal_type: dealType,
        value_ils: value || null,
        owner: owner || null,
        contact_name: contactName || null,
        contact_info: contactInfo || null,
        next_step: nextStep || null,
        next_step_due: nextStepDue || null,
        notes: notes || null,
      };
      const res = await fetch("/api/admin-crm/deals", {
        method: deal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (j.ok) onSaved();
      else setError(j.error || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deal || !confirm("למחוק את העסקה לצמיתות?")) return;
    setSaving(true);
    try {
      await fetch("/api/admin-crm/deals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50" dir="rtl">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-x-4 top-10 mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:inset-x-auto sm:right-1/2 sm:w-full sm:translate-x-1/2">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900">{deal ? "עריכת עסקה" : "עסקה חדשה"}</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-full px-2 text-stone-400 hover:bg-stone-100">
            ✕
          </button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם העסקה (למשל: פיילוט בי״ס אורט רחובות)"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={dealType}
              onChange={(e) => setDealType(e.target.value)}
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
            >
              {DEAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="שווי ₪"
              inputMode="numeric"
              className="w-28 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="בעלים"
              className="w-28 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="איש קשר"
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="טלפון / מייל"
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="הצעד הבא (החשוב מכולם!)"
              className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={nextStepDue}
              onChange={(e) => setNextStepDue(e.target.value)}
              className="rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות"
            rows={3}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
          />
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
          <div className="flex items-center justify-between pt-1">
            {deal ? (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="text-xs font-bold text-stone-300 hover:text-red-500"
              >
                מחיקת עסקה
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-stone-200 px-4 py-2 text-sm font-bold text-stone-500"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {saving ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
