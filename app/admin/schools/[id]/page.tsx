"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ACTIVITY_KINDS,
  CONTACT_ROLES,
  DEAL_PRODUCTS,
  DEAL_SOURCES,
  LICENSE_KINDS,
  LICENSE_STATUSES,
  SCHOOL_STAGES,
  SCHOOL_STATUSES,
  SECTORS,
  labelOf,
  type Opt,
} from "@/app/lib/schools-crm";
import {
  DealForm,
  Field,
  Notice,
  OptSelect,
  REGION_OPTIONS,
  STATUS_PILL,
  StageMover,
  btnGhost,
  btnPrimary,
  cardCls,
  errText,
  getJson,
  useSchoolsBase,
  DeleteButton,
  hebDate,
  hebStamp,
  inputCls,
  nowLocalInput,
  regionLabel,
  sendJson,
  shekel,
  todayIso,
  type DealRow,
} from "../shared";

// עמוד בית ספר: הפרטים, אנשי הקשר, העסקאות, הרישיונות (לקריאה; הניהול ב"רישיונות
// ותשלומים"), ההדרכות, משימות והערות, וציר הזמן עם רישום מהיר. משימות והערות
// נשמרות ב-crm_tasks / crm_notes הקיימות עם entity_type "school".

type Owner = { id: string; name: string };
type School = {
  id: string;
  name: string;
  symbol: string | null;
  stage: string;
  sector: string | null;
  owner_id: string | null;
  city: string | null;
  region_key: string | null;
  students: number | null;
  counselors: number | null;
  status: string;
  is_demo: boolean;
  notes: string | null;
  school_owners: { name: string } | null;
};
type Contact = {
  id: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  is_primary: boolean;
  active: boolean;
  left_at: string | null;
  notes: string | null;
};
type Payment = { id: string; seq: number; status: string };
type License = {
  id: string;
  kind: string;
  status: string;
  school_year: string;
  start_date: string;
  end_date: string;
  price_gross: number;
  code_disabled: boolean;
  school_payments: Payment[] | null;
};
type Training = {
  id: string;
  held_on: string;
  hours: number;
  trainer: string | null;
  participants: number | null;
  topic: string | null;
  billable: boolean;
  amount_gross: number | null;
  notes: string | null;
};
type Activity = { id: string; entity_type: string; entity_id: string; kind: string; summary: string; actor: string; happened_at: string };
type Detail = { school: School; contacts: Contact[]; deals: DealRow[]; licenses: License[]; trainings: Training[]; timeline: Activity[]; owners: Owner[] };

const SAY_MS = 4000;
const LOGGABLE_KINDS = ACTIVITY_KINDS.filter((o) => o.value !== "system");

/** אזור שכבר נשמר ואינו ברשימה (טקסט חופשי שיובא) נשאר בחירה אפשרית. */
function regionOptions(current: string): Opt[] {
  return current && !REGION_OPTIONS.some((o) => o.value === current) ? [...REGION_OPTIONS, { value: current, label: current }] : REGION_OPTIONS;
}

export default function SchoolDetailPage() {
  const base = useSchoolsBase();
  const params = useParams<{ id: string }>();
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await getJson<Detail>(`/api/admin-schools/schools?id=${encodeURIComponent(id)}`);
      setD(j);
      setError("");
    } catch (e) {
      setError(errText(e));
    }
  }, [id]);
  // הטעינה הראשונה (ובמעבר בין בתי ספר); load לבדו משמש לרענון אחרי שמירה.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await getJson<Detail>(`/api/admin-schools/schools?id=${encodeURIComponent(id)}`);
        if (cancelled) return;
        setD(j);
        setError("");
      } catch (e) {
        if (!cancelled) setError(errText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), SAY_MS);
  }, []);

  if (!d) {
    return (
      <div className="p-6" dir="rtl">
        <Link href={base} className="text-sm font-bold text-[#2A6462] underline">
          כל בתי הספר
        </Link>
        <div className="mt-4">{error ? <Notice error={error} /> : <span className="text-sm text-stone-500">טוען...</span>}</div>
      </div>
    );
  }

  const { school } = d;
  return (
    <div className="mx-auto max-w-5xl p-6" dir="rtl">
      <Link href={base} className="text-sm font-bold text-[#2A6462] underline">
        כל בתי הספר
      </Link>
      <div className="mb-5 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-stone-900">{school.name}</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_PILL[school.status] ?? STATUS_PILL.prospect}`}>{labelOf(SCHOOL_STATUSES, school.status)}</span>
        {school.is_demo ? <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-500">בית ספר הדגמה</span> : null}
        <span className="text-sm text-stone-500">{[school.symbol ? `סמל ${school.symbol}` : "", school.city, school.school_owners?.name].filter(Boolean).join(" | ")}</span>
      </div>
      <Notice error={error} flash={flash} />

      <div className="space-y-5">
        <DetailsSection school={school} owners={d.owners} reload={load} say={say} />
        <ContactsSection schoolId={school.id} contacts={d.contacts} reload={load} say={say} />
        <DealsSection school={school} deals={d.deals} reload={load} say={say} />
        <LicensesSection licenses={d.licenses} />
        <TrainingsSection schoolId={school.id} trainings={d.trainings} reload={load} say={say} />
        <div className="grid gap-5 lg:grid-cols-2">
          <TasksSection schoolId={school.id} schoolName={school.name} say={say} />
          <NotesSection schoolId={school.id} />
        </div>
        <TimelineSection schoolId={school.id} timeline={d.timeline} deals={d.deals} licenses={d.licenses} reload={load} say={say} />
      </div>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-black text-stone-900">{children}</h2>
      {action}
    </div>
  );
}

// ── פרטים ─────────────────────────────────────────────────────────────────────
function DetailsSection({ school, owners, reload, say }: { school: School; owners: Owner[]; reload: () => Promise<void>; say: (m: string) => void }) {
  const listHref = useSchoolsBase();
  const [f, setF] = useState(() => ({
    name: school.name,
    symbol: school.symbol ?? "",
    stage: school.stage,
    sector: school.sector ?? "",
    status: school.status,
    owner_id: school.owner_id ?? "",
    city: school.city ?? "",
    region_key: school.region_key ?? "",
    students: school.students != null ? String(school.students) : "",
    counselors: school.counselors != null ? String(school.counselors) : "",
    notes: school.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-schools/schools", { action: "save_school", id: school.id, ...f });
      await reload();
      say("הפרטים נשמרו.");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <SectionTitle>פרטים</SectionTitle>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="שם">
          <input value={f.name} onChange={set("name")} required maxLength={200} className={inputCls} />
        </Field>
        <Field label="סמל מוסד">
          <input value={f.symbol} onChange={set("symbol")} maxLength={20} dir="ltr" className={`${inputCls} text-end`} />
        </Field>
        <Field label="סטטוס">
          <OptSelect list={SCHOOL_STATUSES} value={f.status} onChange={(v) => setF((p) => ({ ...p, status: v }))} />
        </Field>
        <Field label="שלב חינוך">
          <OptSelect list={SCHOOL_STAGES} value={f.stage} onChange={(v) => setF((p) => ({ ...p, stage: v }))} />
        </Field>
        <Field label="מגזר">
          <OptSelect list={SECTORS} value={f.sector} onChange={(v) => setF((p) => ({ ...p, sector: v }))} blank="לא צוין" />
        </Field>
        <Field label="בעלות">
          <select value={f.owner_id} onChange={set("owner_id")} className={inputCls}>
            <option value="">ללא בעלות</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="עיר">
          <input value={f.city} onChange={set("city")} maxLength={80} className={inputCls} />
        </Field>
        <Field label="אזור">
          <OptSelect list={regionOptions(f.region_key)} value={f.region_key} onChange={(v) => setF((p) => ({ ...p, region_key: v }))} blank="לא צוין" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="תלמידים">
            <input type="number" min={0} value={f.students} onChange={set("students")} className={inputCls} />
          </Field>
          <Field label="יועצות">
            <input type="number" min={0} value={f.counselors} onChange={set("counselors")} className={inputCls} />
          </Field>
        </div>
        <Field label="הערות" className="sm:col-span-2 lg:col-span-3">
          <textarea value={f.notes} onChange={set("notes")} maxLength={4000} rows={2} className={inputCls} />
        </Field>
        {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</div>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={busy || !f.name.trim()} className={btnPrimary}>
            {busy ? "שומר..." : "שמירת פרטים"}
          </button>
          {regionLabel(school.region_key) ? <span className="text-xs text-stone-500">אזור: {regionLabel(school.region_key)}</span> : null}
          {school.is_demo ? <span className="text-xs text-stone-500">בית ספר הדגמה אינו נספר בשום סטטיסטיקה ובשערי ההסכם.</span> : null}
          {!school.is_demo && (
            <span className="ms-auto">
              <DeleteButton
                url="/api/admin-schools/schools"
                body={{ action: "delete_school", id: school.id }}
                label="מחיקת בית הספר"
                confirmText={`למחוק את "${school.name}" עם אנשי הקשר, העסקאות, הרישיונות וההדרכות שלו? אי אפשר לבטל. בית ספר ששולם בו תשלום לא נמחק.`}
                onDone={() => {
                  window.location.href = listHref;
                }}
                onError={setError}
              />
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

// ── אנשי קשר ──────────────────────────────────────────────────────────────────
function ContactsSection({ schoolId, contacts, reload, say }: { schoolId: string; contacts: Contact[]; reload: () => Promise<void>; say: (m: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null); // מזהה, או "new"
  const done = async (msg: string) => {
    setEditing(null);
    await reload();
    say(msg);
  };

  return (
    <section className={cardCls}>
      <SectionTitle
        action={
          <button type="button" onClick={() => setEditing(editing === "new" ? null : "new")} className={btnGhost}>
            {editing === "new" ? "סגירה" : "איש קשר חדש"}
          </button>
        }
      >
        אנשי קשר
      </SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-stone-500">אנשי צוות בלבד (יועצת, מנהלת, גזבר). לא שומרים כאן מידע על תלמידים או הורים.</p>
      {editing === "new" && <ContactForm schoolId={schoolId} contact={null} onSaved={() => done("איש הקשר נוסף.")} onCancel={() => setEditing(null)} />}
      {contacts.length === 0 && editing !== "new" ? <p className="text-sm text-stone-500">עדיין אין אנשי קשר.</p> : null}
      <div className="space-y-2">
        {contacts.map((c) =>
          editing === c.id ? (
            <ContactForm key={c.id} schoolId={schoolId} contact={c} onSaved={() => done("איש הקשר נשמר.")} onCancel={() => setEditing(null)} />
          ) : (
            <div key={c.id} className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border border-stone-100 p-3 ${c.active ? "" : "opacity-60"}`}>
              <div className="text-sm">
                <div className="font-bold text-stone-900">
                  {c.name}
                  <span className="ms-2 text-xs font-normal text-stone-500">{labelOf(CONTACT_ROLES, c.role)}</span>
                  {c.is_primary ? <span className="ms-2 rounded-full bg-[#EAF4F3] px-2 py-0.5 text-xs font-bold text-[#2A6462]">ראשי</span> : null}
                  {!c.active ? <span className="ms-2 text-xs font-normal text-stone-500">עזב/ה{c.left_at ? ` ב-${hebDate(c.left_at)}` : ""}</span> : null}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-stone-600">
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} dir="ltr" className="text-[#2A6462]">
                      {c.phone}
                    </a>
                  ) : null}
                  {c.whatsapp ? <span dir="ltr">וואטסאפ {c.whatsapp}</span> : null}
                  {c.email ? (
                    <a href={`mailto:${c.email}`} dir="ltr" className="text-[#2A6462]">
                      {c.email}
                    </a>
                  ) : null}
                </div>
                {c.notes ? <div className="mt-1 text-xs text-stone-500">{c.notes}</div> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(c.id)} className={btnGhost}>
                  עריכה
                </button>
                <DeleteButton
                  url="/api/admin-schools/schools"
                  body={{ action: "delete_contact", id: c.id }}
                  confirmText={`למחוק את ${c.name}? (מי שעזב/ה אפשר גם לסמן "לא בתפקיד" ולשמור לתיעוד.)`}
                  onDone={() => done("איש הקשר נמחק.")}
                  onError={say}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function ContactForm({ schoolId, contact, onSaved, onCancel }: { schoolId: string; contact: Contact | null; onSaved: () => void | Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({
    name: contact?.name ?? "",
    role: contact?.role ?? "counselor",
    phone: contact?.phone ?? "",
    whatsapp: contact?.whatsapp ?? "",
    email: contact?.email ?? "",
    notes: contact?.notes ?? "",
  });
  const [primary, setPrimary] = useState(contact?.is_primary ?? false);
  const [active, setActive] = useState(contact?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-schools/schools", {
        action: "save_contact",
        ...(contact ? { id: contact.id } : { school_id: schoolId }),
        ...f,
        is_primary: primary,
        active,
      });
      await onSaved();
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="שם">
        <input value={f.name} onChange={set("name")} required maxLength={120} className={inputCls} />
      </Field>
      <Field label="תפקיד">
        <OptSelect list={CONTACT_ROLES} value={f.role} onChange={(v) => setF((p) => ({ ...p, role: v }))} />
      </Field>
      <Field label="טלפון">
        <input value={f.phone} onChange={set("phone")} maxLength={40} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <Field label="וואטסאפ">
        <input value={f.whatsapp} onChange={set("whatsapp")} maxLength={40} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <Field label="מייל">
        <input type="email" value={f.email} onChange={set("email")} maxLength={200} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <Field label="הערות">
        <input value={f.notes} onChange={set("notes")} maxLength={1000} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-4 text-sm text-stone-700 sm:col-span-2 lg:col-span-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
          איש קשר ראשי
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          עדיין בתפקיד
        </label>
      </div>
      {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</div>}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy || !f.name.trim()} className={btnPrimary}>
          {busy ? "שומר..." : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-stone-500">
          ביטול
        </button>
      </div>
    </form>
  );
}

// ── עסקאות ────────────────────────────────────────────────────────────────────
function DealsSection({ school, deals, reload, say }: { school: School; deals: DealRow[]; reload: () => Promise<void>; say: (m: string) => void }) {
  const [form, setForm] = useState<{ deal: DealRow | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const today = todayIso();

  async function move(deal: DealRow, stage: string, lostReason?: string) {
    setBusy(deal.id);
    setError("");
    try {
      await sendJson("/api/admin-schools/deals", { action: "save", id: deal.id, stage, ...(stage === "lost" ? { lost_reason: lostReason } : {}) });
      await reload();
      say("שלב העסקה עודכן.");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={cardCls}>
      <SectionTitle
        action={
          <button type="button" onClick={() => setForm({ deal: null })} className={btnGhost}>
            עסקה חדשה
          </button>
        }
      >
        עסקאות
      </SectionTitle>
      <Notice error={error} />
      {deals.length === 0 ? <p className="text-sm text-stone-500">עדיין אין עסקאות מול בית הספר.</p> : null}
      <div className="space-y-2">
        {deals.map((x) => {
          const overdue = Boolean(x.next_step_due && x.next_step_due < today);
          return (
            <div key={x.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-stone-100 p-3">
              <div className="min-w-0 flex-1 text-sm">
                <div className="font-bold text-stone-900">
                  {x.title || labelOf(DEAL_PRODUCTS, x.product)}
                  {x.school_year ? <span className="ms-2 text-xs font-normal text-stone-500">{x.school_year}</span> : null}
                  {x.value_gross != null ? <span className="ms-2 text-xs font-bold text-[#2A6462]">{shekel(x.value_gross)}</span> : null}
                </div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {[labelOf(DEAL_PRODUCTS, x.product), x.source ? `מקור: ${labelOf(DEAL_SOURCES, x.source)}` : "", x.handler ? `מטפל: ${x.handler}` : ""].filter(Boolean).join(" | ")}
                </div>
                {x.next_step ? (
                  <div className={`mt-1 text-xs ${overdue ? "font-bold text-red-600" : "text-stone-600"}`}>
                    הצעד הבא: {x.next_step}
                    {x.next_step_due ? ` (${hebDate(x.next_step_due)})` : ""}
                  </div>
                ) : null}
              </div>
              <div className="flex w-44 shrink-0 flex-col gap-1.5">
                <StageMover stage={x.stage} label={`שלב העסקה: ${x.title || labelOf(DEAL_PRODUCTS, x.product)}`} busy={busy === x.id} onMove={(stage, reason) => move(x, stage, reason)} />
                <button type="button" onClick={() => setForm({ deal: x })} className={btnGhost}>
                  עריכת עסקה
                </button>
                <DeleteButton
                  url="/api/admin-schools/deals"
                  body={{ action: "delete", id: x.id }}
                  label="מחיקת עסקה"
                  confirmText="למחוק את העסקה, עם המשימות וההערות שלה? אי אפשר לבטל."
                  onDone={async () => {
                    await reload();
                    say("העסקה נמחקה.");
                  }}
                  onError={setError}
                />
              </div>
            </div>
          );
        })}
      </div>
      {form && (
        <DealForm
          key={form.deal?.id ?? "new"}
          deal={form.deal}
          school={{ id: school.id, name: school.name, symbol: school.symbol, city: school.city, is_demo: school.is_demo }}
          schoolName={school.name}
          onClose={() => setForm(null)}
          onSaved={async () => {
            setForm(null);
            await reload();
            say("העסקה נשמרה.");
          }}
        />
      )}
    </section>
  );
}

// ── רישיונות (לקריאה) ────────────────────────────────────────────────────────
function LicensesSection({ licenses }: { licenses: License[] }) {
  const paymentsBase = useSchoolsBase();
  return (
    <section className={cardCls}>
      <SectionTitle
        action={
          <Link href={`${paymentsBase}/payments`} className="text-xs font-bold text-[#2A6462] underline">
            ניהול רישיונות ותשלומים
          </Link>
        }
      >
        רישיונות
      </SectionTitle>
      {licenses.length === 0 ? <p className="text-sm text-stone-500">עדיין אין רישיונות. יוצרים רישיון במסך &quot;רישיונות ותשלומים&quot;.</p> : null}
      <div className="space-y-2">
        {licenses.map((l) => {
          const payments = l.school_payments ?? [];
          const received = payments.filter((p) => p.status === "received").length;
          const pill = l.status === "active" ? "bg-[#EAF4F3] text-[#2A6462]" : l.status === "pending_payment" ? "bg-[#FDF6E3] text-[#A87010]" : "bg-stone-100 text-stone-500";
          return (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 p-3 text-sm">
              <div>
                <div className="font-bold text-stone-900">
                  {labelOf(LICENSE_KINDS, l.kind)}, {l.school_year}
                </div>
                <div className="text-xs text-stone-500">
                  {hebDate(l.start_date)} עד {hebDate(l.end_date)}. {shekel(l.price_gross)} כולל מע&quot;מ
                  {payments.length > 0 ? `. תשלומים שהתקבלו: ${received} מתוך ${payments.length}` : ""}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${pill}`}>
                {labelOf(LICENSE_STATUSES, l.status)}
                {l.code_disabled ? ", קוד מושבת" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── הדרכות ────────────────────────────────────────────────────────────────────
function TrainingsSection({ schoolId, trainings, reload, say }: { schoolId: string; trainings: Training[]; reload: () => Promise<void>; say: (m: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const done = async (msg: string) => {
    setEditing(null);
    await reload();
    say(msg);
  };
  return (
    <section className={cardCls}>
      <SectionTitle
        action={
          <button type="button" onClick={() => setEditing(editing === "new" ? null : "new")} className={btnGhost}>
            {editing === "new" ? "סגירה" : "הדרכה חדשה"}
          </button>
        }
      >
        הדרכות
      </SectionTitle>
      {editing === "new" && <TrainingForm schoolId={schoolId} training={null} onSaved={() => done("ההדרכה נרשמה.")} onCancel={() => setEditing(null)} />}
      {trainings.length === 0 && editing !== "new" ? <p className="text-sm text-stone-500">עדיין לא נרשמו הדרכות.</p> : null}
      <div className="space-y-2">
        {trainings.map((t) =>
          editing === t.id ? (
            <TrainingForm key={t.id} schoolId={schoolId} training={t} onSaved={() => done("ההדרכה נשמרה.")} onCancel={() => setEditing(null)} />
          ) : (
            <div key={t.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-stone-100 p-3 text-sm">
              <div>
                <div className="font-bold text-stone-900">
                  {hebDate(t.held_on)}
                  <span className="ms-2 text-xs font-normal text-stone-500">
                    {Number(t.hours)} שעות{t.participants != null ? `, ${t.participants} משתתפים` : ""}
                    {t.trainer ? `, מדריך/ה: ${t.trainer}` : ""}
                  </span>
                </div>
                {t.topic ? <div className="text-xs text-stone-600">{t.topic}</div> : null}
                <div className="text-xs text-stone-500">{t.billable ? `בתשלום${t.amount_gross != null ? `: ${shekel(t.amount_gross)} כולל מע"מ` : ""}` : "רכיב ההדרכה ברישיון, ללא חיוב נפרד"}</div>
                {t.notes ? <div className="text-xs text-stone-500">{t.notes}</div> : null}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(t.id)} className={btnGhost}>
                  עריכה
                </button>
                <DeleteButton
                  url="/api/admin-schools/schools"
                  body={{ action: "delete_training", id: t.id }}
                  confirmText="למחוק את ההדרכה?"
                  onDone={() => done("ההדרכה נמחקה.")}
                  onError={say}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function TrainingForm({ schoolId, training, onSaved, onCancel }: { schoolId: string; training: Training | null; onSaved: () => void | Promise<void>; onCancel: () => void }) {
  const [f, setF] = useState({
    held_on: training?.held_on ?? todayIso(),
    hours: training ? String(training.hours) : "1",
    trainer: training?.trainer ?? "",
    participants: training?.participants != null ? String(training.participants) : "",
    topic: training?.topic ?? "",
    amount_gross: training?.amount_gross != null ? String(training.amount_gross) : "",
    notes: training?.notes ?? "",
  });
  const [billable, setBillable] = useState(training?.billable ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-schools/schools", {
        action: "save_training",
        ...(training ? { id: training.id } : { school_id: schoolId }),
        ...f,
        billable,
      });
      await onSaved();
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-3 grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="תאריך">
        <input type="date" value={f.held_on} onChange={set("held_on")} required className={inputCls} />
      </Field>
      <Field label="שעות">
        <input type="number" min={0.25} step="0.25" value={f.hours} onChange={set("hours")} required className={inputCls} />
      </Field>
      <Field label="מדריך/ה">
        <input value={f.trainer} onChange={set("trainer")} maxLength={120} className={inputCls} />
      </Field>
      <Field label="משתתפים">
        <input type="number" min={0} value={f.participants} onChange={set("participants")} className={inputCls} />
      </Field>
      <Field label="נושא" className="sm:col-span-2">
        <input value={f.topic} onChange={set("topic")} maxLength={300} className={inputCls} />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
          הדרכה בתשלום נפרד
        </label>
        {billable && (
          <Field label={`סכום כולל מע"מ`} className="flex-1">
            <input type="number" min={0} step="0.01" value={f.amount_gross} onChange={set("amount_gross")} className={inputCls} />
          </Field>
        )}
      </div>
      <Field label="הערות" className="sm:col-span-2 lg:col-span-4">
        <input value={f.notes} onChange={set("notes")} maxLength={1000} className={inputCls} />
      </Field>
      {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{error}</div>}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "שומר..." : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-stone-500">
          ביטול
        </button>
      </div>
    </form>
  );
}

// ── משימות (crm_tasks, entity_type "school") ─────────────────────────────────
type Task = { id: string; title: string; due_date: string | null; assignee: string | null; priority: string; status: string };

function TasksSection({ schoolId, schoolName, say }: { schoolId: string; schoolName: string; say: (m: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = todayIso();

  const loadTasks = useCallback(async () => {
    try {
      const j = await getJson<{ tasks: Task[] }>(`/api/admin-crm/tasks?status=active&entity_type=school&entity_id=${encodeURIComponent(schoolId)}`);
      setTasks(j.tasks);
    } catch (e) {
      setError(errText(e));
    }
  }, [schoolId]);
  useEffect(() => {
    void loadTasks();
    getJson<{ assignees: string[] }>("/api/admin-schools/assignees")
      .then((j) => setAssignees(j.assignees))
      .catch(() => setAssignees([]));
  }, [loadTasks]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-crm/tasks", {
        title: title.trim(),
        due_date: due || null,
        assignee: assignee || null,
        entity_type: "school",
        entity_id: schoolId,
        entity_label: schoolName,
        created_by: "admin",
      });
      setTitle("");
      setDue("");
      await loadTasks();
      say("המשימה נוספה.");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(t: Task) {
    setError("");
    try {
      await sendJson("/api/admin-crm/tasks", { id: t.id, status: "done" }, "PATCH");
      await loadTasks();
      say("המשימה סומנה כבוצעה.");
    } catch (err) {
      setError(errText(err));
    }
  }

  return (
    <section className={cardCls}>
      <SectionTitle>משימות</SectionTitle>
      <form onSubmit={add} className="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="משימה חדשה" className={`${inputCls} sm:col-span-2`} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="מועד" className={inputCls} />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="אחראי" className={inputCls}>
          <option value="">ללא אחראי</option>
          {assignees.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy || !title.trim()} className={btnPrimary}>
            הוספה
          </button>
        </div>
      </form>
      <Notice error={error} />
      {tasks.length === 0 ? <p className="text-sm text-stone-500">אין משימות פתוחות לבית הספר.</p> : null}
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start justify-between gap-2 rounded-xl border border-stone-100 p-2.5 text-sm">
            <div>
              <div className="font-bold text-stone-900">{t.title}</div>
              <div className="text-xs text-stone-500">
                {t.due_date ? <span className={t.due_date < today ? "font-bold text-red-600" : ""}>{hebDate(t.due_date)}</span> : "בלי תאריך"}
                {t.assignee ? `, ${t.assignee}` : ""}
              </div>
            </div>
            <button type="button" onClick={() => finish(t)} className={btnGhost}>
              בוצע
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── הערות (crm_notes, entity_type "school") ──────────────────────────────────
type Note = { id: string; body: string; author: string; pinned: boolean; created_at: string };

function NotesSection({ schoolId }: { schoolId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadNotes = useCallback(async () => {
    try {
      const j = await getJson<{ notes: Note[] }>(`/api/admin-crm/notes?entity_type=school&entity_id=${encodeURIComponent(schoolId)}`);
      setNotes(j.notes);
    } catch (e) {
      setError(errText(e));
    }
  }, [schoolId]);
  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-crm/notes", { entity_type: "school", entity_id: schoolId, body: body.trim(), author: "admin" });
      setBody("");
      await loadNotes();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <SectionTitle>הערות</SectionTitle>
      <form onSubmit={add} className="mb-3 space-y-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={2} placeholder="הערה פנימית חדשה" className={inputCls} />
        <button type="submit" disabled={busy || !body.trim()} className={btnPrimary}>
          הוספה
        </button>
      </form>
      <Notice error={error} />
      {notes.length === 0 ? <p className="text-sm text-stone-500">אין הערות.</p> : null}
      <div className="max-h-80 space-y-1.5 overflow-y-auto">
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-stone-100 p-2.5 text-sm">
            <div className="text-xs text-stone-400">{hebStamp(n.created_at, true)}</div>
            <div className="whitespace-pre-line text-stone-800">{n.body}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── ציר זמן ורישום מהיר ──────────────────────────────────────────────────────
function TimelineSection({
  schoolId,
  timeline,
  deals,
  licenses,
  reload,
  say,
}: {
  schoolId: string;
  timeline: Activity[];
  deals: DealRow[];
  licenses: License[];
  reload: () => Promise<void>;
  say: (m: string) => void;
}) {
  const [kind, setKind] = useState("call");
  const [summary, setSummary] = useState("");
  const [when, setWhen] = useState(() => nowLocalInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scope = (a: Activity): string => {
    if (a.entity_type === "school_deal") {
      const x = deals.find((dl) => dl.id === a.entity_id);
      return x ? `עסקה: ${x.title || labelOf(DEAL_PRODUCTS, x.product)}` : "עסקה";
    }
    if (a.entity_type === "school_license") {
      const l = licenses.find((li) => li.id === a.entity_id);
      return l ? `רישיון: ${labelOf(LICENSE_KINDS, l.kind)} ${l.school_year}` : "רישיון";
    }
    return "";
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parsed = when ? new Date(when) : null;
      await sendJson("/api/admin-schools/schools", {
        action: "log_activity",
        entity_type: "school",
        entity_id: schoolId,
        kind,
        summary,
        ...(parsed && !Number.isNaN(parsed.getTime()) ? { happened_at: parsed.toISOString() } : {}),
      });
      setSummary("");
      setWhen(nowLocalInput());
      await reload();
      say("הפעילות נרשמה.");
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={cardCls}>
      <SectionTitle>ציר זמן</SectionTitle>
      <form onSubmit={add} className="mb-4 grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="סוג">
          <OptSelect list={LOGGABLE_KINDS} value={kind} onChange={setKind} />
        </Field>
        <Field label="מתי">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
        </Field>
        <Field label="מה קרה" className="sm:col-span-2">
          <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} required className={inputCls} placeholder="למשל: שוחחתי עם היועצת, ביקשה הצעת מחיר" />
        </Field>
        {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{error}</div>}
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" disabled={busy || !summary.trim()} className={btnPrimary}>
            {busy ? "רושם..." : "רישום מהיר"}
          </button>
        </div>
      </form>
      {timeline.length === 0 ? <p className="text-sm text-stone-500">עדיין אין פעילות.</p> : null}
      <ol className="space-y-2">
        {timeline.map((a) => (
          <li key={a.id} className="flex gap-3 border-b border-stone-100 pb-2 text-sm last:border-b-0">
            <div className="w-32 shrink-0 text-xs text-stone-500">{hebStamp(a.happened_at, true)}</div>
            <div className="min-w-0 flex-1">
              <div>
                <span className="me-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-600">{labelOf(ACTIVITY_KINDS, a.kind)}</span>
                {scope(a) ? <span className="me-2 text-xs text-stone-500">{scope(a)}</span> : null}
              </div>
              <div className="mt-0.5 whitespace-pre-line text-stone-800">{a.summary}</div>
              <div className="text-xs text-stone-400">{a.actor}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
