import { describe, it, expect } from "vitest";
import { centerKind, centerPageTitle, DEFAULT_CENTER_KIND } from "./center-title";

describe("the title of a centre's public page", () => {
  it("names the centre's own field of work when it has one", () => {
    expect(centerPageTitle("מרכז הדוגמה", "טיפול זוגי ומיני", "ירושלים ופתח תקווה")).toBe(
      "מרכז הדוגמה - טיפול זוגי ומיני בירושלים ופתח תקווה",
    );
  });

  it("stays as it was for a centre without one", () => {
    expect(centerPageTitle("מרכז הדוגמה", null, "חיפה")).toBe("מרכז הדוגמה - מרכז טיפולי בחיפה");
    expect(centerPageTitle("מרכז הדוגמה", undefined, "חיפה")).toBe("מרכז הדוגמה - מרכז טיפולי בחיפה");
  });

  it("reads a field left with spaces only as empty", () => {
    expect(centerPageTitle("מרכז הדוגמה", "   ", "חיפה")).toBe("מרכז הדוגמה - מרכז טיפולי בחיפה");
    expect(centerKind("  ")).toBe(DEFAULT_CENTER_KIND);
  });

  it("leaves the city out when there is none", () => {
    expect(centerPageTitle("מרכז הדוגמה", "טיפול זוגי", null)).toBe("מרכז הדוגמה - טיפול זוגי");
    expect(centerPageTitle("מרכז הדוגמה", null, "  ")).toBe("מרכז הדוגמה - מרכז טיפולי");
  });

  it("trims what was typed around the words", () => {
    expect(centerPageTitle("מרכז הדוגמה", " טיפול זוגי ", " חיפה ")).toBe("מרכז הדוגמה - טיפול זוגי בחיפה");
  });

  it("never carries the brand itself, which the layout adds", () => {
    expect(centerPageTitle("מרכז הדוגמה", "טיפול זוגי", "חיפה")).not.toContain("טיפול חכם");
  });
});
