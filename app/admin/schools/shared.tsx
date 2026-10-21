"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import {
  DEAL_LOST_REASONS,
  DEAL_PRODUCTS,
  DEAL_SOURCES,
  DEAL_STAGES,
  PROCUREMENT_ROUTES,
  type Opt,
} from "@/app/lib/schools-crm";
import { PROSPECT_REGION_LABELS } from "@/app/lib/prospect-regions";

// עזרים משותפים למסכי ענף בתי הספר באדמין: רשימה, עמוד בית ספר, בעלויות
// וצינור. כאן גם טופס העסקה ובורר השלב, שמופיעים גם בצינור וגם בעמוד בית הספר.

// ── עזרי תצוגה ─────────────────────────────────────────────────────────────────
export const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
export const btnPrimary = "rounded-full bg-[#3D8C8A] px-5 py-2 text-sm font-bold text-white hover:bg-[#2A6462] disabled:opacity-50";
export const btnGhost = "rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50";
export const cardCls = "rounded-2xl border border-stone-200 bg-white p-4";

export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/** תאריך YYYY-MM-DD (או תחילת חותמת זמן) כ-19.10.2026. */
export const hebDate = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().map(Number).join(".") : "");

/** חותמת זמן לפי שעון ישראל: 19.10.2026, 14:30. */
export function hebStamp(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export const shekel = (n: number | string | null | undefined) => `${Number(n ?? 0).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ש"ח`;

/** ימים שלמים מחותמת זמן עד עכשיו. */
export const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);

/** חותמת זמן ל-input מסוג datetime-local, לפי שעון הדפדפן. */
export function nowLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** שנת הלימודים שעסקה חדשה נוגעת לה: מאי עד אוגוסט כבר נרשמים לשנה הבאה (נספח ד'). */
export function defaultSchoolYear(): string {
  const [y, m] = todayIso().split("-").map(Number);
  const start = m >= 9 || m <= 4 ? (m >= 9 ? y : y - 1) : y;
  return `${start}/${String(start + 1).slice(2)}`;
}

// ── אזורים ─────────────────────────────────────────────────────────────────────
// אותו אוצר מילים של אזורים כמו רשימת המכונים ועסקאות המרכזים (region_key),
// בלי "אונליין": בית ספר יושב במקום.
export const REGION_OPTIONS: Opt[] = Object.entries(PROSPECT_REGION_LABELS)
  .filter(([key]) => key !== "online")
  .map(([value, label]) => ({ value, label }));
export const regionLabel = (key: string | null | undefined) => (key ? (PROSPECT_REGION_LABELS[key] ?? key) : "");

export const STATUS_PILL: Record<string, string> = {
  prospect: "bg-stone-100 text-stone-600",
  pilot: "bg-[#FDF6E3] text-[#A87010]",
  customer: "bg-[#EAF4F3] text-[#2A6462]",
  past: "bg-stone-100 text-stone-500",
  lost: "bg-red-50 text-red-700",
  not_relevant: "bg-stone-100 text-stone-400",
};

// ── קריאות לשרת ───────────────────────────────────────────────────────────────
type Json = Record<string, unknown>;

// ── אדמין או פורטל השותפה ──────────────────────────────────────────────────────
// אותם מסכים משמשים את הבעלים (/admin/schools, Basic Auth) ואת השותפה
// (/partner/schools, סשן Supabase). המסכים כותבים את נתיבי האדמין; בפורטל,
// כל קריאה מנותבת ל-/api/partner-schools/* עם טוקן הסשן (טרי בכל קריאה), ונתיב
// שאין לו מקביל בפורטל נחסם כאן ולא נשלח. ההרשאות עצמן נאכפות בשרת
// (app/lib/schools-api/*, app/lib/schools-auth.server.ts).
export function inPartnerPortal(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/partner");
}

/** הבסיס לקישורים בין מסכי הענף: /admin/schools או /partner/schools. */
export function useSchoolsBase(): string {
  const pathname = usePathname();
  return pathname?.startsWith("/partner") ? "/partner/schools" : "/admin/schools";
}

const PARTNER_ROUTES: [RegExp, string][] = [
  [/^\/api\/admin-schools\/(schools|deals|licenses|assignees|overview|tasks)(?=\?|$)/, "/api/partner-schools/$1"],
  [/^\/api\/admin-crm\/(tasks|notes)(?=\?|$)/, "/api/partner-schools/$1"],
];

async function request(url: string, init: RequestInit): Promise<Response> {
  if (!inPartnerPortal()) return fetch(url, init);
  const route = PARTNER_ROUTES.find(([re]) => re.test(url));
  if (!route) throw new Error("הפעולה הזו אינה זמינה בפורטל");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/partner/login";
    throw new Error("צריך להתחבר מחדש");
  }
  const r = await fetch(url.replace(route[0], route[1]), { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  if (r.status === 401) window.location.href = "/partner/login";
  return r;
}

export async function getJson<T extends Json>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await request(url, { cache: "no-store", signal });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || "שגיאה בטעינה");
  return j as T;
}

export async function sendJson<T extends Json = Json>(url: string, body: Json, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  const r = await request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || "שגיאה");
  return j as T;
}

/** כפתור מחיקה עם אישור. השרת מסרב למחוק מה שכבר נכנס בו כסף, וההודעה שלו מוצגת. */
export function DeleteButton({
  url,
  body,
  confirmText,
  onDone,
  onError,
  label = "מחיקה",
}: {
  url: string;
  body: Json;
  confirmText: string;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        try {
          await sendJson(url, body);
          await onDone();
        } catch (e) {
          onError(errText(e));
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-full border border-red-200 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {busy ? "מוחק..." : label}
    </button>
  );
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : "שגיאה");

// ── רכיבים קטנים ──────────────────────────────────────────────────────────────
export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-bold text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export function OptSelect({
  list,
  value,
  onChange,
  blank,
  className = inputCls,
  disabled,
}: {
  list: Opt[];
  value: string;
  onChange: (v: string) => void;
  blank?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} disabled={disabled}>
      {blank !== undefined && <option value="">{blank}</option>}
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" dir="rtl">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative mx-auto my-10 w-[calc(100%-2rem)] max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-full px-2 py-0.5 text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Notice({ error, flash }: { error?: string; flash?: string }) {
  return (
    <>
      {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {flash ? <div className="mb-4 rounded-xl border border-[#C2DFDE] bg-[#EAF4F3] p-3 text-sm text-[#2A6462]">{flash}</div> : null}
    </>
  );
}

// ── בורר בית ספר ──────────────────────────────────────────────────────────────
// רשימת בתי הספר יכולה להגיע לאלפים, ולכן לא select אחד עם כולם: חיפוש, ואחריו
// בחירה מתוך 30 התוצאות הראשונות.
export type PickedSchool = { id: string; name: string; symbol: string | null; city: string | null; is_demo: boolean };

export const schoolLabel = (s: Pick<PickedSchool, "name" | "symbol" | "city" | "is_demo">) =>
  `${s.name}${s.symbol ? ` (${s.symbol})` : ""}${s.city ? `, ${s.city}` : ""}${s.is_demo ? " [הדגמה]" : ""}`;

export function SchoolPicker({ value, onChange }: { value: PickedSchool | null; onChange: (s: PickedSchool | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedSchool[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(
      () => {
        getJson<{ schools: PickedSchool[] }>(`/api/admin-schools/schools?picker=1&q=${encodeURIComponent(q.trim())}`, ctrl.signal)
          .then((j) => {
            setResults(j.schools);
            setError("");
          })
          .catch((e) => {
            if (!(e instanceof DOMException && e.name === "AbortError")) setError(errText(e));
          });
      },
      q ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם, עיר או סמל" className={inputCls} />
      <select value={value?.id ?? ""} onChange={(e) => onChange(results.find((r) => r.id === e.target.value) ?? null)} className={inputCls}>
        <option value="">בוחרים בית ספר...</option>
        {value && !results.some((r) => r.id === value.id) ? <option value={value.id}>{schoolLabel(value)}</option> : null}
        {results.map((r) => (
          <option key={r.id} value={r.id}>
            {schoolLabel(r)}
          </option>
        ))}
      </select>
      {error ? <div className="text-xs text-red-700">{error}</div> : null}
    </div>
  );
}

// ── בורר שלב לעסקה ────────────────────────────────────────────────────────────
// העברה ל"אבוד" שואלת את הסיבה במקום, ולא ב-window.prompt: זה הרגע היחיד
// שבו זוכרים אותה.
export function StageMover({
  stage,
  label,
  busy,
  className,
  onMove,
}: {
  stage: string;
  label: string;
  busy?: boolean;
  className?: string;
  onMove: (stage: string, lostReason?: string) => void | Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="min-w-0">
      <select
        value={stage}
        disabled={busy}
        aria-label={label}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "lost") {
            setReason("");
            setAsking(true);
            return;
          }
          setAsking(false);
          void onMove(next);
        }}
        className={className ?? "w-full rounded-lg border border-stone-300 bg-white px-1.5 py-1 text-[11px] font-bold text-stone-700"}
      >
        {DEAL_STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {asking && (
        <div className="mt-1.5 space-y-1.5 rounded-lg bg-red-50 p-2">
          <div className="text-[11px] font-bold text-red-700">למה העסקה נפלה?</div>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-stone-300 bg-white px-1.5 py-1 text-[11px]">
            <option value="">בוחרים סיבה...</option>
            {DEAL_LOST_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={!reason}
              onClick={() => {
                setAsking(false);
                void onMove("lost", reason);
              }}
              className="rounded-full bg-red-700 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40"
            >
              העברה ל&quot;אבוד&quot;
            </button>
            <button type="button" onClick={() => setAsking(false)} className="px-2 text-[11px] font-bold text-stone-500">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── טופס עסקה ─────────────────────────────────────────────────────────────────
export type DealRow = {
  id: string;
  school_id: string | null;
  owner_id: string | null;
  title: string | null;
  school_year: string | null;
  stage: string;
  product: string;
  value_gross: number | null;
  source: string | null;
  handler: string | null;
  next_step: string | null;
  next_step_due: string | null;
  procurement_route: string | null;
  pilot_start: string | null;
  pilot_end: string | null;
  quote_ref: string | null;
  po_number: string | null;
  expected_payment_date: string | null;
  lost_reason: string | null;
  frozen_until: string | null;
  notes: string | null;
  stage_changed_at: string;
  closed_at: string | null;
  created_at: string;
};

type DealFields = {
  title: string;
  school_year: string;
  stage: string;
  product: string;
  value_gross: string;
  source: string;
  handler: string;
  next_step: string;
  next_step_due: string;
  procurement_route: string;
  lost_reason: string;
  frozen_until: string;
  pilot_start: string;
  pilot_end: string;
  quote_ref: string;
  po_number: string;
  expected_payment_date: string;
  notes: string;
};

function dealFields(d: DealRow | null): DealFields {
  return {
    title: d?.title ?? "",
    school_year: d ? (d.school_year ?? "") : defaultSchoolYear(),
    stage: d?.stage ?? "listed",
    product: d?.product ?? "license",
    value_gross: d?.value_gross != null ? String(d.value_gross) : "",
    source: d?.source ?? "",
    handler: d?.handler ?? "",
    next_step: d?.next_step ?? "",
    next_step_due: d?.next_step_due ?? "",
    procurement_route: d?.procurement_route ?? "",
    lost_reason: d?.lost_reason ?? "",
    frozen_until: d?.frozen_until ?? "",
    pilot_start: d?.pilot_start ?? "",
    pilot_end: d?.pilot_end ?? "",
    quote_ref: d?.quote_ref ?? "",
    po_number: d?.po_number ?? "",
    expected_payment_date: d?.expected_payment_date ?? "",
    notes: d?.notes ?? "",
  };
}

/**
 * עסקה חדשה (בית ספר קבוע, או בורר כשלא נשלח) או עריכה של עסקה קיימת.
 * הסכומים כולל מע"מ, כמו ברישיונות.
 */
export function DealForm({
  deal,
  school,
  schoolName,
  onClose,
  onSaved,
}: {
  deal: DealRow | null;
  school: PickedSchool | null;
  schoolName?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [picked, setPicked] = useState<PickedSchool | null>(school);
  const [f, setF] = useState<DealFields>(() => dealFields(deal));
  const [more, setMore] = useState(() => Boolean(deal && (deal.pilot_start || deal.pilot_end || deal.quote_ref || deal.po_number || deal.expected_payment_date || deal.procurement_route || deal.notes)));
  const [assignees, setAssignees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof DealFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    getJson<{ assignees: string[] }>("/api/admin-schools/assignees")
      .then((j) => setAssignees(j.assignees))
      .catch(() => setAssignees([]));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!deal && !picked) throw new Error("בוחרים בית ספר");
      await sendJson("/api/admin-schools/deals", { action: "save", ...(deal ? { id: deal.id } : { school_id: picked?.id }), ...f });
      await onSaved();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={deal ? "עריכת עסקה" : "עסקה חדשה"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-stone-700">בית ספר</span>
          {deal || school ? <div className="text-sm text-stone-800">{deal ? (schoolName ?? "") : schoolLabel(school as PickedSchool)}</div> : <SchoolPicker value={picked} onChange={setPicked} />}
        </div>
        <Field label="כותרת (לא חובה)">
          <input value={f.title} onChange={set("title")} maxLength={200} className={inputCls} placeholder="למשל: רישיון שנתי לכל הצוות" />
        </Field>
        <Field label="שנת לימודים">
          <input value={f.school_year} onChange={set("school_year")} maxLength={7} dir="ltr" className={`${inputCls} text-end`} placeholder="2026/27" />
        </Field>
        <Field label="מוצר">
          <OptSelect list={DEAL_PRODUCTS} value={f.product} onChange={(v) => setF((p) => ({ ...p, product: v }))} />
        </Field>
        <Field label="שלב">
          <OptSelect list={DEAL_STAGES} value={f.stage} onChange={(v) => setF((p) => ({ ...p, stage: v }))} />
        </Field>
        {f.stage === "lost" && (
          <Field label="סיבת ההפסד" className="sm:col-span-2">
            <OptSelect list={DEAL_LOST_REASONS} value={f.lost_reason} onChange={(v) => setF((p) => ({ ...p, lost_reason: v }))} blank="בוחרים סיבה..." />
          </Field>
        )}
        {f.stage === "frozen" && (
          <Field label="מתי לחזור">
            <input type="date" value={f.frozen_until} onChange={set("frozen_until")} className={inputCls} />
          </Field>
        )}
        <Field label={`סכום כולל מע"מ`}>
          <input type="number" min={0} step="0.01" value={f.value_gross} onChange={set("value_gross")} className={inputCls} placeholder="לפי מה שסוכם או הוצע" />
        </Field>
        <Field label="מקור">
          <OptSelect list={DEAL_SOURCES} value={f.source} onChange={(v) => setF((p) => ({ ...p, source: v }))} blank="לא ידוע" />
        </Field>
        <Field label="מי מטפל">
          <input value={f.handler} onChange={set("handler")} list="school-deal-handlers" maxLength={80} className={inputCls} />
          <datalist id="school-deal-handlers">
            {assignees.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="הצעד הבא">
          <input value={f.next_step} onChange={set("next_step")} maxLength={300} className={inputCls} />
        </Field>
        <Field label="מועד הצעד הבא">
          <input type="date" value={f.next_step_due} onChange={set("next_step_due")} className={inputCls} />
        </Field>

        <div className="sm:col-span-2">
          <button type="button" onClick={() => setMore((v) => !v)} className="text-xs font-bold text-[#2A6462] underline">
            {more ? "פחות פרטים" : "עוד פרטים: רכש, פיילוט, הצעת מחיר, הערות"}
          </button>
        </div>
        {more && (
          <>
            <Field label="מסלול רכש" className="sm:col-span-2">
              <OptSelect list={PROCUREMENT_ROUTES} value={f.procurement_route} onChange={(v) => setF((p) => ({ ...p, procurement_route: v }))} blank="עוד לא ידוע" />
            </Field>
            <Field label="תחילת פיילוט">
              <input type="date" value={f.pilot_start} onChange={set("pilot_start")} className={inputCls} />
            </Field>
            <Field label="סוף פיילוט">
              <input type="date" value={f.pilot_end} onChange={set("pilot_end")} className={inputCls} />
            </Field>
            <Field label="מספר הצעת מחיר">
              <input value={f.quote_ref} onChange={set("quote_ref")} maxLength={60} className={inputCls} />
            </Field>
            <Field label="מספר הזמנת רכש">
              <input value={f.po_number} onChange={set("po_number")} maxLength={60} className={inputCls} />
            </Field>
            <Field label="מועד תשלום צפוי">
              <input type="date" value={f.expected_payment_date} onChange={set("expected_payment_date")} className={inputCls} />
            </Field>
            <Field label="הערות" className="sm:col-span-2">
              <textarea value={f.notes} onChange={set("notes")} maxLength={2000} rows={3} className={inputCls} />
            </Field>
          </>
        )}

        {error && <div className="text-sm text-red-700 sm:col-span-2">{error}</div>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "שומר..." : "שמירה"}
          </button>
          <button type="button" onClick={onClose} className="text-sm font-bold text-stone-500">
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}
