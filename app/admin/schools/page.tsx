"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEAL_STAGES, SCHOOL_STAGES, SCHOOL_STATUSES, SECTORS, labelOf } from "@/app/lib/schools-crm";
import {
  Field,
  Notice,
  OptSelect,
  REGION_OPTIONS,
  STATUS_PILL,
  btnPrimary,
  errText,
  getJson,
  hebStamp,
  inputCls,
  regionLabel,
  sendJson,
} from "./shared";

// רשימת בתי הספר של הענף. מכאן נכנסים לעמוד בית הספר (אנשי קשר, עסקאות,
// רישיונות, הדרכות, ציר זמן, משימות). בית ספר ההדגמה מוסתר אלא אם מסמנים
// "כולל הדגמה". הרשימה נחתכת ב-500 שורות: מצמצמים בסינון.

type SchoolRow = {
  id: string;
  name: string;
  symbol: string | null;
  city: string | null;
  region_key: string | null;
  stage: string;
  sector: string | null;
  status: string;
  is_demo: boolean;
  school_owners: { name: string; kind: string } | null;
  open_deal_stage: string | null;
  has_active_license: boolean;
  last_activity_at: string | null;
};
type OwnerOpt = { id: string; name: string };
type ListResponse = { schools: SchoolRow[]; counts: Record<string, number>; owners: OwnerOpt[]; truncated: boolean };

export default function SchoolsListPage() {
  const router = useRouter();
  // בעלות שמגיעים אליה מעמוד הבעלויות (?owner=...). נקרא ישירות מהכתובת ולא
  // דרך useSearchParams, שדורש Suspense.
  const [ownerId, setOwnerId] = useState(() => (typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("owner") ?? "")));
  const [status, setStatus] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(
      () => {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (region) p.set("region", region);
        if (ownerId) p.set("owner_id", ownerId);
        if (q.trim()) p.set("q", q.trim());
        if (demo) p.set("demo", "1");
        getJson<ListResponse>(`/api/admin-schools/schools?${p.toString()}`, ctrl.signal)
          .then((j) => {
            setData(j);
            setError("");
          })
          .catch((e) => {
            if (!(e instanceof DOMException && e.name === "AbortError")) setError(errText(e));
          });
      },
      q ? 300 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [status, region, ownerId, q, demo]);

  if (!data && !error) return <div className="p-6 text-sm text-stone-500">טוען...</div>;

  const counts = data?.counts ?? {};
  const total = SCHOOL_STATUSES.reduce((sum, s) => sum + (counts[s.value] ?? 0), 0);

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-stone-900">בתי ספר</h1>
          <p className="mt-1 text-sm text-stone-500">
            {total} בתי ספר בסינון הנוכחי:{" "}
            {SCHOOL_STATUSES.map((s, i) => (
              <span key={s.value}>
                {i > 0 ? ", " : ""}
                <button
                  type="button"
                  onClick={() => setStatus(status === s.value ? "" : s.value)}
                  className={`underline decoration-dotted ${status === s.value ? "font-black text-stone-900" : "text-stone-600"}`}
                >
                  {s.label} {counts[s.value] ?? 0}
                </button>
              </span>
            ))}
            .
          </p>
        </div>
        <button type="button" onClick={() => setShowNew((v) => !v)} className={btnPrimary}>
          {showNew ? "סגירה" : "בית ספר חדש"}
        </button>
      </div>
      <Notice error={error} />

      {showNew && (
        <NewSchoolForm
          owners={data?.owners ?? []}
          onCreated={(id) => router.push(`/admin/schools/${id}`)}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-3">
        <Field label="חיפוש" className="w-56">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שם, עיר או סמל" className={inputCls} />
        </Field>
        <Field label="סטטוס" className="w-40">
          <OptSelect list={SCHOOL_STATUSES} value={status} onChange={setStatus} blank="הכול" />
        </Field>
        <Field label="אזור" className="w-44">
          <OptSelect list={REGION_OPTIONS} value={region} onChange={setRegion} blank="הכול" />
        </Field>
        <Field label="בעלות" className="w-52">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
            <option value="">הכול</option>
            {(data?.owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          כולל הדגמה
        </label>
      </div>

      {data && data.schools.length === 0 ? (
        <p className="text-sm text-stone-500">
          {status || region || ownerId || q ? "אין בתי ספר בסינון הזה." : "עדיין אין בתי ספר ברשימה. מוסיפים את הראשון בכפתור למעלה."}
        </p>
      ) : (
        <>
          {data?.truncated && <p className="mb-2 text-xs text-amber-700">מוצגים 500 בתי הספר שעודכנו לאחרונה. מצמצמים בסינון כדי לראות את השאר.</p>}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-500">
                  <th className="px-3 py-2 text-start font-normal">שם</th>
                  <th className="px-3 py-2 text-start font-normal">עיר</th>
                  <th className="px-3 py-2 text-start font-normal">שלב חינוך</th>
                  <th className="px-3 py-2 text-start font-normal">מגזר</th>
                  <th className="px-3 py-2 text-start font-normal">סטטוס</th>
                  <th className="px-3 py-2 text-start font-normal">בעלות</th>
                  <th className="px-3 py-2 text-start font-normal">עסקה פתוחה</th>
                  <th className="px-3 py-2 text-start font-normal">רישיון פעיל</th>
                  <th className="px-3 py-2 text-start font-normal">פעילות אחרונה</th>
                </tr>
              </thead>
              <tbody>
                {(data?.schools ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-stone-100 hover:bg-stone-50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/schools/${s.id}`} className="font-bold text-stone-900 underline decoration-stone-300 hover:decoration-stone-700">
                        {s.name}
                      </Link>
                      {s.symbol ? <span className="ms-2 text-xs text-stone-500">סמל {s.symbol}</span> : null}
                      {s.is_demo ? <span className="ms-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-stone-500">הדגמה</span> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-700">
                      {s.city ?? ""}
                      {s.region_key ? <div className="text-xs text-stone-400">{regionLabel(s.region_key)}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{labelOf(SCHOOL_STAGES, s.stage)}</td>
                    <td className="px-3 py-2 text-stone-700">{s.sector ? labelOf(SECTORS, s.sector) : ""}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_PILL[s.status] ?? STATUS_PILL.prospect}`}>{labelOf(SCHOOL_STATUSES, s.status)}</span>
                    </td>
                    <td className="px-3 py-2 text-stone-700">{s.school_owners?.name ?? ""}</td>
                    <td className="px-3 py-2 text-stone-700">{s.open_deal_stage ? labelOf(DEAL_STAGES, s.open_deal_stage) : <span className="text-stone-300">אין</span>}</td>
                    <td className="px-3 py-2">
                      {s.has_active_license ? <span className="rounded-full bg-[#EAF4F3] px-2.5 py-0.5 text-xs font-bold text-[#2A6462]">כן</span> : <span className="text-stone-400">לא</span>}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{hebStamp(s.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function NewSchoolForm({ owners, onCreated, onCancel }: { owners: OwnerOpt[]; onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [stage, setStage] = useState("elementary");
  const [sector, setSector] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("prospect");
  const [students, setStudents] = useState("");
  const [counselors, setCounselors] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const j = await sendJson<{ school: { id: string } }>("/api/admin-schools/schools", {
        action: "save_school",
        name,
        symbol,
        city,
        region_key: region,
        stage,
        sector,
        owner_id: owner,
        status,
        students,
        counselors,
        notes,
      });
      onCreated(j.school.id);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="שם בית הספר">
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className={inputCls} />
      </Field>
      <Field label="סמל מוסד (אם יש)">
        <input value={symbol} onChange={(e) => setSymbol(e.target.value)} maxLength={20} dir="ltr" className={`${inputCls} text-end`} />
      </Field>
      <Field label="עיר">
        <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} className={inputCls} />
      </Field>
      <Field label="אזור">
        <OptSelect list={REGION_OPTIONS} value={region} onChange={setRegion} blank="לא צוין" />
      </Field>
      <Field label="שלב חינוך">
        <OptSelect list={SCHOOL_STAGES} value={stage} onChange={setStage} />
      </Field>
      <Field label="מגזר">
        <OptSelect list={SECTORS} value={sector} onChange={setSector} blank="לא צוין" />
      </Field>
      <Field label="בעלות">
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls}>
          <option value="">ללא בעלות</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="סטטוס">
        <OptSelect list={SCHOOL_STATUSES} value={status} onChange={setStatus} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="תלמידים">
          <input type="number" min={0} value={students} onChange={(e) => setStudents(e.target.value)} className={inputCls} />
        </Field>
        <Field label="יועצות">
          <input type="number" min={0} value={counselors} onChange={(e) => setCounselors(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="הערות" className="sm:col-span-2 lg:col-span-3">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} className={inputCls} />
      </Field>
      {error && <div className="text-sm text-red-700 sm:col-span-2 lg:col-span-3">{error}</div>}
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
          {busy ? "שומר..." : "הוספה ומעבר לעמוד בית הספר"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-stone-500">
          ביטול
        </button>
      </div>
    </form>
  );
}
