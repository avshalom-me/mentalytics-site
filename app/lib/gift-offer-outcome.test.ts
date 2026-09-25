import { describe, it, expect } from "vitest";
import {
  buildGiftOfferHistory,
  countGiftOutcomes,
  giftOfferOutcome,
  matchGiftToken,
  type GiftOfferRow,
  type GiftTokenRow,
} from "./gift-offer-outcome";

const TRACKING = "2026-09-04T16:22:14Z";

function token(over: Partial<GiftTokenRow>): GiftTokenRow {
  return {
    therapist_id: "t1",
    created_at: "2026-09-24T12:51:56Z",
    expires_at: "2026-10-08T12:51:56Z",
    used_at: null,
    view_count: 0,
    first_viewed_at: null,
    last_viewed_at: null,
    ...over,
  };
}

const offer: GiftOfferRow = {
  id: "o1",
  therapist_id: "t1",
  region: "השרון",
  treatment: "CBT",
  sent_at: "2026-09-24T12:51:57Z",
};

// ההבחנה שהטבלה קיימת בשבילה: "לא לחץ" נאמר רק כשבאמת ספרנו.
describe("what a recipient did with a gift offer", () => {
  it("registered wins over opened, opened over not opened", () => {
    expect(giftOfferOutcome(offer.sent_at, token({ used_at: "2026-09-24T15:08:43Z", view_count: 1 }), TRACKING)).toBe(
      "registered",
    );
    expect(giftOfferOutcome(offer.sent_at, token({ view_count: 2 }), TRACKING)).toBe("opened");
    expect(giftOfferOutcome(offer.sent_at, token({}), TRACKING)).toBe("not_opened");
  });

  it("an offer sent before opens were counted is unknown, not 'did not click'", () => {
    const early = "2026-08-28T09:00:00Z";
    expect(giftOfferOutcome(early, token({}), TRACKING)).toBe("unknown");
    // but a registration or an open counted later still shows
    expect(giftOfferOutcome(early, token({ used_at: "2026-08-28T10:00:00Z" }), TRACKING)).toBe("registered");
    expect(giftOfferOutcome(early, token({ view_count: 1 }), TRACKING)).toBe("opened");
  });

  it("an offer with no matching link is unknown", () => {
    expect(giftOfferOutcome(offer.sent_at, null, TRACKING)).toBe("unknown");
  });
});

// ל-gift_offers אין עמודת טוקן: ההתאמה היא לפי מטפל וזמן.
describe("matching an offer to its personal link", () => {
  it("takes the retry's link, not the one from a send that failed", () => {
    const failed = token({ created_at: "2026-09-24T12:40:00Z", view_count: 0 });
    const retry = token({ created_at: "2026-09-24T12:51:56Z", view_count: 3 });
    expect(matchGiftToken(offer, [failed, retry])).toBe(retry);
  });

  it("ignores another therapist's link and links from other sends", () => {
    const other = token({ therapist_id: "t2" });
    const monthsLater = token({ created_at: "2027-04-01T10:00:00Z" });
    const longBefore = token({ created_at: "2026-09-24T11:00:00Z" });
    expect(matchGiftToken(offer, [other, monthsLater, longBefore])).toBeNull();
  });
});

describe("the rows the admin table shows", () => {
  it("joins offer, link and therapist, and counts the outcomes", () => {
    const offers: GiftOfferRow[] = [
      offer,
      { ...offer, id: "o2", therapist_id: "t2", sent_at: "2026-09-24T12:52:35Z" },
      { ...offer, id: "o3", therapist_id: "t3", sent_at: "2026-08-28T09:00:00Z" },
    ];
    const tokens = [
      token({ used_at: "2026-09-24T15:08:43Z", view_count: 1 }),
      token({ therapist_id: "t2", created_at: "2026-09-24T12:52:34Z" }),
      token({ therapist_id: "t3", created_at: "2026-08-28T08:59:59Z" }),
    ];
    const therapists = [
      { id: "t1", full_name: "מטפלת לדוגמה ", gender: "נקבה", status: "paying", promotion_source: "gift_trial", promoted_until: null },
      { id: "t2", full_name: "מטפל לדוגמה", gender: "זכר", status: "approved", promotion_source: null, promoted_until: null },
    ];
    const rows = buildGiftOfferHistory(offers, tokens, therapists, TRACKING);

    expect(rows.map((r) => r.outcome)).toEqual(["registered", "not_opened", "unknown"]);
    expect(rows[0].name).toBe("מטפלת לדוגמה");
    expect(rows[0].promotionSource).toBe("gift_trial");
    expect(rows[2].name).toBe("(מטפל/ת שנמחק/ה)");
    expect(countGiftOutcomes(rows)).toEqual({ registered: 1, opened: 0, not_opened: 1, unknown: 1 });
  });
});
