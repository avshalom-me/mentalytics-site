import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("@/app/lib/supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("resend", () => ({ Resend: class { emails = { send: vi.fn() }; } }));
vi.mock("./email-quota", () => ({ sendBulkEmail: vi.fn() }));
vi.mock("./email-log", () => ({ logEmail: vi.fn() }));
vi.mock("./sumit", () => ({ SUBSCRIPTION_BASE_PRICE: 140 }));

import { buildGiftOfferEmailHtml } from "./therapist-emails";

// The gift offer carried its personal join link as plain text in the body. Gmail
// turns that into a link; Outlook does not, and the only real link in the mail
// led to the personal area, where there is no gift (16/10/2026). Invented token.
const JOIN = "https://www.mentalytics.co.il/therapists/gift-checkout?token=AbC-12_xYz";
const BODY = `שלום פלונית,\n\nהקישור להצטרפות אישי ומיועד עבורך בלבד:\n${JOIN}\n\nבברכה,\nצוות טיפול חכם`;

describe("the gift offer email", () => {
  it("has a real join button that leads to the personal link", () => {
    const html = buildGiftOfferEmailHtml({ message: BODY, joinUrl: JOIN })!;
    expect(html).toContain(`<a href="${JOIN}"`);
    expect(html).toContain("להצטרפות במסלול המתנה");
  });

  it("makes the address in the body clickable too", () => {
    const html = buildGiftOfferEmailHtml({ message: BODY })!;
    expect(html).toContain(`>${JOIN}</a>`);
  });

  it("puts the join button before the link to the personal area", () => {
    const html = buildGiftOfferEmailHtml({ message: BODY, joinUrl: JOIN })!;
    expect(html.indexOf("להצטרפות במסלול המתנה")).toBeLessThan(html.indexOf("לאזור האישי שלך באתר"));
  });

  it("still escapes what the admin typed", () => {
    const html = buildGiftOfferEmailHtml({ message: "<b>שלום</b> **חשוב**" })!;
    expect(html).toContain("&lt;b&gt;שלום&lt;/b&gt;");
    expect(html).toContain("<strong>חשוב</strong>");
  });

  it("states the reduced months after the gift and that leaving at its end costs nothing", () => {
    const html = buildGiftOfferEmailHtml({ message: BODY, joinUrl: JOIN })!;
    expect(html).toContain('אחריהם 2 חודשים ב-70 ש"ח + מע"מ לחודש');
    expect(html).toContain('המחיר המלא - 140 ש"ח + מע"מ לחודש');
    expect(html).toContain("כולל מיד בסוף תקופת המתנה, ואז אין חיוב כלל");
  });

  it("refuses an empty body", () => {
    expect(buildGiftOfferEmailHtml({ message: "  " })).toBeNull();
  });

  it("is sent with the link the offer was issued with", () => {
    const source = readFileSync("app/lib/gift-offer.ts", "utf8");
    expect(source).toMatch(/sendGiftOfferEmail\(\{[\s\S]*?joinUrl,[\s\S]*?\}\)/);
  });
});
