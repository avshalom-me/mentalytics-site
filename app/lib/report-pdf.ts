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
import { outerHeight, paginate } from "./report-pdf-layout";
import {
  LEVEL_TONES,
  levelSwatch,
  URGENT_RING,
  URGENT_FG,
  OUTCOME_TONES,
  OUTCOME_ORDER,
  OUTCOME_LABELS_SHORT,
  PROFILE_LEVEL_LABELS,
  PROFILE_TILE_LEVELS,
  PROFILE_STATUS_LABELS,
  PROFILE_CAPTION,
  PROFILE_URGENT_LEGEND,
  HELPED_LEGEND,
  PATH_NOTE,
  type PathChart,
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

// The charts take their colours from report-charts.ts, shared with the screen.
const CHART_FILL = "#3D8C8A";
const CHART_TRACK = "#DDE9E8";

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
    // get longer for having a picture. The path to the committee follows what
    // was tried, and what was not tried closes the section, as in the list.
    // The snapshot follows the background.
    if (s.id === "tried" && charts?.tried) {
      out.push(triedBlock(charts.tried));
      if (charts.path) out.push(pathBlock(charts.path));
      if (charts.tried.untried.length) out.push({ node: chartNote(`טרם נוסו: ${charts.tried.untried.join(", ")}`) });
    } else {
      s.lines.forEach(l => out.push({ node: bullet(l) }));
      if (s.id === "tried" && charts?.path) out.push(pathBlock(charts.path));
    }
    if (s.id === "background" && charts?.profile) out.push(profileBlock(charts.profile));
    out.push({ node: el("div", { height: "9px" }) });
  });
  return out;
}

/**
 * Chart A - the difficulty by domain, one tile per domain: the deeper the
 * teal, the more the counsellor reported; under each tile, what the items
 * found. A gold frame marks an urgent finding. One block, so a page break
 * never splits it.
 */
function profileBlock(c: ProfileChart): Block {
  const wrap = el("div", { padding: "6px 0 12px" });
  wrap.appendChild(el("div", { font: `700 12px/1.6 ${FONT}`, color: INK_3, paddingBottom: "8px" }, PROFILE_CAPTION));
  const grid = el("div", {
    display: "grid", gridTemplateColumns: `repeat(${c.rows.length}, 1fr)`, columnGap: "10px", rowGap: "5px",
    maxWidth: `${c.rows.length * 132}px`,
  });
  for (const r of c.rows) {
    const tone = LEVEL_TONES[r.level];
    // The frame is a border on a wrapper: html2canvas paints borders
    // faithfully, outlines and spread shadows less so.
    const ring = el("div", { border: `2px solid ${r.status === "urgent" ? URGENT_RING : "transparent"}`, borderRadius: "15px", padding: "2px" });
    const tile = el("div", {
      background: tone.bg, border: `1px ${r.level === 0 ? "dashed" : "solid"} ${tone.border}`,
      borderRadius: "12px", padding: "11px 4px 10px", textAlign: "center",
    });
    tile.appendChild(el("div", { font: `800 15px/1.3 ${FONT}`, color: tone.fg }, r.label));
    tile.appendChild(el("div", { font: `500 11.5px/1.4 ${FONT}`, color: tone.fg, paddingTop: "2px" }, PROFILE_TILE_LEVELS[r.level]));
    ring.appendChild(tile);
    grid.appendChild(ring);
  }
  for (const r of c.rows) {
    const strong = r.status === "urgent" || r.status === "found";
    grid.appendChild(el("div", {
      font: `${strong ? 700 : 500} 11px/1.4 ${FONT}`, textAlign: "center",
      color: r.status === "urgent" ? URGENT_FG : r.status === "found" ? ACCENT : INK_3,
    }, PROFILE_STATUS_LABELS[r.status] || " "));
  }
  wrap.appendChild(grid);

  const legend = el("div", { display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center", paddingTop: "9px" });
  PROFILE_LEVEL_LABELS.forEach((l, i) => {
    const s = levelSwatch(i + 1);
    legend.appendChild(swatchItem(s.fill, l, s.border));
  });
  if (c.rows.some(r => r.status === "urgent")) legend.appendChild(swatchItem("#FFFFFF", PROFILE_URGENT_LEGEND, URGENT_RING));
  wrap.appendChild(legend);
  return { node: wrap };
}

/** A small colour sample and its meaning, for the legends. */
function swatchItem(fill: string, label: string, border = fill): HTMLElement {
  const item = el("span", { display: "inline-flex", alignItems: "center", gap: "5px", font: `500 11px/1.4 ${FONT}`, color: INK_3 });
  item.appendChild(el("span", { display: "inline-block", width: "14px", height: "10px", borderRadius: "3px", background: fill, border: `1.5px solid ${border}`, boxSizing: "border-box" }));
  item.appendChild(el("span", {}, label));
  return item;
}

function chartNote(text: string, strong = false): HTMLElement {
  return el("div", { font: `${strong ? 700 : 500} 11.5px/1.65 ${FONT}`, color: strong ? INK_2 : INK_3, padding: "2px 0 6px" }, text);
}

/**
 * Chart B - what was tried and what came of it. A bar of how the attempts
 * ended, then each attempt as a tag in its outcome's colour, by kind. Every tag
 * also says its outcome in words; "הועיל" is an outline only, because it does
 * not count toward מיצוי.
 */
function triedBlock(c: TriedChart): Block {
  const wrap = el("div", { padding: "2px 0 6px" });

  const head = el("div", { display: "flex", alignItems: "center", gap: "12px", paddingBottom: "6px" });
  head.appendChild(el("span", { font: `800 13px/1.4 ${FONT}`, color: INK, flex: "0 0 auto" }, `${c.total} ניסיונות`));
  const bar = el("div", { display: "flex", gap: "2px", height: "12px", flex: "1 1 auto", maxWidth: "380px" });
  const present = OUTCOME_ORDER.filter(o => c.counts[o] > 0);
  present.forEach((o, i) => {
    // Rounded ends drawn on the end segments: a clipping parent with a radius
    // is the one thing html2canvas does not reliably honour.
    const seg = el("span", { display: "block", flex: `${c.counts[o]} 1 0`, background: OUTCOME_TONES[o].fill });
    if (i === 0) Object.assign(seg.style, { borderStartStartRadius: "6px", borderEndStartRadius: "6px" });
    if (i === present.length - 1) Object.assign(seg.style, { borderStartEndRadius: "6px", borderEndEndRadius: "6px" });
    bar.appendChild(seg);
  });
  head.appendChild(bar);
  wrap.appendChild(head);

  const legend = el("div", { display: "flex", flexWrap: "wrap", gap: "6px 14px", paddingBottom: "10px" });
  for (const o of present) legend.appendChild(swatchItem(OUTCOME_TONES[o].fill, `${OUTCOME_LABELS_SHORT[o]} ${c.counts[o]}`));
  wrap.appendChild(legend);

  for (const g of c.groups) {
    const row = el("div", { display: "grid", gridTemplateColumns: "64px 1fr", columnGap: "10px", alignItems: "start", paddingBottom: "8px" });
    row.appendChild(el("div", { font: `700 11.5px/1.4 ${FONT}`, color: INK_3, paddingTop: "5px" }, g.title));
    const tags = el("div", { display: "flex", flexWrap: "wrap", gap: "6px" });
    for (const r of g.rows) {
      const t = OUTCOME_TONES[r.outcome];
      const tag = el("span", {
        display: "inline-block", background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: "999px",
        padding: "3px 11px", font: `500 12px/1.5 ${FONT}`, color: INK_2,
      });
      tag.appendChild(el("span", {}, r.label));
      tag.appendChild(el("span", { fontWeight: "700", color: t.fg }, ` · ${OUTCOME_LABELS_SHORT[r.outcome]}`));
      tags.appendChild(tag);
    }
    row.appendChild(tags);
    wrap.appendChild(row);
  }
  if (c.anyHelped) wrap.appendChild(chartNote(HELPED_LEGEND));
  return { node: wrap };
}

/**
 * Chart C - the way to the committee: the floor as two stations, then the
 * referral and the hearings with this year's dates. The line runs teal as far
 * as the team has come; a missing station is framed in gold.
 */
function pathBlock(p: PathChart): Block {
  const wrap = el("div", { padding: "8px 0 8px" });
  wrap.appendChild(el("div", { font: `700 12px/1.6 ${FONT}`, color: INK_3, paddingBottom: "10px" }, p.title));
  const row = el("div", { display: "grid", gridTemplateColumns: `repeat(${p.stations.length}, 1fr)`, maxWidth: "620px" });
  const reached = (i: number) => p.stations.slice(0, i + 1).every(s => s.state === "done" || s.state === "next");
  p.stations.forEach((s, i) => {
    const cell = el("div", { position: "relative", textAlign: "center", padding: "0 4px" });
    if (i < p.stations.length - 1) {
      cell.appendChild(el("div", {
        position: "absolute", top: "12px", height: "3px", width: "100%", insetInlineStart: "50%",
        background: reached(i + 1) ? CHART_FILL : CHART_TRACK,
      }));
    }
    const dot = el("div", {
      position: "relative", width: "26px", height: "26px", borderRadius: "50%", margin: "0 auto",
      boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center",
      font: `800 13px/1 ${FONT}`,
      ...(s.state === "done" ? { background: CHART_FILL, color: "#FFFFFF" }
        : s.state === "missing" ? { background: "#FFFFFF", border: `2px solid ${URGENT_RING}`, color: URGENT_FG }
          : s.state === "next" ? { background: URGENT_RING, border: "4px solid #FDF6E3" }
            : { background: "#FFFFFF", border: "2px solid #C2DFDE" }),
    }, s.state === "done" ? "✓" : s.state === "missing" ? "!" : "");
    cell.appendChild(dot);
    cell.appendChild(el("div", { font: `700 12px/1.4 ${FONT}`, color: s.state === "ahead" ? INK_3 : INK, paddingTop: "6px" }, s.label));
    cell.appendChild(el("div", {
      font: `${s.state === "ahead" ? 500 : 700} 11px/1.4 ${FONT}`,
      color: s.state === "done" ? ACCENT : s.state === "ahead" ? INK_3 : URGENT_FG,
    }, s.state === "next" ? `השלב הבא · ${s.sub}` : s.sub));
    row.appendChild(cell);
  });
  wrap.appendChild(row);
  wrap.appendChild(el("div", { font: `500 11px/1.6 ${FONT}`, color: INK_3, paddingTop: "9px" }, PATH_NOTE));
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
    // The official pages the card links to on screen. Clickable in the file
    // (renderPdf lays a link over each), and the site's name beside each, for
    // whoever reads it on paper.
    if (t.officialLinks.length) {
      out.push({ node: subHeading("קישורים רשמיים"), keepWithNext: true });
      t.officialLinks.forEach(l => out.push({ node: linkRow(l.label, l.href) }));
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

function anchor(text: string, href: string, style: Style): HTMLElement {
  const a = el("a", { color: ACCENT, textDecoration: "underline", ...style }, text) as HTMLAnchorElement;
  a.href = href;
  return a;
}

function linkRow(label: string, href: string): HTMLElement {
  const row = el("div", { display: "flex", gap: "8px", paddingBottom: "5px", alignItems: "baseline" });
  row.appendChild(el("span", { font: `700 12px/1.75 ${FONT}`, color: ACCENT, flex: "0 0 auto", minWidth: "14px" }, "•"));
  const text = el("div", { font: `500 13px/1.75 ${FONT}`, color: INK_2, flex: "1 1 auto" });
  text.appendChild(anchor(label, href, { font: `600 13px/1.75 ${FONT}` }));
  let host = "";
  try { host = new URL(href).hostname.replace(/^www\./, ""); } catch { /* a malformed link keeps its label */ }
  if (host) text.appendChild(el("span", { font: `500 11px/1.75 ${FONT}`, color: INK_3, unicodeBidi: "isolate" }, ` · ${host}`));
  row.appendChild(text);
  return row;
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
  const brand = el("span", {});
  brand.appendChild(anchor("טיפול חכם", "https://www.mentalytics.co.il", { color: INK_3, textDecoration: "none" }));
  brand.appendChild(document.createTextNode(` · ${todayLabel}`));
  foot.appendChild(brand);
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
  /** The counsellor's charts (report-charts.ts). Each is null when it has nothing worth drawing. */
  charts?: { profile?: ProfileChart | null; tried?: TriedChart | null; path?: PathChart | null };
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
      const cs = getComputedStyle(b.node);
      heights.push(outerHeight(b.node.getBoundingClientRect().height, cs.marginTop, cs.marginBottom));
      measurer.removeChild(b.node);
    }
    stage.removeChild(measurer);

    // Pass 2 - place them (report-pdf-layout.ts holds the rules).
    const placed = paginate(
      blocks.map((b, i) => ({ height: heights[i], keepWithNext: b.keepWithNext, breakBefore: b.breakBefore })),
      CONTENT_H,
    );
    const pages: HTMLElement[] = [];
    let body: HTMLElement | null = null;
    const open = () => {
      const page = newPage(logoSrc, input.disclaimer);
      pages.push(page);
      stage.appendChild(page);
      body = page.querySelector<HTMLElement>("[data-body]");
    };

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const p = placed[i];
      while (pages.length <= p.page) open();

      // A graph taller than a whole page is scaled, never sliced.
      if (heights[i] > CONTENT_H) {
        const k = p.height / heights[i];
        b.node.style.transform = `scale(${k})`;
        b.node.style.transformOrigin = "top right";
        const shell = el("div", { height: `${p.height}px`, overflow: "hidden" });
        shell.appendChild(b.node);
        b.node = shell;
      }
      if (p.gap) b.node.style.paddingTop = `${p.gap}px`;

      body!.appendChild(b.node);
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
  const mm = 210 / PAGE_W;
  for (let i = 0; i < pages.length; i++) {
    // The page is a picture, so a link in it is drawn but not live: each one
    // is found here, while the page is still laid out, and an invisible link
    // area of the same size is put over it in the PDF. getClientRects gives
    // one box per line, so a label that wraps stays clickable on both lines.
    const origin = pages[i].getBoundingClientRect();
    const links = Array.from(pages[i].querySelectorAll<HTMLAnchorElement>("a[href]"))
      .filter(a => /^https?:/.test(a.href))
      .flatMap(a => Array.from(a.getClientRects()).map(r => ({
        url: a.href, x: (r.left - origin.left) * mm, y: (r.top - origin.top) * mm, w: r.width * mm, h: r.height * mm,
      })));

    // scale 3 puts a 794px page at ~285dpi. It was JPEG, which spends its
    // budget on the edges of glyphs and left the letters soft when zoomed in;
    // PNG is lossless, so a letter has the edge html2canvas painted. "FAST":
    // without a compression mode jsPDF stores the pixels raw, 24MB a page.
    const canvas = await html2canvas(pages[i], { scale: 3, backgroundColor: PAPER, useCORS: true, logging: false });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
    for (const l of links) pdf.link(l.x, l.y, l.w, l.h, { url: l.url });
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
