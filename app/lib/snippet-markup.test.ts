import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { META_MAX, QUIZ_INVITE, placeDescription } from "./meta-description";
import { CITY_SEO_LIST } from "./regions";

// מה שגוגל מציג מתחת לקישור של עמוד נחיתה נקבע בשני מקומות, ושניהם נשברו בשקט
// בעבר: התיאור (meta description), והסימון data-nosnippet שמוציא מהציטוט כל
// קטע שאין בו הזמנה לשאלון. גוגל מכבד את הסימון רק על span, div ו-section;
// מ-22/8 עד 5/10/2026 הוא ישב על <Link> ועל <p>, לא עשה כלום, ואף בדיקה לא
// הראתה את זה - רק תוצאת חיפוש, שישה שבועות אחר כך.

const root = process.cwd();

function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxFiles(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });
}

describe("data-nosnippet sits only where Google honours it", () => {
  it("is never placed on anything but a span, a div or a section", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles("app")) {
      // בלי ההערות: רובן מסבירות את הסימון ומזכירות אותו בשמו.
      const code = readFileSync(path.join(root, file), "utf8").replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, "");
      for (const m of code.matchAll(/\bdata-nosnippet\b/g)) {
        const open = code.lastIndexOf("<", m.index);
        const tag = code.slice(open).match(/^<([A-Za-z][\w.]*)/)?.[1] ?? "?";
        if (!["span", "div", "section"].includes(tag)) offenders.push(`${file}: <${tag} data-nosnippet>`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("placeDescription", () => {
  const lead = (city: string, around = false) => `טיפול פסיכולוגי, נפשי ורגשי ב${city}${around ? " והסביבה" : ""}`;

  it("leads with the questionnaire, then offers direct contact", () => {
    const d = placeDescription(lead("חיפה"));
    expect(d.startsWith(`${lead("חיפה")}: ${QUIZ_INVITE}`)).toBe(true);
    expect(d).toContain("או פנו ישירות למטפלים שתעודותיהם אומתו");
  });

  it("fits the budget for every city page, with and without the surroundings, and ends on a full stop", () => {
    for (const city of CITY_SEO_LIST) {
      for (const around of [false, true]) {
        const d = placeDescription(lead(city, around));
        expect([...d].length, d).toBeLessThanOrEqual(META_MAX);
        expect(d.endsWith("."), d).toBe(true);
        expect(d, d).toContain(QUIZ_INVITE);
      }
    }
  });

  it("inflects for a women-only page", () => {
    const d = placeDescription("פסיכולוגית בחיפה", { fem: true });
    expect(d).toContain("למטפלות שתעודותיהן אומתו");
    expect(d).not.toContain("למטפלים");
  });
});
