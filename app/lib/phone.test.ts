import { describe, it, expect } from "vitest";
import {
  centerWhatsAppNumber,
  validateCenterWhatsApp,
  waLinkForCenter,
  waLinkFor,
} from "./phone";

// WhatsApp Business registers on landlines and virtual lines too (verification
// by voice call). On 23/9/2026 a centre tried to save its 072 line as its
// business WhatsApp and was refused with "must start with 05".
describe("a centre's business WhatsApp", () => {
  it("accepts a landline or virtual line when the centre enters it", () => {
    expect(validateCenterWhatsApp("0721234567")).toEqual({ ok: true, value: "0721234567" });
    expect(validateCenterWhatsApp("072-1234567")).toEqual({ ok: true, value: "072-1234567" });
    expect(validateCenterWhatsApp("04-1234567")).toEqual({ ok: true, value: "04-1234567" });
    expect(validateCenterWhatsApp("052-1234567")).toEqual({ ok: true, value: "052-1234567" });
  });

  it("still rejects what is not a phone number, and treats empty as clearing it", () => {
    expect(validateCenterWhatsApp("office@example.com").ok).toBe(false);
    expect(validateCenterWhatsApp("123").ok).toBe(false);
    expect(validateCenterWhatsApp("   ")).toEqual({ ok: true, value: null });
  });

  it("uses the declared number even when it is a landline", () => {
    expect(centerWhatsAppNumber("072-1234567", "072-1234567")).toBe("072-1234567");
    expect(waLinkForCenter(centerWhatsAppNumber("0721234567", null))).toMatch(
      /^https:\/\/wa\.me\/972721234567\?text=/
    );
  });

  it("does not guess WhatsApp from a landline dialling number nobody declared", () => {
    // A centre's switchboard opened an empty chat until 21/8/2026.
    expect(centerWhatsAppNumber(null, "04-1234567")).toBeNull();
    expect(centerWhatsAppNumber("", "077-1234567")).toBeNull();
  });

  it("keeps falling back to a mobile dialling number", () => {
    expect(centerWhatsAppNumber(null, "0551234567")).toBe("0551234567");
  });
});

describe("a therapist's WhatsApp is unchanged", () => {
  // A therapist has one phone field and declares nothing about WhatsApp, so a
  // landline there is still not assumed to have it.
  it("stays mobile or foreign only", () => {
    expect(waLinkFor("077-1234567")).toBeNull();
    expect(waLinkFor("054-1234567")).toMatch(/^https:\/\/wa\.me\/972541234567\?text=/);
    expect(waLinkFor("+39 333 123 4567")).toMatch(/^https:\/\/wa\.me\/393331234567\?text=/);
  });
});
