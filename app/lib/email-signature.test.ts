import { describe, it, expect } from "vitest";
import { repeatedClosingLine, dropRepeatedClosing } from "./email-signature";

// Drafts close with "בברכה,\nצוות טיפול חכם", and the admin@ Gmail signature
// opens with the same name. The rule removes the repeat from the outgoing mail
// only; the admin preview uses the same function to say so in advance.

const SIG = "צוות טיפול חכם\n\nwww.mentalytics.co.il\n\nadmin@getmentalytics.com";
const DRAFT = "שלום מתן,\n\nנחזור אליך בהקדם.\n\nבברכה,\nצוות טיפול חכם";

describe("repeatedClosingLine", () => {
  it("finds the closing name the signature already opens with", () => {
    expect(repeatedClosingLine(DRAFT, SIG)).toBe("צוות טיפול חכם");
  });

  it("ignores trailing punctuation, spaces and blank lines", () => {
    expect(repeatedClosingLine("תודה.\nבברכה,\nצוות  טיפול חכם.  \n\n", SIG)).toBe("צוות  טיפול חכם.");
  });

  it("does not match a different closing", () => {
    expect(repeatedClosingLine("תודה.\nבברכה,\nאבשלום", SIG)).toBeNull();
  });

  it("never treats a one-line body as a closing", () => {
    expect(repeatedClosingLine("צוות טיפול חכם", SIG)).toBeNull();
  });

  it("does nothing for a logo-only signature", () => {
    expect(repeatedClosingLine(DRAFT, "")).toBeNull();
  });
});

describe("dropRepeatedClosing", () => {
  it("keeps 'בברכה,' and drops only the repeated name", () => {
    expect(dropRepeatedClosing(DRAFT, SIG)).toBe("שלום מתן,\n\nנחזור אליך בהקדם.\n\nבברכה,");
  });

  it("leaves the body untouched when nothing repeats", () => {
    const body = "תודה.\nבברכה,\nאבשלום";
    expect(dropRepeatedClosing(body, SIG)).toBe(body);
  });
});
