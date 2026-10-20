import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { centerHeaderPlace, centerPlaces, centerWebsiteHref, countWebsiteClicks } from "./center-page-details";
import { firstPhoneIn, phonesInField, telHref } from "./phone";

// A centre's page showed neither its city nor its phone under the title: the
// city field was empty and the phone field held two numbers, which failed
// validation as a whole (20/10/2026). Numbers here are invented.
describe("firstPhoneIn", () => {
  it("returns a single number as typed", () => {
    expect(firstPhoneIn("02-1234567")).toBe("02-1234567");
  });

  it("takes the first number of two separated by a slash", () => {
    const raw = "021234567/   0521234567";
    expect(firstPhoneIn(raw)).toBe("021234567");
    expect(telHref(firstPhoneIn(raw))).not.toBeNull();
  });

  it("handles a comma and the word 'או'", () => {
    expect(firstPhoneIn("03-1234567, 054-1234567")).toBe("03-1234567");
    expect(firstPhoneIn("03-1234567 או 054-1234567")).toBe("03-1234567");
  });

  it("skips a piece that is not a number", () => {
    expect(firstPhoneIn("משרד / 054-1234567")).toBe("054-1234567");
  });

  it("is null when nothing is a number", () => {
    expect(firstPhoneIn("office@example.com")).toBeNull();
    expect(firstPhoneIn("")).toBeNull();
    expect(firstPhoneIn(null)).toBeNull();
  });

  it("counts the numbers in the field", () => {
    expect(phonesInField("02-1234567")).toBe(1);
    expect(phonesInField("021234567/0521234567")).toBe(2);
    expect(phonesInField("לא מספר")).toBe(0);
  });
});

describe("centerHeaderPlace", () => {
  it("prefers the city the centre typed", () => {
    expect(centerHeaderPlace("חיפה", ["ירושלים"])).toBe("חיפה");
  });

  it("falls back to the cities the centre marked for matching", () => {
    expect(centerHeaderPlace("", ["ירושלים", "מבשרת ציון"])).toBe("ירושלים · מבשרת ציון");
    expect(centerHeaderPlace(null, ["ירושלים", "ירושלים"])).toBe("ירושלים");
  });

  it("gives the places themselves, for the short tag above the name", () => {
    expect(centerPlaces("", ["ירושלים", "מבשרת ציון"])[0]).toBe("ירושלים");
    expect(centerPlaces("חיפה", ["ירושלים"])).toEqual(["חיפה"]);
  });

  it("caps the list at three and leaves out online", () => {
    expect(centerHeaderPlace(null, ["א", "ב", "ג", "ד"])).toBe("א · ב · ג ועוד");
    expect(centerHeaderPlace(null, ["online", "אונליין"])).toBeNull();
  });
});

describe("centerWebsiteHref", () => {
  it("adds a scheme and the referral tag", () => {
    const href = centerWebsiteHref("example.com")!;
    const url = new URL(href);
    expect(url.hostname).toBe("example.com");
    expect(url.searchParams.get("utm_source")).toBe("mentalytics");
    expect(url.searchParams.get("utm_medium")).toBe("referral");
  });

  it("keeps the centre's own parameters and an existing tag", () => {
    const url = new URL(centerWebsiteHref("https://example.com/a?x=1&utm_source=theirs")!);
    expect(url.searchParams.get("x")).toBe("1");
    expect(url.searchParams.get("utm_source")).toBe("theirs");
  });

  it("is null when there is no site", () => {
    expect(centerWebsiteHref("  ")).toBeNull();
  });
});

describe("countWebsiteClicks", () => {
  const t = (s: number) => new Date(Date.UTC(2026, 9, 20, 10, 0, s)).toISOString();

  it("counts a repeat by the same visitor within two minutes once", () => {
    expect(countWebsiteClicks([
      { created_at: t(0), session_id: "a" },
      { created_at: t(30), session_id: "a" },
      { created_at: t(59), session_id: "b" },
    ])).toBe(2);
  });

  it("counts the same visitor again after the window", () => {
    const later = new Date(Date.UTC(2026, 9, 20, 10, 5, 0)).toISOString();
    expect(countWebsiteClicks([{ created_at: t(0), session_id: "a" }, { created_at: later, session_id: "a" }])).toBe(2);
  });

  it("counts rows without a visitor id every time", () => {
    expect(countWebsiteClicks([{ created_at: t(0), session_id: null }, { created_at: t(1), session_id: null }])).toBe(2);
  });
});

describe("the centre page", () => {
  const page = readFileSync("app/centers/[slug]/CenterProfile.tsx", "utf8");

  it("reads the phone and the place through the helpers", () => {
    expect(page).toContain("firstPhoneIn(center.public_phone)");
    expect(page).toContain("centerHeaderPlace(");
  });

  // Portrait photos lost the top of the head in the square frame (20/10/2026).
  it("crops people photos from near the top, not the middle", () => {
    expect(page).toMatch(/objectPosition: "50% 12%"/);
  });
});
