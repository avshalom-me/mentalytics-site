// Real income, read from the documents Sumit issued rather than from what the
// site recorded while charging.
//
// `payments` is written by the charge flow and the renewal mirror, so it holds
// charges only. Refunds are made in Sumit, as credit notes, and never came back:
// on 29/9/2026 Sumit held nine of them since 19/8 (-₪2,030 before VAT) and the
// finance screen showed none, which put its income about 19% above the real
// figure (September: 35%). The daily cron copies the documents into
// `sumit_documents`, and the finance screen reads each month's sales and
// refunds from them (monthIncome below).
//
// Credits are deliberately NOT written into `payments` as negative rows: that
// table also feeds the Google Ads conversion upload, the CAC count and the
// payment checks, none of which expect a negative amount. Nor are Sumit's
// charges copied into it: the documents are read where the totals are needed.
//
// Everything here is read-only towards Sumit.

import type { SupabaseClient } from "@supabase/supabase-js";
import { listDocuments, type SumitListedDocument } from "@/app/lib/sumit";
import { VAT_RATE } from "@/app/lib/crm";

export type SumitDocumentKind = "charge" | "credit" | "other";

// Sumit's Accounting_Typed_DocumentType. A sale is counted once, from its tax
// invoice: an invoice (0) or an invoice-receipt (1). A plain receipt (2) is the
// payment against an invoice that is already counted, so counting it as well
// would double the sale. The same on the refund side: a credit invoice (5) or
// credit invoice-receipt (6) counts, a credit receipt (7) does not. Every
// document on the account so far is a 1 or a 6.
const CHARGE_TYPES = new Set([0, 1]);
const CREDIT_TYPES = new Set([5, 6]);

export function documentKind(type: number): SumitDocumentKind {
  if (CHARGE_TYPES.has(type)) return "charge";
  if (CREDIT_TYPES.has(type)) return "credit";
  return "other";
}

export type SumitDocumentRow = {
  document_id: number;
  document_number: number | null;
  doc_type: number;
  kind: SumitDocumentKind;
  doc_date: string;
  currency: number | null;
  value_gross: number;
  value_net: number;
  customer_id: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One listed document → one table row, or null for a draft or a row we cannot read. */
export function toDocumentRow(d: SumitListedDocument): SumitDocumentRow | null {
  if (d.IsDraft) return null;
  if (typeof d.DocumentID !== "number") return null;
  const day = typeof d.Date === "string" ? d.Date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const gross =
    typeof d.CompanyValue === "number" && Number.isFinite(d.CompanyValue)
      ? d.CompanyValue
      : typeof d.DocumentValue === "number" && Number.isFinite(d.DocumentValue)
        ? d.DocumentValue
        : null;
  if (gross == null) return null;
  const type = Number(d.Type);
  return {
    document_id: d.DocumentID,
    document_number: typeof d.DocumentNumber === "number" ? d.DocumentNumber : null,
    doc_type: type,
    kind: documentKind(type),
    doc_date: day,
    currency: typeof d.Currency === "number" ? d.Currency : null,
    value_gross: round2(gross),
    // Every document is VAT-inclusive at the standard rate: the site charges
    // with VATIncluded:false and Sumit adds 18% (sumit.ts).
    value_net: round2(gross / (1 + VAT_RATE)),
    customer_id: typeof d.CustomerID === "number" ? d.CustomerID : null,
  };
}

export type SumitMonth = {
  /** Sales before VAT. */
  charges_net: number;
  /** Refunds before VAT, as a positive amount. */
  credits_net: number;
  charges: number;
  credits: number;
};

/** Totals per "YYYY-MM" (the document's own date). Months without documents are absent. */
export function monthlySumitTotals(
  rows: { kind: string; doc_date: string; value_net: number | string }[]
): Map<string, SumitMonth> {
  const out = new Map<string, SumitMonth>();
  for (const r of rows) {
    if (r.kind !== "charge" && r.kind !== "credit") continue;
    const month = String(r.doc_date).slice(0, 7);
    const m = out.get(month) ?? { charges_net: 0, credits_net: 0, charges: 0, credits: 0 };
    const net = Number(r.value_net);
    if (!Number.isFinite(net)) continue;
    if (r.kind === "charge") {
      m.charges_net = round2(m.charges_net + net);
      m.charges++;
    } else {
      // A credit is money out whatever sign it arrives with (Sumit sends it negative).
      m.credits_net = round2(m.credits_net + Math.abs(net));
      m.credits++;
    }
    out.set(month, m);
  }
  return out;
}

// Sumit replaced Morning on 11/5/2026, so May's charges are split between two
// providers and June 2026 is the first month whose books are all in Sumit.
export const SUMIT_BOOKS_FROM_MONTH = "2026-06";

export type MonthIncome = {
  /** Sales before VAT: Sumit's invoices from SUMIT_BOOKS_FROM_MONTH on, the site's records before. */
  income: number;
  source: "sumit" | "site";
  /** Sumit's credit notes before VAT, as a positive amount. */
  refunds_sumit: number;
  /** Credit notes plus refunds entered by hand. */
  refunds: number;
  /** Sumit's sales minus what the site recorded; null when there is nothing to compare. */
  site_gap: number | null;
};

// Income and refunds must come from the same books. A credit note can refund a
// charge the site never recorded (on 19/8/2026 one refunded a duplicate charge
// of 17/8 that `payments` does not have), so subtracting Sumit's credits from
// the site's charges would take the same ₪140 off twice. From the first full
// Sumit month on, both sides are read from the documents; the site's own
// records stay as the breakdown and as a check (site_gap).
export function monthIncome(opts: {
  month: string;
  siteIncome: number;
  manualRefunds: number;
  sumit: SumitMonth | null;
}): MonthIncome {
  const fromSumit = opts.month >= SUMIT_BOOKS_FROM_MONTH && opts.sumit !== null;
  if (!fromSumit) {
    return {
      income: opts.siteIncome,
      source: "site",
      refunds_sumit: 0,
      refunds: opts.manualRefunds,
      site_gap: null,
    };
  }
  const income = Math.round(opts.sumit!.charges_net);
  const refundsSumit = Math.round(opts.sumit!.credits_net);
  return {
    income,
    source: "sumit",
    refunds_sumit: refundsSumit,
    refunds: opts.manualRefunds + refundsSumit,
    site_gap: income - opts.siteIncome,
  };
}

// The daily run re-reads this many days, so a cron that fails for a few days
// in a row still catches up. The first run on an empty table reads from
// BACKFILL_FROM instead. Both fit one page (200) at the current volume.
export const SYNC_WINDOW_DAYS = 60;
export const BACKFILL_FROM = "2026-01-01";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export type SumitDocumentsSyncResult = {
  from: string;
  to: string;
  fetched: number;
  upserted: number;
  calls: number;
  truncated: boolean;
};

export async function syncSumitDocuments(
  supabase: SupabaseClient,
  opts: { from?: string; to?: string; now?: Date } = {}
): Promise<SumitDocumentsSyncResult> {
  const now = opts.now ?? new Date();
  let from = opts.from;
  if (!from) {
    const { count, error } = await supabase
      .from("sumit_documents")
      .select("document_id", { count: "exact", head: true });
    if (error) throw new Error(`sumit_documents count: ${error.message}`);
    from = count ? isoDay(addDays(now, -SYNC_WINDOW_DAYS)) : BACKFILL_FROM;
  }
  // Tomorrow, so today's documents are in whatever way Sumit reads the bound.
  const to = opts.to ?? isoDay(addDays(now, 1));

  const { documents, calls, truncated } = await listDocuments({ dateFrom: from, dateTo: to });
  const rows = documents.map(toDocumentRow).filter((r): r is SumitDocumentRow => r !== null);

  if (rows.length > 0) {
    // first_seen_at is left out of the payload, so an existing row keeps it.
    const syncedAt = now.toISOString();
    const { error } = await supabase
      .from("sumit_documents")
      .upsert(rows.map((r) => ({ ...r, synced_at: syncedAt })), { onConflict: "document_id" });
    if (error) throw new Error(`sumit_documents upsert: ${error.message}`);
  }

  return { from, to, fetched: documents.length, upserted: rows.length, calls, truncated };
}
