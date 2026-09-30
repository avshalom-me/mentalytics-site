import { describe, it, expect } from "vitest";
import { articleTeaser, isHouseByline } from "./article-byline";

// Names below are invented; this repository is public.
describe("whose article it is", () => {
  it("an empty byline is the attributed therapist's own article", () => {
    expect(isHouseByline(null, "נועה לוי")).toBe(false);
    expect(isHouseByline("", "נועה לוי")).toBe(false);
    expect(isHouseByline("   ", "נועה לוי")).toBe(false);
  });

  // The case that hid 23 articles from their authors' profiles: the byline was
  // filled with the therapist's own name.
  it("a byline with the therapist's own name is still their article", () => {
    expect(isHouseByline("נועה לוי", "נועה לוי")).toBe(false);
    expect(isHouseByline("נועה לוי", "נועה לוי ")).toBe(false);
    expect(isHouseByline(" נועה  לוי", "נועה לוי")).toBe(false);
  });

  it("recognises the same person without the business description or the title", () => {
    expect(isHouseByline("נועה לוי", "נועה לוי- פסיכותרפיה בעמק")).toBe(false);
    expect(isHouseByline("נועה לוי", "נועה לוי - טיפול זוגי")).toBe(false);
    expect(isHouseByline('ד"ר נועה לוי', "נועה לוי")).toBe(false);
    expect(isHouseByline("נועה לוי", "ד״ר נועה לוי")).toBe(false);
    expect(isHouseByline("פרופ' נועה לוי", 'ד"ר נועה לוי')).toBe(false);
    // A byline that adds a description after the name.
    expect(isHouseByline("נועה לוי, פסיכולוגית קלינית", "נועה לוי")).toBe(false);
  });

  it("a byline naming someone else is a house piece", () => {
    expect(isHouseByline("צוות טיפול חכם", 'ד"ר דן כהן')).toBe(true);
    expect(isHouseByline("מערכת האתר", "נועה לוי")).toBe(true);
    // Another person, even one sharing a first name.
    expect(isHouseByline("נועה כהן", "נועה לוי")).toBe(true);
  });

  it("matches whole words, not fragments of a longer name", () => {
    expect(isHouseByline("לוי", "נועה לויאן")).toBe(true);
    expect(isHouseByline("רז", "רזיאל כהן")).toBe(true);
  });

  it("with no therapist name to compare, any byline is treated as house", () => {
    expect(isHouseByline("נועה לוי", null)).toBe(true);
    expect(isHouseByline("נועה לוי", "")).toBe(true);
  });
});

describe("the line under an article's title", () => {
  it("uses the summary when there is one", () => {
    expect(articleTeaser("תקציר קצר.", "גוף ארוך מאוד")).toBe("תקציר קצר.");
    expect(articleTeaser("  תקציר  ", null)).toBe("תקציר");
  });

  it("falls back to the opening of the article, without the formatting marks", () => {
    const body = [
      "## כותרת משנה",
      "",
      "פסקה עם **הדגשה** ו[קישור](/research/x) בתוכה.",
      "",
      "- פריט ראשון",
      "- פריט שני",
      "",
      "| א | ב |",
      "|---|---|",
      "| 1 | 2 |",
    ].join("\n");
    expect(articleTeaser("", body, 500)).toBe("כותרת משנה. פסקה עם הדגשה וקישור בתוכה. פריט ראשון פריט שני. א ב 1 2");
    expect(articleTeaser(null, "> ציטוט פותח\n\nוהמשך.")).toBe("ציטוט פותח. והמשך.");
  });

  // An article that opens with a subtitle line and no full stop read as one
  // run-on sentence with the paragraph after it.
  it("ends an opening line that has no full stop, so it does not run into the next paragraph", () => {
    expect(articleTeaser("", "כותרת בלי נקודה\n\nהפסקה הראשונה מתחילה כאן.")).toBe("כותרת בלי נקודה. הפסקה הראשונה מתחילה כאן.");
    // Punctuation that already ends the line is kept as is.
    expect(articleTeaser("", "למה זה קורה?\n\nכי ככה.")).toBe("למה זה קורה? כי ככה.");
    // Lines wrapped inside one paragraph are joined with a space, not a stop.
    expect(articleTeaser("", "משפט ארוך שנשבר\nבאמצע השורה.")).toBe("משפט ארוך שנשבר באמצע השורה.");
    expect(articleTeaser("", "שורה\r\n\r\nעם CRLF.")).toBe("שורה. עם CRLF.");
  });

  it("cuts a long text at a word boundary and marks the cut", () => {
    const body = "מילה ".repeat(100);
    const t = articleTeaser("", body, 50);
    expect(t.length).toBeLessThanOrEqual(50);
    expect(t.endsWith("…")).toBe(true);
    expect(t).not.toMatch(/\s…$/);
    expect(t.slice(0, -1).split(" ").every((w) => w === "מילה")).toBe(true);
  });

  it("is empty when there is nothing to show", () => {
    expect(articleTeaser(null, null)).toBe("");
    expect(articleTeaser("", "   ")).toBe("");
  });
});
