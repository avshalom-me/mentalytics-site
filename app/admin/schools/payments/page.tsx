"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import HelpTip from "../../components/HelpTip";
import {
  LICENSE_KINDS,
  LICENSE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  SCHEDULE_KINDS,
  labelOf,
  schoolYearOf,
} from "@/app/lib/schools-crm";

// רישיונות ותשלומים של ענף בתי הספר. כאן נולד רישיון (עם קוד גישה ולוח
// תשלומים), מכאן נשלח לבית הספר קישור לדף התשלום, וכאן נרשם כסף שהגיע
// בהעברה, בהמחאה או בהזמנת רכש. חיוב בכרטיס מדף התשלום נרשם לבד ומופיע כאן.
// הצינור (בתי ספר, בעלויות, עסקאות) הוא עמוד נפרד.

type Payment = {
  id: string;
  seq: number;
  amount_gross: number;
  amount_net: number;
  method: string | null;
  due_date: string | null;
  status: string;
  received_at: string | null;
  sumit_document_number: string | null;
  proforma_number: string | null;
  note: string | null;
};
type License = {
  id: string;
  school_id: string;
  kind: string;
  status: string;
  school_year: string;
  start_date: string;
  end_date: string;
  price_gross: number;
  price_net: number;
  schedule_kind: string;
  access_code: string;
  code_disabled: boolean;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  schools: { name: string; symbol: string | null; city: string | null; is_demo: boolean } | null;
  school_payments: Payment[];
};
type School = { id: string; name: string; symbol: string | null; city: string | null; is_demo: boolean; status: string };

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
const hebDate = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().map(Number).join(".") : "");
const shekel = (n: number) => `${Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 })} ש"ח`;
const payUrl = (licenseId: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/school/pay/${licenseId}`;

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/admin-schools/licenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || "שגיאה");
  return j;
}

export default function SchoolPaymentsPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin-schools/licenses", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setLicenses(j.licenses);
      setSchools(j.schools);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const year = schoolYearOf(todayIso()).label;
    let expected = 0;
    let received = 0;
    let overdue = 0;
    const today = todayIso();
    for (const l of licenses) {
      if (l.status === "cancelled") continue;
      for (const p of l.school_payments) {
        if (p.status === "expected") {
          expected += Number(p.amount_gross);
          if (p.due_date && p.due_date < today) overdue += 1;
        }
        if (p.status === "received" && l.school_year === year) received += Number(p.amount_gross);
      }
    }
    return { year, expected, received, overdue };
  }, [licenses]);

  const say = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(""), 4000);
  };

  if (loading) return <div className="p-6 text-sm text-stone-500">טוען...</div>;

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-stone-900">רישיונות ותשלומים</h1>
            <HelpTip id="school-payments" />
          </div>
          <p className="mt-1 text-sm text-stone-500">שנת הלימודים {summary.year}: התקבלו {shekel(summary.received)}. פתוח לגבייה: {shekel(summary.expected)}{summary.overdue ? `, ${summary.overdue} באיחור` : ""}.</p>
        </div>
        <button type="button" onClick={() => setShowNew((v) => !v)} className="rounded-full bg-[#3D8C8A] px-5 py-2 text-sm font-bold text-white hover:bg-[#2A6462]">
          {showNew ? "סגירה" : "רישיון חדש"}
        </button>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {flash && <div className="mb-4 rounded-xl border border-[#C2DFDE] bg-[#EAF4F3] p-3 text-sm text-[#2A6462]">{flash}</div>}

      {showNew && (
        <NewLicenseForm
          schools={schools}
          onCreated={async (l) => {
            setShowNew(false);
            await load();
            say(`הרישיון נוצר. קוד הגישה: ${l.access_code}. ${l.status === "active" ? "פעיל מיד." : "ממתין לתשלום: שולחים לבית הספר את קישור התשלום."}`);
          }}
        />
      )}

      {licenses.length === 0 ? (
        <p className="text-sm text-stone-500">עדיין אין רישיונות. יוצרים את הראשון למעלה.</p>
      ) : (
        <div className="space-y-4">
          {licenses.map((l) => (
            <LicenseCard key={l.id} license={l} onChanged={load} say={say} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewLicenseForm({ schools, onCreated }: { schools: School[]; onCreated: (l: License) => void | Promise<void> }) {
  const [schoolId, setSchoolId] = useState("");
  const [kind, setKind] = useState("annual");
  const [activation, setActivation] = useState(todayIso());
  const [price, setPrice] = useState("");
  const [schedule, setSchedule] = useState("full");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";
  const free = kind === "pilot" || kind === "demo" || kind === "trial";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const j = await post({ action: "create", school_id: schoolId, kind, activation_date: activation, price_gross: free ? 0 : Number(price || 0), schedule_kind: schedule, notes });
      await onCreated(j.license as License);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">בית ספר</span>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} required className={field}>
          <option value="">בוחרים...</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.symbol ? ` (${s.symbol})` : ""}{s.city ? `, ${s.city}` : ""}{s.is_demo ? " [הדגמה]" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">סוג</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
          {LICENSE_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">תאריך הפעלה</span>
        <input type="date" value={activation} onChange={(e) => setActivation(e.target.value)} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">מחיר כולל מע&quot;מ</span>
        <input type="number" min={0} step="0.01" value={free ? "0" : price} disabled={free} onChange={(e) => setPrice(e.target.value)} className={field} placeholder="לפי הסיכום עם בית הספר" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">לוח תשלומים</span>
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)} disabled={free} className={field}>
          {SCHEDULE_KINDS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-bold text-stone-700">הערות</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
      </label>
      {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</div>}
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy || !schoolId} className="rounded-full bg-[#3D8C8A] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
          {busy ? "יוצר..." : "יצירת רישיון וקוד"}
        </button>
        <span className="ms-3 text-xs text-stone-500">רישיון שנתי שמופעל באמצע השנה נרשם כחלקי עד 31 באוגוסט; מאי עד אוגוסט נרשם לשנה הבאה.</span>
      </div>
    </form>
  );
}

function LicenseCard({ license: l, onChanged, say }: { license: License; onChanged: () => Promise<void>; say: (m: string) => void }) {
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const school = l.schools;
  const statusColor =
    l.status === "active" ? "bg-[#EAF4F3] text-[#2A6462]" : l.status === "pending_payment" ? "bg-[#FDF6E3] text-[#A87010]" : "bg-stone-100 text-stone-500";

  async function run(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await post(body);
      await onChanged();
      say(done);
    } catch (e) {
      say(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }
  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(() => say(`${what} הועתק.`)).catch(() => say("לא הצלחנו להעתיק."));
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-stone-900">
            {school?.name ?? "בית ספר"}{school?.symbol ? <span className="ms-2 text-sm font-normal text-stone-500">סמל {school.symbol}</span> : null}
            {school?.is_demo ? <span className="ms-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">הדגמה</span> : null}
          </div>
          <div className="mt-1 text-sm text-stone-600">
            {labelOf(LICENSE_KINDS, l.kind)}, {l.school_year}, {hebDate(l.start_date)} עד {hebDate(l.end_date)}. {shekel(l.price_gross)} כולל מע&quot;מ ({labelOf(SCHEDULE_KINDS, l.schedule_kind)}).
          </div>
          {l.notes && <div className="mt-1 text-xs text-stone-500">{l.notes}</div>}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor}`}>{labelOf(LICENSE_STATUSES, l.status)}{l.code_disabled ? ", קוד מושבת" : ""}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">קוד גישה:</span>
        <HelpTip id="school-access-code" />
        <code dir="ltr" className="rounded bg-stone-100 px-2 py-0.5 font-mono tracking-widest">{showCode ? l.access_code : "••••-••••"}</code>
        <button type="button" onClick={() => setShowCode((v) => !v)} className="text-xs text-[#2A6462] underline">{showCode ? "הסתרה" : "הצגה"}</button>
        <button type="button" onClick={() => copy(l.access_code, "הקוד")} className="text-xs text-[#2A6462] underline">העתקה</button>
        <span className="mx-2 text-stone-300">|</span>
        <button type="button" onClick={() => copy(payUrl(l.id), "קישור התשלום")} className="text-xs text-[#2A6462] underline">העתקת קישור לדף התשלום</button>
        <a href={`/school/pay/${l.id}`} target="_blank" rel="noreferrer" className="text-xs text-stone-500 underline">פתיחה</a>
        {l.status !== "cancelled" && (
          <>
            <span className="mx-2 text-stone-300">|</span>
            <button type="button" disabled={busy} onClick={() => run({ action: "code", license_id: l.id, disabled: !l.code_disabled }, l.code_disabled ? "הקוד הופעל מחדש." : "הקוד הושבת.")} className="text-xs text-stone-600 underline disabled:opacity-50">
              {l.code_disabled ? "הפעלת הקוד מחדש" : "השבתת הקוד"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt("סיבת הביטול:");
                if (reason && reason.trim()) void run({ action: "cancel", license_id: l.id, reason: reason.trim() }, "הרישיון בוטל.");
              }}
              className="text-xs text-red-700 underline disabled:opacity-50"
            >
              ביטול רישיון
            </button>
          </>
        )}
      </div>

      {l.school_payments.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-500">
              <th className="py-1 text-start font-normal">תשלום</th>
              <th className="py-1 text-start font-normal">סכום</th>
              <th className="py-1 text-start font-normal">מועד</th>
              <th className="py-1 text-start font-normal">מצב</th>
              <th className="py-1 text-start font-normal">מסמכים</th>
              <th className="py-1 text-end font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {l.school_payments.map((p) => (
              <tr key={p.id} className="border-t border-stone-100">
                <td className="py-2 font-bold text-stone-800">{p.seq} מתוך {l.school_payments.length}</td>
                <td className="py-2">{shekel(p.amount_gross)}</td>
                <td className="py-2 text-stone-600">{hebDate(p.due_date)}{p.status === "expected" && p.due_date && p.due_date < todayIso() ? <span className="ms-1 text-xs font-bold text-red-700">באיחור</span> : null}</td>
                <td className="py-2">
                  {labelOf(PAYMENT_STATUSES, p.status)}
                  {p.status === "received" ? ` ${hebDate(p.received_at)}, ${labelOf(PAYMENT_METHODS, p.method)}` : ""}
                  {p.note ? <div className="text-xs text-stone-500">{p.note}</div> : null}
                </td>
                <td className="py-2 text-xs text-stone-600">
                  {p.sumit_document_number ? <div>חשבונית {p.sumit_document_number}</div> : null}
                  {p.proforma_number ? <div>דרישת תשלום {p.proforma_number}</div> : null}
                </td>
                <td className="py-2 text-end">
                  {p.status === "expected" && l.status !== "cancelled" && (
                    <button type="button" onClick={() => setMarking(marking === p.id ? null : p.id)} className="rounded-full border border-[#3D8C8A] px-3 py-1 text-xs font-bold text-[#2A6462]">
                      {marking === p.id ? "סגירה" : "התקבל"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {marking && (
        <MarkReceivedForm
          paymentId={marking}
          onDone={async () => {
            setMarking(null);
            await onChanged();
            say("התשלום נרשם.");
          }}
        />
      )}
    </div>
  );
}

function MarkReceivedForm({ paymentId, onDone }: { paymentId: string; onDone: () => Promise<void> }) {
  const [method, setMethod] = useState("transfer");
  const [day, setDay] = useState(todayIso());
  const [docNo, setDocNo] = useState("");
  const [proforma, setProforma] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post({ action: "mark_received", payment_id: paymentId, method, received_on: day, sumit_document_number: docNo, proforma_number: proforma, note });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-stone-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs">
        <span className="mb-1 block font-bold text-stone-700">איך</span>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
          {PAYMENT_METHODS.filter((o) => o.value !== "card").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-bold text-stone-700">תאריך קבלה</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-bold text-stone-700">מספר חשבונית ב-Sumit</span>
        <input value={docNo} onChange={(e) => setDocNo(e.target.value)} className={field} placeholder="אחרי שהונפקה" />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-bold text-stone-700">דרישת תשלום / הזמנת רכש</span>
        <input value={proforma} onChange={(e) => setProforma(e.target.value)} className={field} />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-bold text-stone-700">הערה</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={field} />
      </label>
      {error && <div className="text-xs text-red-700 sm:col-span-2 lg:col-span-5">{error}</div>}
      <div className="sm:col-span-2 lg:col-span-5">
        <button type="submit" disabled={busy} className="rounded-full bg-[#3D8C8A] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy ? "רושם..." : "רישום התשלום"}</button>
        <span className="ms-3 text-xs text-stone-500">התשלום הראשון מפעיל את הרישיון; את קוד הגישה שולחים לבית הספר ביד.</span>
      </div>
    </form>
  );
}
