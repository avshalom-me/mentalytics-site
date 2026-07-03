import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { EXPENSE_CATEGORIES, REFUND_CATEGORIES, labelOf } from "@/app/lib/crm";
import { createSumitExpenseDraft } from "@/app/lib/sumit-expense";

// Finance overview + expense ledger.
//
// Income is read live from `payments` (mirrored from Sumit by the charge
// flow — completed rows only, amounts are ₪ before VAT). Expenses/refunds
// come from the manual ledger. Nothing here ever writes toward Sumit; the
// books of record stay in Sumit, this screen is the management view.

type PaymentRow = { payment_type: string; reference_id: string; amount: number; status: string; created_at: string };
type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  vat_amount: number | null;
  is_rnd: boolean;
  channel: string | null;
  receipt_ref: string | null;
  note: string | null;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export async function GET(req: NextRequest) {
  try {
    const monthsBack = Math.min(Number(req.nextUrl.searchParams.get("months") ?? 6), 24);
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - (monthsBack - 1));
    since.setUTCHours(0, 0, 0, 0);
    const sinceIso = since.toISOString();
    const sinceDate = sinceIso.slice(0, 10);

    const [payments, expenses, allFirstPayments, targetsRes] = await Promise.all([
      fetchAllRows<PaymentRow>(() =>
        supabaseAdmin
          .from("payments")
          .select("payment_type, reference_id, amount, status, created_at")
          .eq("status", "completed")
          .gte("created_at", sinceIso)
      ),
      fetchAllRows<ExpenseRow>(() =>
        supabaseAdmin
          .from("expenses")
          .select("*")
          .gte("expense_date", sinceDate)
          .order("expense_date", { ascending: false })
      ),
      // First completed subscription payment per therapist (all-time) — the
      // month it lands in is the therapist's acquisition month (CAC base).
      fetchAllRows<{ reference_id: string; created_at: string }>(() =>
        supabaseAdmin
          .from("payments")
          .select("reference_id, created_at")
          .eq("status", "completed")
          .eq("payment_type", "subscription")
          .order("created_at", { ascending: true })
      ),
      supabaseAdmin.from("plan_targets").select("*").in("metric", ["cac_max", "ebitda_year"]),
    ]);

    const firstPaymentMonth = new Map<string, string>();
    for (const p of allFirstPayments) {
      if (!firstPaymentMonth.has(p.reference_id)) {
        firstPaymentMonth.set(p.reference_id, monthKey(p.created_at));
      }
    }
    const newPayingByMonth = new Map<string, number>();
    for (const m of firstPaymentMonth.values()) {
      newPayingByMonth.set(m, (newPayingByMonth.get(m) ?? 0) + 1);
    }

    // Build month list newest-first.
    const months: string[] = [];
    const cursor = new Date();
    for (let i = 0; i < monthsBack; i++) {
      months.push(
        `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`
      );
      cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }

    const rows = months.map((m) => {
      const monthPayments = payments.filter((p) => monthKey(p.created_at) === m);
      const incomeSubs = monthPayments
        .filter((p) => p.payment_type === "subscription")
        .reduce((s, p) => s + Number(p.amount), 0);
      const incomeQuiz = monthPayments
        .filter((p) => p.payment_type === "quiz")
        .reduce((s, p) => s + Number(p.amount), 0);

      const monthExpenses = expenses.filter((e) => monthKey(e.expense_date) === m);
      const refunds = monthExpenses
        .filter((e) => REFUND_CATEGORIES.includes(e.category))
        .reduce((s, e) => s + Number(e.amount), 0);
      const expensesTotal = monthExpenses
        .filter((e) => !REFUND_CATEGORIES.includes(e.category))
        .reduce((s, e) => s + Number(e.amount), 0);
      const adSpend = monthExpenses
        .filter((e) => e.category.startsWith("advertising_"))
        .reduce((s, e) => s + Number(e.amount), 0);
      const rndTotal = monthExpenses
        .filter((e) => e.is_rnd)
        .reduce((s, e) => s + Number(e.amount), 0);

      const newPaying = newPayingByMonth.get(m) ?? 0;
      const income = incomeSubs + incomeQuiz;

      return {
        month: m,
        income_subscriptions: incomeSubs,
        income_quiz: incomeQuiz,
        income_total: income,
        expenses_total: expensesTotal,
        refunds_total: refunds,
        ad_spend: adSpend,
        rnd_total: rndTotal,
        new_paying: newPaying,
        cac_actual: adSpend > 0 && newPaying > 0 ? Math.round(adSpend / newPaying) : null,
        net: income - expensesTotal - refunds,
      };
    });

    const cumulativeNet = rows.reduce((s, r) => s + r.net, 0);

    return NextResponse.json({
      ok: true,
      months: rows,
      expenses: expenses.slice(0, 500),
      cumulative_net: cumulativeNet,
      targets: targetsRes.data ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const amount = Number(b.amount);
    if (!b.expense_date || !b.category || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "חסרים תאריך, קטגוריה או סכום תקין" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .insert({
        expense_date: String(b.expense_date),
        category: String(b.category),
        vendor: b.vendor ? String(b.vendor).slice(0, 200) : null,
        description: b.description ? String(b.description).slice(0, 500) : null,
        amount,
        vat_amount: b.vat_amount != null && b.vat_amount !== "" ? Number(b.vat_amount) : null,
        is_rnd: !!b.is_rnd,
        channel: b.channel ? String(b.channel) : null,
        receipt_ref: b.receipt_ref ? String(b.receipt_ref).slice(0, 120) : null,
        note: b.note ? String(b.note).slice(0, 1000) : null,
        created_by: String(b.created_by ?? "admin").slice(0, 60),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Optional handoff to Sumit as a DRAFT expense document (the accountant
    // reads the books from Sumit). Refund categories are money back to
    // therapists — not supplier expenses — and are never pushed.
    let sumit: { status: string; error?: string } | null = null;
    if (b.send_to_sumit && !REFUND_CATEGORIES.includes(String(b.category))) {
      sumit = await pushExpenseToSumit(data);
    }

    return NextResponse.json({ ok: true, expense: data, sumit });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

type ExpenseDbRow = {
  id: string;
  expense_date: string;
  category: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  vat_amount: number | null;
  receipt_ref: string | null;
};

async function pushExpenseToSumit(e: ExpenseDbRow): Promise<{ status: string; error?: string }> {
  const gross = Number(e.amount) + Number(e.vat_amount ?? 0);
  const breakdown =
    e.vat_amount != null
      ? `לפני מע"מ ₪${Number(e.amount)}, מע"מ ₪${Number(e.vat_amount)}. `
      : "";
  const result = await createSumitExpenseDraft({
    date: e.expense_date,
    supplierName: e.vendor || "ספק כללי",
    itemName: labelOf(EXPENSE_CATEGORIES, e.category) || "הוצאה",
    amountGross: gross,
    expenseNumber: e.receipt_ref ?? undefined,
    description: `${breakdown}${e.description ?? ""} (נוצר אוטומטית מ-CRM טיפול חכם — טיוטה לאישור)`.trim(),
  });

  const update = result.ok
    ? { sumit_doc_id: result.documentId, sumit_status: "draft_created", sumit_error: null }
    : { sumit_status: "failed", sumit_error: result.error.slice(0, 300) };
  const { error: updateErr } = await supabaseAdmin.from("expenses").update(update).eq("id", e.id);
  if (updateErr) console.error("expenses sumit-status update failed:", updateErr.message);

  return result.ok ? { status: "draft_created" } : { status: "failed", error: result.error };
}

// Late/retry send of an existing row to Sumit.
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    if (b.action !== "send_to_sumit" || !b.id) {
      return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
    }
    const { data: row, error } = await supabaseAdmin
      .from("expenses")
      .select("id, expense_date, category, vendor, description, amount, vat_amount, receipt_ref, sumit_doc_id")
      .eq("id", b.id)
      .maybeSingle();
    if (error || !row) return NextResponse.json({ ok: false, error: "רשומה לא נמצאה" }, { status: 404 });
    if (row.sumit_doc_id) {
      return NextResponse.json({ ok: false, error: "כבר נוצרה טיוטה ב-Sumit לרשומה זו" }, { status: 400 });
    }
    if (REFUND_CATEGORIES.includes(row.category)) {
      return NextResponse.json({ ok: false, error: "החזרים לא נשלחים ל-Sumit כהוצאת ספק" }, { status: 400 });
    }
    const sumit = await pushExpenseToSumit(row);
    return NextResponse.json({ ok: sumit.status === "draft_created", sumit });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
}
