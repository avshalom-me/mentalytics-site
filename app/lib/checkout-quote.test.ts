import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkoutQuote,
  SUBSCRIPTION_REGULAR_PRICE,
  TRIAL_UPGRADE_PRICE,
  TRIAL_UPGRADE_MONTHS,
  TRIAL_UPGRADE_TOTAL,
  SUBSCRIPTION_REGULAR_TOTAL,
} from "./promo";

// 23/10/2026: a therapist whose gift period was ending got the email "the first two
// months at ₪60 + VAT", clicked through, and the checkout page showed ₪140 - in the
// price, in the consent checkbox and on the pay button (₪165.20). The server would
// have charged ₪60; the page never knew about the offer. None of the 16 therapists
// who got the offer since 30/8 subscribed through it.
const NOW = new Date("2026-10-23T10:00:00Z");

describe("checkoutQuote", () => {
  it("an active end-of-trial offer: ₪60 + VAT for two months, then the regular price", () => {
    const q = checkoutQuote("2026-11-01T08:00:49Z", NOW);
    expect(q).toEqual({
      kind: "trial_upgrade",
      unitPrice: TRIAL_UPGRADE_PRICE,
      unitTotal: TRIAL_UPGRADE_TOTAL,
      discountMonths: TRIAL_UPGRADE_MONTHS,
      regularPrice: SUBSCRIPTION_REGULAR_PRICE,
      regularTotal: SUBSCRIPTION_REGULAR_TOTAL,
    });
    expect([q.unitPrice, q.unitTotal, q.discountMonths]).toEqual([60, 70.8, 2]);
  });

  it("an expired offer, or none: the regular price (the early bird ended on 9/7/2026)", () => {
    expect(checkoutQuote("2026-10-01T00:00:00Z", NOW).kind).toBe("regular");
    expect(checkoutQuote(null, NOW)).toMatchObject({ kind: "regular", unitPrice: 140, unitTotal: 165.2, discountMonths: 0 });
  });

  it("the early bird when its window was open, and the personal offer wins over it", () => {
    const july = new Date("2026-07-05T10:00:00Z");
    expect(checkoutQuote(null, july)).toMatchObject({ kind: "early_bird", unitPrice: 90, discountMonths: 3 });
    expect(checkoutQuote("2026-07-20T00:00:00Z", july).kind).toBe("trial_upgrade");
  });
});

describe("the page and the charge read the same decision", () => {
  it("create-subscription charges checkoutQuote's price", () => {
    const route = readFileSync("app/api/payments/create-subscription/route.ts", "utf8");
    expect(route).toMatch(/const quote = checkoutQuote\(therapist\.upgrade_offer_until/);
    expect(route).toContain("const unitPrice = quote.unitPrice;");
  });

  it("the checkout page shows the server's quote in the price, the consent and the button", () => {
    const page = readFileSync("app/therapists/checkout/page.tsx", "utf8");
    expect(page).toContain('fetch("/api/payments/checkout-info"');
    expect(page).toContain("setQuote(info.quote as CheckoutQuote)");
    expect(page).toContain("חיוב מאובטח - ₪{quote.unitTotal}");
    expect(page).toMatch(/ואת החיוב החודשי המתחדש - ₪\$\{quote\.unitPrice\}/);
    // the browser no longer reads the therapists table (closed to clients on 20/10/2026)
    expect(page).not.toMatch(/\.from\("therapists"\)/);
  });

  it("the dashboard's join banner shows the same quote (a free therapist with an offer saw ₪140 there)", () => {
    const dash = readFileSync("app/therapists/dashboard/page.tsx", "utf8");
    expect(dash).toContain("const quote = checkoutQuote(profile.upgrade_offer_until ?? null);");
    expect(dash).toContain("₪{quote.unitPrice}");
    expect(dash).not.toMatch(/isPromoActive\(\)/);
  });

  it("the info route answers from checkoutQuote for the signed-in user's own row", () => {
    const info = readFileSync("app/api/payments/checkout-info/route.ts", "utf8");
    expect(info).toContain('.eq("user_id", user.id)');
    expect(info).toContain("quote: checkoutQuote(");
  });
});
