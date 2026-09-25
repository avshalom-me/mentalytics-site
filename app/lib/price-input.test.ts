import { describe, it, expect } from "vitest";
import { parsePriceInput, normalizePriceField } from "./price-input";

describe("parsePriceInput", () => {
  it("reads a plain price, with or without the currency and commas", () => {
    expect(parsePriceInput("400")).toEqual({ ok: true, value: 400 });
    expect(parsePriceInput(" 400 ₪ ")).toEqual({ ok: true, value: 400 });
    expect(parsePriceInput('400 ש"ח')).toEqual({ ok: true, value: 400 });
    expect(parsePriceInput("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parsePriceInput("350.00")).toEqual({ ok: true, value: 350 });
    expect(parsePriceInput(450)).toEqual({ ok: true, value: 450 });
  });

  it("treats an empty field as not stated", () => {
    expect(parsePriceInput("")).toEqual({ ok: true, value: null });
    expect(parsePriceInput("   ")).toEqual({ ok: true, value: null });
    expect(parsePriceInput(null)).toEqual({ ok: true, value: null });
  });

  it("refuses what used to be mangled or silently dropped", () => {
    // Stripping non-digits turned these into 300400 and 35000.
    const range = parsePriceInput("300-400");
    expect(range.ok).toBe(false);
    if (!range.ok) expect(range.error).toContain("טווח");
    expect(parsePriceInput("40").ok).toBe(false);
    expect(parsePriceInput("6000").ok).toBe(false);
    expect(parsePriceInput("בערך 400").ok).toBe(false);
  });
});

describe("normalizePriceField (server)", () => {
  it("leaves an update without a price alone", () => {
    const u: Record<string, unknown> = { bio: "x" };
    expect(normalizePriceField(u)).toBeNull();
    expect(u).toEqual({ bio: "x" });
  });

  it("stores the parsed number, and null for an empty field", () => {
    const a: Record<string, unknown> = { price: "400" };
    expect(normalizePriceField(a)).toBeNull();
    expect(a.price).toBe(400);
    const b: Record<string, unknown> = { price: "" };
    expect(normalizePriceField(b)).toBeNull();
    expect(b.price).toBeNull();
  });

  it("refuses instead of silently dropping the price", () => {
    const u: Record<string, unknown> = { price: "300400" };
    expect(normalizePriceField(u)).toMatch(/^מחיר למפגש: /);
  });
});
