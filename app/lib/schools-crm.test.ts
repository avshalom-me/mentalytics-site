import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_BRANCH_SETTINGS,
  DEAL_STAGES,
  SCHOOL_ENTITY_TYPES,
  addMonthsIso,
  autoMatchable,
  calendarQuarter,
  ladderStatus,
  matchTransferCandidates,
  normalizeForMatch,
  type ExpectedPayment,
  countsForGate,
  gateReceiptValue,
  generateAccessCode,
  grossToNet,
  licenseInvoiceItem,
  licenseTitle,
  licenseUsable,
  monthsToYearEnd,
  nextExpectedPayment,
  normalizeAccessCode,
  partialPrice,
  payPageOpen,
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

describe("the payment page", () => {
  it("offers the lowest-numbered payment that is still expected, whatever the row order", () => {
    const rows = [
      { seq: 2, status: "expected" },
      { seq: 1, status: "received" },
    ];
    expect(nextExpectedPayment(rows)?.seq).toBe(2);
    expect(nextExpectedPayment([{ seq: 2, status: "expected" }, { seq: 1, status: "expected" }])?.seq).toBe(1);
    expect(nextExpectedPayment([{ seq: 1, status: "received" }])).toBeNull();
    expect(nextExpectedPayment([])).toBeNull();
  });
  it("is open while the licence waits for payment or runs, and closed once it is cancelled or over", () => {
    expect(payPageOpen({ status: "pending_payment", end_date: "2027-08-31" }, "2026-11-01")).toBe(true);
    expect(payPageOpen({ status: "active", end_date: "2027-08-31" }, "2027-02-01")).toBe(true);
    expect(payPageOpen({ status: "active", end_date: "2027-08-31" }, "2027-09-01")).toBe(false);
    expect(payPageOpen({ status: "cancelled", end_date: "2027-08-31" }, "2026-11-01")).toBe(false);
    expect(payPageOpen({ status: "expired", end_date: "2026-08-31" }, "2026-11-01")).toBe(false);
  });
  it("titles the pay page without repeating the school year", () => {
    expect(licenseTitle("annual", "2026/27")).toBe("רישיון שנתי לשנת הלימודים 2026/27");
    expect(licenseTitle("partial", "2026/27")).toBe("רישיון חלקי לשנת הלימודים 2026/27");
  });
  it("names the invoice item after the licence, and numbers a split payment", () => {
    expect(licenseInvoiceItem("annual", "2026/27", 1, 1)).toBe("רישיון שנתי לשאלון היועצות, 2026/27 | טיפול חכם");
    expect(licenseInvoiceItem("partial", "2026/27", 2, 2)).toBe("רישיון חלקי עד סוף שנת הלימודים לשאלון היועצות, 2026/27, תשלום 2 מתוך 2 | טיפול חכם");
  });
});

describe("matching a bank credit to an expected payment", () => {
  const expected: ExpectedPayment[] = [
    { id: "p1", seq: 1, amount_gross: 1180, due_date: "2026-11-01", proforma_number: null, license_id: "l1", school_id: "s1", school_name: "אורנים", school_symbol: "412345" },
    { id: "p2", seq: 1, amount_gross: 1180, due_date: "2026-11-01", proforma_number: "DT-77", license_id: "l2", school_id: "s2", school_name: "בי\"ס הגפן", school_symbol: null },
    { id: "p3", seq: 2, amount_gross: 708, due_date: "2027-02-28", proforma_number: null, license_id: "l1", school_id: "s1", school_name: "אורנים", school_symbol: "412345" },
  ];
  const credit = (amount: number, description: string, reference: string | null = null) => ({ id: "c", line_date: "2026-11-03", amount, description, reference });

  it("normalises punctuation and quotes so a bank description matches a school name", () => {
    expect(normalizeForMatch('העברה מ-בי"ס  הגפן (ת"א)')).toBe("העברה מ בי ס הגפן ת א");
  });
  it("amount plus the school symbol is a strong match, and is applied without a click", () => {
    const [best] = matchTransferCandidates(credit(1180, "העברה עיריית X", "412345"), expected);
    expect(best.payment.id).toBe("p1");
    expect(best.confidence).toBe("strong");
    expect(autoMatchable(best)).toBe(true);
  });
  it("amount plus the proforma number is strong too", () => {
    const [best] = matchTransferCandidates(credit(1180, "DT-77 תשלום"), expected);
    expect(best.payment.id).toBe("p2");
    expect(autoMatchable(best)).toBe(true);
  });
  it("the same amount alone proposes every payment of that amount, never automatically", () => {
    const c = matchTransferCandidates(credit(1180.5, "העברה"), expected);
    expect(c.map((x) => x.payment.id)).toEqual(["p1", "p2"]);
    expect(c.every((x) => x.confidence === "amount" && !autoMatchable(x))).toBe(true);
  });
  it("a name in the description strengthens a proposal but does not apply it by itself", () => {
    const [best] = matchTransferCandidates(credit(1180, "העברה מבית ספר אורנים"), expected);
    expect(best.payment.id).toBe("p1");
    expect(best.confidence).toBe("strong");
    expect(autoMatchable(best)).toBe(false);
  });
  it("a symbol with a different amount is only a weak hint, and an unrelated credit is nothing", () => {
    const weak = matchTransferCandidates(credit(500, "412345"), expected);
    expect(weak.map((x) => [x.payment.id, x.confidence])).toEqual([["p1", "key"], ["p3", "key"]]);
    expect(matchTransferCandidates(credit(999, "משכורת"), expected)).toEqual([]);
  });
  it("a short symbol inside a longer number does not match", () => {
    const short = [{ ...expected[0], school_symbol: "123" }];
    expect(matchTransferCandidates(credit(1180, "ref 4123456"), short)[0].reasons).toEqual(["amount"]);
  });
});

describe("the ladder (section 9, appendix B)", () => {
  const settings = { start_date: "2026-10-22", ladder: DEFAULT_BRANCH_SETTINGS.ladder };
  it("adds calendar months, clamped to the month's last day", () => {
    expect(addMonthsIso("2026-10-22", 2)).toBe("2026-12-22");
    expect(addMonthsIso("2026-12-31", 2)).toBe("2027-02-28");
    expect(addMonthsIso("2026-11-15", 14)).toBe("2028-01-15");
  });
  it("starts at the first stage on the start day, with nothing sold", () => {
    const s = ladderStatus(settings, [], "2026-10-22");
    expect(s.current).toEqual({ stage: 1, rate: 0.1, since: "2026-10-22" });
    expect(s.next).toMatchObject({ stage: 2, not_before: "2026-12-22", gates_met_on: null, applies_from: null });
    expect(s.steps.map((x) => [x.stage, x.not_before, x.applies_from])).toEqual([
      [1, "2026-10-22", "2026-10-22"],
      [2, "2026-12-22", null],
      [3, "2027-02-22", null],
      [4, "2027-04-22", null],
      [5, "2027-06-22", null],
    ]);
  });
  it("a stage whose date came but whose gates are not met waits, and the rate does not move", () => {
    const events = [{ date: "2026-11-05", schools: 39, receipts: 30000 }];
    expect(ladderStatus(settings, events, "2027-03-01").current.stage).toBe(1);
  });
  it("both gates met: the stage applies from the first of the next month, not before its date", () => {
    const early = [{ date: "2026-11-05", schools: 40, receipts: 25000 }];
    const s1 = ladderStatus(settings, early, "2026-12-01");
    expect(s1.current.stage).toBe(1);
    expect(s1.next?.gates_met_on).toBe("2026-11-05");
    expect(s1.next?.applies_from).toBe("2026-12-22");
    expect(ladderStatus(settings, early, "2026-12-22").current).toEqual({ stage: 2, rate: 0.2, since: "2026-12-22" });
    const late = [{ date: "2027-01-10", schools: 40 }, { date: "2027-02-03", receipts: 25000 }];
    const s2 = ladderStatus(settings, late, "2027-03-01");
    expect(s2.current).toEqual({ stage: 2, rate: 0.2, since: "2027-03-01" });
  });
  it("when several stages' gates are met, the highest stage whose date came applies", () => {
    const big = [{ date: "2026-11-01", schools: 130, receipts: 80000 }];
    expect(ladderStatus(settings, big, "2027-01-15").current.stage).toBe(2);
    expect(ladderStatus(settings, big, "2027-02-22").current.stage).toBe(3);
  });
  it("without a start date nothing advances", () => {
    const s = ladderStatus({ ...settings, start_date: null }, [{ date: "2026-11-01", schools: 999, receipts: 1e7 }], "2027-12-01");
    expect(s.current.stage).toBe(1);
  });
  it("names the calendar quarter of a date (the calculation period)", () => {
    expect(calendarQuarter("2026-10-22")).toEqual({ label: "רבעון 4, 2026", start: "2026-10-01", end: "2026-12-31" });
    expect(calendarQuarter("2027-02-28")).toEqual({ label: "רבעון 1, 2027", start: "2027-01-01", end: "2027-03-31" });
  });
});
