import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("./agent-infra", () => ({ startAgentRun: vi.fn(), finishAgentRun: vi.fn(), syncAgentAlerts: vi.fn() }));
vi.mock("./contact-concentration-data", () => ({ loadConcentrationInput: vi.fn() }));
vi.mock("./gift-offer", () => ({
  giftEligibilityError: () => null,
  recentGiftOffers: vi.fn(),
  GIFT_OFFER_MONTHS: 2,
  GIFT_OFFER_WAIT_DAYS: 21,
  GIFT_OFFER_COOLDOWN_DAYS: 180,
}));

import { buildConcentrationDraft, buildGiftDraft } from "./supply-gaps";
import { JOIN_LINK_PLACEHOLDER } from "./gift-checkout";

// טיוטת הצעת המתנה לחיתוך של ריכוז פניות (20/10/26). שם בדוי.
const conc = buildConcentrationDraft("פלונית אלמונית", "גוש דן", "CBT", 5);
const gap = buildGiftDraft("פלונית אלמונית", "גוש דן", "CBT", 5);

function tail(draft: string): string {
  return draft.slice(draft.indexOf("מה זה אומר בפועל:"));
}

describe("the gift offer for a slice where contacts concentrate", () => {
  it("says what happened: there were therapists, and the contacts went to a few of them", () => {
    expect(conc).toContain("הפניות מתרכזות כרגע אצל מספר קטן של מטפלים");
    expect(conc).toContain("באזור גוש דן");
    // זה לא פער: אסור לטעון שלא היה למטופלים מה לקבל.
    expect(conc).not.toContain("לא היו לנו מספיק מטפלים");
  });

  it("names no other therapist and gives no exact count", () => {
    expect(conc).not.toMatch(/\d+ מטופלים/);
    expect(conc).toContain("מספר רב של מטופלים");
    expect(buildConcentrationDraft("פלונית", "גוש דן", "CBT", 2)).toContain("מספר מטופלים");
  });

  it("carries exactly the same terms, cancellation and link as the supply-gap offer", () => {
    expect(tail(conc)).toBe(tail(gap));
    expect(conc).toContain(JOIN_LINK_PLACEHOLDER);
    expect(conc.split("\n")[0]).toBe("שלום פלונית אלמונית,");
  });

  it("uses a plain hyphen, never an em dash", () => {
    expect(conc).not.toContain("—");
  });

  it("speaks of online work as a way of working, not a place", () => {
    expect(buildConcentrationDraft("פלונית", "online", "CBT", 4)).toContain("בטיפול אונליין");
  });
});
