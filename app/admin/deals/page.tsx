"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../components/HelpTip";
import { CLOSED_DEAL_STAGES, DEAL_STAGES, DEAL_TYPES, LOST_REASONS, labelOf } from "@/app/lib/crm";
import { REGION_GROUP_LABELS } from "@/app/lib/regions";

// עסקאות B2B - לוח בעמודות, עמודה לכל סטטוס (בקשה מ-14/9/26). זה הופך את
// ההחלטה מ-30/8/26 על טבלה עם כותרות קבועות: הטבלה סודרה לפי שם, ומה שרצו
// לראות הוא איפה כל עסקה עומדת בצינור. בכל כרטיס נשאר דרופדאון הסטטוס - זו
// הדרך להעביר עסקה בין עמודות. "שלב" נקרא מעכשיו "סטטוס" בכל הממשק; הערך
// במסד נשאר stage, שינוי שם בשביל תווית היה דורש מיגרציה בלי שום רווח.
// מכונים מגיעים לכאן אוטומטית מסוכן איתור המכונים ("רוצים" ← עסקה).

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
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

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

// רקע העמודה: אותה משפחת צבעים כמו הסטטוס, חיוורת, כדי שעסקה שעוברת עמודה
// תיראה במקום אחר גם בזווית העין.
const COLUMN_CLS: Record<string, string> = {
  first_contact: "border-stone-200 bg-stone-100/70",
  negotiation: "border-amber-200 bg-amber-50/60",
  link_sent: "border-sky-200 bg-sky-50/60",
  closed: "border-emerald-200 bg-emerald-50/60",
  lost: "border-red-200 bg-red-50/40",
};

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [losing, setLosing] = useState<Deal | null>(null);

  // פילטרים - צד לקוח, הרשימה קטנה. אין פילטר סטטוס: כל עמודה היא סטטוס.
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

  async function setStage(deal: Deal, stage: string, lostReason?: string) {
    setBusy(deal.id);
    try {
      await fetch("/api/admin-crm/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, stage, ...(stage === "lost" ? { lost_reason: lostReason ?? null } : {}) }),
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

  // עמודה לכל סטטוס, בסדר הצינור. בתוך עמודה: צעד הבא שעבר מועדו קודם, אחריו
  // לפי מועד הצעד הבא, ובלי מועד בסוף - כך שהכרטיס העליון הוא מה שצריך לטפל
  // בו עכשיו, ולא מה שנפתח ראשון או מה שקודם באלף-בית.
  const columns = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const urgency = (d: Deal) => (d.next_step_due && d.next_step_due < today ? 0 : 1);
    return DEAL_STAGES.map((s) => {
      const items = deals
        .filter((d) => d.stage === s.value)
        .filter(matchesFilters)
        .slice()
        .sort((a, b) => {
          const u = urgency(a) - urgency(b);
          if (u !== 0) return u;
          if (a.next_step_due && b.next_step_due) return a.next_step_due.localeCompare(b.next_step_due);
          if (a.next_step_due) return -1;
          if (b.next_step_due) return 1;
          return b.updated_at.localeCompare(a.updated_at);
        });
      const value = items.reduce((sum, d) => sum + (Number(d.value_ils) || 0), 0);
      return { stage: s.value as string, label: s.label as string, items, value };
    });
  }, [deals, matchesFilters]);

  const pipelineValue = columns
    .filter((c) => !(CLOSED_DEAL_STAGES as readonly string[]).includes(c.stage))
    .reduce((sum, c) => sum + c.value, 0);
  const regionsPresent = Array.from(
    new Set(deals.map((d) => d.region_key).filter((v): v is string => Boolean(v)))
  );
  const lostReasonsLine = (() => {
    const lost = deals.filter((d) => d.stage === "lost").filter(matchesFilters);
    if (lost.length === 0) return "";
    const byReason = new Map<string, number>();
    for (const d of lost) {
      const k = d.lost_reason ?? "unset";
      byReason.set(k, (byReason.get(k) ?? 0) + 1);
    }
    return Array.from(byReason.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k === "unset" ? "ללא סיבה" : labelOf(LOST_REASONS, k)}: ${n}`)
      .join(" · ");
  })();

  function dealCard(d: Deal) {
    const overdue = Boolean(d.next_step_due && d.next_step_due < new Date().toISOString().slice(0, 10));
    const finished = d.stage === "closed" || d.stage === "lost";
    return (
      <div
        key={d.id}
        className={`rounded-xl border border-stone-200 bg-white p-3 shadow-sm ${d.stage === "lost" ? "opacity-70" : ""}`}
      >
        <button
          onClick={() => {
            setEditing(d);
            setShowForm(true);
          }}
          className="block w-full text-start text-sm font-black leading-snug text-stone-800 hover:underline"
        >
          {d.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
          {d.prospect_id && (
            <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">מאיתור מכונים</span>
          )}
          {d.deal_type && <span>{labelOf(DEAL_TYPES, d.deal_type)}</span>}
          {d.region_key && <span>· {REGION_GROUP_LABELS[d.region_key] ?? d.region_key}</span>}
          {d.value_ils != null && <span className="font-bold text-teal-700">· {fmtValue(d.value_ils)}</span>}
        </div>
        {(d.contact_name || d.contact_info) && (
          <div className="mt-1.5 text-xs text-stone-600">
            {d.contact_name && <span className="font-bold">{d.contact_name}</span>}
            {d.contact_info && <div className="break-words text-stone-400">{d.contact_info}</div>}
          </div>
        )}
        {d.next_step ? (
          <div className={`mt-2 text-xs ${overdue ? "font-bold text-red-600" : "text-stone-600"}`}>
            הצעד הבא: {d.next_step}
            {d.next_step_due ? ` (${fmtDate(d.next_step_due)})` : ""}
          </div>
        ) : !finished ? (
          <div className="mt-2 text-xs font-bold text-amber-600">⚠ אין צעד הבא</div>
        ) : null}
        {d.stage === "lost" && d.lost_reason && (
          <div className="mt-1 text-[11px] font-bold text-red-500">{labelOf(LOST_REASONS, d.lost_reason)}</div>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-stone-100 pt-2">
          <select
            value={d.stage}
            disabled={busy === d.id}
            aria-label={`סטטוס: ${d.title}`}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "lost") {
                // הסיבה נשאלת כאן ולא בטופס: זה הרגע היחיד שבו זוכרים
                // אותה, ובלעדיו השדה נשאר ריק לנצח.
                setLosing(d);
                e.target.value = d.stage;
                return;
              }
              setStage(d, v);
            }}
            className={`min-w-0 flex-1 rounded-lg border px-1.5 py-1 text-[11px] font-bold ${STAGE_CLS[d.stage] ?? ""}`}
          >
            {DEAL_STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="shrink-0 text-[10px] text-stone-400">{fmtDate(d.updated_at)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
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
          מרכז פעיל. להעברת עסקה לעמודה אחרת - לבחור לה סטטוס בתחתית הכרטיס.
        </p>

        {/* פילטרים */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
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

        {/* לוח: עמודה לכל סטטוס. גולל אופקית כשהמסך צר מחמש עמודות. */}
        {!loading && (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1100px] grid-cols-5 gap-3">
              {columns.map((c) => (
                <section
                  key={c.stage}
                  className={`flex min-h-[55vh] flex-col rounded-2xl border ${COLUMN_CLS[c.stage] ?? "border-stone-200 bg-stone-100/70"}`}
                >
                  <header className="flex items-baseline justify-between gap-2 border-b border-black/5 px-3 py-2.5">
                    <h2 className="text-sm font-black text-stone-800">{c.label}</h2>
                    <span className="text-[11px] font-bold text-stone-500">
                      {c.items.length}
                      {c.value > 0 ? ` · ${fmtValue(c.value)}` : ""}
                    </span>
                  </header>
                  {c.stage === "lost" && lostReasonsLine && (
                    <p className="px-3 pt-2 text-[11px] text-stone-500">{lostReasonsLine}</p>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-2">
                    {c.items.map((d) => dealCard(d))}
                    {c.items.length === 0 && (
                      <p className="px-1 py-6 text-center text-xs text-stone-400">
                        {typeFilter || regionFilter || q ? "אין עסקאות בסינון הזה" : "אין עסקאות"}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {losing && (
          <LostReasonDialog
            deal={losing}
            onClose={() => setLosing(null)}
            onPick={(reason) => {
              const d = losing;
              setLosing(null);
              setStage(d, "lost", reason);
            }}
          />
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

function LostReasonDialog({
  deal,
  onClose,
  onPick,
}: {
  deal: Deal;
  onClose: () => void;
  onPick: (reason: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-auto my-16 w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-base font-black text-stone-900">למה העסקה נפלה?</h2>
        <p className="mb-4 text-xs text-stone-500">{deal.title}</p>
        <div className="space-y-2">
          {LOST_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => onPick(r.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-start text-sm font-bold text-stone-700 hover:border-red-300 hover:bg-red-50"
            >
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-xs font-bold text-stone-400 hover:text-stone-600">
          ביטול
        </button>
      </div>
    </div>
  );
}

function DealForm({ deal, onClose, onSaved }: { deal: Deal | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(deal?.title ?? "");
  // הסטטוס לא היה בטופס בכלל, כך שעסקה שנפתחה אוטומטית מאיתור המכונים
  // אפשר היה לפתוח ולערוך - אבל לא לקבוע לה סטטוס. בעסקה חדשה ברירת המחדל
  // היא "פנייה ראשונית", כמו שה-API קובע ממילא.
  const [stage, setStageValue] = useState<string>(deal?.stage ?? "first_contact");
  const [lostReason, setLostReason] = useState<string>(deal?.lost_reason ?? "");
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
    if (stage === "lost" && !lostReason) {
      setError("עסקה אבודה צריכה סיבה - בלעדיה אי אפשר לספור בהמשך למה עסקאות נופלות");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // בעריכה הסטטוס נשלח רק אם השתנה. ה-API מאפס את closed_at בכל פעם
      // שהוא מקבל stage, כך ששמירת הערה על עסקה שנסגרה לפני חודש הייתה
      // מזיזה את תאריך הסגירה שלה להיום.
      const stageChanged = !deal || stage !== deal.stage;
      const body = {
        ...(deal ? { id: deal.id } : {}),
        ...(stageChanged ? { stage } : {}),
        ...(stage === "lost" ? { lost_reason: lostReason } : {}),
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
          <div className={stage === "lost" ? "grid grid-cols-2 gap-2" : ""}>
            <div>
              <label className={label}>סטטוס</label>
              <select value={stage} onChange={(e) => setStageValue(e.target.value)} className={`${field} font-bold`}>
                {DEAL_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            {stage === "lost" && (
              <div>
                <label className={label}>למה העסקה נפלה?</label>
                <select value={lostReason} onChange={(e) => setLostReason(e.target.value)} className={field}>
                  <option value="">בחירה…</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
