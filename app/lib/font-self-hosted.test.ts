import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Heebo מתארח אצלנו מ-12/10/2026, אחרי שלוש פריסות שנכשלו כי ה-build משך את
// הגופן מגוגל (ההסבר ב-app/fonts/heebo.css). הבדיקות האלה שומרות שלא נחזור
// לתלות הזאת בטעות, ושהקבצים שה-CSS וה-layout מפנים אליהם באמת קיימים: קובץ
// גופן חסר לא מפיל build, הוא רק מציג את האתר בגופן החלופי.

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(tsx?|css)$/.test(e.name) && !e.name.endsWith(".test.ts") ? [p] : [];
  });
}

describe("Heebo is self-hosted", () => {
  // בלי ההערות: ההערה שבראש הקובץ מזכירה בעצמה את "font-weight: 300 900".
  const css = read("app/fonts/heebo.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const fontUrls = [...new Set([...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]))];

  it("no source file pulls a font from Google at build or at run time", () => {
    const offenders = sourceFiles("app").filter((f) => {
      const code = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      return /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(code);
    });
    expect(offenders).toEqual([]);
  });

  it("every font file the CSS points at exists under /public", () => {
    expect(fontUrls).toHaveLength(5);
    for (const url of fontUrls) expect(existsSync(path.join(root, "public", url)), url).toBe(true);
  });

  it("the layout preloads a file the CSS actually uses", () => {
    const preloaded = read("app/layout.tsx").match(/HEEBO_HEBREW_FONT = "([^"]+)"/)?.[1];
    expect(preloaded).toBeDefined();
    expect(fontUrls).toContain(preloaded);
  });

  it("keeps the six separate weights, so a weight that is not declared still looks as it did", () => {
    // font-weight: 600 מוצג כ-700 כי 600 אינו ברשימה. טווח רציף (300 900) היה
    // מציג 600 אמיתי ומשנה את המראה של כל האתר.
    const weights = [...css.matchAll(/font-weight:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(new Set(weights)).toEqual(new Set(["300", "400", "500", "700", "800", "900"]));
    expect(weights).toHaveLength(30);
  });

  it("the body falls back to the metric-matched Arial before any other font", () => {
    expect(read("app/globals.css")).toMatch(/font-family:\s*'Heebo',\s*'Heebo Fallback',\s*sans-serif/);
    expect(css).toMatch(/font-family:\s*"Heebo Fallback";[\s\S]*size-adjust:\s*99\.89%/);
  });
});
