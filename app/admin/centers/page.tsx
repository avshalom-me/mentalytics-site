"use client";

import { useCallback, useEffect, useState } from "react";

// מרכזים טיפוליים — הצעות מחיר, קישורי תשלום ומנויים.
// זרימה: יוצרים הצעה (מסלולים + מחיר חודשי מותאם + חודשי מתנה) ← מעתיקים
// את הקישור ושולחים למרכז ← המרכז ממלא אשראי בדף ההצטרפות ← המנוי מופיע
// כאן כפעיל, עם ביטול וסנכרון מול Sumit.

type Plan = { key: string; title: string; monthly_price: number; features: string[] };

type Center = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  token: string;
  plans: Plan[];
  gift_months: number;
  status: "draft" | "sent" | "active" | "cancelled";
  selected_plan_key: string | null;
  agreed_monthly_price: number | null;
  billing_starts_at: string | null;
  payer_name: string | null;
  payer_email: string | null;
  sumit_recurring_id: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<Center["status"], { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-stone-100 border-stone-300 text-stone-600" },
  sent: { label: "הצעה נשלחה", cls: "bg-blue-50 border-blue-300 text-blue-800" },
  active: { label: "מנוי פעיל", cls: "bg-green-50 border-green-300 text-green-800" },
  cancelled: { label: "בוטל", cls: "bg-red-50 border-red-300 text-red-700" },
};

// טופס מסלול בעריכה: features כטקסט חופשי (שורה = שורת "מה מקבלים")
type PlanDraft = { title: string; monthly_price: string; featuresText: string };

const emptyPlan = (): PlanDraft => ({ title: "", monthly_price: "", featuresText: "" });

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
  const [fPlans, setFPlans] = useState<PlanDraft[]>([emptyPlan()]);

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
    setFPlans([emptyPlan()]);
  }

  function openEdit(c: Center) {
    setEditing(c);
    setFName(c.name);
    setFContact(c.contact_name ?? "");
    setFEmail(c.email ?? "");
    setFPhone(c.phone ?? "");
    setFNotes(c.notes ?? "");
    setFGift(String(c.gift_months));
    setFPlans(
      c.plans.length > 0
        ? c.plans.map((p) => ({ title: p.title, monthly_price: String(p.monthly_price), featuresText: p.features.join("\n") }))
        : [emptyPlan()]
    );
  }

  async function save() {
    const plans = fPlans
      .filter((p) => p.title.trim() || p.monthly_price.trim())
      .map((p) => ({
        title: p.title,
        monthly_price: Number(p.monthly_price),
        features: p.featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      }));
    const payload: Record<string, unknown> = {
      name: fName,
      contact_name: fContact,
      email: fEmail,
      phone: fPhone,
      notes: fNotes,
      gift_months: Number(fGift),
      plans,
    };
    const editingLocked = editing !== "new" && editing !== null && (editing.status === "active" || editing.status === "cancelled");
    if (editingLocked) {
      // אחרי תשלום — רק פרטי קשר והערות ניתנים לעדכון
      delete payload.plans;
      delete payload.gift_months;
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

  const isLockedEditing = editing !== "new" && editing !== null && (editing.status === "active" || editing.status === "cancelled");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 pb-20" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-black text-stone-900">מרכזים טיפוליים</h1>
        <button onClick={openNew} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700">
          + הצעה למרכז חדש
        </button>
      </div>
      <p className="mb-6 text-sm text-stone-500 max-w-3xl">
        יוצרים הצעה עם המסלולים והסכום החודשי שסגרתם, מעתיקים את הקישור ושולחים למרכז.
        בקישור הם רואים מה הם מקבלים בכל מסלול וממלאים פרטי אשראי. אפשר להגדיר חודשי מתנה —
        הכרטיס נשמר מיד והחיוב הראשון יוצא רק בתום המתנה.
      </p>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-sm text-stone-400 animate-pulse">טוען…</p>}

      {!loading && centers.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-400">
          אין עדיין מרכזים — צרו הצעה ראשונה
        </div>
      )}

      {centers.map((c) => {
        const st = STATUS_LABELS[c.status];
        const chosenPlan = c.plans.find((p) => p.key === c.selected_plan_key);
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
                {c.status === "active" && chosenPlan ? (
                  <>
                    <div className="text-xl font-black text-green-700">₪{Number(c.agreed_monthly_price).toLocaleString("he-IL")} <span className="text-xs font-normal">+ מע&quot;מ/חודש</span></div>
                    <div className="text-xs text-stone-500">{chosenPlan.title} · חיוב ראשון {fmtDate(c.billing_starts_at)}</div>
                  </>
                ) : (
                  <div className="text-xs text-stone-500">
                    {c.plans.map((p) => (
                      <div key={p.key}><strong>{p.title}</strong>: ₪{p.monthly_price.toLocaleString("he-IL")} + מע&quot;מ</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {c.status === "active" && c.payer_name && (
              <p className="mt-2 rounded-lg bg-green-50/60 border border-green-100 px-3 py-1.5 text-xs text-stone-600">
                משלם: {c.payer_name} ({c.payer_email}) · שולם {fmtDate(c.paid_at)}
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
              {(c.status === "draft" || c.status === "sent") && (
                <>
                  <button onClick={() => post({ action: "mark_sent", id: c.id })} disabled={busy}
                    className="rounded-full border border-stone-300 px-3 py-1 text-stone-600 hover:bg-stone-50">
                    {c.status === "sent" ? "החזרה לטיוטה" : "סימון כנשלחה"}
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

      {/* מודל יצירה/עריכה */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10" dir="rtl">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-stone-800">
                {editing === "new" ? "הצעה למרכז חדש" : `עריכה — ${(editing as Center).name}`}
              </h3>
              <button onClick={() => setEditing(null)} className="text-stone-400 hover:text-stone-600">✕</button>
            </div>

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
              <>
                <Field label="🎁 חודשי מתנה (0 = בלי מתנה; הכרטיס נשמר מיד והחיוב הראשון יוצא בתום המתנה)">
                  <input type="number" min={0} max={12} value={fGift} onChange={(e) => setFGift(e.target.value)}
                    className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                </Field>

                <div className="mt-2 mb-1 flex items-center justify-between">
                  <span className="text-xs font-black text-stone-700">המסלולים בהצעה (עד 4)</span>
                  {fPlans.length < 4 && (
                    <button onClick={() => setFPlans([...fPlans, emptyPlan()])}
                      className="rounded-full border border-stone-300 px-2.5 py-0.5 text-xs text-stone-600 hover:bg-stone-50">
                      + מסלול
                    </button>
                  )}
                </div>
                {fPlans.map((p, i) => (
                  <div key={i} className="mb-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                      <input value={p.title} placeholder={`שם המסלול (למשל "מסלול בסיס")`}
                        onChange={(e) => setFPlans(fPlans.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-stone-500">₪</span>
                        <input value={p.monthly_price} placeholder="לחודש" inputMode="decimal"
                          onChange={(e) => setFPlans(fPlans.map((x, j) => (j === i ? { ...x, monthly_price: e.target.value.replace(/[^\d.]/g, "") } : x)))}
                          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" dir="ltr" />
                        <span className="text-xs text-stone-400 whitespace-nowrap">+ מע&quot;מ</span>
                      </div>
                      {fPlans.length > 1 && (
                        <button onClick={() => setFPlans(fPlans.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 text-sm">✕</button>
                      )}
                    </div>
                    <textarea
                      value={p.featuresText}
                      onChange={(e) => setFPlans(fPlans.map((x, j) => (j === i ? { ...x, featuresText: e.target.value } : x)))}
                      rows={4}
                      placeholder={"מה המרכז מקבל במסלול — שורה לכל סעיף:\nעד 10 פרופילי מטפלים במערכת ההתאמה\nדוח סטטיסטיקות חודשי\nליווי והטמעה"}
                      className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs leading-5"
                    />
                  </div>
                ))}
              </>
            )}

            <Field label="הערות פנימיות (לא מוצג למרכז)">
              <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            </Field>

            <button onClick={save} disabled={busy || !fName.trim()}
              className="mt-3 w-full rounded-xl bg-stone-800 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {busy ? "שומר…" : "שמירה"}
            </button>
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
