import { describe, it, expect } from "vitest";
import {
  allocateByShare,
  anomalies,
  budgetUtilization,
  giftFunnel,
  pct,
  runwayMonths,
} from "./budget-report-calc";
import { HOLIDAYS_KNOWN_UNTIL, holidaysBetween } from "./israel-holidays";

describe("allocateByShare", () => {
  it("splits spend by where a campaign's searches came from", () => {
    // g-tlv: 20 searches in Gush Dan, 5 in the Shfela.
    const out = allocateByShare(1000, new Map([["גוש דן", 20], ["השפלה והמרכז", 5], ["דרום", 0]]));
    expect(out.get("גוש דן")).toBe(800);
    expect(out.get("השפלה והמרכז")).toBe(200);
    expect(out.has("דרום")).toBe(false);
  });

  it("gives nothing when there is nothing to split by", () => {
    expect(allocateByShare(1000, new Map()).size).toBe(0);
  });
});

describe("budgetUtilization", () => {
  const days = (cost: number, n = 14) => Array.from({ length: n }, () => ({ cost }));

  it("calls a campaign that spends its whole budget budget-limited", () => {
    expect(budgetUtilization(days(24), 25)).toMatchObject({ kind: "limited", share: 0.96 });
  });

  it("calls one that spends well under it demand-limited", () => {
    expect(budgetUtilization(days(10), 25)).toMatchObject({ kind: "saturated", share: 0.4 });
  });

  it("does not judge a young campaign or one without a budget", () => {
    expect(budgetUtilization(days(10, 3), 25).kind).toBe("unknown");
    expect(budgetUtilization(days(10), null).kind).toBe("unknown");
  });
});

describe("anomalies", () => {
  it("reports a 30% move in cost per click on enough clicks", () => {
    const a = anomalies({ cost: 300, clicks: 100, impressions: 2000 }, { cost: 520, clicks: 100, impressions: 2000 });
    expect(a).toHaveLength(1);
    expect(a[0].metric).toBe("cpc");
    expect(a[0].change).toBeCloseTo(0.733, 2);
  });

  it("reports a fall in click-through rate", () => {
    const a = anomalies({ cost: 300, clicks: 100, impressions: 1000 }, { cost: 300, clicks: 100, impressions: 2000 });
    expect(a.map((x) => x.metric)).toEqual(["ctr"]);
    expect(a[0].change).toBeCloseTo(-0.5, 5);
  });

  it("stays quiet on small samples", () => {
    expect(anomalies({ cost: 30, clicks: 10, impressions: 100 }, { cost: 90, clicks: 10, impressions: 100 })).toEqual([]);
  });
});

describe("runwayMonths", () => {
  it("counts months of cash at a monthly loss", () => {
    expect(runwayMonths(60000, -8000)).toBe(7.5);
  });

  it("has nothing to count without cash, or without a loss", () => {
    expect(runwayMonths(null, -8000)).toBeNull();
    expect(runwayMonths(60000, 500)).toBeNull();
  });
});

describe("giftFunnel", () => {
  it("follows each offer from sent to paid", () => {
    const offers = [
      { therapist_id: "a", sent_at: "2026-09-24T09:00:00Z" },
      { therapist_id: "b", sent_at: "2026-09-24T09:00:00Z" },
      { therapist_id: "c", sent_at: "2026-09-24T09:00:00Z" },
    ];
    const tokens = [
      // Opened the same day, registered.
      { therapist_id: "a", created_at: "2026-09-24T09:00:00Z", first_viewed_at: "2026-09-24T20:00:00Z", used_at: "2026-09-24T21:00:00Z" },
      // Opened three days later, did not register.
      { therapist_id: "b", created_at: "2026-09-24T09:00:00Z", first_viewed_at: "2026-09-27T09:00:00Z", used_at: null },
      // Never opened.
      { therapist_id: "c", created_at: "2026-09-24T09:00:00Z", first_viewed_at: null, used_at: null },
    ];
    const f = giftFunnel(offers, tokens, new Map([["a", ["2026-10-24T06:45:00Z"]]]));
    expect(f).toEqual({ sent: 3, opened: 2, openedWithin34h: 1, registered: 1, paid: 1 });
  });

  it("counts a registration as an opening even when the view was never logged", () => {
    const f = giftFunnel(
      [{ therapist_id: "a", sent_at: "2026-08-20T09:00:00Z" }],
      [{ therapist_id: "a", created_at: "2026-08-20T09:00:00Z", first_viewed_at: null, used_at: "2026-08-21T10:00:00Z" }],
      new Map()
    );
    expect(f).toEqual({ sent: 1, opened: 1, openedWithin34h: 0, registered: 1, paid: 0 });
  });

  it("does not count a charge from before the offer as paying for it", () => {
    const f = giftFunnel(
      [{ therapist_id: "a", sent_at: "2026-09-24T09:00:00Z" }],
      [{ therapist_id: "a", created_at: "2026-09-24T09:00:00Z", first_viewed_at: "2026-09-24T10:00:00Z", used_at: "2026-09-24T11:00:00Z" }],
      new Map([["a", ["2026-08-01T00:00:00Z"]]])
    );
    expect(f.paid).toBe(0);
  });
});

describe("holidays", () => {
  it("knows the week before 29/9/2026 was Sukkot", () => {
    expect(holidaysBetween("2026-09-22", "2026-09-29").map((h) => h.name)).toEqual(["סוכות ושמיני עצרת"]);
  });

  it("lists the High Holidays inside a 30-day window", () => {
    expect(holidaysBetween("2026-08-30", "2026-09-28").map((h) => h.name)).toEqual([
      "ראש השנה",
      "יום כיפור",
      "סוכות ושמיני עצרת",
    ]);
  });

  it("covers at least the coming year", () => {
    expect(HOLIDAYS_KNOWN_UNTIL >= "2027-09-30").toBe(true);
  });
});

describe("pct", () => {
  it("rounds, and has no base for zero", () => {
    expect(pct(1, 14)).toBe("7%");
    expect(pct(1, 0)).toBe("—");
  });
});
