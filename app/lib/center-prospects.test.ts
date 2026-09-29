import { describe, it, expect, vi } from "vitest";

// parseProspectLine is what turns a pasted spreadsheet row into a prospect. Until
// 28/9/26 it put an email into the website field ("https://office@x.co.il"), let a
// pair of phones ("03-... / 052-...") fall into the name because 19 digits are not
// "a phone", and saved "לא נמצא" as the city. The cases below are those shapes,
// with invented names and numbers.

vi.mock("server-only", () => ({}));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: {} }));
vi.mock("./agent-infra", () => ({
  startAgentRun: vi.fn(),
  finishAgentRun: vi.fn(),
  syncAgentAlerts: vi.fn(),
  agentEnabled: vi.fn(),
  createAgentAction: vi.fn(),
}));
vi.mock("./places-search", () => ({ placesConfigured: () => false, searchCentersInCities: vi.fn() }));

import { parseProspectLine, stampStatus } from "./center-prospects";
import { canonicalCity, prospectRegionGroup, prospectRegionOfCity } from "./prospect-regions";

describe("parseProspectLine", () => {
  it("keeps the simple comma form working", () => {
    expect(parseProspectLine("מכון שלווה, 03-1234567, רמת גן")).toEqual({
      name: "מכון שלווה",
      phone: "03-1234567",
      email: null,
      city: "רמת גן",
      website: null,
      notes: null,
    });
  });

  it("reads an email as an email, not as a website", () => {
    const p = parseProspectLine("מרכז אופק - office@example.co.il - example.co.il - חיפה");
    expect(p?.email).toBe("office@example.co.il");
    expect(p?.website).toBe("https://example.co.il");
    expect(p?.city).toBe("חיפה");
  });

  it("takes a pair of phones as phones, not as part of the name", () => {
    const p = parseProspectLine("מרכז אופק — טיפול רגשי - 03-5000000 / 050-0000000 - רחובות");
    expect(p?.name).toBe("מרכז אופק — טיפול רגשי");
    expect(p?.phone).toBe("03-5000000 / 050-0000000");
    expect(p?.city).toBe("רחובות");
  });

  it("drops spreadsheet placeholders and keeps the rest out of the name", () => {
    const p = parseProspectLine(
      "מכון דוגמה - ישראל ישראלי (מנהל) - לא נמצא - הרצל 1 - לא נמצא - דרך טופס באתר - נתניה"
    );
    expect(p?.name).toBe("מכון דוגמה");
    expect(p?.city).toBe("נתניה");
    expect(p?.phone).toBeNull();
    expect(p?.notes).toBe("ישראל ישראלי (מנהל) · הרצל 1 · דרך טופס באתר");
  });

  it("never saves an unknown fragment as the city", () => {
    const p = parseProspectLine("מרכז דוגמה - לקויות למידה - example.org.il");
    expect(p?.city).toBeNull();
    expect(p?.notes).toBe("לקויות למידה");
  });

  it("accepts star and 1-700 numbers", () => {
    expect(parseProspectLine("מכון דוגמה - מוקד 5806*")?.phone).toBe("5806*");
    expect(parseProspectLine("מכון דוגמה - 1-700-000-000")?.phone).toBe("1-700-000-000");
  });

  it("normalises city spellings people actually type", () => {
    expect(parseProspectLine("מרכז דוגמה, קרית ביאליק")?.city).toBe("קריית ביאליק");
    expect(parseProspectLine("מרכז דוגמה, מודיעין-מכבים-רעות")?.city).toBe("מודיעין");
  });
});

describe("prospect regions", () => {
  it("splits the Shfela from the centre", () => {
    expect(prospectRegionOfCity("תל אביב")).toBe("center");
    expect(prospectRegionOfCity("רחובות")).toBe("shfela");
    expect(prospectRegionOfCity("ראשון לציון")).toBe("shfela");
    expect(prospectRegionOfCity("כפר סבא")).toBe("sharon");
  });

  it("maps the Shfela back to the site-wide group for gap ranking", () => {
    expect(prospectRegionGroup("shfela")).toBe("center");
    expect(prospectRegionGroup("center")).toBe("center");
    expect(prospectRegionGroup("jerusalem")).toBe("jerusalem");
  });

  it("returns null for a city outside the vocabulary instead of guessing", () => {
    expect(canonicalCity("לא נמצא")).toBeNull();
    expect(prospectRegionOfCity("דרך טופס באתר")).toBeNull();
    expect(prospectRegionOfCity(null)).toBeNull();
  });
});

describe("stampStatus", () => {
  it("records when the status changed and appends to the history", () => {
    const first = stampStatus(null, "contacted_phone", "2026-09-28T09:00:00.000Z");
    expect(first.status_changed_at).toBe("2026-09-28T09:00:00.000Z");
    expect(first.status_history).toEqual([{ status: "contacted_phone", at: "2026-09-28T09:00:00.000Z" }]);
    const second = stampStatus(first.status_history, "not_relevant_now", "2026-09-29T10:00:00.000Z");
    expect(second.status_history.map((h) => h.status)).toEqual(["contacted_phone", "not_relevant_now"]);
  });

  it("keeps only the last 30 changes", () => {
    const long = Array.from({ length: 30 }, (_, i) => ({ status: "new" as const, at: `2026-01-${String(i + 1).padStart(2, "0")}` }));
    const next = stampStatus(long, "later", "2026-09-29");
    expect(next.status_history).toHaveLength(30);
    expect(next.status_history[29]).toEqual({ status: "later", at: "2026-09-29" });
  });
});
