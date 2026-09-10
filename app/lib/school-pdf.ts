/**
 * The counsellor's report as a document, not a photograph of a web page.
 *
 * downloadResultsPDF captures the results card with html2canvas and slices the
 * bitmap into A4 pages. For a parent's short report that is fine. For a
 * counsellor it produced 52 pages: the whole coloured web UI - hero button,
 * "what now" strip, per-finding cards - reproduced at screen width, text
 * touching both edges, and every page break falling wherever pixel 1123
 * happened to land, which is to say through the middle of a sentence.
 *
 * So this builds the document instead. The same data the screen renders is
 * laid out again into real A4 pages: a fixed margin, a running header and
 * footer, headings that stay with what follows them, and a page break that can
 * only fall between whole blocks. Nothing is ever cut in half, because nothing
 * is ever split. html2canvas is still what turns a page into pixels - the
 * browser is the only thing here that can set Hebrew - but it is handed one
 * finished page at a time rather than a two-metre column to guess at.
 *
 * What the counsellor gets: the referral summary first, the committee map
 * after it, and the practical tools as an appendix. The web-only furniture
 * does not appear at all.
 */

import type { SchoolSummary } from "./school-report";
import type { SchoolTrack } from "./school-tracks";

// ── Page geometry, in CSS pixels at 96dpi ────────────────────────────────────
const PAGE_W = 794;   // 210mm
const PAGE_H = 1123;  // 297mm
const MARGIN_X = 64;
const HEAD_H = 88;
const FOOT_H = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - HEAD_H - FOOT_H;

// A document palette: ink on paper, one restrained accent. The screen report is
// colour-coded because a parent scans it; this one is read like a file note.
//
// Darker than the screen's own greys on purpose. html2canvas paints without
// subpixel antialiasing and jsPDF then fits the bitmap to the sheet, and both
// steps thin a stroke; a body grey that reads as quiet on a backlit screen
// comes out of a printer looking faded. Body text is 500 for the same reason -
// Heebo 400 at 13.5px survives neither step with its weight intact.
const INK = "#101a19";
const INK_2 = "#1f2b2a";
const INK_3 = "#4f6260";
const RULE = "#d3dedd";
const ACCENT = "#2A6462";
const PAPER = "#ffffff";
const BAND = "#f4f8f7";

const FONT = "Heebo, system-ui, sans-serif";

export const PDF_DISCLAIMER = "מסמך המלצה אוטומטי להפניות - אינו אבחון";

type Style = Record<string, string>;

function el(tag: string, style: Style, text?: string): HTMLElement {
  const n = document.createElement(tag);
  Object.assign(n.style as unknown as Record<string, string>, style);
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * One thing that goes on a page.
 *
 * `keepWithNext` is what stops a heading being the last thing on a page with
 * its content overleaf. `breakBefore` starts a new page for the parts of the
 * document that should open on one.
 */
type Block = { node: HTMLElement; keepWithNext?: boolean; breakBefore?: boolean };

const PAD = "10px";

function paragraph(text: string, style: Style = {}): HTMLElement {
  return el("div", {
    font: `500 13.5px/1.75 ${FONT}`, color: INK_2, paddingBottom: PAD,
    textAlign: "justify", ...style,
  }, text);
}

/** A bullet drawn as a real element - a CSS marker lands on the wrong side here. */
function bullet(text: string, opts: { marker?: string; color?: string; bold?: boolean } = {}): HTMLElement {
  const row = el("div", { display: "flex", gap: "8px", paddingBottom: "5px", alignItems: "baseline" });
  row.appendChild(el("span", {
    font: `700 12px/1.75 ${FONT}`, color: opts.color ?? ACCENT, flex: "0 0 auto", minWidth: "14px",
  }, opts.marker ?? "•"));
  row.appendChild(el("div", {
    font: `${opts.bold ? 700 : 500} 13.5px/1.75 ${FONT}`, color: opts.color ?? INK_2, flex: "1 1 auto",
  }, text));
  return row;
}

/**
 * A part opens on a fresh page - the document convention - except when that
 * would leave most of the current one blank. The summary ends near the top of a
 * page as often as not, and eight-tenths of a page of white followed by
 * "מפת המסלולים" reads as a fault rather than as a break. See the placement
 * loop, which is where that call is made.
 */
function partHeading(text: string): Block {
  const wrap = el("div", { paddingBottom: "16px" });
  const h = el("div", { font: `800 19px/1.4 ${FONT}`, color: INK, paddingBottom: "8px" }, text);
  wrap.appendChild(h);
  wrap.appendChild(el("div", { height: "2px", background: ACCENT, width: "56px" }));
  return { node: wrap, keepWithNext: true, breakBefore: true };
}

function sectionHeading(n: number, text: string): Block {
  const row = el("div", { display: "flex", gap: "8px", alignItems: "baseline", padding: "6px 0 7px" });
  row.appendChild(el("span", { font: `800 14px/1.5 ${FONT}`, color: ACCENT, flex: "0 0 auto" }, `${n}.`));
  row.appendChild(el("span", { font: `800 14.5px/1.5 ${FONT}`, color: INK, flex: "1 1 auto" }, text));
  return { node: row, keepWithNext: true };
}

// ── The pieces of the document ───────────────────────────────────────────────

function titleBlocks(doc: SchoolSummary["doc"]): Block[] {
  const wrap = el("div", { paddingBottom: "18px" });
  wrap.appendChild(el("div", { font: `800 25px/1.35 ${FONT}`, color: INK, paddingBottom: "6px" }, doc.head));
  wrap.appendChild(el("div", { font: `500 12.5px/1.7 ${FONT}`, color: INK_3 }, doc.meta));
  wrap.appendChild(el("div", { height: "2px", background: ACCENT, width: "72px", marginTop: "12px" }));
  return [{ node: wrap, keepWithNext: true }];
}

function summaryBlocks(doc: SchoolSummary["doc"]): Block[] {
  const out: Block[] = [];
  doc.sections.forEach((s, i) => {
    out.push(sectionHeading(i + 1, s.title));
    s.lines.forEach(l => out.push({ node: bullet(l) }));
    out.push({ node: el("div", { height: "9px" }) });
  });
  return out;
}

function footBlocks(foot: string): Block[] {
  const wrap = el("div", { paddingTop: "8px" });
  wrap.appendChild(el("div", { height: "1px", background: RULE, marginBottom: "10px" }));
  wrap.appendChild(el("div", { font: `500 11.5px/1.7 ${FONT}`, color: INK_3, textAlign: "justify" }, foot));
  return [{ node: wrap }];
}

/**
 * The flow diagram and the timeline, lifted from the live page.
 *
 * Cloned rather than rebuilt: they are the one part of the report that is a
 * picture, and the picture is already on screen. Scaled to the content width
 * (the screen card is wider) and again to the page if a tall one would
 * otherwise not fit - which is also what "keep the graphs, a little smaller"
 * asks for.
 */
function graphBlocks(source: HTMLElement | null): Block[] {
  if (!source) return [];
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach(d => { (d as HTMLDetailsElement).open = true; });
  const box = el("div", {
    border: `1px solid ${RULE}`, borderRadius: "10px", padding: "16px 14px",
    background: PAPER, marginBottom: "18px", overflow: "hidden",
  });
  box.appendChild(clone);
  return [{ node: box }];
}

function trackBlocks(tracks: SchoolTrack[], relevanceLabel: (t: SchoolTrack) => string): Block[] {
  const out: Block[] = [];
  for (const t of tracks) {
    const head = el("div", {
      display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline",
      background: BAND, border: `1px solid ${RULE}`, borderRadius: "8px",
      padding: "9px 12px", marginBottom: "9px",
    });
    head.appendChild(el("span", { font: `800 14.5px/1.5 ${FONT}`, color: INK }, t.name));
    head.appendChild(el("span", { font: `700 11.5px/1.5 ${FONT}`, color: ACCENT, whiteSpace: "nowrap" }, relevanceLabel(t)));
    out.push({ node: head, keepWithNext: true });

    for (const w of t.why) out.push({ node: bullet(w) });

    if (t.deadline) {
      const d = el("div", { padding: "7px 0 6px" });
      d.appendChild(el("div", { font: `700 13px/1.6 ${FONT}`, color: INK }, `מועד: ${t.deadline.label}`));
      if (t.deadline.note) d.appendChild(el("div", { font: `500 12px/1.65 ${FONT}`, color: INK_3, paddingTop: "2px" }, t.deadline.note));
      out.push({ node: d });
    }
    for (const c of t.cautions) out.push({ node: bullet(c, { marker: "!", color: "#A83B22" }) });

    if (t.steps.length) {
      out.push({ node: subHeading("צעדים"), keepWithNext: true });
      t.steps.forEach((x, i) => out.push({ node: bullet(x, { marker: `${i + 1}.` }) }));
    }
    if (t.documents.length) {
      out.push({ node: subHeading("מסמכים"), keepWithNext: true });
      t.documents.forEach(x => out.push({ node: bullet(x) }));
    }
    if (t.appeals.length) {
      out.push({ node: subHeading("ערר"), keepWithNext: true });
      t.appeals.forEach(a => out.push({ node: bullet(`על ${a.against}: ${a.window}, אל ${a.to}`) }));
    }
    out.push({ node: paragraph(`אומת מול: ${t.verified}`, { font: `500 11px/1.6 ${FONT}`, color: INK_3, paddingBottom: "22px" }) });
  }
  return out;
}

function subHeading(text: string): HTMLElement {
  return el("div", { font: `700 12px/1.6 ${FONT}`, color: INK, padding: "6px 0 4px" }, text);
}

export type ToolGroup = { title: string; tools: string[] };

/**
 * The engine writes a tool as one string with its own bullets inside it
 * ("להפחתת מתח: 🟢 קרקוע: … 🟢 נשימות: …"). Inside a coloured card on screen
 * that reads; in a document it is a slab. Split on those inner markers so each
 * practice gets a line of its own, and keep whatever stood before the first
 * marker as the line that introduces them.
 */
const TOOL_MARK = /\s*[\u2022\u25B8\u{1F7E2}\u{1F7E0}\u{1F534}]\s*/gu;

function toolLines(text: string): { lead: string; items: string[] } {
  const parts = text.split(TOOL_MARK).map(x => x.trim()).filter(Boolean);
  if (parts.length <= 1) return { lead: "", items: parts };
  return { lead: parts[0], items: parts.slice(1) };
}

function toolBlocks(groups: ToolGroup[]): Block[] {
  if (!groups.length) return [];
  const out: Block[] = [partHeading("נספח: כלים מעשיים")];
  out.push({
    node: paragraph(
      "הכלים שלהלן נלווים לממצאים שבסיכום. הם אינם מחליפים טיפול ואינם חלק מההפניה - הם מה שאפשר להתחיל ליישם בבית הספר או בבית בזמן ההמתנה.",
      { color: INK_3, font: `500 12.5px/1.7 ${FONT}`, paddingBottom: "16px" },
    ),
  });
  for (const g of groups) {
    out.push({ node: subHeading(g.title), keepWithNext: true });
    for (const t of g.tools) {
      const { lead, items } = toolLines(t);
      if (lead) {
        out.push({
          node: paragraph(lead, { font: `600 12.5px/1.7 ${FONT}`, color: INK, paddingBottom: "4px", textAlign: "start" }),
          keepWithNext: items.length > 0,
        });
      }
      for (const it of items) out.push({ node: bullet(it) });
    }
    out.push({ node: el("div", { height: "12px" }) });
  }
  return out;
}

// ── Page assembly ────────────────────────────────────────────────────────────

function newPage(logoSrc: string): HTMLElement {
  const page = el("div", {
    position: "relative", width: `${PAGE_W}px`, height: `${PAGE_H}px`,
    background: PAPER, direction: "rtl", boxSizing: "border-box", overflow: "hidden",
  });

  const head = el("div", {
    position: "absolute", top: "0", insetInlineStart: "0", insetInlineEnd: "0", height: `${HEAD_H}px`,
    padding: `26px ${MARGIN_X}px 0`, boxSizing: "border-box",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
  });
  const logo = document.createElement("img");
  logo.src = logoSrc;
  logo.alt = "טיפול חכם";
  Object.assign(logo.style, { height: "30px", width: "auto", display: "block" });
  head.appendChild(logo);
  head.appendChild(el("div", { font: `700 10.5px/1.4 ${FONT}`, color: INK_3, textAlign: "start" }, PDF_DISCLAIMER));
  page.appendChild(head);
  page.appendChild(el("div", {
    position: "absolute", top: `${HEAD_H - 14}px`, insetInlineStart: `${MARGIN_X}px`,
    width: `${CONTENT_W}px`, height: "1px", background: RULE,
  }));

  const body = el("div", {
    position: "absolute", top: `${HEAD_H}px`, insetInlineStart: `${MARGIN_X}px`,
    width: `${CONTENT_W}px`, height: `${CONTENT_H}px`, overflow: "hidden",
  });
  body.dataset.body = "1";
  page.appendChild(body);

  return page;
}

function stampFooter(page: HTMLElement, n: number, total: number, todayLabel: string) {
  page.appendChild(el("div", {
    position: "absolute", bottom: `${FOOT_H - 16}px`, insetInlineStart: `${MARGIN_X}px`,
    width: `${CONTENT_W}px`, height: "1px", background: RULE,
  }));
  const foot = el("div", {
    position: "absolute", bottom: "16px", insetInlineStart: `${MARGIN_X}px`, width: `${CONTENT_W}px`,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    font: `500 10.5px/1.4 ${FONT}`, color: INK_3,
  });
  foot.appendChild(el("span", {}, `טיפול חכם · ${todayLabel}`));
  foot.appendChild(el("span", { fontWeight: "700" }, `עמוד ${n} מתוך ${total}`));
  page.appendChild(foot);
}

export interface SchoolPdfInput {
  summary: SchoolSummary;
  tracks: SchoolTrack[];
  relevanceLabel: (t: SchoolTrack) => string;
  /** The live flow diagram + timeline container, cloned into the document. */
  graphsEl: HTMLElement | null;
  toolGroups: ToolGroup[];
  todayLabel: string;
  filename: string;
  logoSrc?: string;
}

/**
 * Lay the report out into A4 pages and download it.
 *
 * Two passes: every block is measured on its own at the content width, then
 * placed. A block that would overflow moves to the next page whole; a heading
 * takes the block after it along. The only thing allowed to shrink is a
 * cloned graph too tall to fit, which is scaled rather than cut.
 */
export async function downloadSchoolReportPDF(input: SchoolPdfInput): Promise<void> {
  const logoSrc = input.logoSrc ?? "/logo-temp.png";

  const blocks: Block[] = [
    ...titleBlocks(input.summary.doc),
    ...summaryBlocks(input.summary.doc),
    ...footBlocks(input.summary.doc.foot),
  ];
  if (input.tracks.length) {
    blocks.push(partHeading("מפת המסלולים"));
    blocks.push({
      node: paragraph(
        "המסלולים והמועדים מחושבים מכללי חוזרי המנכ\"ל ומן החוק, לפי הכיתה ולפי מה שנמסר על התיק. השיפוט הקליני - מה מצדיק הפניה ובאיזו דחיפות - נשאר בידי הצוות.",
        { color: INK_3, font: `500 12.5px/1.7 ${FONT}`, paddingBottom: "16px" },
      ),
      keepWithNext: true,
    });
    blocks.push(...graphBlocks(input.graphsEl));
    blocks.push(...trackBlocks(input.tracks, input.relevanceLabel));
  }
  blocks.push(...toolBlocks(input.toolGroups));

  const stage = el("div", {
    position: "fixed", insetInlineStart: "-20000px", top: "0",
    width: `${PAGE_W}px`, direction: "rtl", background: PAPER, zIndex: "-1",
  });
  stage.dataset.schoolPdfStage = "1";
  document.body.appendChild(stage);

  try {
    await waitForAssets(logoSrc);

    // Pass 1 - measure each block alone at the width it will be laid out at.
    const measurer = el("div", { width: `${CONTENT_W}px`, direction: "rtl" });
    stage.appendChild(measurer);
    const heights: number[] = [];
    for (const b of blocks) {
      measurer.appendChild(b.node);
      heights.push(b.node.getBoundingClientRect().height);
      measurer.removeChild(b.node);
    }
    stage.removeChild(measurer);

    // Pass 2 - place them.
    const pages: HTMLElement[] = [];
    let body: HTMLElement | null = null;
    let y = 0;
    const open = () => {
      const page = newPage(logoSrc);
      pages.push(page);
      stage.appendChild(page);
      body = page.querySelector<HTMLElement>("[data-body]");
      y = 0;
    };
    open();

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      let h = heights[i];
      let topGap = b.breakBefore && y > 0 ? 30 : 0;

      // A graph taller than a whole page is scaled, never sliced.
      if (h > CONTENT_H) {
        const k = (CONTENT_H - 8) / h;
        b.node.style.transform = `scale(${k})`;
        b.node.style.transformOrigin = "top right";
        const shell = el("div", { height: `${h * k}px`, overflow: "hidden" });
        shell.appendChild(b.node);
        b.node = shell;
        h = h * k;
      }

      // Follow the whole keep-with-next chain, not just one link: the map's
      // heading holds its opening paragraph, which holds the diagram, and
      // measuring only the first pair left the heading alone at the foot of a
      // page with a third of it blank. Capped at a page, so a chain longer
      // than one sheet asks for a break it cannot be given.
      let need = h + topGap;
      for (let j = i; blocks[j]?.keepWithNext && j + 1 < blocks.length; j++) need += heights[j + 1];
      need = Math.min(need, CONTENT_H);
      const mostlyEmpty = CONTENT_H - y > CONTENT_H * 0.45;
      if (y > 0 && ((b.breakBefore && !mostlyEmpty) || y + need > CONTENT_H)) { open(); topGap = 0; }
      if (topGap) b.node.style.paddingTop = `${topGap}px`;

      body!.appendChild(b.node);
      y += h + topGap;
    }

    pages.forEach((p, i) => stampFooter(p, i + 1, pages.length, input.todayLabel));
    await renderPdf(pages, input.filename);
  } finally {
    stage.remove();
  }
}

/** Fonts and the logo must be in before anything is measured or painted. */
async function waitForAssets(logoSrc: string): Promise<void> {
  try { await document.fonts.ready; } catch { /* older browsers */ }
  await new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoSrc;
  });
}

async function renderPdf(pages: HTMLElement[], filename: string): Promise<void> {
  const [{ default: html2canvas }, jsPDFMod] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const pdf = new jsPDFMod.jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  for (let i = 0; i < pages.length; i++) {
    // scale 3 puts a 794px page at ~285dpi. Two was enough to read on a screen
    // and left the letters looking washed out on paper: JPEG spends its budget
    // on the edges of glyphs, and at 190dpi a Hebrew stroke is thin enough that
    // it loses. Quality then comes down, not up: on a page that is mostly white,
    // JPEG spends far less on 285dpi at 0.86 than on 190dpi at 0.95, and the
    // strokes come out heavier either way.
    const canvas = await html2canvas(pages[i], { scale: 3, backgroundColor: PAPER, useCORS: true, logging: false });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.86), "JPEG", 0, 0, 210, 297);
  }
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
