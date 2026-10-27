/**
 * Where each block of the report PDF goes, as numbers only.
 *
 * report-pdf.ts measures every block in the browser and then places them; the
 * placing is arithmetic, so it lives here, where it can be tested without a
 * page. A block is never split: it goes on the page whole, or on the next one.
 */

/** A part (the map, the appendix) opens on a fresh page unless this much of the current one is still free. */
const EMPTY_ENOUGH = 0.45;
/** The air above a part that opens on a page already in use. */
export const PART_GAP = 30;
/** What a block taller than a whole page is shrunk to fit inside. */
const TALL_MARGIN = 8;

/**
 * What a block takes on the page: its box and the margins around it.
 *
 * getBoundingClientRect leaves margins out, and two blocks carry one (the map's
 * diagram, 18px, and each route's heading, 9px). Every page that held one was
 * filled to the brim by the boxes and then pushed past it by the margin, and the
 * last line of the page went under the clip: a step cut through its middle
 * at the foot of a page (10 of the 26 review cases, 1 to 17px).
 */
export function outerHeight(boxHeight: number, marginTop: string, marginBottom: string): number {
  return boxHeight + (parseFloat(marginTop) || 0) + (parseFloat(marginBottom) || 0);
}

export interface LayoutItem {
  height: number;
  /** Stays on the same page as the block after it - a heading and what it heads. */
  keepWithNext?: boolean;
  /** Opens on a new page, unless that would leave most of the current one blank. */
  breakBefore?: boolean;
}

export interface Placement {
  page: number;
  /** Space added above the block, when a part starts on a page already in use. */
  gap: number;
  /** The height it takes: its own, or the page's when it was too tall and is scaled. */
  height: number;
}

/**
 * Assign each block a page.
 *
 * A block that does not fit goes to the next page, and takes with it the chain
 * of blocks it is kept with (capped at one page, so a chain longer than a sheet
 * asks for a break it cannot be given).
 *
 * A part's opening - its heading and the line under it - is not left on a page
 * unless what comes after it can start there too. The map's opening used to be
 * placed whenever the page was more than 45% empty, and then the diagram under
 * it, too tall for what was left, went overleaf: a heading and one sentence at
 * the foot of a page, 40% of it blank, and the content on the next.
 */
export function paginate(items: LayoutItem[], contentH: number): Placement[] {
  const chainEnd = (from: number) => {
    let e = from;
    while (items[e]?.keepWithNext && e + 1 < items.length) e++;
    return e;
  };
  const span = (from: number, to: number) => {
    let s = 0;
    for (let k = from; k <= to; k++) s += items[k].height;
    return s;
  };

  const out: Placement[] = [];
  let page = 0;
  let y = 0;
  items.forEach((it, i) => {
    const height = it.height > contentH ? contentH - TALL_MARGIN : it.height;
    let gap = it.breakBefore && y > 0 ? PART_GAP : 0;
    const end = chainEnd(i);
    const need = Math.min(height + gap + span(i + 1, end), contentH);

    let breaks = y > 0 && y + need > contentH;
    if (it.breakBefore && y > 0) {
      const mostlyEmpty = contentH - y > contentH * EMPTY_ENOUGH;
      if (!mostlyEmpty) breaks = true;
      else if (end + 1 < items.length && y + need + span(end + 1, chainEnd(end + 1)) > contentH) breaks = true;
    }
    if (breaks) { page++; y = 0; gap = 0; }
    out.push({ page, gap, height });
    y += height + gap;
  });
  return out;
}
