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
const conc = buildConcentrationDraft("פלונית אלמונית", "גוש דן", "CBT");
const gap = buildGiftDraft("פלונית אלמונית", "גוש דן", "CBT", 5);

function tail(draft: string): string {
  return draft.slice(draft.indexOf("מה זה אומר בפועל:"));
}

describe("the gift offer for a slice where contacts concentrate", () => {
  it("is the owner's wording (20/10/2026), word for word", () => {
    const lines = conc.split("\n");
    expect(lines[2]).toBe(
      "בתקופה האחרונה מספר רב של מטופלים חיפשו CBT באזור גוש דן דרך מערכת ההתאמות, שבה מוצגים רק מטפלים מקודמים."
    );
    expect(lines[4]).toBe(
      'הפרופיל שלך מתאים לתחום ולאזור האלה, ולכן אנחנו מציעים לך להצטרף לקידום במסלול הבא: 2 חודשים ראשונים ללא תשלום, אחריהם 2 חודשים ב-70 ש"ח + מע"מ לחודש, ורק לאחר מכן המחיר המלא - 140 ש"ח + מע"מ לחודש.'
    );
  });

  it("names no other therapist, gives no count, and does not claim patients had no one to see", () => {
    expect(conc).not.toMatch(/\d+ מטופלים/);
    expect(conc).not.toContain("לא היו לנו מספיק מטפלים");
    expect(conc).not.toContain("מתרכזות");
  });

  it("carries exactly the same terms, cancellation and link as the supply-gap offer", () => {
    expect(tail(conc)).toBe(tail(gap));
    expect(conc).toContain(JOIN_LINK_PLACEHOLDER);
    expect(conc.split("\n")[0]).toBe("שלום פלונית אלמונית,");
  });

  it("uses a plain hyphen, never an em dash", () => {
    expect(conc).not.toContain(String.fromCharCode(0x2014));
  });

  it("speaks of online work as a way of working, not a place", () => {
    expect(buildConcentrationDraft("פלונית", "online", "CBT")).toContain("בטיפול אונליין");
  });
});
