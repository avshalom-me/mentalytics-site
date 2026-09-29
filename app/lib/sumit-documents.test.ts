import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

process.env.SUMIT_COMPANY_ID = process.env.SUMIT_COMPANY_ID || "1";
process.env.SUMIT_API_KEY = process.env.SUMIT_API_KEY || "test-key";

import { listDocuments, type SumitListedDocument } from "./sumit";
import {
  BACKFILL_FROM,
  documentKind,
  monthIncome,
  monthlySumitTotals,
  syncSumitDocuments,
  toDocumentRow,
} from "./sumit-documents";

// Shapes as /accounting/documents/list/ returned them on 29/9/2026.
const charge = (id: number, date: string, gross: number): SumitListedDocument => ({
  DocumentID: id,
  DocumentNumber: id - 9000,
  Type: 1,
  Date: `${date}T00:00:00`,
  Currency: 0,
  DocumentValue: gross,
  CompanyValue: gross,
  CustomerID: 555,
  IsDraft: false,
});
const credit = (id: number, date: string, gross: number): SumitListedDocument => ({
  ...charge(id, date, gross),
  Type: 6,
});

/** A fake Sumit that serves the given pages in order and records each request body. */
function fakeSumit(pages: { docs: SumitListedDocument[]; hasNext: boolean }[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetchMock = vi.fn(async (url: string, init: { body: string }) => {
    expect(new URL(url).pathname).toBe("/accounting/documents/list/");
    const body = JSON.parse(init.body);
    bodies.push(body);
    const page = pages[Math.min(bodies.length - 1, pages.length - 1)];
    return {
      ok: true,
      json: async () => ({
        Status: 0,
        UserErrorMessage: null,
        TechnicalErrorDetails: null,
        Data: { Documents: page.docs, HasNextPage: page.hasNext },
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { bodies };
}

/** Just enough of a Supabase client for syncSumitDocuments. */
function fakeSupabase(existingRows: number, upsertError: string | null = null) {
  const upserts: { rows: Record<string, unknown>[]; opts: unknown }[] = [];
  const client = {
    from(table: string) {
      expect(table).toBe("sumit_documents");
      return {
        select: () => Promise.resolve({ count: existingRows, error: null }),
        upsert: (rows: Record<string, unknown>[], opts: unknown) => {
          upserts.push({ rows, opts });
          return Promise.resolve({ error: upsertError ? { message: upsertError } : null });
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, upserts };
}

afterEach(() => vi.unstubAllGlobals());

describe("documentKind", () => {
  it("counts a sale once, from its tax invoice, and a refund from its credit invoice", () => {
    expect(documentKind(1)).toBe("charge"); // invoice-receipt: every charge on the account
    expect(documentKind(0)).toBe("charge"); // invoice
    expect(documentKind(6)).toBe("credit"); // credit invoice-receipt: every refund on the account
    expect(documentKind(5)).toBe("credit"); // credit invoice
    // A receipt pays an invoice that is already counted; counting it too would double the sale.
    expect(documentKind(2)).toBe("other");
    expect(documentKind(7)).toBe("other");
    expect(documentKind(12)).toBe("other"); // price quotation
  });
});

describe("toDocumentRow", () => {
  it("takes the VAT out of a charge", () => {
    expect(toDocumentRow(charge(9101, "2026-09-18", 165.2))).toEqual({
      document_id: 9101,
      document_number: 101,
      doc_type: 1,
      kind: "charge",
      doc_date: "2026-09-18",
      currency: 0,
      value_gross: 165.2,
      value_net: 140,
      customer_id: 555,
    });
  });

  it("keeps a credit negative, as Sumit reports it", () => {
    // ₪495.60 refunded three ₪140 months in one note.
    const row = toDocumentRow(credit(9102, "2026-09-02", -495.6));
    expect(row?.kind).toBe("credit");
    expect(row?.value_gross).toBe(-495.6);
    expect(row?.value_net).toBe(-420);
  });

  it("reads the shekel value when the two amounts differ", () => {
    const row = toDocumentRow({ ...charge(9103, "2026-09-01", 50), DocumentValue: 50, CompanyValue: 118, Currency: 1 });
    expect(row?.value_gross).toBe(118);
    expect(row?.value_net).toBe(100);
  });

  it("skips drafts and rows without a date or an amount", () => {
    expect(toDocumentRow({ ...charge(9104, "2026-09-01", 118), IsDraft: true })).toBeNull();
    expect(toDocumentRow({ ...charge(9105, "2026-09-01", 118), Date: null })).toBeNull();
    expect(
      toDocumentRow({ ...charge(9106, "2026-09-01", 118), DocumentValue: null, CompanyValue: null })
    ).toBeNull();
  });
});

describe("monthlySumitTotals", () => {
  it("adds sales and refunds per month, refunds as a positive amount", () => {
    const rows = [
      charge(9201, "2026-09-03", 165.2),
      charge(9202, "2026-09-26", 106.2),
      credit(9203, "2026-09-29", -377.6),
      charge(9204, "2026-08-31", 165.2),
      { ...charge(9205, "2026-09-10", 118), Type: 2 }, // a receipt: not counted
    ]
      .map(toDocumentRow)
      .filter((r) => r !== null);

    const months = monthlySumitTotals(rows);
    expect(months.get("2026-09")).toEqual({ charges_net: 230, credits_net: 320, charges: 2, credits: 1 });
    expect(months.get("2026-08")).toEqual({ charges_net: 140, credits_net: 0, charges: 1, credits: 0 });
    expect(months.has("2026-07")).toBe(false);
  });

  it("treats a credit as money out even if it arrives positive", () => {
    const months = monthlySumitTotals([{ kind: "credit", doc_date: "2026-09-01", value_net: "320.00" }]);
    expect(months.get("2026-09")?.credits_net).toBe(320);
  });
});

// The live figures of 29/9/2026, before VAT.
describe("monthIncome", () => {
  it("September: ₪2,790 of sales less ₪980 of credit notes is ₪1,810", () => {
    const m = monthIncome({
      month: "2026-09",
      siteIncome: 2790,
      manualRefunds: 0,
      sumit: { charges_net: 2790, credits_net: 979.66, charges: 21, credits: 5 },
    });
    expect(m).toEqual({ income: 2790, source: "sumit", refunds_sumit: 980, refunds: 980, site_gap: 0 });
    expect(m.income - m.refunds).toBe(1810);
  });

  it("August: sales come from the same books as the credits, so a refunded duplicate nets to zero", () => {
    // Sumit charged a therapist twice (16/8 and 17/8) and credited the second
    // one on 19/8. The site recorded only the first charge. Taking the credit
    // off the site's figure would remove that ₪140 twice.
    const m = monthIncome({
      month: "2026-08",
      siteIncome: 2390,
      manualRefunds: 0,
      sumit: { charges_net: 2530, credits_net: 1050, charges: 22, credits: 4 },
    });
    expect(m.income).toBe(2530);
    expect(m.refunds).toBe(1050);
    expect(m.site_gap).toBe(140);
  });

  it("adds refunds entered by hand to the credit notes", () => {
    const m = monthIncome({
      month: "2026-09",
      siteIncome: 2790,
      manualRefunds: 200,
      sumit: { charges_net: 2790, credits_net: 979.66, charges: 21, credits: 5 },
    });
    expect(m.refunds).toBe(1180);
  });

  it("keeps the site's figures for May, when half the month was charged through Morning", () => {
    const m = monthIncome({
      month: "2026-05",
      siteIncome: 390,
      manualRefunds: 0,
      sumit: { charges_net: 120, credits_net: 0, charges: 1, credits: 0 },
    });
    expect(m).toEqual({ income: 390, source: "site", refunds_sumit: 0, refunds: 0, site_gap: null });
  });

  it("falls back to the site's figures for a month with no synced document yet", () => {
    const m = monthIncome({ month: "2026-10", siteIncome: 140, manualRefunds: 0, sumit: null });
    expect(m.source).toBe("site");
    expect(m.income).toBe(140);
  });
});

describe("listDocuments", () => {
  it("pages until Sumit says there is nothing more", async () => {
    const sumit = fakeSumit([
      { docs: [charge(1, "2026-09-01", 118), charge(2, "2026-09-02", 118)], hasNext: true },
      { docs: [credit(3, "2026-09-03", -118)], hasNext: false },
    ]);
    const r = await listDocuments({ dateFrom: "2026-08-01", dateTo: "2026-09-30" });
    expect(r.documents.map((d) => d.DocumentID)).toEqual([1, 2, 3]);
    expect(r.calls).toBe(2);
    expect(r.truncated).toBe(false);
    // Without Paging the endpoint returns 10 documents and says nothing.
    expect(sumit.bodies.map((b) => b.Paging)).toEqual([
      { StartIndex: 0, PageSize: 200 },
      { StartIndex: 2, PageSize: 200 },
    ]);
    expect(sumit.bodies[0]).toMatchObject({ DateFrom: "2026-08-01", DateTo: "2026-09-30", IncludeDrafts: false });
  });

  it("stops when a page brings nothing new instead of spending the quota", async () => {
    const same = [charge(1, "2026-09-01", 118)];
    const sumit = fakeSumit([{ docs: same, hasNext: true }]);
    const r = await listDocuments({ dateFrom: "2026-09-01", dateTo: "2026-09-30" });
    expect(r.documents).toHaveLength(1);
    expect(sumit.bodies).toHaveLength(2);
  });

  it("reports a cut-off when the page limit is reached", async () => {
    fakeSumit([
      { docs: [charge(1, "2026-09-01", 118)], hasNext: true },
      { docs: [charge(2, "2026-09-02", 118)], hasNext: true },
    ]);
    const r = await listDocuments({ dateFrom: "2026-09-01", dateTo: "2026-09-30", maxPages: 1 });
    expect(r.truncated).toBe(true);
    expect(r.calls).toBe(1);
  });
});

describe("syncSumitDocuments", () => {
  const now = new Date("2026-09-30T06:45:00Z");

  it("reads the whole year on the first run", async () => {
    const sumit = fakeSumit([
      { docs: [charge(1, "2026-06-11", 165.2), { ...charge(2, "2026-06-12", 118), IsDraft: true }], hasNext: false },
    ]);
    const db = fakeSupabase(0);
    const r = await syncSumitDocuments(db.client, { now });

    expect(sumit.bodies[0]).toMatchObject({ DateFrom: BACKFILL_FROM, DateTo: "2026-10-01" });
    expect(r).toMatchObject({ from: BACKFILL_FROM, fetched: 2, upserted: 1, calls: 1 });
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0].opts).toEqual({ onConflict: "document_id" });
    expect(db.upserts[0].rows[0]).toMatchObject({ document_id: 1, value_net: 140, synced_at: now.toISOString() });
    // An existing row keeps the day it was first seen.
    expect(db.upserts[0].rows[0]).not.toHaveProperty("first_seen_at");
  });

  it("re-reads a trailing 60 days once the table has rows", async () => {
    const sumit = fakeSumit([{ docs: [], hasNext: false }]);
    const db = fakeSupabase(84);
    const r = await syncSumitDocuments(db.client, { now });

    expect(sumit.bodies[0]).toMatchObject({ DateFrom: "2026-08-01", DateTo: "2026-10-01" });
    expect(r.upserted).toBe(0);
    expect(db.upserts).toHaveLength(0);
  });

  it("fails loudly when the rows cannot be saved", async () => {
    fakeSumit([{ docs: [charge(1, "2026-09-01", 118)], hasNext: false }]);
    const db = fakeSupabase(10, "permission denied");
    await expect(syncSumitDocuments(db.client, { now })).rejects.toThrow("permission denied");
  });
});
