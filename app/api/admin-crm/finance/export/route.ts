import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { EXPENSE_CATEGORIES, REFUND_CATEGORIES, labelOf } from "@/app/lib/crm";

// Monthly accountant package: one CSV, income section then expenses section.
// UTF-8 BOM so Hebrew opens correctly in Excel. Amounts are ₪ before VAT
// (matching both payments.amount and expenses.amount), with a VAT column.

const VAT_RATE = 0.18;

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "חסר חודש (YYYY-MM)" }, { status: 400 });
  }

  const from = `${month}-01`;
  const fromDate = new Date(`${from}T00:00:00Z`);
  const to = new Date(fromDate);
  to.setUTCMonth(to.getUTCMonth() + 1);
  const toIso = to.toISOString();

  try {
    const [payments, expenses, therapists] = await Promise.all([
      fetchAllRows<{ payment_type: string; reference_id: string; amount: number; created_at: string }>(() =>
        supabaseAdmin
          .from("payments")
          .select("payment_type, reference_id, amount, created_at")
          .eq("status", "completed")
          .gte("created_at", `${from}T00:00:00Z`)
          .lt("created_at", toIso)
          .order("created_at", { ascending: true })
      ),
      fetchAllRows<{
        expense_date: string;
        category: string;
        vendor: string | null;
        description: string | null;
        amount: number;
        vat_amount: number | null;
        is_rnd: boolean;
        receipt_ref: string | null;
      }>(() =>
        supabaseAdmin
          .from("expenses")
          .select("expense_date, category, vendor, description, amount, vat_amount, is_rnd, receipt_ref")
          .gte("expense_date", from)
          .lt("expense_date", toIso.slice(0, 10))
          .order("expense_date", { ascending: true })
      ),
      supabaseAdmin.from("therapists").select("id, full_name"),
    ]);

    const nameById = new Map((therapists.data ?? []).map((t) => [t.id, t.full_name ?? ""]));

    const lines: string[] = [];
    lines.push(`חבילת הנהלת חשבונות — טיפול חכם,חודש ${month}`);
    lines.push("");
    lines.push("=== הכנסות (מקור: Sumit) ===");
    lines.push("תאריך,סוג,לקוח,לפני מע\"מ,מע\"מ 18%,כולל מע\"מ");
    let incomeNet = 0;
    for (const p of payments) {
      const net = Number(p.amount);
      const vat = +(net * VAT_RATE).toFixed(2);
      incomeNet += net;
      lines.push(
        [
          p.created_at.slice(0, 10),
          p.payment_type === "subscription" ? "מנוי מטפל" : "שאלון מטופל",
          csvEscape(p.payment_type === "subscription" ? nameById.get(p.reference_id) ?? "" : ""),
          net,
          vat,
          +(net + vat).toFixed(2),
        ].join(",")
      );
    }
    lines.push(`,,סה"כ,${incomeNet},${+(incomeNet * VAT_RATE).toFixed(2)},${+(incomeNet * (1 + VAT_RATE)).toFixed(2)}`);
    lines.push("");
    lines.push("=== הוצאות והחזרים (מקור: הזנה ידנית ב-CRM) ===");
    lines.push("תאריך,קטגוריה,ספק,תיאור,לפני מע\"מ,מע\"מ,אסמכתא,מו\"פ,החזר");
    let expensesNet = 0;
    let refundsNet = 0;
    for (const e of expenses) {
      const isRefund = REFUND_CATEGORIES.includes(e.category);
      if (isRefund) refundsNet += Number(e.amount);
      else expensesNet += Number(e.amount);
      lines.push(
        [
          e.expense_date,
          csvEscape(labelOf(EXPENSE_CATEGORIES, e.category)),
          csvEscape(e.vendor),
          csvEscape(e.description),
          Number(e.amount),
          e.vat_amount != null ? Number(e.vat_amount) : "",
          csvEscape(e.receipt_ref),
          e.is_rnd ? "כן" : "",
          isRefund ? "כן" : "",
        ].join(",")
      );
    }
    lines.push(`,,,סה"כ הוצאות,${expensesNet}`);
    lines.push(`,,,סה"כ החזרים,${refundsNet}`);
    lines.push("");
    lines.push(`מאזן חודשי (לפני מע"מ),${incomeNet - expensesNet - refundsNet}`);

    // The string below starts with an INVISIBLE U+FEFF (BOM) — Excel needs it
    // to open Hebrew UTF-8 correctly. Don't "clean up" the empty-looking char.
    const csv ="﻿" + lines.join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mentalytics-finance-${month}.csv"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
