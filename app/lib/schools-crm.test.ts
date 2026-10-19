import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_BRANCH_SETTINGS,
  DEAL_STAGES,
  SCHOOL_ENTITY_TYPES,
  countsForGate,
  gateReceiptValue,
  generateAccessCode,
  grossToNet,
  licenseUsable,
  monthsToYearEnd,
  normalizeAccessCode,
  partialPrice,
  paymentSchedule,
  planLicense,
  platformFeeForMonth,
  schoolYearOf,
  type LicenseLike,
} from "./schools-crm";

const base: LicenseLike = {
  kind: "annual", status: "active", start_date: "2026-11-01", end_date: "2027-08-31",
  price_net: 636, months: 12, paid_at: "2026-11-01T10:00:00Z", refunded_at: null, code_disabled: false,
};

describe("school year and license dates (appendix D)", () => {
  it("1 September opens the year, 31 August closes it", () => {
    expect(schoolYearOf("2026-09-01").label).toBe("2026/27");
    expect(schoolYearOf("2027-08-31").label).toBe("2026/27");
    expect(schoolYearOf("2027-09-01").label).toBe("2027/28");
    expect(schoolYearOf("2026-03-15")).toMatchObject({ start: "2025-09-01", end: "2026-08-31" });
  });
  it("counts calendar months to 31 August, a started month counts whole", () => {
    expect(monthsToYearEnd("2026-09-01")).toBe(12);
    expect(monthsToYearEnd("2026-11-20")).toBe(10);
    expect(monthsToYearEnd("2027-04-30")).toBe(5);
    expect(monthsToYearEnd("2027-08-10")).toBe(1);
  });
  it("an annual licence bought mid-year becomes a partial one to 31 August", () => {
    const p = planLicense("annual", "2026-11-20");
    expect(p).toMatchObject({ kind: "partial", school_year: "2026/27", end_date: "2027-08-31", months: 10, next_year_purchase: false });
  });
  it("a purchase between May and August is for the next year, with immediate access", () => {
    const p = planLicense("annual", "2027-06-10");
    expect(p).toMatchObject({ kind: "annual", school_year: "2027/28", start_date: "2027-06-10", end_date: "2028-08-31", months: 12, next_year_purchase: true });
  });
  it("pilot and trial licences run for the configured number of days", () => {
    expect(planLicense("trial", "2026-11-01").end_date).toBe("2026-11-15");
    expect(planLicense("pilot", "2026-11-01").end_date).toBe("2026-12-31");
  });
});

describe("prices and payment schedules (Gefen guide, p. 20)", () => {
  it("net is gross without 18% VAT, rounded to agorot", () => {
    expect(grossToNet(750)).toBe(635.59);
    expect(partialPrice(750, 10)).toBe(625);
  });
  it("full schedule is one payment on activation", () => {
    const s = paymentSchedule(4900, "full", "2026-11-01", schoolYearOf("2026-11-01"));
    expect(s).toEqual([{ seq: 1, amount_gross: 4900, amount_net: 4152.54, due_date: "2026-11-01" }]);
  });
  it("40/60 split: 40% on activation, the rest by 28 February", () => {
    const s = paymentSchedule(4900, "split_40_60", "2026-11-01", schoolYearOf("2026-11-01"));
    expect(s.map((p) => [p.seq, p.amount_gross, p.due_date])).toEqual([[1, 1960, "2026-11-01"], [2, 2940, "2027-02-28"]]);
    expect(s[0].amount_gross + s[1].amount_gross).toBe(4900);
  });
  it("a purchase after 31 December is paid in full with the order", () => {
    const s = paymentSchedule(4900, "split_40_60", "2027-01-15", schoolYearOf("2027-01-15"));
    expect(s).toHaveLength(1);
    expect(s[0].amount_gross).toBe(4900);
  });
});

describe("access codes", () => {
  it("are eight readable characters in two groups, and normalise what a counsellor types", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(normalizeAccessCode(" abcd 2345 ")).toBe("ABCD-2345");
    expect(normalizeAccessCode("abcd-234")).toBeNull();
    expect(normalizeAccessCode("ABCD-O123")).toBeNull(); // O and 1 are not in the alphabet
  });
  it("use the random bytes they are given", () => {
    const fixed = generateAccessCode(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(fixed).toBe("ABCD-EFGH");
  });
});

describe("licence state and the contract's gates (appendix B)", () => {
  it("a licence opens the questionnaire only while active and within its dates", () => {
    expect(licenseUsable(base, "2027-01-10")).toBe(true);
    expect(licenseUsable(base, "2027-09-01")).toBe(false);
    expect(licenseUsable({ ...base, status: "pending_payment" }, "2027-01-10")).toBe(false);
    expect(licenseUsable({ ...base, code_disabled: true }, "2027-01-10")).toBe(false);
  });
  it("a paid annual licence at or above 450 net counts; demo, pilot and trial never do", () => {
    expect(countsForGate(base)).toBe(true);
    expect(countsForGate({ ...base, price_net: 449 })).toBe(false);
    expect(countsForGate({ ...base, paid_at: null })).toBe(false);
    for (const kind of ["demo", "pilot", "trial", "training_only"]) expect(countsForGate({ ...base, kind })).toBe(false);
  });
  it("a partial licence is measured against the pro-rata floor", () => {
    const partial = { ...base, kind: "partial", months: 5 };
    expect(countsForGate({ ...partial, price_net: 187.5 })).toBe(true); // 450 * 5 / 12
    expect(countsForGate({ ...partial, price_net: 180 })).toBe(false);
  });
  it("a refund within 30 days removes the school from the count, a later one does not", () => {
    expect(countsForGate({ ...base, refunded_at: "2026-11-20T00:00:00Z" })).toBe(false);
    expect(countsForGate({ ...base, refunded_at: "2027-02-01T00:00:00Z" })).toBe(true);
  });
  it("gate B annualises a partial licence's receipt", () => {
    expect(gateReceiptValue(625, { kind: "partial", months: 10 })).toBe(750);
    expect(gateReceiptValue(636, { kind: "annual", months: 12 })).toBe(636);
  });
});

describe("platform fee tiers (clause 8.8)", () => {
  it("500 up to 100K, 1,000 up to 500K, 3% a year above", () => {
    expect(platformFeeForMonth(0)).toBe(500);
    expect(platformFeeForMonth(100_000)).toBe(500);
    expect(platformFeeForMonth(100_001)).toBe(1000);
    expect(platformFeeForMonth(500_000)).toBe(1000);
    expect(platformFeeForMonth(636_000)).toBe(1590);
  });
});

describe("the migration and the lists stay in step", () => {
  const sql = readFileSync("supabase/migrations/20261019_schools_branch.sql", "utf8");
  it("every deal stage in the UI list is allowed by the database", () => {
    for (const s of DEAL_STAGES) expect(sql).toContain(`'${s.value}'`);
  });
  it("activity entity types match the CHECK constraint", () => {
    for (const t of SCHOOL_ENTITY_TYPES) expect(sql).toContain(`'${t}'`);
  });
  it("the default ladder is the one in draft 8 of the agreement", () => {
    expect(DEFAULT_BRANCH_SETTINGS.ladder.map((s) => [s.rate, s.gate_schools, s.gate_receipts])).toEqual([
      [0.1, null, null], [0.2, 40, 25_000], [0.3, 120, 76_000], [0.4, 300, 190_000], [0.5, 500, 320_000],
    ]);
  });
});
