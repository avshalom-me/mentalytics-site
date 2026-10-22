import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("./therapist-recipient", () => ({ operationalMailTarget: vi.fn() }));
vi.mock("./therapist-emails", () => ({ sendGiftOfferEmail: vi.fn() }));
vi.mock("./audit", () => ({ writeAudit: vi.fn() }));
vi.mock("./gift-checkout", () => ({ issueGiftCheckoutToken: vi.fn(), JOIN_LINK_PLACEHOLDER: "{{JOIN}}", GIFT_OFFER_TTL_DAYS: 14 }));

const { giftOfferAfterSend, withProgressLine } = await import("./gift-offer");

// 22/10/2026: a card closed as soon as the slice reached its target, even with
// candidates left on it, and vanished in the middle of a round of sends. The
// admin had to re-run the agent between one send and the next.
describe("giftOfferAfterSend", () => {
  it("keeps the card open while there is someone left to send to, even when the target is reached", () => {
    expect(giftOfferAfterSend({ stillShort: 0, availableCount: 2 })).toEqual({ stillOpen: true, targetReached: true });
    expect(giftOfferAfterSend({ stillShort: 2, availableCount: 1 })).toEqual({ stillOpen: true, targetReached: false });
  });

  it("closes the card when nobody is left on it", () => {
    expect(giftOfferAfterSend({ stillShort: 3, availableCount: 0 }).stillOpen).toBe(false);
    expect(giftOfferAfterSend({ stillShort: 0, availableCount: 0 }).stillOpen).toBe(false);
  });
});

describe("withProgressLine", () => {
  it("says how many are still missing, and replaces the previous line instead of stacking", () => {
    const once = withProgressLine("גוף ההצעה", 1, 2);
    expect(once).toBe("גוף ההצעה\n▸ נשלחו עד כה: 1 הצעות בחיתוך הזה; חסרים עוד 2 כדי לסגור אותו.");
    const twice = withProgressLine(once, 2, 1);
    expect(twice.split("\n")).toHaveLength(2);
    expect(twice).toContain("חסרים עוד 1");
  });

  it("says the target is reached and points to 'סיום'", () => {
    expect(withProgressLine("גוף", 3, 0)).toContain('היעד בחיתוך הושג. אפשר לשלוח גם לנותרים, או ללחוץ "סיום"');
  });
});

describe("the queue offers 'סיום' on a card that already sent", () => {
  it("the card swaps 'דחה' for 'סיום' after a send, and the API closes it as executed", () => {
    const page = readFileSync("app/admin/agents/page.tsx", "utf8");
    expect(page).toMatch(/onClick=\{sentCount > 0 \? onFinish : onDismiss\}/);
    expect(page).toContain('postAgents("gift_offer_finish"');
    const route = readFileSync("app/api/admin-agents/route.ts", "utf8");
    expect(route).toContain("finishGiftOffer(actionId)");
    const lib = readFileSync("app/lib/gift-offer.ts", "utf8");
    expect(lib).toMatch(/status: "executed"[\s\S]*הסתיים ידנית/);
  });

  it("an agent run keeps the sent count of a pending card", () => {
    const gaps = readFileSync("app/lib/supply-gaps.ts", "utf8");
    expect(gaps).toContain("sentCountByKey");
  });
});
