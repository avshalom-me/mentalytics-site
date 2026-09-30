// Minimal .xlsx writer for admin exports: one sheet, a colored header row,
// typed cells (text, numbers, dates), a right-to-left view, a frozen header and
// an autofilter. That is everything an export like this needs, so there is no
// spreadsheet library in the bundle: an .xlsx is a zip of XML parts, and fflate
// (already shipped with jspdf) does the zip.
//
// Excel is strict about this format. The order of elements inside each part
// matters, and a mistake does not throw here - it shows up as a "repair this
// file" prompt on the admin's machine. Keep the order below, and run
// xlsx-writer.test.ts (it checks every part is well-formed) after any change.

import { strToU8, zipSync } from "fflate";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// How a column's numbers are shown. Dates are Excel serial numbers (toExcelSerial).
//   int      0            counts, years, percentages
//   count    #,##0        engagement totals
//   money    #,##0.00     shekel amounts
//   date     dd/mm/yyyy
//   datetime dd/mm/yyyy hh:mm
export type XlsxKind = "text" | "int" | "count" | "money" | "date" | "datetime";

export type XlsxColumn = {
  header: string;
  /** Width in characters. */
  width: number;
  kind?: XlsxKind;
  /** Wrap long text inside the cell. The row grows to fit, up to MAX_WRAPPED_LINES. */
  wrap?: boolean;
  /** Which of the two header shades to use, so a change of section shows. */
  band?: 0 | 1;
};

export type XlsxValue = string | number | null | undefined;

export type XlsxSheet = {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxValue[][];
  rtl?: boolean;
  /** The header row is always frozen; this keeps the first column in view too. */
  freezeFirstColumn?: boolean;
};

// Past this many lines a wrapped cell shows its first lines and the rest is in
// the formula bar. Without a cap one long description makes a row a screen tall.
const MAX_WRAPPED_LINES = 6;
const LINE_PT = 15; // Calibri 11, Excel's default row height

// Indexes into cellXfs (CELL_XFS below, same order).
const STYLE = { headerA: 1, headerB: 2, text: 3, wrap: 4, int: 5, count: 6, money: 7, date: 8, datetime: 9 } as const;

const STYLE_BY_KIND: Record<Exclude<XlsxKind, "text">, number> = {
  int: STYLE.int,
  count: STYLE.count,
  money: STYLE.money,
  date: STYLE.date,
  datetime: STYLE.datetime,
};

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";

// Excel's day 0 is 1899-12-30; this is the distance from there to the Unix epoch.
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const DAY_MS = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();
function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/**
 * Excel serial number for a date-only string ("2026-09-30") or a timestamp.
 * A timestamp is read as wall-clock time in `timeZone`, because a spreadsheet
 * cell has no zone: 21:30Z is 00:30 the next day in Jerusalem, and that is
 * what the admin should see.
 */
export function toExcelSerial(value: string | null | undefined, timeZone = "UTC"): number | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) / DAY_MS + EXCEL_EPOCH_OFFSET_DAYS;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = wallClockFormatter(timeZone).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  // Whole days plus a whole number of seconds over 86,400: the double nearest to
  // the time, as other libraries write it. Rounding the sum to a few decimals
  // instead leaves 11:00 a fraction of a millisecond short, and a reader that
  // truncates shows it as 10:59.
  const days = Math.floor(wallMs / DAY_MS);
  return days + EXCEL_EPOCH_OFFSET_DAYS + Math.round((wallMs - days * DAY_MS) / 1000) / 86_400;
}

// "A", "B", ... "Z", "AA", ...
function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// XML 1.0 has no room for most control characters, and Excel caps a cell at
// 32,767 characters. Line breaks are normalised to \n, which is what Excel writes.
function cleanText(s: string): string {
  const t = s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "");
  return t.length > 32767 ? t.slice(0, 32767) : t;
}

// Excel reads _xHHHH_ in a string as an escaped character, so a literal one
// (rare, but it is user text) has its underscore escaped.
function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/_x([0-9A-Fa-f]{4})_/g, "_x005F_x$1_");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

function cleanSheetName(name: string): string {
  const n = name.replace(/[[\]:*?/\\]/g, " ").trim().replace(/^'+|'+$/g, "").slice(0, 31).trim();
  return n || "Sheet1";
}

function stringCell(ref: string, style: number, raw: string): string {
  const t = cleanText(raw);
  const preserve = /^\s|\s$|\n/.test(t) ? ' xml:space="preserve"' : "";
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t${preserve}>${escapeText(t)}</t></is></c>`;
}

// Lines a text takes in a column `width` characters wide. A rough count is
// enough: it only sets the row height.
function linesIn(text: string, width: number): number {
  let n = 0;
  for (const part of text.split("\n")) n += Math.max(1, Math.ceil(part.length / Math.max(1, width)));
  return n;
}

const CELL_XFS = [
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
  '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
  '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
  '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>',
];

// Brand teal for the two header shades (--teal, --teal-dark); white text on both.
const STYLES_XML =
  XML_DECL +
  `<styleSheet xmlns="${NS_MAIN}">` +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/></numFmts>' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>' +
  "</fonts>" +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF3D8C8A"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF2A6462"/><bgColor indexed="64"/></patternFill></fill>' +
  "</fills>" +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  `<cellXfs count="${CELL_XFS.length}">${CELL_XFS.join("")}</cellXfs>` +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '<dxfs count="0"/>' +
  '<tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/>' +
  "</styleSheet>";

const CONTENT_TYPES_XML =
  XML_DECL +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS_XML =
  XML_DECL +
  `<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
  "</Relationships>";

const WORKBOOK_RELS_XML =
  XML_DECL +
  `<Relationships xmlns="${NS_PKG_REL}">` +
  `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
  "</Relationships>";

function workbookXml(sheetName: string, filterRange: string): string {
  const quoted = `'${sheetName.replace(/'/g, "''")}'`;
  return (
    XML_DECL +
    `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>' +
    `<sheets><sheet name="${escapeAttr(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${escapeText(quoted)}!${filterRange}</definedName></definedNames>` +
    '<calcPr calcId="191029"/>' +
    "</workbook>"
  );
}

function sheetViewsXml(rtl: boolean, freezeFirstColumn: boolean): string {
  const attrs = `${rtl ? ' rightToLeft="1"' : ""} tabSelected="1" workbookViewId="0"`;
  const panes = freezeFirstColumn
    ? '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>' +
      '<selection pane="topRight" activeCell="B1" sqref="B1"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
      '<selection pane="bottomRight" activeCell="B2" sqref="B2"/>'
    : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
  return `<sheetViews><sheetView${attrs}>${panes}</sheetView></sheetViews>`;
}

function worksheetXml(sheet: XlsxSheet): string {
  const { columns, rows } = sheet;
  const lastCol = colLetter(columns.length - 1);
  const lastRow = rows.length + 1;

  const colsXml = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${(c.width + 0.71).toFixed(2)}" customWidth="1"/>`)
    .join("");

  // Header row: wrapped, so its height follows the longest title (a bold title
  // is a little wider than body text, hence the factor).
  const headerLines = Math.min(
    3,
    columns.reduce((m, c) => Math.max(m, Math.ceil((c.header.length * 1.15) / Math.max(1, c.width))), 1),
  );
  const headerCells = columns
    .map((c, i) => stringCell(`${colLetter(i)}1`, c.band === 1 ? STYLE.headerB : STYLE.headerA, c.header))
    .join("");
  let sheetData = `<row r="1" ht="${Math.max(24, headerLines * LINE_PT + 6)}" customHeight="1">${headerCells}</row>`;

  rows.forEach((row, r) => {
    const rowNo = r + 2;
    let cells = "";
    let lines = 1;
    columns.forEach((col, c) => {
      const v = row[c];
      if (v === null || v === undefined || v === "") return;
      const kind = col.kind ?? "text";
      const ref = `${colLetter(c)}${rowNo}`;
      if (typeof v === "number" && kind !== "text") {
        if (Number.isFinite(v)) cells += `<c r="${ref}" s="${STYLE_BY_KIND[kind]}"><v>${v}</v></c>`;
        return;
      }
      // Text, or something that does not fit its column's kind (a number in a
      // text column, text in a number column): written as text, never dropped.
      const text = typeof v === "number" ? String(v) : v;
      if (col.wrap) lines = Math.max(lines, linesIn(text, col.width));
      cells += stringCell(ref, col.wrap ? STYLE.wrap : STYLE.text, text);
    });
    const height = lines > 1 ? ` ht="${Math.min(lines, MAX_WRAPPED_LINES) * LINE_PT}" customHeight="1"` : "";
    sheetData += `<row r="${rowNo}"${height}>${cells}</row>`;
  });

  return (
    XML_DECL +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    sheetViewsXml(sheet.rtl ?? false, sheet.freezeFirstColumn ?? false) +
    `<sheetFormatPr defaultRowHeight="${LINE_PT}"/>` +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${sheetData}</sheetData>` +
    `<autoFilter ref="A1:${lastCol}${lastRow}"/>` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    "</worksheet>"
  );
}

/**
 * The workbook as bytes, ready to save as .xlsx. Copied into a plain
 * ArrayBuffer (fflate's own type may be a SharedArrayBuffer view) so it goes
 * straight into a Blob.
 */
export function buildXlsx(sheet: XlsxSheet): Uint8Array<ArrayBuffer> {
  if (sheet.columns.length === 0) throw new Error("xlsx: a sheet needs at least one column");
  const name = cleanSheetName(sheet.name);
  const lastCol = colLetter(sheet.columns.length - 1);
  const filterRange = `$A$1:$${lastCol}$${sheet.rows.length + 1}`;
  // [Content_Types].xml goes first: some readers look for it at the start of the zip.
  const zipped = zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES_XML),
      "_rels/.rels": strToU8(ROOT_RELS_XML),
      "xl/workbook.xml": strToU8(workbookXml(name, filterRange)),
      "xl/_rels/workbook.xml.rels": strToU8(WORKBOOK_RELS_XML),
      "xl/styles.xml": strToU8(STYLES_XML),
      "xl/worksheets/sheet1.xml": strToU8(worksheetXml(sheet)),
    },
    { level: 6 },
  );
  return new Uint8Array(zipped);
}
