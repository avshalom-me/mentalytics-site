import { describe, it, expect } from "vitest";
import {
  priceWithVat,
  SUBSCRIPTION_REGULAR_PRICE,
  SUBSCRIPTION_PROMO_PRICE,
  TRIAL_UPGRADE_PRICE,
  GIFT_FOLLOWON_PRICE,
} from "./promo";

// Sumit stores a standing order's UnitPrice with VAT included, and
// updateRecurringPrice writes into that field. The numbers on the right are
// what four live standing orders actually held when read from the Sumit API on
// 23/9/2026 - so this is not arithmetic for its own sake: a drift here means a
// card is charged an amount nobody agreed to.
describe("priceWithVat", () => {
  it("matches what Sumit holds for live standing orders", () => {
    expect(priceWithVat(SUBSCRIPTION_PROMO_PRICE)).toBe(106.2); // early bird, ₪90
    expect(priceWithVat(SUBSCRIPTION_REGULAR_PRICE)).toBe(165.2); // regular, ₪140
    expect(priceWithVat(240)).toBe(283.2); // a centre, 3 therapists
    expect(priceWithVat(700)).toBe(826); // a centre, flat monthly price
  });

  it("covers the discounted steps offered by email", () => {
    expect(priceWithVat(TRIAL_UPGRADE_PRICE)).toBe(70.8); // end-of-gift upgrade
    expect(priceWithVat(GIFT_FOLLOWON_PRICE)).toBe(82.6); // step after the gift months
  });

  it("rounds to agorot", () => {
    expect(priceWithVat(33.33)).toBe(39.33);
    expect(priceWithVat(0)).toBe(0);
  });
});
