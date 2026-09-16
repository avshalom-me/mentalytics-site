import { describe, it, expect } from "vitest";
import { isPaidTouch, paidHideAttr, paidVisitorBootScript, PAID_VISITOR_CLASS } from "./paid-visitor";
import { STORAGE_KEY, CAPTURED_AT_KEY, ATTRIBUTION_TTL_MS } from "./attribution";

// The boot script runs in the browser before any module code, so it cannot be
// imported - it is evaluated here with the three globals it touches stubbed.
function bootAddsClass(opts: { search?: string; stored?: string | null }): boolean {
  const added = new Set<string>();
  const run = new Function(
    "location",
    "localStorage",
    "document",
    paidVisitorBootScript(),
  );
  run(
    { search: opts.search ?? "" },
    { getItem: () => opts.stored ?? null },
    { documentElement: { classList: { add: (c: string) => added.add(c) } } },
  );
  return added.has(PAID_VISITOR_CLASS);
}

const stored = (channel: string, ageMs: number, utm_medium: string | null = null) =>
  JSON.stringify({ channel, utm_medium, [CAPTURED_AT_KEY]: Date.now() - ageMs });

describe("isPaidTouch", () => {
  it("every *_paid channel is paid, organic and direct are not", () => {
    expect(isPaidTouch({ channel: "google_paid" })).toBe(true);
    expect(isPaidTouch({ channel: "taboola_paid" })).toBe(true);
    expect(isPaidTouch({ channel: "meta_paid" })).toBe(true);
    expect(isPaidTouch({ channel: "google_organic" })).toBe(false);
    expect(isPaidTouch({ channel: "direct" })).toBe(false);
    expect(isPaidTouch(null)).toBe(false);
  });
  it("a paid medium on an unrecognised source still counts", () => {
    expect(isPaidTouch({ channel: "other", utm_medium: "CPC" })).toBe(true);
    expect(isPaidTouch({ channel: "other", utm_medium: "social" })).toBe(false);
  });
});

describe("paidHideAttr", () => {
  it("marks a section only when every card in it is free", () => {
    expect(paidHideAttr([{ free: true }, { free: true }])).toEqual({ "data-paid-hide": "" });
    expect(paidHideAttr([{ free: true }, { free: false }])).toEqual({});
    expect(paidHideAttr([])).toEqual({});
  });
});

describe("paidVisitorBootScript", () => {
  it("a Google Ads click id on the landing URL marks the visitor before anything is stored", () => {
    expect(bootAddsClass({ search: "?gclid=abc" })).toBe(true);
    expect(bootAddsClass({ search: "?utm_source=google&utm_medium=cpc&utm_campaign=g-haifa" })).toBe(true);
    expect(bootAddsClass({ search: "?utm_source=taboola&utm_medium=native" })).toBe(true);
    expect(bootAddsClass({ search: "?tblci=xyz" })).toBe(true);
  });
  it("an organic landing with nothing stored is not paid", () => {
    expect(bootAddsClass({ search: "" })).toBe(false);
    expect(bootAddsClass({ search: "?utm_source=google&utm_medium=organic" })).toBe(false);
  });
  it("a stored paid touch inside the 30-day window still counts on later pages", () => {
    expect(bootAddsClass({ stored: stored("google_paid", 5 * 86_400_000) })).toBe(true);
    expect(bootAddsClass({ stored: stored("other", 1000, "cpc") })).toBe(true);
    expect(bootAddsClass({ stored: stored("google_organic", 1000) })).toBe(false);
  });
  it("an expired paid touch no longer hides anyone", () => {
    expect(bootAddsClass({ stored: stored("google_paid", ATTRIBUTION_TTL_MS + 1000) })).toBe(false);
  });
  it("corrupt storage never throws and never marks", () => {
    expect(bootAddsClass({ stored: "{not json" })).toBe(false);
  });
  it("reads the same storage key attribution.ts writes", () => {
    expect(paidVisitorBootScript()).toContain(JSON.stringify(STORAGE_KEY));
    expect(paidVisitorBootScript()).not.toContain("</script");
  });
});
