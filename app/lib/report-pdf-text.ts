/**
 * A text layer for the report PDF - a prototype, off unless asked for.
 *
 * The report is built in the browser and photographed page by page
 * (report-pdf.ts), so the file is pictures: nothing in it can be selected,
 * searched, copied or read out. This writes the words back over each page's
 * picture in the rendering mode that paints nothing, so a viewer finds them where
 * the picture shows them. It is on only when `window.__pdfTextLayer` is true or
 * the caller passes `textLayer: true`; the file the counsellor gets is otherwise
 * exactly what it was.
 *
 * Hebrew is the whole difficulty, and what works was found by measuring, not by
 * reading the specification. A PDF paints glyphs left to right in the order they
 * are written, and the viewers that extract text (PDFium - that is Chrome and
 * Edge - pdf.js and poppler) hand the stream back in that order, putting words
 * in reading order by position. So:
 *   - every WORD (a run of Hebrew letters, or a run of anything else - digits,
 *     Latin, punctuation) is its own text object at the place the browser put it,
 *     stretched to the width the picture shows, so selection and the search
 *     highlight cover the right box;
 *   - a Hebrew word's letters are written in reading order inside the word. jsPDF
 *     takes its text as visual and writes it logical, so the browser's
 *     left-to-right letters go in as they are seen;
 *   - the objects of a line are written right to left, which is reading order.
 * A whole line as one object, or a word's letters in the order the glyphs paint,
 * comes back from the viewer reversed ("םולש") and finds nothing.
 *
 * Not here: tags. A tagged PDF (headings, lists, reading order) is what a
 * screen-reader user needs, and this does not make one - see
 * docs/report-pdf-text-layer.md.
 */

import type { jsPDF } from "jspdf";

/** One word of a line as the page shows it, in CSS px from the page's corner. */
export interface TextRun {
  /** The characters as seen, left to right. */
  text: string;
  x: number;
  /** Where the baseline is. */
  baseline: number;
  w: number;
  /** Font size in CSS px. */
  size: number;
  /** A space follows it in reading order: the next word is not a piece of the same one. */
  space: boolean;
}

const MIRRORED: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<", "«": "»", "»": "«" };
const HEBREW = /[֐-׿]/;
const LATIN_OR_DIGIT = /[A-Za-z0-9]/;
/** What the font has - Heebo's Hebrew and Latin subsets. Anything else is dropped rather than written as a hole. */
const IN_FONT = /[ -~ -¬®-ÿְ-ּ־-ֿׁ-ׇׂא-תװ-״‌-‏–-—‘-‚“-„•…₪€−]/;

/**
 * Which characters of a text are laid out right to left, in the sense that
 * decides whether a bracket is mirrored: UAX #9 cut down to what the report
 * contains. Hebrew letters are right to left, Latin letters and digits left to
 * right, and anything else takes the side it is between - or the page's own
 * direction (right to left) when its two sides disagree.
 */
export function rtlFlags(text: string): boolean[] {
  const chars = [...text];
  const cls = chars.map(c => (HEBREW.test(c) ? "R" : LATIN_OR_DIGIT.test(c) ? "L" : "N"));
  return chars.map((_, i) => {
    if (cls[i] === "R") return true;
    if (cls[i] === "L") return false;
    let a = i - 1; while (a >= 0 && cls[a] === "N") a--;
    let b = i + 1; while (b < chars.length && cls[b] === "N") b++;
    return !((a >= 0 ? cls[a] : "R") === "L" && (b < chars.length ? cls[b] : "R") === "L");
  });
}

interface Glyph { ch: string; hebrew: boolean; x0: number; x1: number; top: number; bottom: number; size: number }

/** Every visible character of a page with the box the browser gave it. */
function glyphsOf(page: HTMLElement): Glyph[] {
  const origin = page.getBoundingClientRect();
  const out: Glyph[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const text = node.data;
    if (!text.trim()) continue;
    const parent = node.parentElement;
    if (!parent || parent.closest("[aria-hidden='true']")) continue;
    const size = parseFloat(getComputedStyle(parent).fontSize) || 13;
    const rtl = rtlFlags(text);
    let at = 0;   // UTF-16 offset
    let n = 0;    // character index
    for (const ch of text) {
      range.setStart(node, at);
      range.setEnd(node, at + ch.length);
      const r = range.getClientRects()[0];
      if (r && r.width > 0.01 && IN_FONT.test(ch)) {
        out.push({
          ch: rtl[n] && MIRRORED[ch] ? MIRRORED[ch] : ch,
          hebrew: HEBREW.test(ch),
          x0: r.left - origin.left, x1: r.right - origin.left, top: r.top - origin.top, bottom: r.bottom - origin.top, size,
        });
      }
      at += ch.length;
      n++;
    }
  }
  return out;
}

/** The page's words, line by line, each in the order it stands on the line. */
export function collectTextRuns(page: HTMLElement): TextRun[] {
  const glyphs = glyphsOf(page);
  // A line is a band of glyphs whose middles are within half a font size.
  const mid = (g: Glyph) => (g.top + g.bottom) / 2;
  glyphs.sort((a, b) => mid(a) - mid(b) || a.x0 - b.x0);
  const lines: Glyph[][] = [];
  for (const g of glyphs) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(mid(g) - mid(line[0])) <= g.size * 0.5) line.push(g);
    else lines.push([g]);
  }
  const runs: TextRun[] = [];
  for (const line of lines) {
    line.sort((a, b) => a.x0 - b.x0);
    // A mark inside a Hebrew word - the hyphen of בית-ספר, the slash of מחנכ/ת, the quote of שפ"ח - belongs to the
    // word, or the word is cut in three and comes back out of a viewer with spaces in it.
    const isHeb = line.map((g, i) => {
      if (g.hebrew) return true;
      const before = line[i - 1], after = line[i + 1];
      const near = (n?: Glyph) => !!n && n.hebrew && Math.abs(n.x1 - g.x0) < g.size * 0.35 || !!n && n.hebrew && Math.abs(g.x1 - n.x0) < g.size * 0.35;
      if (/["'׳״]/.test(g.ch)) return near(before) || near(after);
      if (/[-\/־]/.test(g.ch)) return near(before) && near(after);
      return false;
    });
    // Words: a break at a space, at a gap wider than a space (a column, a tag), and where Hebrew meets something else.
    const words: { glyphs: Glyph[]; touchesLeft: boolean }[] = [];
    let cur: Glyph[] = [];
    let curHeb = false;
    let touch = false;
    line.forEach((g, i) => {
      const prev = cur[cur.length - 1];
      if (g.ch === " " || g.ch === " ") {
        if (cur.length) words.push({ glyphs: cur, touchesLeft: touch });
        cur = []; touch = false;
        return;
      }
      if (prev && g.x0 - prev.x1 > g.size * 0.35) {
        words.push({ glyphs: cur, touchesLeft: touch });
        cur = []; touch = false;
      } else if (prev && isHeb[i] !== curHeb) {
        words.push({ glyphs: cur, touchesLeft: touch });
        cur = []; touch = true;
      }
      if (!cur.length) curHeb = isHeb[i];
      cur.push(g);
    });
    if (cur.length) words.push({ glyphs: cur, touchesLeft: touch });
    // Written right to left: the order the line is read in. The word to the left of a word it touches follows it with no space.
    for (let k = words.length - 1; k >= 0; k--) {
      const w = words[k].glyphs;
      const size = Math.max(...w.map(g => g.size));
      runs.push({
        text: w.map(g => g.ch).join(""),
        x: w[0].x0, w: w[w.length - 1].x1 - w[0].x0,
        // Heebo's descender is about a fifth of the em box.
        baseline: Math.max(...w.map(g => g.bottom)) - size * 0.27, size,
        space: !(k > 0 && words[k].touchesLeft),
      });
    }
  }
  return runs;
}

/** TrueType font of the layer: Heebo 500 with the Hebrew and Latin ranges of the report. */
export const TEXT_FONT_URL = "/fonts/heebo-text/Heebo-Text-500.ttf";
const FONT_NAME = "HeeboText";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Load the layer's font into a document; false when it could not be fetched (the file is then pictures only). */
export async function addTextFont(pdf: jsPDF): Promise<boolean> {
  try {
    const res = await fetch(TEXT_FONT_URL);
    if (!res.ok) return false;
    pdf.addFileToVFS("Heebo-Text-500.ttf", toBase64(await res.arrayBuffer()));
    pdf.addFont("Heebo-Text-500.ttf", FONT_NAME, "normal", undefined, "Identity-H");
    return true;
  } catch {
    return false;
  }
}

/** Write one page's words, each stretched to the width the picture shows, in the mode that paints nothing. */
export function drawTextRuns(pdf: jsPDF, runs: TextRun[], mmPerPx: number): void {
  pdf.setFont(FONT_NAME, "normal");
  for (const r of runs) {
    pdf.setFontSize(r.size * 0.75);
    // A trailing space keeps words apart for a viewer that joins what it extracts.
    const text = r.space ? `${r.text} ` : r.text;
    const natural = pdf.getTextWidth(r.text);
    const scale = natural > 0 ? (r.w * mmPerPx) / natural : 1;
    pdf.text(text, r.x * mmPerPx, r.baseline * mmPerPx, { renderingMode: "invisible", horizontalScale: scale });
  }
}

/** The switch: set by a test script on the page, or passed by a caller that wants the layer. */
export function textLayerWanted(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return typeof window !== "undefined" && (window as unknown as { __pdfTextLayer?: boolean }).__pdfTextLayer === true;
}
