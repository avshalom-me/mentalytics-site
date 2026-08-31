"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import { DEAL_STAGES, DEAL_TYPES, labelOf } from "@/app/lib/crm";
import { REGION_GROUP_LABELS } from "@/app/lib/regions";

// עסקאות B2B - טבלה עם כותרות קבועות במקום קנבן (החלטת המשתמש 30/8/26):
// שלב העסקה הוא דרופדאון בשורה, הסגורות יורדות לטבלה נפרדת למטה, ומכונים
// מגיעים לכאן אוטומטית מסוכן איתור המכונים ("רוצים" ← עסקה).

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
  prospect_id: string | null;
  region_key: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

const OPEN_STAGES = DEAL_STAGES.filter((s) => s.value !== "closed" && s.value !== "lost");

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

function fmtValue(v: number | null): string {
  if (v == null) return "";
  return `₪${Number(v).toLocaleString("he-IL")}`;
}

// צבע התחנה: מתקדם = חם יותר. closed ירוק, lost אדום.
const STAGE_CLS: Record<string, string> = {
  first_contact: "border-stone-300 bg-white text-stone-700",
  negotiation: "border-amber-300 bg-amber-50 text-amber-900",
  link_sent: "border-sky-300 bg-sky-50 text-sky-900",
  closed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  lost: "border-red-300 bg-red-50 text-red-800",
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  // פילטרים - צד לקוח, הרשימה קטנה.
  const [stageFilter, setStageFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [q, setQ] = useState("");

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

  const matchesFilters = useCallback(
    (d: Deal) =>
      (typeFilter ? d.deal_type === typeFilter : true) &&
      (regionFilter ? d.region_key === regionFilter : true) &&
      (q
        ? `${d.title} ${d.contact_name ?? ""} ${d.contact_info ?? ""} ${d.notes ?? ""}`
            .toLowerCase()
            .includes(q.toLowerCase())
        : true),
    [typeFilter, regionFilter, q]
  );

  const open = useMemo(() => {
    const stageRank = Object.fromEntries(DEAL_STAGES.map((s, i) => [s.value, i]));
    return deals
      .filter((d) => d.stage !== "closed" && d.stage !== "lost")
      .filter((d) => (stageFilter ? d.stage === stageFilter : true))
      .filter(matchesFilters)
      .slice()
      // המתקדמות בצינור קודם - הן הכי קרובות לכסף, ושכחה שם הכי יקרה.
      .sort((a, b) => (stageRank[b.stage] ?? 0) - (stageRank[a.stage] ?? 0));
  }, [deals, stageFilter, matchesFilters]);

  const closedWon = useMemo(
    () => deals.filter((d) => d.stage === "closed").filter(matchesFilters),
    [deals, matchesFilters]
  );
  const lost = useMemo(
    () => deals.filter((d) => d.stage === "lost").filter(matchesFilters),
    [deals, matchesFilters]
  );

  const pipelineValue = open.reduce((sum, d) => sum + (Number(d.value_ils) || 0), 0);
  const regionsPresent = Array.from(
    new Set(deals.map((d) => d.region_key).filter((v): v is string => Boolean(v)))
  );

  const th = "sticky top-0 z-10 bg-stone-100 p-2 text-right text-xs font-black text-stone-500";

  function dealRow(d: Deal, dimmed = false) {
    return (
      <tr
        key={d.id}
        className={`border-b border-stone-100 hover:bg-stone-50/60 ${dimmed ? "opacity-70" : ""}`}
      >
        <td className="p-2 align-top">
          <button
            onClick={() => {
              setEditing(d);
              setShowForm(true);
            }}
            className="text-start text-sm font-black text-stone-800 hover:underline"
          >
            {d.title}
          </button>
          {d.prospect_id && (
            <span className="ms-2 rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
              מאיתור מכונים
            </span>
          )}
        </td>
        <td className="whitespace-nowrap p-2 align-top text-xs text-stone-500">
          {labelOf(DEAL_TYPES, d.deal_type ?? "") || "-"}
        </td>
        <td className="p-2 align-top">
          <select
            value={d.stage}
            disabled={busy === d.id}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "lost" && !window.confirm(`לסמן את "${d.title}" כעסקה אבודה?`)) return;
              setStage(d, v);
            }}
            className={`w-40 rounded-lg border px-2 py-1 text-xs font-bold ${STAGE_CLS[d.stage] ?? ""}`}
          >
            {DEAL_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </td>
        <td className="whitespace-nowrap p-2 align-top text-xs font-bold text-teal-700">
          {fmtValue(d.value_ils)}
        </td>
        <td className="p-2 align-top text-xs text-stone-600">
          {d.contact_name && <div className="font-bold">{d.contact_name}</div>}
          {d.contact_info && <div className="text-stone-400">{d.contact_info}</div>}
        </td>
        <td className="whitespace-nowrap p-2 align-top text-xs text-stone-500">
          {d.region_key ? (REGION_GROUP_LABELS[d.region_key] ?? d.region_key) : "-"}
        </td>
        <td className="p-2 align-top text-xs">
          {d.next_step ? (
            <span
              className={
                d.next_step_due && d.next_step_due < new Date().toISOString().slice(0, 10)
                  ? "font-bold text-red-600"
                  : "text-stone-600"
              }
            >
              {d.next_step}
              {d.next_step_due ? ` (${fmtDate(d.next_step_due)})` : ""}
            </span>
          ) : (
            <span className="font-bold text-amber-600">⚠ אין צעד הבא</span>
          )}
        </td>
        <td className="whitespace-nowrap p-2 align-top text-[11px] text-stone-400">{fmtDate(d.updated_at)}</td>
      </tr>
    );
  }

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
        <p className="mb-4 text-sm text-stone-500">
          שווי פייפליין פתוח: <span className="font-black text-stone-700">{fmtValue(pipelineValue) || "₪0"}</span>
          <span className="mx-2 text-stone-300">·</span>
          מכון שמסומן &quot;רוצים&quot; באיתור המכונים נפתח כאן אוטומטית, ועסקה נסגרת לבד כשמזוהה מנוי
          מרכז פעיל.
        </p>

        {/* פילטרים */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-bold text-stone-600"
          >
            <option value="">כל השלבים הפתוחים</option>
            {OPEN_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-bold text-stone-600"
          >
            <option value="">כל הסוגים</option>
            {DEAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-bold text-stone-600"
          >
            <option value="">כל האזורים</option>
            {regionsPresent.map((rk) => (
              <option key={rk} value={rk}>
                {REGION_GROUP_LABELS[rk] ?? rk}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש חופשי..."
            className="w-40 rounded-lg border border-stone-200 bg-white px-2 py-1.5"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {/* הפתוחות - טבלה עם כותרות קבועות */}
        {!loading && (
          <div className="max-h-[60vh] overflow-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr>
                  <th className={th}>שם העסקה</th>
                  <th className={th}>סוג</th>
                  <th className={th}>שלב</th>
                  <th className={th}>שווי</th>
                  <th className={th}>איש קשר</th>
                  <th className={th}>אזור</th>
                  <th className={th}>הצעד הבא</th>
                  <th className={th}>עודכן</th>
                </tr>
              </thead>
              <tbody>
                {open.map((d) => dealRow(d))}
                {open.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-sm text-stone-400">
                      אין עסקאות פתוחות{stageFilter || typeFilter || regionFilter || q ? " בסינון הזה" : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* עסקאות שנסגרו - לקוחות מכונים */}
        {!loading && closedWon.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-black text-emerald-800">
              ✓ עסקאות שנסגרו ({closedWon.length}) - לקוחות פעילים
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-emerald-200 bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <tbody>{closedWon.map((d) => dealRow(d))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* אבודות - מקופל */}
        {!loading && lost.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-bold text-stone-400 hover:text-stone-600">
              עסקאות אבודות ({lost.length})
            </summary>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white opacity-80">
              <table className="w-full min-w-[900px] text-sm">
                <tbody>{lost.map((d) => dealRow(d, true))}</tbody>
              </table>
            </div>
          </details>
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
  const [dealType, setDealType] = useState(deal?.deal_type ?? "center");
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

  const label = "mb-1 block text-xs font-black text-stone-500";
  const field = "w-full rounded-xl border border-stone-200 px-3 py-2 text-sm";

  return (
    // כל שכבת העל גלילה: חלונית גבוהה מהמסך נגללת במקום להיחתך למעלה.
    <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-auto my-8 w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-stone-900">{deal ? "עריכת עסקה" : "עסקה חדשה"}</h2>
          <button onClick={onClose} aria-label="סגירה" className="rounded-full px-2 text-stone-400 hover:bg-stone-100">
            ✕
          </button>
        </div>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className={label}>שם העסקה</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: מכון שלווה - הצטרפות כמרכז"
              className={field}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={label}>סוג</label>
              <select value={dealType} onChange={(e) => setDealType(e.target.value)} className={field}>
                {DEAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>שווי חודשי ₪</label>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="numeric"
                className={field}
              />
            </div>
            <div>
              <label className={label}>בעלים</label>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>איש קשר</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>טלפון / מייל</label>
              <input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} className={field} />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div>
              <label className={label}>הצעד הבא (החשוב מכולם!)</label>
              <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>עד מתי</label>
              <input
                type="date"
                value={nextStepDue}
                onChange={(e) => setNextStepDue(e.target.value)}
                className={field}
              />
            </div>
          </div>
          <div>
            <label className={label}>הערות</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={field} />
          </div>
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
