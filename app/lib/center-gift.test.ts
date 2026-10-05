import { describe, it, expect } from "vitest";
import { giftDaysLeft, giftUntilFromMonths, isCenterOnGift, stopReasonLabel } from "./center-gift";

const DAY = 86_400_000;

describe("a centre on a gift promotion", () => {
  it("is an active centre the admin granted a gift to", () => {
    expect(isCenterOnGift({ status: "active", gift_granted_at: "2026-10-05T10:00:00.000Z" })).toBe(true);
  });

  it("is not a paying centre, whose gift fields are empty", () => {
    expect(isCenterOnGift({ status: "active", gift_granted_at: null })).toBe(false);
    expect(isCenterOnGift({ status: "active" })).toBe(false);
  });

  it("is not a stopped centre, even if a gift date was left on the row", () => {
    expect(isCenterOnGift({ status: "cancelled", gift_granted_at: "2026-10-05T10:00:00.000Z" })).toBe(false);
    expect(isCenterOnGift({ status: "draft", gift_granted_at: "2026-10-05T10:00:00.000Z" })).toBe(false);
  });
});

describe("the end date of a gift of N months", () => {
  const from = new Date("2026-10-05T10:30:00.000Z");

  it("falls on the same day of the month, N months on", () => {
    expect(giftUntilFromMonths(1, from)).toBe("2026-11-05T10:30:00.000Z");
    expect(giftUntilFromMonths(3, from)).toBe("2027-01-05T10:30:00.000Z");
  });

  it("is a year on for twelve months", () => {
    expect(giftUntilFromMonths(12, from)).toBe("2027-10-05T10:30:00.000Z");
  });

  it("stops at the end of a shorter month instead of spilling into the next one", () => {
    expect(giftUntilFromMonths(1, new Date("2026-08-31T08:00:00.000Z"))).toBe("2026-09-30T08:00:00.000Z");
    expect(giftUntilFromMonths(1, new Date("2027-01-31T08:00:00.000Z"))).toBe("2027-02-28T08:00:00.000Z");
    expect(giftUntilFromMonths(1, new Date("2028-01-31T08:00:00.000Z"))).toBe("2028-02-29T08:00:00.000Z");
  });

  it("leaves the date it was given untouched", () => {
    const start = new Date("2026-10-05T10:30:00.000Z");
    giftUntilFromMonths(6, start);
    expect(start.toISOString()).toBe("2026-10-05T10:30:00.000Z");
  });
});

describe("the days left on a gift", () => {
  const now = new Date("2026-10-05T10:00:00.000Z").getTime();
  const gift = (until: string | null) => ({ status: "active", gift_granted_at: "2026-09-05T10:00:00.000Z", gift_until: until });

  it("counts whole days, rounding a part of a day up", () => {
    expect(giftDaysLeft(gift(new Date(now + 14 * DAY).toISOString()), now)).toBe(14);
    expect(giftDaysLeft(gift(new Date(now + DAY / 2).toISOString()), now)).toBe(1);
  });

  it("is zero or less once the period is over", () => {
    expect(giftDaysLeft(gift(new Date(now).toISOString()), now)).toBe(0);
    expect(giftDaysLeft(gift(new Date(now - 2 * DAY).toISOString()), now)).toBe(-2);
  });

  it("is unknown for a gift with no end date, and for a centre that is not on a gift", () => {
    expect(giftDaysLeft(gift(null), now)).toBeNull();
    expect(giftDaysLeft({ status: "active", gift_granted_at: null, gift_until: null }, now)).toBeNull();
    expect(giftDaysLeft({ status: "cancelled", gift_granted_at: "2026-09-05T10:00:00.000Z", gift_until: new Date(now + DAY).toISOString() }, now)).toBeNull();
  });

  it("is unknown for a date that does not parse", () => {
    expect(giftDaysLeft(gift("not a date"), now)).toBeNull();
  });
});

describe("why a centre's subscription stopped", () => {
  it("names each reason the system writes", () => {
    expect(stopReasonLabel("admin")).toBe("נעצר מהאדמין");
    expect(stopReasonLabel("sumit")).toBe("הוראת הקבע בוטלה ב-Sumit");
    expect(stopReasonLabel("gift_ended")).toBe("תקופת המתנה הסתיימה");
  });

  it("has nothing to say about a centre stopped before reasons were kept", () => {
    expect(stopReasonLabel(null)).toBeNull();
    expect(stopReasonLabel(undefined)).toBeNull();
    expect(stopReasonLabel("something else")).toBeNull();
  });
});
