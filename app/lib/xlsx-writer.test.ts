import { describe, it, expect } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { buildXlsx, toExcelSerial, type XlsxSheet } from "./xlsx-writer";

function parts(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]));
}

// Excel rejects a part with a stray "&" or "<" in text, an unclosed tag or a
// control character - and reports it as "we found a problem with some content",
// not as an error. There is no XML parser in the node test environment, so this
// checks the things that go wrong when text is spliced into markup.
function expectWellFormed(name: string, xml: string) {
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'), `${name}: declaration`).toBe(true);
  expect(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml), `${name}: control character`).toBe(false);
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, "");
  const badEntity = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/;
  const tag = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/g;
  const stack: string[] = [];
  let roots = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(body))) {
    const gap = body.slice(last, m.index);
    expect(gap.includes("<"), `${name}: "<" in text near ${JSON.stringify(gap.slice(0, 40))}`).toBe(false);
    expect(badEntity.test(gap), `${name}: bare "&" in text`).toBe(false);
    expect(badEntity.test(m[3]), `${name}: bare "&" in attribute`).toBe(false);
    last = m.index + m[0].length;
    const [, closing, tagName, , selfClosing] = m;
    if (closing) {
      expect(stack.pop(), `${name}: </${tagName}> closes the wrong tag`).toBe(tagName);
    } else if (!selfClosing) {
      if (stack.length === 0) roots++;
      stack.push(tagName);
    } else if (stack.length === 0) {
      roots++;
    }
  }
  expect(body.slice(last).trim(), `${name}: trailing content`).toBe("");
  expect(stack, `${name}: unclosed tags`).toEqual([]);
  expect(roots, `${name}: one root element`).toBe(1);
}

describe("the well-formedness check used below", () => {
  const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  it("accepts good markup and catches the mistakes it exists for", () => {
    expect(() => expectWellFormed("ok", `${decl}<a x="1"><b>t &amp; u</b><c/></a>`)).not.toThrow();
    expect(() => expectWellFormed("bare &", `${decl}<a><b>t & u</b></a>`)).toThrow();
    expect(() => expectWellFormed("bare <", `${decl}<a><b>t < u</b></a>`)).toThrow();
    expect(() => expectWellFormed("unclosed", `${decl}<a><b>t</a>`)).toThrow();
    expect(() => expectWellFormed("crossed", `${decl}<a><b>t</a></b>`)).toThrow();
    expect(() => expectWellFormed("two roots", `${decl}<a/><b/>`)).toThrow();
    expect(() => expectWellFormed("control", `${decl}<a>\u0001</a>`)).toThrow();
    expect(() => expectWellFormed("bare & in attribute", `${decl}<a x="1 & 2"/>`)).toThrow();
    expect(() => expectWellFormed("no declaration", "<a/>")).toThrow();
  });
});

const sheet = (over: Partial<XlsxSheet> = {}): XlsxSheet => ({
  name: "מרכזים",
  columns: [
    { header: "שם", width: 20 },
    { header: "מחיר", width: 12, kind: "money" },
    { header: "תאריך", width: 12, kind: "date" },
  ],
  rows: [
    ["מרכז א", 1200.5, 46295],
    ["מרכז ב", null, null],
  ],
  ...over,
});

const sheetXml = (s: XlsxSheet) => parts(buildXlsx(s))["xl/worksheets/sheet1.xml"];

describe("the package", () => {
  it("has the parts Excel needs, content types first, and every part is well-formed", () => {
    const p = parts(buildXlsx(sheet()));
    expect(Object.keys(p)).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    for (const [name, xml] of Object.entries(p)) expectWellFormed(name, xml);
  });

  it("refuses a sheet with no columns", () => {
    expect(() => buildXlsx(sheet({ columns: [], rows: [] }))).toThrow(/at least one column/);
  });
});

describe("cells", () => {
  it("writes text as inline strings, numbers by kind, and skips blanks", () => {
    const xml = sheetXml(sheet());
    expect(xml).toContain('<c r="A2" s="3" t="inlineStr"><is><t>מרכז א</t></is></c>');
    expect(xml).toContain('<c r="B2" s="7"><v>1200.5</v></c>');
    expect(xml).toContain('<c r="C2" s="8"><v>46295</v></c>');
    expect(xml).toContain('<c r="A3" s="3" t="inlineStr">');
    expect(xml).not.toContain('r="B3"');
    expect(xml).not.toContain('r="C3"');
  });

  it("never drops data that does not fit its column: it is written as text", () => {
    const xml = sheetXml(
      sheet({
        rows: [
          [12, "יש לבדוק", "2026-09-30"], // a number in a text column, text in number and date columns
          ["x", Number.NaN, Number.POSITIVE_INFINITY], // non-finite numbers are blank, not "NaN"
        ],
      }),
    );
    expect(xml).toContain('<c r="A2" s="3" t="inlineStr"><is><t>12</t></is></c>');
    expect(xml).toContain('<c r="B2" s="3" t="inlineStr"><is><t>יש לבדוק</t></is></c>');
    expect(xml).toContain('<c r="C2" s="3" t="inlineStr"><is><t>2026-09-30</t></is></c>');
    expect(xml).not.toContain('r="B3"');
    expect(xml).not.toContain("NaN");
    expect(xml).not.toContain("Infinity");
  });

  it("escapes markup, drops control characters and protects literal _x0041_ sequences", () => {
    const s = sheet({
      columns: [{ header: 'A & B <"h">', width: 30 }],
      rows: [["a & b <c> \"q\" \u0001\u0008 _x0041_ end"]],
    });
    const p = parts(buildXlsx(s));
    const xml = p["xl/worksheets/sheet1.xml"];
    expect(xml).toContain("a &amp; b &lt;c&gt; \"q\"  _x005F_x0041_ end");
    expect(xml).toContain("A &amp; B &lt;\"h\"&gt;");
    for (const [name, part] of Object.entries(p)) expectWellFormed(name, part);
  });

  it("keeps line breaks (\\r\\n becomes \\n) and the edges of padded text", () => {
    const xml = sheetXml(sheet({ rows: [["one\r\ntwo", "  padded  ", "plain"]] }));
    expect(xml).toContain('<t xml:space="preserve">one\ntwo</t>');
    expect(xml).toContain('<t xml:space="preserve">  padded  </t>');
    expect(xml).toContain("<t>plain</t>");
  });

  it("cuts a cell at Excel's 32,767 character limit", () => {
    const xml = sheetXml(sheet({ rows: [["א".repeat(40_000)]] }));
    const text = /<t>(א+)<\/t>/.exec(xml)?.[1] ?? "";
    expect(text.length).toBe(32_767);
  });
});

describe("the sheet view", () => {
  it("is right-to-left, with the header row and first column frozen and a filter over the data", () => {
    const p = parts(buildXlsx(sheet({ rtl: true, freezeFirstColumn: true })));
    const xml = p["xl/worksheets/sheet1.xml"];
    expect(xml).toContain('rightToLeft="1"');
    expect(xml).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>');
    expect(xml).toContain('<dimension ref="A1:C3"/>');
    expect(xml).toContain('<autoFilter ref="A1:C3"/>');
    expect(p["xl/workbook.xml"]).toContain("<definedName name=\"_xlnm._FilterDatabase\" localSheetId=\"0\" hidden=\"1\">'מרכזים'!$A$1:$C$3</definedName>");
  });

  it("freezes only the header row when asked, and is left-to-right by default", () => {
    const xml = sheetXml(sheet());
    expect(xml).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(xml).not.toContain("rightToLeft");
    expect(xml).not.toContain("xSplit");
  });

  it("keeps the header and filter when there are no rows", () => {
    const p = parts(buildXlsx(sheet({ rows: [] })));
    expect(p["xl/worksheets/sheet1.xml"]).toContain('<autoFilter ref="A1:C1"/>');
    expect(p["xl/workbook.xml"]).toContain("$A$1:$C$1");
  });

  it("names the columns' letters past Z", () => {
    const columns = Array.from({ length: 28 }, (_, i) => ({ header: `h${i}`, width: 8 }));
    const xml = sheetXml({ name: "x", columns, rows: [[]] });
    expect(xml).toContain('<c r="Z1"');
    expect(xml).toContain('<c r="AA1"');
    expect(xml).toContain('<c r="AB1"');
    expect(xml).toContain('<autoFilter ref="A1:AB2"/>');
  });

  it("colors the header by section band", () => {
    const xml = sheetXml(
      sheet({
        columns: [
          { header: "a", width: 10, band: 0 },
          { header: "b", width: 10, band: 1 },
          { header: "c", width: 10 },
        ],
        rows: [],
      }),
    );
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(xml).toContain('<c r="B1" s="2" t="inlineStr">');
    expect(xml).toContain('<c r="C1" s="1" t="inlineStr">');
  });
});

describe("row heights", () => {
  const wrapSheet = (text: string) =>
    sheet({
      columns: [
        { header: "קצר", width: 20 },
        { header: "ארוך", width: 10, wrap: true },
      ],
      rows: [["x", text]],
    });

  it("grows a row with wrapped text to fit its lines", () => {
    // 25 characters in a 10-wide column: three lines.
    expect(sheetXml(wrapSheet("א".repeat(25)))).toContain('<row r="2" ht="45" customHeight="1">');
    // Explicit line breaks count too.
    expect(sheetXml(wrapSheet("a\nb"))).toContain('<row r="2" ht="30" customHeight="1">');
  });

  it("caps a very long text at six lines so one row cannot fill the screen", () => {
    expect(sheetXml(wrapSheet("א".repeat(5000)))).toContain('<row r="2" ht="90" customHeight="1">');
  });

  it("leaves a row alone when nothing in it needs more than one line", () => {
    expect(sheetXml(wrapSheet("קצר"))).toContain('<row r="2">');
    expect(sheetXml(sheet())).toContain('<row r="2">');
  });

  it("gives the header row room for a title that wraps, up to three lines", () => {
    const xml = sheetXml(sheet({ columns: [{ header: "כותרת ארוכה מאוד לעמודה צרה", width: 10 }], rows: [] }));
    expect(xml).toMatch(/<row r="1" ht="(\d+)" customHeight="1">/);
    const ht = Number(/<row r="1" ht="(\d+)"/.exec(xml)?.[1]);
    expect(ht).toBeGreaterThan(24);
  });
});

describe("sheet name", () => {
  it("drops characters Excel forbids, caps the length and quotes an apostrophe in the filter range", () => {
    const p = parts(buildXlsx(sheet({ name: "[a]:b*c?d/e\\f 'quote' and a very long tail that goes on" })));
    const name = /<sheet name="([^"]*)"/.exec(p["xl/workbook.xml"])?.[1] ?? "";
    expect(name.length).toBeLessThanOrEqual(31);
    expect(/[[\]:*?/\\]/.test(name)).toBe(false);
    expect(name.startsWith("'")).toBe(false);
    expectWellFormed("workbook", p["xl/workbook.xml"]);

    const q = parts(buildXlsx(sheet({ name: "It's & co" })));
    expect(q["xl/workbook.xml"]).toContain("'It''s &amp; co'!$A$1:$C$3");
    expectWellFormed("workbook", q["xl/workbook.xml"]);
  });

  it("falls back to a default when nothing usable is left", () => {
    const p = parts(buildXlsx(sheet({ name: "  []  " })));
    expect(p["xl/workbook.xml"]).toContain('<sheet name="Sheet1"');
  });
});

describe("toExcelSerial", () => {
  it("counts days from Excel's day 0 for a plain date", () => {
    expect(toExcelSerial("2026-09-30")).toBe(46295);
    expect(toExcelSerial("2026-01-15")).toBe(46037);
    expect(toExcelSerial("1900-03-01")).toBe(61); // Excel's leap-year bug is behind us from here on
  });

  it("reads a timestamp as wall-clock time in the given zone, across midnight and across DST", () => {
    // Israel is UTC+3 in September: 21:30Z is 00:30 the next day.
    expect(toExcelSerial("2026-09-30T21:30:00Z", "Asia/Jerusalem")).toBeCloseTo(46296 + 30 / 1440, 7);
    // UTC+2 in January.
    expect(toExcelSerial("2026-01-15T12:00:00Z", "Asia/Jerusalem")).toBeCloseTo(46037 + 14 / 24, 7);
    // Exactly local midnight is hour 00, not 24 (some engines format it as 24:00).
    expect(toExcelSerial("2026-09-29T21:00:00Z", "Asia/Jerusalem")).toBe(46295);
    // No zone given: UTC.
    expect(toExcelSerial("2026-09-30T12:00:00Z")).toBeCloseTo(46295.5, 7);
  });

  it("writes a whole-second time as the exact fraction of a day, so a round hour stays a round hour", () => {
    // 08:00Z is 11:00 in Israel in September: 39,600 of the day's 86,400 seconds.
    expect(toExcelSerial("2026-09-01T08:00:00Z", "Asia/Jerusalem")).toBe(46266 + 39600 / 86400);
    expect(toExcelSerial("2026-09-29T21:30:00Z", "Asia/Jerusalem")).toBe(46295 + 1800 / 86400);
  });

  it("accepts the timestamp shapes Postgres returns", () => {
    const iso = toExcelSerial("2026-09-30T10:15:07.123456+00:00", "UTC");
    expect(iso).toBeCloseTo(46295 + (10 * 3600 + 15 * 60 + 7) / 86400, 6);
  });

  it("returns null for nothing or nonsense", () => {
    expect(toExcelSerial(null)).toBeNull();
    expect(toExcelSerial(undefined)).toBeNull();
    expect(toExcelSerial("")).toBeNull();
    expect(toExcelSerial("not a date")).toBeNull();
  });
});
