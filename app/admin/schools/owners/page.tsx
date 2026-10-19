"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { OWNER_KINDS, SUPPLIER_STATUSES, labelOf } from "@/app/lib/schools-crm";
import {
  Field,
  Notice,
  OptSelect,
  REGION_OPTIONS,
  btnGhost,
  btnPrimary,
  errText,
  getJson,
  inputCls,
  regionLabel,
  sendJson,
} from "../shared";

// בעלויות: מי שמשלם בפועל על בתי הספר (רשות מקומית, רשת, בעלות פרטית) ומה
// מצבנו מולה כספק. אנשי הקשר של בית ספר נשמרים בעמוד בית הספר; לטבלת
// הבעלויות עצמה אין שדות קשר.

type Owner = {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  region_key: string | null;
  payment_terms_days: number | null;
  supplier_status: string;
  supplier_notes: string | null;
  notes: string | null;
  schools_count: number;
};

const SUPPLIER_PILL: Record<string, string> = {
  none: "bg-stone-100 text-stone-500",
  forms_sent: "bg-[#FDF6E3] text-[#A87010]",
  approved: "bg-[#EAF4F3] text-[#2A6462]",
};

export default function SchoolOwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = await getJson<{ owners: Owner[] }>("/api/admin-schools/schools?owners=1");
      setOwners(j.owners);
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

  const summary = useMemo(() => {
    const approved = owners.filter((o) => o.supplier_status === "approved").length;
    const sent = owners.filter((o) => o.supplier_status === "forms_sent").length;
    return `${owners.length} בעלויות. ספק מאושר אצל ${approved}, נשלחה חבילת ספק ל-${sent}.`;
  }, [owners]);

  if (loading) return <div className="p-6 text-sm text-stone-500">טוען...</div>;

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">בעלויות</h1>
          <p className="mt-1 text-sm text-stone-500">{summary}</p>
        </div>
        <button type="button" onClick={() => setShowNew((v) => !v)} className={btnPrimary}>
          {showNew ? "סגירה" : "בעלות חדשה"}
        </button>
      </div>
      <Notice error={error} flash={flash} />

      {showNew && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
          <OwnerForm
            owner={null}
            onSaved={async () => {
              setShowNew(false);
              await load();
              say("הבעלות נוספה.");
            }}
            onCancel={() => setShowNew(false)}
          />
        </div>
      )}

      {owners.length === 0 ? (
        <p className="text-sm text-stone-500">עדיין אין בעלויות. מוסיפים רשות או רשת כשיש בית ספר שמשלם דרכה.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-xs text-stone-500">
                <th className="px-3 py-2 text-start font-normal">שם</th>
                <th className="px-3 py-2 text-start font-normal">סוג</th>
                <th className="px-3 py-2 text-start font-normal">מקום</th>
                <th className="px-3 py-2 text-start font-normal">מצב כספק</th>
                <th className="px-3 py-2 text-start font-normal">תנאי תשלום</th>
                <th className="px-3 py-2 text-start font-normal">בתי ספר</th>
                <th className="px-3 py-2 text-end font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <Fragment key={o.id}>
                  <tr className="border-t border-stone-100 align-top">
                    <td className="px-3 py-2">
                      <div className="font-bold text-stone-900">{o.name}</div>
                      {o.notes ? <div className="mt-0.5 max-w-xs truncate text-xs text-stone-500">{o.notes}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{labelOf(OWNER_KINDS, o.kind)}</td>
                    <td className="px-3 py-2 text-stone-600">{[o.city, regionLabel(o.region_key)].filter(Boolean).join(", ")}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SUPPLIER_PILL[o.supplier_status] ?? SUPPLIER_PILL.none}`}>{labelOf(SUPPLIER_STATUSES, o.supplier_status)}</span>
                      {o.supplier_notes ? <div className="mt-1 max-w-xs text-xs text-stone-500">{o.supplier_notes}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{o.payment_terms_days != null ? `${o.payment_terms_days} ימים` : "עוד לא ידוע"}</td>
                    <td className="px-3 py-2">
                      {o.schools_count > 0 ? (
                        <Link href={`/admin/schools?owner=${o.id}`} className="font-bold text-[#2A6462] underline">
                          {o.schools_count}
                        </Link>
                      ) : (
                        <span className="text-stone-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <button type="button" onClick={() => setEditing(editing === o.id ? null : o.id)} className={btnGhost}>
                        {editing === o.id ? "סגירה" : "עריכה"}
                      </button>
                    </td>
                  </tr>
                  {editing === o.id && (
                    <tr className="bg-stone-50">
                      <td colSpan={7} className="px-3 py-3">
                        <OwnerForm
                          owner={o}
                          onSaved={async () => {
                            setEditing(null);
                            await load();
                            say("הבעלות נשמרה.");
                          }}
                          onCancel={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OwnerForm({ owner, onSaved, onCancel }: { owner: Owner | null; onSaved: () => void | Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(owner?.name ?? "");
  const [kind, setKind] = useState(owner?.kind ?? "authority");
  const [city, setCity] = useState(owner?.city ?? "");
  const [region, setRegion] = useState(owner?.region_key ?? "");
  const [terms, setTerms] = useState(owner?.payment_terms_days != null ? String(owner.payment_terms_days) : "");
  const [supplier, setSupplier] = useState(owner?.supplier_status ?? "none");
  const [supplierNotes, setSupplierNotes] = useState(owner?.supplier_notes ?? "");
  const [notes, setNotes] = useState(owner?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendJson("/api/admin-schools/schools", {
        action: "save_owner",
        ...(owner ? { id: owner.id } : {}),
        name,
        kind,
        city,
        region_key: region,
        payment_terms_days: terms,
        supplier_status: supplier,
        supplier_notes: supplierNotes,
        notes,
      });
      await onSaved();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="שם">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className={inputCls} placeholder="למשל: עיריית ..." />
      </Field>
      <Field label="סוג">
        <OptSelect list={OWNER_KINDS} value={kind} onChange={setKind} />
      </Field>
      <Field label="עיר">
        <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={inputCls} />
      </Field>
      <Field label="אזור">
        <OptSelect list={REGION_OPTIONS} value={region} onChange={setRegion} blank="לא צוין" />
      </Field>
      <Field label="תנאי תשלום בימים (שוטף+30 = 30)">
        <input type="number" min={0} max={365} value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls} placeholder="עוד לא ידוע" />
      </Field>
      <Field label="מצב כספק">
        <OptSelect list={SUPPLIER_STATUSES} value={supplier} onChange={setSupplier} />
      </Field>
      <Field label="הערות על פתיחת ספק" className="sm:col-span-2 lg:col-span-1">
        <input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} maxLength={2000} className={inputCls} />
      </Field>
      <Field label="הערות" className="sm:col-span-2">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className={inputCls} />
      </Field>
      {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</div>}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
          {busy ? "שומר..." : "שמירה"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-stone-500">
          ביטול
        </button>
      </div>
    </form>
  );
}
