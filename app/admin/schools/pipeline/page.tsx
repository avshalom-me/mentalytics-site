"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CLOSED_DEAL_STAGES, DEAL_LOST_REASONS, DEAL_PRODUCTS, DEAL_SOURCES, DEAL_STAGES, labelOf } from "@/app/lib/schools-crm";
import { DealForm, Notice, StageMover, btnPrimary, daysSince, errText, getJson, hebDate, inputCls, sendJson, shekel, todayIso, type DealRow } from "../shared";

// צינור העסקאות של ענף בתי הספר: עמודה לכל שלב, ועל כל כרטיס דרופדאון שלב
// שמעביר אותו בין העמודות (כמו בלוח עסקאות B2B). השלבים הסגורים ("שולם,
// רישיון פעיל" ו"אבוד") מקופלים כברירת מחדל. הסכומים כולל מע"מ.
// עסקה חדשה נפתחת גם מעמוד בית הספר.

type PipelineDeal = DealRow & {
  schools: { name: string; city: string | null; symbol: string | null; is_demo: boolean } | null;
  school_owners: { name: string } | null;
};

const isClosed = (stage: string) => (CLOSED_DEAL_STAGES as readonly string[]).includes(stage);

// צבע העמודה לפי הקרבה לסגירה: קר בהתחלה, זהוב באמצע, ירקרק בסוף.
const COLUMN_CLS: Record<string, string> = {
  listed: "border-stone-200 bg-stone-100/70",
  contacted: "border-stone-200 bg-stone-100/70",
  meeting: "border-stone-200 bg-stone-100/70",
  pilot: "border-[#E8D9A8] bg-[#FDF6E3]/70",
  quote_sent: "border-[#E8D9A8] bg-[#FDF6E3]/70",
  approval: "border-[#E8D9A8] bg-[#FDF6E3]/70",
  active: "border-[#C2DFDE] bg-[#EAF4F3]/70",
  renewal: "border-[#C2DFDE] bg-[#EAF4F3]/70",
  frozen: "border-stone-300 bg-stone-200/50",
  lost: "border-red-200 bg-red-50/40",
};

export default function SchoolsPipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [demo, setDemo] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ deal: PipelineDeal | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ deals: PipelineDeal[] }>("/api/admin-schools/deals");
      setDeals(j.deals);
      setError("");
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 4000);
  };

  async function move(deal: PipelineDeal, stage: string, lostReason?: string) {
    setBusy(deal.id);
    try {
      await sendJson("/api/admin-schools/deals", { action: "save", id: deal.id, stage, ...(stage === "lost" ? { lost_reason: lostReason } : {}) });
      await load();
      say(`העסקה עברה ל"${labelOf(DEAL_STAGES, stage)}".`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  const today = todayIso();
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return deals.filter((d) => {
      if (!demo && d.schools?.is_demo) return false;
      if (!needle) return true;
      const hay = `${d.schools?.name ?? ""} ${d.schools?.city ?? ""} ${d.school_owners?.name ?? ""} ${d.title ?? ""} ${d.handler ?? ""} ${d.next_step ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [deals, q, demo]);

  // בתוך עמודה: צעד הבא שעבר מועדו קודם, אחריו לפי מועד הצעד הבא, ובלי מועד
  // בסוף. הכרטיס העליון הוא מה שצריך לטפל בו עכשיו.
  const columns = useMemo(
    () =>
      DEAL_STAGES.map((s) => {
        const items = visible
          .filter((d) => d.stage === s.value)
          .sort((a, b) => {
            const ua = a.next_step_due && a.next_step_due < today ? 0 : 1;
            const ub = b.next_step_due && b.next_step_due < today ? 0 : 1;
            if (ua !== ub) return ua - ub;
            if (a.next_step_due && b.next_step_due) return a.next_step_due.localeCompare(b.next_step_due);
            if (a.next_step_due) return -1;
            if (b.next_step_due) return 1;
            return b.stage_changed_at.localeCompare(a.stage_changed_at);
          });
        return { stage: s.value, label: s.label, items, value: items.reduce((sum, d) => sum + (Number(d.value_gross) || 0), 0) };
      }),
    [visible, today],
  );

  // עסקאות פתוחות: לא סגורות ולא מוקפאות.
  const openValue = columns.filter((c) => !isClosed(c.stage) && c.stage !== "frozen").reduce((sum, c) => sum + c.value, 0);
  const openCount = columns.filter((c) => !isClosed(c.stage) && c.stage !== "frozen").reduce((sum, c) => sum + c.items.length, 0);

  const lostLine = useMemo(() => {
    const lost = visible.filter((d) => d.stage === "lost");
    if (lost.length === 0) return "";
    const by = new Map<string, number>();
    for (const d of lost) by.set(d.lost_reason ?? "", (by.get(d.lost_reason ?? "") ?? 0) + 1);
    return [...by.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k ? labelOf(DEAL_LOST_REASONS, k) : "ללא סיבה"}: ${n}`)
      .join(", ");
  }, [visible]);

  if (loading) return <div className="p-6 text-sm text-stone-500">טוען...</div>;

  function card(d: PipelineDeal) {
    const overdue = Boolean(d.next_step_due && d.next_step_due < today);
    const finished = isClosed(d.stage) || d.stage === "frozen";
    const days = daysSince(d.stage_changed_at);
    const who = d.schools?.name ?? d.school_owners?.name ?? "בית ספר";
    return (
      <div key={d.id} className={`rounded-xl border border-stone-200 bg-white p-3 shadow-sm ${d.stage === "lost" ? "opacity-75" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          {d.school_id ? (
            <Link href={`/admin/schools/${d.school_id}`} className="text-sm font-black leading-snug text-stone-900 underline decoration-stone-300 hover:decoration-stone-700">
              {who}
            </Link>
          ) : (
            <span className="text-sm font-black leading-snug text-stone-900">{who}</span>
          )}
          <button type="button" onClick={() => setForm({ deal: d })} className="shrink-0 text-[11px] font-bold text-[#2A6462] underline">
            עריכה
          </button>
        </div>
        <div className="mt-0.5 text-[11px] text-stone-500">
          {[d.schools?.city, d.schools?.is_demo ? "הדגמה" : ""].filter(Boolean).join(", ")}
        </div>
        {d.title ? <div className="mt-1 text-xs text-stone-700">{d.title}</div> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
          <span>{labelOf(DEAL_PRODUCTS, d.product)}</span>
          {d.value_gross != null ? <span className="font-bold text-[#2A6462]">{shekel(d.value_gross)}</span> : null}
          {d.source ? <span>מקור: {labelOf(DEAL_SOURCES, d.source)}</span> : null}
        </div>
        {d.handler ? <div className="mt-1 text-[11px] text-stone-600">מטפל: {d.handler}</div> : null}
        {d.next_step ? (
          <div className={`mt-2 text-xs ${overdue ? "font-bold text-red-600" : "text-stone-600"}`}>
            הצעד הבא: {d.next_step}
            {d.next_step_due ? ` (${hebDate(d.next_step_due)})` : ""}
          </div>
        ) : !finished ? (
          <div className="mt-2 text-xs font-bold text-amber-700">אין צעד הבא</div>
        ) : null}
        {d.stage === "frozen" && d.frozen_until ? <div className="mt-1 text-[11px] text-stone-600">חוזרים ב-{hebDate(d.frozen_until)}</div> : null}
        {d.stage === "lost" && d.lost_reason ? <div className="mt-1 text-[11px] font-bold text-red-600">{labelOf(DEAL_LOST_REASONS, d.lost_reason)}</div> : null}
        <div className="mt-2.5 border-t border-stone-100 pt-2">
          <StageMover stage={d.stage} label={`שלב העסקה: ${who}`} busy={busy === d.id} onMove={(stage, reason) => move(d, stage, reason)} />
          <div className="mt-1 text-[10px] text-stone-400">{days === 0 ? "עברה לשלב היום" : `${days} ימים בשלב`}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">צינור העסקאות</h1>
          <p className="mt-1 text-sm text-stone-500">
            {openCount} עסקאות פתוחות, בסכום של {shekel(openValue)} כולל מע&quot;מ (בלי מוקפאות). להעברה בין עמודות בוחרים שלב בתחתית הכרטיס.
          </p>
        </div>
        <button type="button" onClick={() => setForm({ deal: null })} className={btnPrimary}>
          עסקה חדשה
        </button>
      </div>
      <Notice error={error} flash={flash} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: בית ספר, עיר, מטפל, צעד הבא" className={`${inputCls} max-w-xs`} />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          כולל הדגמה
        </label>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((c) => {
          const closed = isClosed(c.stage);
          const open = !closed || expanded[c.stage];
          if (!open) {
            return (
              <button
                key={c.stage}
                type="button"
                onClick={() => setExpanded((p) => ({ ...p, [c.stage]: true }))}
                className={`w-40 shrink-0 self-start rounded-2xl border px-3 py-2.5 text-start ${COLUMN_CLS[c.stage] ?? ""}`}
              >
                <div className="text-sm font-black text-stone-800">{c.label}</div>
                <div className="text-[11px] font-bold text-stone-500">
                  {c.items.length} עסקאות{c.value > 0 ? `, ${shekel(c.value)}` : ""}
                </div>
                <div className="mt-1 text-[11px] text-[#2A6462] underline">הצגה</div>
              </button>
            );
          }
          return (
            <section key={c.stage} className={`flex min-h-[40vh] w-64 shrink-0 flex-col rounded-2xl border ${COLUMN_CLS[c.stage] ?? "border-stone-200 bg-stone-100/70"}`}>
              <header className="border-b border-black/5 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-black text-stone-800">{c.label}</h2>
                  <span className="text-[11px] font-bold text-stone-500">{c.items.length}</span>
                </div>
                {c.value > 0 ? <div className="text-[11px] text-stone-500">{shekel(c.value)}</div> : null}
                {closed ? (
                  <button type="button" onClick={() => setExpanded((p) => ({ ...p, [c.stage]: false }))} className="mt-0.5 text-[11px] text-[#2A6462] underline">
                    קיפול
                  </button>
                ) : null}
                {c.stage === "lost" && lostLine ? <p className="mt-1 text-[11px] text-stone-500">{lostLine}</p> : null}
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {c.items.map((d) => card(d))}
                {c.items.length === 0 && <p className="px-1 py-6 text-center text-xs text-stone-400">{q ? "אין עסקאות בחיפוש הזה" : "אין עסקאות"}</p>}
              </div>
            </section>
          );
        })}
      </div>

      {form && (
        <DealForm
          key={form.deal?.id ?? "new"}
          deal={form.deal}
          school={null}
          schoolName={form.deal ? (form.deal.schools?.name ?? form.deal.school_owners?.name ?? "") : undefined}
          onClose={() => setForm(null)}
          onSaved={async () => {
            setForm(null);
            await load();
            say("העסקה נשמרה.");
          }}
        />
      )}
    </div>
  );
}
