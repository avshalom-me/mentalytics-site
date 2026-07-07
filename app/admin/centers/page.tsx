"use client";

import { useCallback, useEffect, useState } from "react";
import { centerPricing, ilCurrency as ils } from "@/app/lib/center-pricing";

// מרכזים טיפוליים — הצעות מחיר, קישורי תשלום ומנויים.
// זרימה: יוצרים הצעה (מסלולים + מחיר חודשי מותאם + חודשי מתנה) ← מעתיקים
// את הקישור ושולחים למרכז ← המרכז ממלא אשראי בדף ההצטרפות ← המנוי מופיע
// כאן כפעיל, עם ביטול וסנכרון מול Sumit.

type Center = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  token: string;
  price_per_therapist: number | null;
  therapist_count: number | null; // מספר המטפלים בתמחור ההצעה
  gift_months: number;
  status: "draft" | "sent" | "active" | "cancelled";
  agreed_monthly_price: number | null;
  billing_starts_at: string | null;
  payer_name: string | null;
  payer_email: string | null;
  sumit_recurring_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  linked_therapist_count: number; // כמה פרופילי מטפלים משויכים למרכז
  user_id: string | null;
};

// חישובי הכסף מגיעים ממקור האמת המשותף (center-pricing) — לא לשכפל כאן.
const pricing = (pricePerTherapist: number | string | null, count: number | string | null) =>
  centerPricing(Number(pricePerTherapist) || 0, Number(count) || 0);

type TherapistPoolItem = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
  center_account_id: string | null;
  center_name: string | null;
};

const STATUS_LABELS: Record<Center["status"], { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-stone-100 border-stone-300 text-stone-600" },
  sent: { label: "הצעה נשלחה", cls: "bg-blue-50 border-blue-300 text-blue-800" },
  active: { label: "מנוי פעיל", cls: "bg-green-50 border-green-300 text-green-800" },
  cancelled: { label: "בוטל", cls: "bg-red-50 border-red-300 text-red-700" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.includes("T") ? iso : iso + "T00:00:00").toLocaleDateString("he-IL");
}

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sumitInfo, setSumitInfo] = useState<Record<string, string>>({});

  // טופס יצירה/עריכה
  const [editing, setEditing] = useState<Center | "new" | null>(null);
  const [fName, setFName] = useState("");
  const [fContact, setFContact] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fGift, setFGift] = useState("0");
  const [fPricePerTherapist, setFPricePerTherapist] = useState("");
  const [fTherapistCount, setFTherapistCount] = useState("");

  // ניהול שיוך מטפלים למרכז
  const [manageFor, setManageFor] = useState<Center | null>(null);
  const [pool, setPool] = useState<TherapistPoolItem[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());

  // נועל את גלילת העמוד שמאחורי המודל — בלעדיו, גלילה עם העכבר מעל הרקע
  // הכהה (מחוץ לכרטיס הלבן) מזיזה את דף האדמין שמתחת במקום את תוכן המודל.
  useEffect(() => {
    if (!editing && !manageFor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [editing, manageFor]);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-centers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setCenters(j.centers);
        else setError(j.error ?? "שגיאה");
      })
      .catch(() => setError("שגיאת רשת"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function post(payload: Record<string, unknown>): Promise<{ ok: boolean; [k: string]: unknown }> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!j.ok) setError(j.error ?? "שגיאה");
      else load();
      return j;
    } catch {
      setError("שגיאת רשת");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }

  function openNew() {
    setEditing("new");
    setFName(""); setFContact(""); setFEmail(""); setFPhone(""); setFNotes("");
    setFGift("0");
    setFPricePerTherapist(""); setFTherapistCount("");
  }

  function openEdit(c: Center) {
    setEditing(c);
    setFName(c.name);
    setFContact(c.contact_name ?? "");
    setFEmail(c.email ?? "");
    setFPhone(c.phone ?? "");
    setFNotes(c.notes ?? "");
    setFGift(String(c.gift_months));
    setFPricePerTherapist(c.price_per_therapist != null ? String(c.price_per_therapist) : "");
    setFTherapistCount(c.therapist_count != null ? String(c.therapist_count) : "");
  }

  async function save() {
    const payload: Record<string, unknown> = {
      name: fName,
      contact_name: fContact,
      email: fEmail,
      phone: fPhone,
      notes: fNotes,
      gift_months: Number(fGift),
      price_per_therapist: Number(fPricePerTherapist),
      therapist_count: Number(fTherapistCount),
    };
    // חודשי מתנה נעולים אחרי תשלום; מחיר/מספר-מטפלים ניתנים לעריכה תמיד
    // (במרכז פעיל השרת מפרסם את השינוי ל-Sumit). מרכז מבוטל — עריכת קשר בלבד.
    if (editing !== "new" && editing !== null) {
      if (editing.status === "active") {
        delete payload.gift_months;
      } else if (editing.status === "cancelled") {
        delete payload.gift_months;
        delete payload.price_per_therapist;
        delete payload.therapist_count;
      }
    }
    const j = editing === "new"
      ? await post({ action: "create", ...payload })
      : await post({ action: "update", id: (editing as Center).id, ...payload });
    if (j.ok) setEditing(null);
  }

  function joinUrl(c: Center): string {
    return `${window.location.origin}/centers/join/${c.token}`;
  }

  async function copyLink(c: Center) {
    try {
      await navigator.clipboard.writeText(joinUrl(c));
      setCopied(c.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt("העתיקו את הקישור:", joinUrl(c));
    }
  }

  async function sendProposal(c: Center) {
    if (!c.email) {
      setError("למרכז אין אימייל — הוסיפו בעריכת ההצעה");
      return;
    }
    if (!confirm(`לשלוח את ההצעה במייל אל ${c.email}? המרכז יקבל את המחיר לכל מטפל, מספר המטפלים, הסכום הכולל, המתנה וקישור ההצטרפות.`)) return;
    const j = await post({ action: "send_proposal", id: c.id });
    if (j.ok) alert(`ההצעה נשלחה ל${c.email}.`);
  }

  async function syncSumit(c: Center) {
    const j = await post({ action: "sync_sumit", id: c.id });
    if (j.ok) {
      const s = j.sumit as { status: number; next_billing: string | null; unit_price: number | null } | null;
      setSumitInfo((prev) => ({
        ...prev,
        [c.id]: s
          ? `Sumit: ${s.status === 0 ? "פעיל" : "לא פעיל"}${s.next_billing ? ` · חיוב הבא ${fmtDate(s.next_billing)}` : ""}${s.unit_price != null ? ` · ₪${s.unit_price}` : ""}`
          : "לא נמצאה הוראת קבע ב-Sumit",
      }));
    }
  }

  async function openManage(c: Center) {
    setManageFor(c);
    setPoolSearch("");
    setPoolLoading(true);
    setPool([]);
    setSelectedTx(new Set());
    try {
      const res = await fetch("/api/admin-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_therapists" }),
      });
      const j = await res.json();
      if (j.ok) {
        setPool(j.therapists);
        setSelectedTx(new Set((j.therapists as TherapistPoolItem[]).filter((t) => t.center_account_id === c.id).map((t) => t.id)));
      } else {
        setError(j.error ?? "שגיאה");
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setPoolLoading(false);
    }
  }

  async function saveTherapists() {
    if (!manageFor) return;
    const j = await post({ action: "set_therapists", id: manageFor.id, therapist_ids: [...selectedTx] });
    if (j.ok) setManageFor(null);
  }

  // חודשי מתנה נעולים אחרי תשלום (active/cancelled). מחיר/מספר-מטפלים ננעלים
  // רק כשההצעה בוטלה — במרכז פעיל אפשר לעדכן (מתפרסם ל-Sumit בשמירה).
  const isLockedEditing = editing !== "new" && editing !== null && (editing.status === "active" || editing.status === "cancelled");
  const pricingLocked = editing !== "new" && editing !== null && editing.status === "cancelled";
  const isActiveEditing = editing !== "new" && editing !== null && editing.status === "active";
  const fPricing = pricing(fPricePerTherapist, fTherapistCount);
  const fTotal = fPricing.monthlyTotal;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-stone-900">מרכזים טיפוליים</h1>
        <button onClick={openNew} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700">
          + הצעה למרכז חדש
        </button>
      </div>
      <p className="mb-3 text-sm text-stone-500 max-w-3xl">
        יוצרים הצעה עם המחיר לכל מטפל ומספר המטפלים שסגרתם בשיחת ההתאמה, שולחים למרכז במייל (או מעתיקים את הקישור).
        המרכז רואה את הסכום החודשי הכולל וממלא פרטי אשראי. אפשר להגדיר חודשי מתנה —
        הכרטיס נשמר מיד והחיוב הראשון יוצא רק בתום המתנה.
      </p>
      <div className="mb-6 flex flex-wrap gap-4 text-xs">
        <a href="/prospectus-centers.pdf" target="_blank" className="font-bold text-[#0F5468] underline">📄 פרוספקט למרכזים (PDF לשליחה)</a>
        <a href="/centers" target="_blank" className="font-bold text-[#0F5468] underline">🔗 עמוד ההסבר למרכזים</a>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && centers.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
          אין עדיין מרכזים — צרו הצעה ראשונה
        </div>
      )}

      {centers.map((c) => {
        const st = STATUS_LABELS[c.status];
        const p = pricing(c.price_per_therapist, c.therapist_count);
        const total = p.monthlyTotal;
        const priced = p.pricePerTherapist > 0 && p.therapistCount > 0;
        return (
          <div key={c.id} className="mb-4 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-stone-800">{c.name}</h2>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
                  {c.gift_months > 0 && (
                    <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      🎁 {c.gift_months} חודשי מתנה
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {c.contact_name && <>איש קשר: {c.contact_name} · </>}
                  {c.email && <>{c.email} · </>}
                  {c.phone && <>{c.phone} · </>}
                  נוצר {fmtDate(c.created_at)}
                </p>
              </div>
              <div className="text-left">
                {c.status === "active" ? (
                  <>
                    <div className="text-xl font-black text-green-700">₪{Number(c.agreed_monthly_price ?? total).toLocaleString("he-IL")} <span className="text-xs font-normal">+ מע&quot;מ/חודש</span></div>
                    <div className="text-xs text-stone-500">
                      {priced && <>{c.therapist_count} מטפלים × ₪{ils(Number(c.price_per_therapist))} · </>}
                      חיוב ראשון {fmtDate(c.billing_starts_at)}
                    </div>
                  </>
                ) : priced ? (
                  <>
                    <div className="text-xl font-black text-stone-800">₪{ils(total)} <span className="text-xs font-normal text-stone-500">+ מע&quot;מ/חודש</span></div>
                    <div className="text-xs text-stone-500">{c.therapist_count} מטפלים × ₪{ils(Number(c.price_per_therapist))} · ₪{ils(p.monthlyTotalWithVat)} כולל מע&quot;מ</div>
                  </>
                ) : (
                  <div className="text-xs text-amber-600">טרם הוגדר מחיר/מספר מטפלים</div>
                )}
              </div>
            </div>

            {c.status === "active" && c.payer_name && (
              <p className="mt-2 rounded-lg bg-green-50/60 border border-green-100 px-3 py-1.5 text-xs text-stone-600">
                משלם: {c.payer_name} ({c.payer_email}) · שולם {fmtDate(c.paid_at)}
                {c.user_id
                  ? <strong className="text-green-700"> · ✓ נכנסו לפורטל</strong>
                  : <span className="text-amber-600"> · טרם נכנסו לפורטל (מייל כניסה: {c.email || c.payer_email || "—"})</span>}
                {!c.sumit_recurring_id && <strong className="text-red-600"> · ⚠️ חסר מזהה הוראת קבע — ביטול רק דרך ממשק Sumit</strong>}
              </p>
            )}
            {c.notes && <p className="mt-2 text-xs text-stone-500 whitespace-pre-wrap">📝 {c.notes}</p>}
            {sumitInfo[c.id] && <p className="mt-2 text-xs font-bold text-[#0F5468]">{sumitInfo[c.id]}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => copyLink(c)}
                className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 font-bold text-teal-800 hover:bg-teal-100">
                {copied === c.id ? "✓ הועתק!" : "🔗 העתקת קישור למרכז"}
              </button>
              <button onClick={() => openManage(c)}
                className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 font-bold text-indigo-800 hover:bg-indigo-100">
                👥 ניהול מטפלים ({c.linked_therapist_count})
              </button>
              {(c.status === "draft" || c.status === "sent") && (
                <>
                  <button onClick={() => sendProposal(c)} disabled={busy || !c.email}
                    title={c.email ? "שליחת ההצעה במייל למרכז + קישור הצטרפות" : "אין אימייל למרכז — הוסיפו בעריכה"}
                    className="rounded-full border border-teal-400 bg-teal-600 px-3 py-1 font-bold text-white hover:bg-teal-700 disabled:opacity-40">
                    ✉️ שלח הצעה במייל
                  </button>
                  <button onClick={() => post({ action: "mark_sent", id: c.id })} disabled={busy}
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    {c.status === "sent" ? "החזרה לטיוטה" : "סימון כנשלחה ידנית"}
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    עריכה
                  </button>
                </>
              )}
              {c.status === "active" && (
                <>
                  <button onClick={() => openEdit(c)} className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    עריכת פרטים
                  </button>
                  <button onClick={() => syncSumit(c)} disabled={busy}
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    🔄 סטטוס מ-Sumit
                  </button>
                  {c.sumit_recurring_id && (
                    <button
                      onClick={() => {
                        if (confirm(`לבטל את המנוי של ${c.name}? הוראת הקבע ב-Sumit תבוטל והחיובים ייפסקו.`)) {
                          post({ action: "cancel_subscription", id: c.id });
                        }
                      }}
                      disabled={busy}
                      className="rounded-full border border-red-300 bg-red-50 px-3 py-1 font-bold text-red-700 hover:bg-red-100"
                    >
                      ביטול מנוי
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* מודל יצירה/עריכה — כותרת וכפתור השמירה קבועים; רק תוכן הטופס גולל,
          כך שהטופס נשאר נגיש במסך נמוך בלי לאבד את פעולת השמירה. */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-2xl border-b border-stone-100 px-6 py-4">
              <h3 className="text-lg font-black text-stone-800">
                {editing === "new" ? "הצעה למרכז חדש" : `עריכה — ${(editing as Center).name}`}
              </h3>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="שם המרכז *">
                <input value={fName} onChange={(e) => setFName(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="איש/אשת קשר">
                <input value={fContact} onChange={(e) => setFContact(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="אימייל">
                <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
              <Field label="טלפון">
                <input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
            </div>

            {!isLockedEditing && (
              <Field label="🎁 חודשי מתנה (0 = בלי מתנה; הכרטיס נשמר מיד והחיוב הראשון יוצא בתום המתנה)">
                <input type="number" min={0} max={12} value={fGift} onChange={(e) => setFGift(e.target.value)}
                  className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
              </Field>
            )}

            {!pricingLocked && (
              <>
                <div className="mt-2 mb-1">
                  <span className="text-xs font-black text-stone-700">המחיר וההיקף (כפי שנקבעו בשיחת ההתאמה)</span>
                </div>
                <p className="mb-2 text-[11px] leading-4 text-stone-400">
                  כל מנוי כולל אוטומטית: כניסה למערכת ההתאמות, דוח סטטיסטיקות חודשי, וביטול בכל עת (כולל בחודשי המתנה) — מוצג למרכז בדף ההצטרפות. כאן מגדירים רק את המחיר לכל מטפל ואת מספר המטפלים.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="מחיר לכל מטפל (₪ לחודש, לפני מע&quot;מ) *">
                    <input value={fPricePerTherapist} inputMode="decimal" placeholder="למשל 80"
                      onChange={(e) => setFPricePerTherapist(e.target.value.replace(/[^\d.]/g, ""))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                  </Field>
                  <Field label="מספר מטפלים *">
                    <input value={fTherapistCount} inputMode="numeric" placeholder="למשל 5"
                      onChange={(e) => setFTherapistCount(e.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                  </Field>
                </div>
                <div className="mt-1 mb-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
                  {fTotal > 0 ? (
                    <>סה&quot;כ חודשי: <strong className="text-stone-900">₪{ils(fTotal)}</strong> + מע&quot;מ · {Number(fTherapistCount) || 0} × ₪{ils(Number(fPricePerTherapist) || 0)} · ₪{ils(fPricing.monthlyTotalWithVat)} כולל מע&quot;מ</>
                  ) : (
                    "הזינו מחיר לכל מטפל ומספר מטפלים כדי לראות את הסכום החודשי הכולל."
                  )}
                </div>
                {isActiveEditing && (
                  <p className="mb-2 text-[11px] leading-4 text-amber-600">
                    ⚠️ שינוי המחיר או מספר המטפלים במרכז פעיל יעדכן מיד את הסכום החודשי בהוראת הקבע ב-Sumit (מהחיוב הבא).
                  </p>
                )}
              </>
            )}

            <Field label="הערות פנימיות (לא מוצג למרכז)">
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </Field>
            </div>

            <div className="rounded-b-2xl border-t border-stone-100 px-6 py-4">
              <button onClick={save} disabled={busy || !fName.trim() || (!pricingLocked && fTotal <= 0)}
                className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                {busy ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* מודל: ניהול שיוך מטפלים למרכז */}
      {manageFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setManageFor(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="rounded-t-2xl border-b border-stone-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-stone-800">מטפלי {manageFor.name}</h3>
                <button onClick={() => setManageFor(null)} className="text-stone-400 hover:text-stone-600">✕</button>
              </div>
              <p className="mt-1 text-xs text-stone-500">סמנו את המטפלים ששייכים למרכז — הם יופיעו בפורטל המרכז ובסטטיסטיקות המרוכזות. מטפל משויך למרכז אחד בלבד.</p>
              <input
                value={poolSearch}
                onChange={(e) => setPoolSearch(e.target.value)}
                placeholder="חיפוש לפי שם…"
                className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="overflow-y-auto px-4 py-3">
              {poolLoading ? (
                <p className="py-6 text-center text-sm text-stone-400">טוען מטפלים…</p>
              ) : (() => {
                const q = poolSearch.trim().toLowerCase();
                const filtered = q ? pool.filter((t) => t.full_name.toLowerCase().includes(q)) : pool;
                if (filtered.length === 0) return <p className="py-6 text-center text-sm text-stone-400">לא נמצאו מטפלים</p>;
                return (
                  <div className="space-y-1">
                    {filtered.map((t) => {
                      const checked = selectedTx.has(t.id);
                      const otherCenter = t.center_account_id && t.center_account_id !== manageFor.id ? t.center_name : null;
                      return (
                        <label key={t.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${checked ? "border-indigo-300 bg-indigo-50" : "border-stone-200 hover:bg-stone-50"}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedTx((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(t.id); else next.delete(t.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 accent-indigo-600"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-stone-800">{t.full_name}</div>
                            <div className="truncate text-xs text-stone-400">
                              {t.email ?? "—"}
                              {otherCenter && <span className="text-amber-600"> · משויך כרגע ל{otherCenter}</span>}
                            </div>
                          </div>
                          <span className="text-[10px] text-stone-400">{t.status}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between rounded-b-2xl border-t border-stone-100 px-6 py-4">
              <span className="text-xs text-stone-500">{selectedTx.size} נבחרו</span>
              <button onClick={saveTherapists} disabled={busy}
                className="rounded-xl bg-stone-800 px-6 py-2 text-sm font-bold text-white disabled:opacity-40">
                {busy ? "שומר…" : "שמירת השיוך"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-stone-500">{label}</label>
      {children}
    </div>
  );
}
