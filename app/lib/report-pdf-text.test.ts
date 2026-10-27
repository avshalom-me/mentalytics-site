import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { rtlFlags, textLayerWanted, TEXT_FONT_URL } from "./report-pdf-text";

const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("rtlFlags - which characters sit in a right-to-left run", () => {
  it("marks Hebrew right to left and Latin letters and digits left to right", () => {
    expect(rtlFlags("שלום")).toEqual([true, true, true, true]);
    expect(rtlFlags("abc12")).toEqual([false, false, false, false, false]);
  });

  it("puts a bracket between Hebrew letters on the Hebrew side, so it is mirrored", () => {
    // "א(ב)ג": both brackets are inside the Hebrew run
    const f = rtlFlags("א(ב)ג");
    expect(f[1]).toBe(true);
    expect(f[3]).toBe(true);
  });

  it("leaves a mark between two Latin letters or digits on the Latin side", () => {
    expect(rtlFlags("a-b")[1]).toBe(false);
    expect(rtlFlags("31.3.2027")[2]).toBe(false);
  });

  it("gives a mark at the edge of the text the page's own direction, right to left", () => {
    expect(rtlFlags(": א")[0]).toBe(true);
    expect(rtlFlags("א :")[2]).toBe(true);
  });
});

describe("the text layer is a prototype, off unless asked for", () => {
  it("is off by default and when the page does not set the switch", () => {
    expect(textLayerWanted()).toBe(false);
  });

  it("follows the caller when the caller says", () => {
    expect(textLayerWanted(true)).toBe(true);
    expect(textLayerWanted(false)).toBe(false);
  });

  it("is reached from the PDF builder only through that switch", () => {
    const src = read("app/lib/report-pdf.ts");
    expect(src).toContain("textLayerWanted(input.textLayer)");
    // collected and drawn only when the font loaded
    expect(src).toMatch(/const runs = withText \? collectTextRuns\(pages\[i\]\) : \[\]/);
    expect(src).toMatch(/if \(withText\) drawTextRuns\(pdf, runs, mm\)/);
    // the default file is written exactly as before: no compression change
    expect(src).toMatch(/compress: textLayer/);
  });

  it("has its font, with its licence, where the module fetches it", () => {
    expect(existsSync(path.join(process.cwd(), "public", TEXT_FONT_URL))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "public/fonts/heebo-text/LICENSE.txt"))).toBe(true);
  });
});
