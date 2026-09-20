import { describe, it, expect, vi } from "vitest";

// What the agent is allowed to close without asking.
//
// 18/9/26: a therapist replied "לצערי לא יכול, מטפל בשעה הזאת" to a proposed
// meeting time. His two lines sat above a long quote of our own automatic
// "פנייה חדשה" notification, the classifier read the thread as an automated
// message, and the inquiry was closed as needing no reply. It never appeared
// in the queue. The cases below are the real messages from that week.

vi.mock("server-only", () => ({}));

import { splitQuoted } from "./gmail";
import { isCourtesyClosing, mayAutoIgnore } from "./inbox-triage";

const AVIAD = [
  "היי אבשלום, נעים מאד.",
  "לצערי לא יכול, מטפל בשעה הזאת.",
  "",
  "בתאריך יום ו׳, 18 בספט׳ 2026, 10:26, מאת Admin Admin ‏<",
  "admin@getmentalytics.com>:",
  "",
  "> שלום אביעד,",
  ">",
  "> אשמח לשוחח איתך, האם אתה פנוי בשלישי הקרוב ב9:00?",
  ">",
  ">> פנייה חדשה — בית למפתחים",
  ">> טופס הצטרפות מהאתר",
  ">> שם: אביעד נוריאלי",
  ">> נשלח מ-mentalytics.co.il/developers",
].join("\n");

describe("splitQuoted", () => {
  it("keeps only what the person wrote now, and hands back the quote separately", () => {
    const { text, quoted } = splitQuoted(AVIAD);
    expect(text).toBe("היי אבשלום, נעים מאד.\nלצערי לא יכול, מטפל בשעה הזאת.");
    expect(quoted).toContain("פנייה חדשה");
    // The new text is a fraction of the mail: classifying the whole body
    // means classifying the quote.
    expect(text.length).toBeLessThan(quoted.length / 3);
  });

  it("treats a mail that is quote all the way down as having no separate quote", () => {
    const fwd = "> הכול מצוטט\n> שורה שנייה";
    expect(splitQuoted(fwd)).toEqual({ text: fwd, quoted: "" });
  });
});

describe("isCourtesyClosing", () => {
  it("accepts a plain sign-off", () => {
    expect(isCourtesyClosing("מעולה אז יאללה אנסה. תודה")).toBe(true);
    expect(isCourtesyClosing("תודה רבה לכם")).toBe(true);
  });

  it("rejects anything that asks, declines or leaves a number", () => {
    expect(isCourtesyClosing("היי אבשלום, נעים מאד. לצערי לא יכול, מטפל בשעה הזאת.")).toBe(false);
    expect(isCourtesyClosing("תודה, אפשר לקבוע למחר?")).toBe(false);
    expect(isCourtesyClosing("תודה, תתקשרו אליי 0507646595")).toBe(false);
    expect(isCourtesyClosing("")).toBe(false);
  });
});

describe("mayAutoIgnore", () => {
  it("still closes spam and system mail by itself", () => {
    expect(mayAutoIgnore("system", "בוצע חיוב עבור מטפל")).toBe(true);
    expect(mayAutoIgnore("spam", "מסמך ממשרד רואה החשבון ממתין לך בקישור")).toBe(true);
  });

  it("never closes a person's message that asks for something", () => {
    // The regression: category was "other", not spam or system.
    expect(mayAutoIgnore("other", splitQuoted(AVIAD).text)).toBe(false);
    expect(
      mayAutoIgnore("therapist_billing", "היי אבקש ליצור עמי קשר כדי לעדכן אמצעי תשלום עבור המנוי. תודה")
    ).toBe(false);
  });

  it("does close a person's courtesy sign-off", () => {
    expect(mayAutoIgnore("other", "מעולה אז יאללה אנסה. תודה")).toBe(true);
  });
});
