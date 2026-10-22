import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("./therapist-recipient", () => ({ operationalMailTarget: vi.fn() }));
vi.mock("./therapist-emails", () => ({ sendGiftOfferEmail: vi.fn() }));
vi.mock("./audit", () => ({ writeAudit: vi.fn() }));
vi.mock("./gift-checkout", () => ({ issueGiftCheckoutToken: vi.fn(), JOIN_LINK_PLACEHOLDER: "{{JOIN}}", GIFT_OFFER_TTL_DAYS: 14 }));

const { isPromotionStatusChange, lastPromotionChangeWithin, PAST_PROMOTION_EXCLUDE_DAYS } = await import("./gift-offer");

// 22/10/2026, the owner: the agent offered a gift to a therapist who had paid and
// been refunded, and to one who had a gift promotion for an article and left
// without paying. Whoever was in the promoted track is not offered a gift for a year.
const NOW = Date.parse("2026-10-22T10:00:00Z");
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("isPromotionStatusChange", () => {
  it("counts entering and leaving the promoted track, on every path", () => {
    expect(isPromotionStatusChange("status_change:pending->paying")).toBe(true);
    expect(isPromotionStatusChange("status_change:approved->paying")).toBe(true);
    expect(isPromotionStatusChange("status_change:paying->approved")).toBe(true);
  });
  it("ignores everything else in the log", () => {
    expect(isPromotionStatusChange("status_change:pending->approved")).toBe(false);
    expect(isPromotionStatusChange("approve_listing")).toBe(false);
    expect(isPromotionStatusChange("article_invite")).toBe(false);
    expect(isPromotionStatusChange("gift_offer_sent")).toBe(false);
  });
});

describe("lastPromotionChangeWithin", () => {
  it("paid, refunded and left two months ago: excluded, from the exit", () => {
    const rows = [
      { action: "status_change:pending->paying", created_at: day(115) },
      { action: "approve_listing", created_at: day(115) },
      { action: "status_change:paying->approved", created_at: day(53) },
    ];
    expect(lastPromotionChangeWithin(rows, NOW)).toBe(day(53));
  });

  it("a gift promotion that ended five days ago: excluded", () => {
    const rows = [
      { action: "status_change:pending->approved", created_at: day(71) },
      { action: "status_change:approved->paying", created_at: day(66) },
      { action: "status_change:paying->approved", created_at: day(5) },
    ];
    expect(lastPromotionChangeWithin(rows, NOW)).toBe(day(5));
  });

  it("left more than a year ago, or never promoted: can be offered", () => {
    expect(lastPromotionChangeWithin([{ action: "status_change:paying->approved", created_at: day(PAST_PROMOTION_EXCLUDE_DAYS + 1) }], NOW)).toBeNull();
    expect(lastPromotionChangeWithin([{ action: "status_change:pending->approved", created_at: day(10) }], NOW)).toBeNull();
    expect(lastPromotionChangeWithin([], NOW)).toBeNull();
  });
});

describe("the rule is applied wherever a gift recipient is chosen", () => {
  it("the agent's pool, the send path and the queue cards", () => {
    const gaps = readFileSync("app/lib/supply-gaps.ts", "utf8");
    expect(gaps).toMatch(/recentlyPromotedIds\(\)/);
    expect(gaps).toMatch(/!pastPromoted\.has\(t\.id\)/);
    const lib = readFileSync("app/lib/gift-offer.ts", "utf8");
    expect(lib).toMatch(/const pastPromotion = await pastPromotionError\(opts\.therapistId\);\s*if \(pastPromotion\) return \{ ok: false/);
    const route = readFileSync("app/api/admin-agents/route.ts", "utf8");
    expect(route).toMatch(/gift_offered_ids: await Promise\.all\(\[[\s\S]*recentlyPromotedIds\(\)/);
  });
});
