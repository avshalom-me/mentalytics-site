import { describe, it, expect } from "vitest";
import { ageInHebrew, seoCacheFreshness, SEO_CACHE_FRESH_MS } from "./admin-seo-cache";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3_600_000;

// המקרה שהחזיר את השאלה: העותק היה בן 32 שעות, ה-API הסתפק בו (הסף היה 36),
// והגרף נראה "תקוע" יום שלם.
describe("when the stored /admin/seo copy is good enough", () => {
  it("is fresh for a normal 6-hourly cycle, and stale after two failed runs", () => {
    expect(seoCacheFreshness(ago(2 * HOUR), NOW)).toBe("fresh");
    expect(seoCacheFreshness(ago(SEO_CACHE_FRESH_MS - 1), NOW)).toBe("fresh");
    expect(seoCacheFreshness(ago(SEO_CACHE_FRESH_MS + 1), NOW)).toBe("stale");
  });

  it("a 32-hour-old copy is stale (it used to be served for up to 36 hours)", () => {
    expect(seoCacheFreshness(ago(32 * HOUR), NOW)).toBe("stale");
  });

  it("no copy, or an unreadable date, counts as missing", () => {
    expect(seoCacheFreshness(null, NOW)).toBe("missing");
    expect(seoCacheFreshness(undefined, NOW)).toBe("missing");
    expect(seoCacheFreshness("not a date", NOW)).toBe("missing");
  });
});

describe("the age label", () => {
  it("speaks in hours under a day and in days after", () => {
    expect(ageInHebrew(ago(20 * 60_000), NOW)).toBe("לפני פחות משעה");
    expect(ageInHebrew(ago(HOUR + 5 * 60_000), NOW)).toBe("לפני שעה");
    expect(ageInHebrew(ago(5 * HOUR), NOW)).toBe("לפני 5 שעות");
    expect(ageInHebrew(ago(32 * HOUR), NOW)).toBe("לפני יום");
    expect(ageInHebrew(ago(50 * HOUR), NOW)).toBe("לפני יומיים");
    expect(ageInHebrew(ago(96 * HOUR), NOW)).toBe("לפני 4 ימים");
  });

  it("never goes negative when the clocks disagree slightly", () => {
    expect(ageInHebrew(new Date(NOW + 5 * 60_000).toISOString(), NOW)).toBe("לפני פחות משעה");
  });
});
