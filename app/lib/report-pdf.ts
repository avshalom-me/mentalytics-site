/**
 * A questionnaire report as a document, not a photograph of a web page.
 *
 * downloadResultsPDF captures a results card with html2canvas and slices the
 * bitmap into A4 pages. For a counsellor that produced 52 pages: the whole
 * coloured web UI - hero button, "what now" strip, per-finding cards -
 * reproduced at screen width, text touching both edges, and every page break
 * falling wherever pixel 1123 happened to land, which is to say through the
 * middle of a sentence. A parent's report is shorter and got the same cuts.
 *
 * So this builds the document instead. The same data the screen renders is
 * laid out again into real A4 pages: a fixed margin, a running header and
 * footer, headings that stay with what follows them, and a page break that can
 * only fall between whole blocks. Nothing is ever cut in half, because nothing
 * is ever split. html2canvas is still what turns a page into pixels - the
 * browser is the only thing here that can set Hebrew - but it is handed one
 * finished page at a time rather than a two-metre column to guess at.
 *
 * Two reports use it. The counsellor's: the referral summary first, the
 * committee map after it, the practical tools as an appendix. The parent's: the
 * findings by domain, then the tools. The web-only furniture appears in
 * neither - see kids-report-doc.ts for how the parent's is assembled.
 */

import type { SchoolTrack } from "./school-tracks";
import {
  PROFILE_LEVEL_LABELS,
  PROFILE_STATUS_LABELS,
  PROFILE_CAPTION,
  OUTCOME_COLUMNS,
  OUTCOME_COLUMN_LABELS,
  HELPED_LEGEND,
  exhaustionLine,
  type ProfileChart,
  type TriedChart,
} from "./report-charts";

/** The text of a report, already in sections - what either report builder returns. */
export interface ReportDoc {
  head: string;
  meta: string;
  /** `id` places a chart: beside "background", in place of the lines of "tried". */
  sections: { title: string; lines: string[]; id?: string }[];
  foot: string;
}

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

/**
 * The three relevance levels, told apart on paper.
 *
 * They were all printed in the same teal, so a card marked "מידע" read exactly
 * like one marked "לטיפול עכשיו" - and in a document that goes into a file and
 * gets passed on, that is the difference between background and a referral.
 * Restrained on purpose: a weight and a tint, not a colour-coded web card.
 */
const REL_TONE: Record<string, { fg: string; band: string; border: string }> = {
  "לטיפול עכשיו": { fg: "#8a5a06", band: "#fdf6e3", border: "#e3c98a" },
  "לשיקול": { fg: ACCENT, band: "#eef5f4", border: "#bcd6d4" },
  "מידע": { fg: "#5c6d6b", band: "#f5f6f6", border: "#dfe4e3" },
};
const toneFor = (label: string) => REL_TONE[label] ?? REL_TONE["מידע"];

// The two charts: one teal and a grey track, the gold only for "דחוף".
const CHART_FILL = "#3D8C8A";
const CHART_EMPTY = "#e3ebea";
const CHART_URGENT = "#8a5a06";

const FONT = "Heebo, system-ui, sans-serif";

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

function titleBlocks(doc: ReportDoc): Block[] {
  const wrap = el("div", { paddingBottom: "18px" });
  wrap.appendChild(el("div", { font: `800 25px/1.35 ${FONT}`, color: INK, paddingBottom: "6px" }, doc.head));
  wrap.appendChild(el("div", { font: `500 12.5px/1.7 ${FONT}`, color: INK_3 }, doc.meta));
  wrap.appendChild(el("div", { height: "2px", background: ACCENT, width: "72px", marginTop: "12px" }));
  return [{ node: wrap, keepWithNext: true }];
}

function summaryBlocks(doc: ReportDoc, charts?: ReportPdfInput["charts"]): Block[] {
  const out: Block[] = [];
  doc.sections.forEach((s, i) => {
    out.push(sectionHeading(i + 1, s.title));
    // The attempts chart replaces the list it draws - the document does not
    // get longer for having a picture. The snapshot follows the background.
    if (s.id === "tried" && charts?.tried) out.push(triedBlock(charts.tried, !!charts.gan));
    else s.lines.forEach(l => out.push({ node: bullet(l) }));
    if (s.id === "background" && charts?.profile) out.push(profileBlock(charts.profile));
    out.push({ node: el("div", { height: "9px" }) });
  });
  return out;
}

/**
 * Chart A - the difficulty by domain: the counsellor's own four-point scale as
 * three segments, and beside each row what the items found. One block, so a
 * page break never splits it.
 */
function profileBlock(c: ProfileChart): Block {
  const wrap = el("div", { padding: "6px 0 10px" });
  wrap.appendChild(el("div", { font: `700 12px/1.6 ${FONT}`, color: INK_3, paddingBottom: "7px" }, PROFILE_CAPTION));
  const grid = el("div", {
    display: "grid", gridTemplateColumns: "80px 222px 1fr", columnGap: "14px", rowGap: "7px",
    alignItems: "center", maxWidth: "520px",
  });
  grid.appendChild(el("span", {}));
  const head = el("div", { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: "4px" });
  for (const l of PROFILE_LEVEL_LABELS) head.appendChild(el("span", { font: `500 10.5px/1.4 ${FONT}`, color: INK_3, textAlign: "center" }, l));
  grid.appendChild(head);
  grid.appendChild(el("span", {}));
  for (const r of c.rows) {
    grid.appendChild(el("span", { font: `700 12.5px/1.4 ${FONT}`, color: r.level === 0 ? INK_3 : INK }, r.label));
    const bar = el("div", { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", columnGap: "4px" });
    for (let i = 1; i <= 3; i++) bar.appendChild(el("span", { display: "block", height: "11px", borderRadius: "3px", background: i <= r.level ? CHART_FILL : CHART_EMPTY }));
    grid.appendChild(bar);
    grid.appendChild(el("span", {
      font: `${r.status === "urgent" ? 700 : 500} 11.5px/1.4 ${FONT}`,
      color: r.status === "urgent" ? CHART_URGENT : r.status === "found" ? INK_2 : INK_3,
    }, PROFILE_STATUS_LABELS[r.status]));
  }
  wrap.appendChild(grid);
  return { node: wrap };
}

/**
 * Chart B - what was tried and what came of it: one dot per attempt, in the
 * column of its outcome. A filled dot counts toward מיצוי; "הועיל" is drawn
 * hollow because it does not. What was not tried, and the floor itself, are
 * said underneath, so nothing the text list held is lost.
 */
function triedBlock(c: TriedChart, gan: boolean): Block {
  const wrap = el("div", { padding: "2px 0 8px" });
  // The label column is as wide as the longest label, so a short one does not
  // leave its dot half a page away.
  const grid = el("div", {
    display: "grid", gridTemplateColumns: "fit-content(380px) 58px 58px 58px", columnGap: "18px", rowGap: "6px",
    alignItems: "center", justifyContent: "start",
  });
  grid.appendChild(el("span", {}));
  for (const o of OUTCOME_COLUMNS) grid.appendChild(el("span", { font: `700 10.5px/1.4 ${FONT}`, color: INK_3, textAlign: "center" }, OUTCOME_COLUMN_LABELS[o]));
  for (const g of c.groups) {
    grid.appendChild(el("div", {
      gridColumn: "1 / -1", font: `700 11.5px/1.4 ${FONT}`, color: INK_3,
      borderBottom: `1px solid ${RULE}`, paddingBottom: "2px", marginTop: "4px",
    }, g.title));
    for (const r of g.rows) {
      grid.appendChild(el("span", { font: `500 12.5px/1.5 ${FONT}`, color: INK_2 }, r.label));
      for (const o of OUTCOME_COLUMNS) {
        const cell = el("div", { display: "flex", justifyContent: "center", alignItems: "center" });
        if (o === r.outcome) {
          cell.appendChild(el("span", {
            display: "block", width: "11px", height: "11px", borderRadius: "50%", boxSizing: "border-box",
            ...(o === "helped" ? { border: `2px solid ${INK_3}` } : { background: CHART_FILL }),
          }));
        }
        grid.appendChild(cell);
      }
    }
  }
  wrap.appendChild(grid);
  const notes: string[] = [];
  if (c.exhaustion) notes.push(exhaustionLine(c.exhaustion, gan));
  if (c.anyHelped) notes.push(HELPED_LEGEND);
  if (c.untried.length) notes.push(`טרם נוסו: ${c.untried.join(", ")}`);
  notes.forEach((n, i) => wrap.appendChild(el("div", {
    font: `${i === 0 && c.exhaustion ? 700 : 500} 11.5px/1.65 ${FONT}`, color: i === 0 && c.exhaustion ? INK_2 : INK_3,
    paddingTop: i === 0 ? "8px" : "2px",
  }, n)));
  return { node: wrap };
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
    const label = relevanceLabel(t);
    const tone = toneFor(label);
    const head = el("div", {
      display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline",
      background: tone.band, border: `1px solid ${tone.border}`, borderRadius: "8px",
      padding: "9px 12px", marginBottom: "9px",
    });
    head.appendChild(el("span", { font: `800 14.5px/1.5 ${FONT}`, color: INK }, t.name));
    head.appendChild(el("span", {
      font: `800 11px/1.5 ${FONT}`, color: tone.fg, whiteSpace: "nowrap",
      border: `1px solid ${tone.border}`, borderRadius: "999px", padding: "2px 9px", background: PAPER,
    }, label));
    out.push({ node: head, keepWithNext: true });

    // "שיקולים להכרעה", when the team is still weighing it: the headline, then
    // each condition marked met, missing, or to confirm.
    if (t.decision) {
      out.push({ node: subHeading("שיקולים להכרעה"), keepWithNext: true });
      out.push({
        node: paragraph(t.decision.headline, { font: `700 13px/1.7 ${FONT}`, color: INK, paddingBottom: "6px", textAlign: "start" }),
        keepWithNext: true,
      });
      for (const it of t.decision.items) {
        out.push({
          node: bullet(it.label, {
            marker: it.ok === true ? "✓" : it.ok === false ? "✗" : "?",
            color: it.ok === false ? "#A83B22" : undefined,
          }),
        });
      }
      if (t.decision.decideBy) {
        out.push({ node: paragraph(t.decision.decideBy, { font: `700 12px/1.6 ${FONT}`, color: "#8a5a06", paddingBottom: "12px", textAlign: "start" }) });
      }
    }

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

/**
 * Labelled blank lines, two to a row, each a rule to write on.
 *
 * The counsellor rubric is anonymous by construction - no name ever reaches
 * it - so the printed document leaves room for what she adds by hand: who the
 * student is at the top, who prepared it and signed at the end. One block, so a
 * row of blanks is never split across two pages.
 */
function blankLines(labels: string[], opts: { topRule?: boolean } = {}): Block {
  const wrap = el("div", { paddingTop: opts.topRule ? "10px" : "2px", paddingBottom: "20px" });
  if (opts.topRule) wrap.appendChild(el("div", { height: "1px", background: RULE, marginBottom: "18px" }));
  const grid = el("div", { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "32px", rowGap: "22px" });
  for (const label of labels) {
    const row = el("div", { display: "flex", alignItems: "flex-end", gap: "8px" });
    row.appendChild(el("span", { font: `600 12.5px/1.4 ${FONT}`, color: INK_2, flex: "0 0 auto", whiteSpace: "nowrap" }, `${label}:`));
    row.appendChild(el("span", { flex: "1 1 auto", height: "18px", borderBottom: `1px solid ${INK_3}` }));
    grid.appendChild(row);
  }
  wrap.appendChild(grid);
  return { node: wrap };
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

function toolBlocks(groups: ToolGroup[], intro: string): Block[] {
  if (!groups.length) return [];
  const out: Block[] = [partHeading("נספח: כלים מעשיים")];
  out.push({
    node: paragraph(intro, { color: INK_3, font: `500 12.5px/1.7 ${FONT}`, paddingBottom: "16px" }),
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

function newPage(logoSrc: string, disclaimer: string): HTMLElement {
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
  head.appendChild(el("div", { font: `700 10.5px/1.4 ${FONT}`, color: INK_3, textAlign: "start" }, disclaimer));
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

export interface ReportPdfInput {
  doc: ReportDoc;
  /** The line beside the logo on every page. */
  disclaimer: string;
  /** The counsellor's committee map. A parent's report has none. */
  map?: {
    tracks: SchoolTrack[];
    relevanceLabel: (t: SchoolTrack) => string;
    /** The live flow diagram + timeline container, cloned into the document. */
    graphsEl: HTMLElement | null;
  };
  toolGroups: ToolGroup[];
  /** The sentence that opens the tools appendix: whose tools, and for when. */
  toolsIntro: string;
  todayLabel: string;
  filename: string;
  logoSrc?: string;
  /** Blank lines under the title, for what the tool deliberately does not collect. */
  fillIn?: string[];
  /** Blank lines closing the report proper - after the summary, before the map and the appendix. */
  signature?: string[];
  /** The counsellor's two charts (report-charts.ts). Each is null when it has nothing worth drawing. */
  charts?: { profile?: ProfileChart | null; tried?: TriedChart | null; gan?: boolean };
}

/**
 * Lay the report out into A4 pages and download it.
 *
 * Two passes: every block is measured on its own at the content width, then
 * placed. A block that would overflow moves to the next page whole; a heading
 * takes the block after it along. The only thing allowed to shrink is a
 * cloned graph too tall to fit, which is scaled rather than cut.
 */
export async function downloadReportPDF(input: ReportPdfInput): Promise<void> {
  const logoSrc = input.logoSrc ?? "/logo-temp.png";

  // The signature closes the report itself - the summary. The map and the
  // tools that follow are attachments to it, not part of what is being signed,
  // and a signature printed after them sat alone at the top of the last page
  // reading as if it belonged to the appendix. The disclaimer above it is kept
  // with it, so the signature never opens a page on its own.
  const foot = footBlocks(input.doc.foot);
  if (input.signature?.length) foot[foot.length - 1].keepWithNext = true;
  const blocks: Block[] = [
    ...titleBlocks(input.doc),
    ...(input.fillIn?.length ? [blankLines(input.fillIn)] : []),
    ...summaryBlocks(input.doc, input.charts),
    ...foot,
    ...(input.signature?.length ? [blankLines(input.signature, { topRule: true })] : []),
  ];
  if (input.map && input.map.tracks.length) {
    blocks.push(partHeading("מפת המסלולים"));
    blocks.push({
      node: paragraph(
        "המסלולים והמועדים מחושבים מכללי חוזרי המנכ\"ל ומן החוק, לפי הכיתה ולפי מה שנמסר על התיק. השיפוט הקליני - מה מצדיק הפניה ובאיזו דחיפות - נשאר בידי הצוות.",
        { color: INK_3, font: `500 12.5px/1.7 ${FONT}`, paddingBottom: "16px" },
      ),
      // Deliberately NOT kept with the diagram: chaining heading -> paragraph ->
      // diagram meant all three moved together, and a summary that ends near the
      // top of a page then left two thirds of it white. The heading keeps its
      // paragraph; the picture may start overleaf, which is what a document does.
    });
    blocks.push(...graphBlocks(input.map.graphsEl));
    blocks.push(...trackBlocks(input.map.tracks, input.map.relevanceLabel));
  }
  blocks.push(...toolBlocks(input.toolGroups, input.toolsIntro));

  const stage = el("div", {
    position: "fixed", insetInlineStart: "-20000px", top: "0",
    width: `${PAGE_W}px`, direction: "rtl", background: PAPER, zIndex: "-1",
  });
  stage.dataset.reportPdfStage = "1";
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
      const page = newPage(logoSrc, input.disclaimer);
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
