"use client";

import { useCallback, useEffect, useState } from "react";
import HelpTip from "../components/HelpTip";
import { EXPENSE_CATEGORIES, REFUND_CATEGORIES, labelOf } from "@/app/lib/crm";

type MonthRow = {
  month: string;
  income_subscriptions: number;
  income_quiz: number;
  income_total: number;
  expenses_total: number;
  refunds_total: number;
  ad_spend: number;
  rnd_total: number;
  new_paying: number;
  cac_actual: number | null;
  net: number;
};

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  vat_amount: number | null;
  is_rnd: boolean;
  receipt_ref: string | null;
  sumit_doc_id: number | null;
  sumit_status: string | null;
  sumit_error: string | null;
};

type Target = { metric: string; month: string; scenario: string; target: number };

function ils(n: number): string {
  return `₪${Number(n).toLocaleString("he-IL")}`;
}

function monthLabel(m: string): string {
  const months = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
  const [y, mo] = m.split("-").map(Number);
  return `${months[mo - 1]} ${String(y).slice(2)}`;
}

export default function FinancePage() {
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [cumulative, setCumulative] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Quick-add form
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fCategory, setFCategory] = useState("advertising_google");
  const [fVendor, setFVendor] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fVat, setFVat] = useState("");
  const [fRnd, setFRnd] = useState(false);
  const [fRef, setFRef] = useState("");
  const [fToSumit, setFToSumit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sumitNotice, setSumitNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin-crm/finance?months=6")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setMonths(j.months);
          setExpenses(j.expenses);
          setTargets(j.targets);
          setCumulative(j.cumulative_net);
        } else setError(j.error || "שגיאה בטעינה");
      })
      .catch(() => setError("שגיאה בטעינה"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Selecting an R&D-ish category defaults the R&D flag on.
  useEffect(() => {
    setFRnd(fCategory === "rnd");
  }, [fCategory]);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!fAmount || Number(fAmount) <= 0) return;
    setSaving(true);
    setError("");
    try {
      const cat = EXPENSE_CATEGORIES.find((c) => c.value === fCategory);
      const isRefund = REFUND_CATEGORIES.includes(fCategory);
      const res = await fetch("/api/admin-crm/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date: fDate,
          category: fCategory,
          vendor: fVendor || null,
          description: fDesc || null,
          amount: Number(fAmount),
          vat_amount: fVat ? Number(fVat) : null,
          is_rnd: fRnd,
          channel: cat?.channel ?? null,
          receipt_ref: fRef || null,
          send_to_sumit: fToSumit && !isRefund,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setFVendor("");
        setFDesc("");
        setFAmount("");
        setFVat("");
        setFRef("");
        if (j.sumit?.status === "draft_created") {
          setSumitNotice("✓ נוצרה טיוטת הוצאה ב-Sumit — לאישור סופי בתוך Sumit");
        } else if (j.sumit?.status === "failed") {
          setSumitNotice(`⚠ ההוצאה נשמרה, אבל יצירת הטיוטה ב-Sumit נכשלה: ${j.sumit.error ?? ""} — אפשר לנסות שוב מהטבלה`);
        } else {
          setSumitNotice("");
        }
        load();
      } else setError(j.error || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  async function sendToSumit(id: string) {
    setBusy(id);
    setSumitNotice("");
    try {
      const res = await fetch("/api/admin-crm/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_to_sumit", id }),
      });
      const j = await res.json();
      if (j.ok) setSumitNotice("✓ נוצרה טיוטת הוצאה ב-Sumit — לאישור סופי בתוך Sumit");
      else setSumitNotice(`⚠ יצירת הטיוטה נכשלה: ${j.sumit?.error ?? j.error ?? ""}`);
      load();
    } finally {
      setBusy(null);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm("למחוק את הרשומה?")) return;
    setBusy(id);
    try {
      await fetch("/api/admin-crm/finance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      load();
    } finally {
      setBusy(null);
    }
  }

  const current = months[0];
  const cacTarget = targets
    .filter((t) => t.metric === "cac_max")
    .sort((a, b) => (a.month < b.month ? -1 : 1))[0];
  const ebitdaTargets = targets.filter((t) => t.metric === "ebitda_year");
  const ebitdaOptimistic = ebitdaTargets.find((t) => t.scenario === "optimistic");

  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-stone-900">כספים</h1>
            <HelpTip id="finance" />
          </div>
          <a
            href={`/api/admin-crm/finance/export?month=${thisMonth}`}
            className="rounded-full bg-stone-800 px-5 py-2 text-sm font-bold text-white hover:bg-stone-700"
          >
            ⬇ ייצוא לרו"ח (החודש)
          </a>
        </div>
        <p className="mb-5 text-sm text-stone-500">
          הכנסות נקראות אוטומטית מהחיובים (לפני מע"מ). הוצאה מוזנת כאן פעם אחת ונוצרת כטיוטה ב-Sumit —
          שם מאשרים אותה לספרים, והרו"ח רואה הכול במקום הרגיל שלו.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <p className="text-sm text-stone-400">טוען…</p>}

        {!loading && current && (
          <>
            {/* This-month cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Card label="הכנסות החודש" value={ils(current.income_total)} sub={`מנויים ${ils(current.income_subscriptions)} · שאלונים ${ils(current.income_quiz)}`} accent />
              <Card label="הוצאות החודש" value={ils(current.expenses_total)} sub={current.rnd_total > 0 ? `מתוכן מו"פ ${ils(current.rnd_total)}` : undefined} />
              <Card label="החזרים החודש" value={ils(current.refunds_total)} />
              <Card
                label="מאזן החודש"
                value={ils(current.net)}
                tone={current.net >= 0 ? "text-emerald-600" : "text-red-600"}
              />
              <Card
                label="CAC בפועל"
                value={current.cac_actual != null ? ils(current.cac_actual) : "—"}
                sub={
                  current.cac_actual != null && cacTarget
                    ? Number(current.cac_actual) <= Number(cacTarget.target)
                      ? `בתוך היעד (עד ${ils(Number(cacTarget.target))}) ✓`
                      : `מעל היעד (${ils(Number(cacTarget.target))}) ⚠`
                    : "דורש הזנת הוצאות פרסום"
                }
                tone={
                  current.cac_actual != null && cacTarget && Number(current.cac_actual) > Number(cacTarget.target)
                    ? "text-red-600"
                    : undefined
                }
              />
            </div>

            {/* EBITDA progress */}
            {ebitdaOptimistic && (
              <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-bold text-stone-700">מאזן מצטבר (6 חודשים) מול יעד EBITDA שנתי</span>
                  <span className="text-xs text-stone-400">
                    פסימי {ils(Number(ebitdaTargets.find((t) => t.scenario === "pessimistic")?.target ?? 0))} · אופטימי{" "}
                    {ils(Number(ebitdaOptimistic.target))} · הצלחה{" "}
                    {ils(Number(ebitdaTargets.find((t) => t.scenario === "success")?.target ?? 0))}
                  </span>
                </div>
                <div className={`text-2xl font-black ${cumulative >= 0 ? "text-stone-900" : "text-red-600"}`}>
                  {ils(cumulative)}
                </div>
              </div>
            )}

            {/* Month table */}
            <div className="mb-8 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-400">
                    <th className="px-4 py-2.5 text-start font-bold">חודש</th>
                    <th className="px-4 py-2.5 text-start font-bold">הכנסות</th>
                    <th className="px-4 py-2.5 text-start font-bold">הוצאות</th>
                    <th className="px-4 py-2.5 text-start font-bold">החזרים</th>
                    <th className="px-4 py-2.5 text-start font-bold">פרסום</th>
                    <th className="px-4 py-2.5 text-start font-bold">משלמים חדשים</th>
                    <th className="px-4 py-2.5 text-start font-bold">CAC</th>
                    <th className="px-4 py-2.5 text-start font-bold">מאזן</th>
                    <th className="px-4 py-2.5 text-start font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.month} className="border-b border-stone-100 last:border-b-0">
                      <td className="px-4 py-2.5 font-bold text-stone-700">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2.5 text-emerald-700">{ils(m.income_total)}</td>
                      <td className="px-4 py-2.5">{ils(m.expenses_total)}</td>
                      <td className="px-4 py-2.5">{m.refunds_total > 0 ? ils(m.refunds_total) : "—"}</td>
                      <td className="px-4 py-2.5">{m.ad_spend > 0 ? ils(m.ad_spend) : "—"}</td>
                      <td className="px-4 py-2.5">{m.new_paying}</td>
                      <td className="px-4 py-2.5">{m.cac_actual != null ? ils(m.cac_actual) : "—"}</td>
                      <td className={`px-4 py-2.5 font-black ${m.net >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                        {ils(m.net)}
                      </td>
                      <td className="px-4 py-2.5">
                        <a
                          href={`/api/admin-crm/finance/export?month=${m.month}`}
                          className="text-xs font-bold text-stone-400 hover:text-stone-700"
                          title="ייצוא CSV לחודש זה"
                        >
                          ⬇ CSV
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add expense */}
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-stone-500">
              הזנת הוצאה / החזר <HelpTip id="expenses" />
            </div>
            <form onSubmit={addExpense} className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 bg-white p-3 sm:grid-cols-4 lg:grid-cols-8">
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="rounded-xl border border-stone-200 px-2 py-2 text-sm text-stone-600" />
              <select value={fCategory} onChange={(e) => setFCategory(e.target.value)} className="rounded-xl border border-stone-200 px-2 py-2 text-sm text-stone-600 col-span-2 sm:col-span-1">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input value={fVendor} onChange={(e) => setFVendor(e.target.value)} placeholder="ספק" className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="תיאור" className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={fAmount} onChange={(e) => setFAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder='סכום ₪ לפני מע"מ' inputMode="decimal" className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={fVat} onChange={(e) => setFVat(e.target.value.replace(/[^\d.]/g, ""))} placeholder='מע"מ ₪' inputMode="decimal" className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <input value={fRef} onChange={(e) => setFRef(e.target.value)} placeholder="מס' חשבונית" className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs font-bold text-stone-500">
                  <input type="checkbox" checked={fRnd} onChange={(e) => setFRnd(e.target.checked)} />
                  מו"פ
                </label>
                <button type="submit" disabled={saving || !fAmount} className="flex-1 rounded-full bg-stone-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? "…" : "הוספה"}
                </button>
              </div>
              {!REFUND_CATEGORIES.includes(fCategory) && (
                <label className="col-span-2 flex items-center gap-1.5 text-xs font-bold text-teal-700 sm:col-span-4 lg:col-span-8">
                  <input type="checkbox" checked={fToSumit} onChange={(e) => setFToSumit(e.target.checked)} />
                  צור גם טיוטת הוצאה ב-Sumit (לא נכנס לספרים עד אישור בתוך Sumit)
                </label>
              )}
            </form>
            {sumitNotice && (
              <div className={`-mt-4 mb-6 rounded-xl border p-3 text-sm ${sumitNotice.startsWith("✓") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {sumitNotice}
              </div>
            )}

            {/* Expense list */}
            {expenses.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-400">
                      <th className="px-4 py-2 text-start font-bold">תאריך</th>
                      <th className="px-4 py-2 text-start font-bold">קטגוריה</th>
                      <th className="px-4 py-2 text-start font-bold">ספק / תיאור</th>
                      <th className="px-4 py-2 text-start font-bold">סכום</th>
                      <th className="px-4 py-2 text-start font-bold">אסמכתא</th>
                      <th className="px-4 py-2 text-start font-bold">Sumit</th>
                      <th className="px-4 py-2 text-start font-bold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-stone-100 last:border-b-0">
                        <td className="px-4 py-2 text-stone-600">{e.expense_date}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                              REFUND_CATEGORIES.includes(e.category)
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-stone-200 bg-stone-50 text-stone-600"
                            }`}
                          >
                            {labelOf(EXPENSE_CATEGORIES, e.category)}
                          </span>
                          {e.is_rnd && <span className="ms-1 text-xs text-teal-700">מו"פ</span>}
                        </td>
                        <td className="px-4 py-2 text-stone-600">
                          {[e.vendor, e.description].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td className="px-4 py-2 font-bold text-stone-800">
                          {ils(Number(e.amount))}
                          {e.vat_amount != null && (
                            <span className="ms-1 text-xs font-normal text-stone-400">+{ils(Number(e.vat_amount))} מע"מ</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-stone-400">{e.receipt_ref || "—"}</td>
                        <td className="px-4 py-2">
                          {e.sumit_status === "draft_created" ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700" title={`Sumit DocumentID: ${e.sumit_doc_id}`}>
                              טיוטה ב-Sumit ✓
                            </span>
                          ) : REFUND_CATEGORIES.includes(e.category) ? (
                            <span className="text-[11px] text-stone-300">—</span>
                          ) : (
                            <button
                              onClick={() => sendToSumit(e.id)}
                              disabled={busy === e.id}
                              className="rounded-full border border-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-500 hover:bg-stone-100 disabled:opacity-50"
                              title={e.sumit_status === "failed" ? `ניסיון קודם נכשל: ${e.sumit_error ?? ""}` : "יצירת טיוטת הוצאה ב-Sumit"}
                            >
                              {e.sumit_status === "failed" ? "נסה שוב ל-Sumit" : "שלח ל-Sumit"}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => removeExpense(e.id)}
                            disabled={busy === e.id}
                            className="text-stone-300 hover:text-red-500"
                            title="מחיקה"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  tone?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-xl font-black ${tone ?? (accent ? "text-teal-700" : "text-stone-900")}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}
