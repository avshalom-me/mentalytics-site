import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { outerHeight, paginate, PART_GAP, type LayoutItem } from "./report-pdf-layout";

const H = 979; // the report page's content height

/** What a page holds, summed - the thing that must never exceed the page. */
function load(items: LayoutItem[]) {
  const placed = paginate(items, H);
  const pages = new Map<number, number>();
  placed.forEach((p) => pages.set(p.page, (pages.get(p.page) ?? 0) + p.gap + p.height));
  return { placed, pages };
}

describe("outerHeight", () => {
  it("counts the margins the box's own height leaves out", () => {
    expect(outerHeight(100, "0px", "18px")).toBe(118);
    expect(outerHeight(100, "9px", "0px")).toBe(109);
    expect(outerHeight(40, "", "auto")).toBe(40);
  });
});

describe("paginate", () => {
  it("never puts more on a page than the page holds", () => {
    // Heights that sum to just under, and just over, a page - the margin bug filled pages to the brim.
    const items: LayoutItem[] = [];
    for (let i = 0; i < 80; i++) items.push({ height: 23 + ((i * 37) % 120) });
    const { pages } = load(items);
    for (const used of pages.values()) expect(used).toBeLessThanOrEqual(H);
  });

  it("fills a page with margin-carrying blocks without spilling past the clip", () => {
    // Six 150px boxes, each with a 18px margin below, is 168 a block. Measured without the
    // margin the page took six and overflowed by 108; measured with it, it takes five.
    const withMargin = Array.from({ length: 12 }, () => ({ height: outerHeight(150, "0px", "18px") }));
    const { pages } = load(withMargin);
    expect(pages.get(0)).toBe(5 * 168);
    for (const used of pages.values()) expect(used).toBeLessThanOrEqual(H);
  });

  it("keeps a heading with what it heads", () => {
    const { placed } = load([{ height: 900 }, { height: 40, keepWithNext: true }, { height: 80 }]);
    expect(placed[1].page).toBe(1);
    expect(placed[2].page).toBe(1);
  });

  it("shrinks a block taller than a page instead of slicing it", () => {
    const { placed } = load([{ height: 2000 }]);
    expect(placed[0].height).toBe(H - 8);
  });

  describe("a part's opening", () => {
    const heading = { height: 60, keepWithNext: true, breakBefore: true };
    const intro = { height: 40 };

    it("opens on a fresh page when the current one is well used", () => {
      const { placed } = load([{ height: 700 }, heading, intro, { height: 200 }]);
      expect(placed[1].page).toBe(1);
      expect(placed[1].gap).toBe(0);
    });

    it("stays on a mostly empty page when what follows it can start there too", () => {
      const { placed } = load([{ height: 300 }, heading, intro, { height: 200 }]);
      expect([placed[1].page, placed[2].page, placed[3].page]).toEqual([0, 0, 0]);
      expect(placed[1].gap).toBe(PART_GAP);
    });

    it("is not stranded at the foot of a page with the diagram overleaf", () => {
      // The page is more than half empty, so the heading would have stayed - but the diagram
      // under it is too tall for what is left, and the heading used to be left alone with its
      // one sentence and 40% of the page blank. It goes with the diagram instead.
      const { placed } = load([{ height: 450 }, heading, intro, { height: 800 }]);
      expect(placed[1].page).toBe(1);
      expect(placed[2].page).toBe(1);
      expect(placed[3].page).toBe(1);
      expect(placed[1].gap).toBe(0);
    });

    it("counts the first chain after the opening, not just one block", () => {
      // The next thing is a heading that keeps its line and its first bullet: 40 + 30 + 30.
      const next = [{ height: 40, keepWithNext: true }, { height: 30, keepWithNext: true }, { height: 30 }];
      const stays = load([{ height: 480 }, heading, intro, ...next]);   // 480 + 100 + 100 fits
      expect(stays.placed[1].page).toBe(0);
      const goes = load([{ height: 800 }, heading, intro, ...next]);    // would not
      expect(goes.placed[1].page).toBe(1);
    });
  });

  it("is what the PDF builder uses", () => {
    const src = readFileSync(new URL("./report-pdf.ts", import.meta.url), "utf8");
    expect(src).toContain("paginate(");
    expect(src).toMatch(/outerHeight\(b\.node\.getBoundingClientRect\(\)\.height/);
  });
});
