import { describe, it, expect } from "vitest";
import { profileMetaDescription } from "./profile-meta";
import { META_MAX } from "./meta-description";

// Invented therapists; no real name or bio.
const base = {
  name: "פלונית אלמונית",
  title: "פסיכולוגית קלינית",
  regions: ["תל אביב", "רמת גן"],
  online: true,
  trainingAreas: ["חרדה", "דיכאון", "טראומה", "הפרעות אכילה"],
};

describe("profileMetaDescription", () => {
  it("opens with who and where, then the areas, then whole sentences of the bio", () => {
    const d = profileMetaDescription({
      ...base,
      bio: "אני מטפלת בגישה דינמית. בקליניקה שלי יש מקום לכל רגש. המשפט הזה כבר לא ייכנס כי הוא ארוך מדי בשביל המקום שנשאר בתיאור של העמוד הזה, ולכן ייעצר לפני.",
    });
    expect(d).toBe(
      "פלונית אלמונית, פסיכולוגית קלינית בתל אביב וברמת גן וגם אונליין. תחומי טיפול: חרדה, דיכאון, טראומה. אני מטפלת בגישה דינמית. בקליניקה שלי יש מקום לכל רגש.",
    );
    expect([...d].length).toBeLessThanOrEqual(META_MAX);
  });

  it("never cuts a word in half when the bio's first sentence is longer than the room", () => {
    const oneLongSentence = "אני ".repeat(10) + "מילה-ארוכה-במיוחד ".repeat(20);
    const d = profileMetaDescription({ ...base, bio: oneLongSentence });
    expect([...d].length).toBeLessThanOrEqual(META_MAX);
    expect(d.endsWith("...")).toBe(true);
    // Every token of the bio part is a whole token of the source.
    const bioPart = d.slice(d.indexOf("טראומה.") + "טראומה.".length).replace(/\.\.\.$/, "").trim();
    for (const word of bioPart.split(" ")) expect(["אני", "מילה-ארוכה-במיוחד"]).toContain(word);
  });

  it("reads correctly with only a city, only online, or no place at all", () => {
    expect(profileMetaDescription({ name: "פלוני", title: "פסיכולוג", regions: ["חיפה"], online: false })).toBe("פלוני, פסיכולוג בחיפה.");
    expect(profileMetaDescription({ name: "פלוני", title: "פסיכולוג", regions: [], online: true })).toBe("פלוני, פסיכולוג אונליין.");
    expect(profileMetaDescription({ name: "פלוני", title: "פסיכולוג" })).toBe("פלוני, פסיכולוג.");
  });

  it("collapses the line breaks therapists paste into the bio", () => {
    const d = profileMetaDescription({ name: "פלוני", title: "פסיכולוג", bio: "שורה ראשונה.\r\n\r\nשורה   שנייה." });
    expect(d).toBe("פלוני, פסיכולוג. שורה ראשונה. שורה שנייה.");
  });

  it("drops the bio rather than adding three words and an ellipsis", () => {
    const d = profileMetaDescription({
      ...base,
      name: "שם ארוך מאוד של מטפלת עם תואר כפול",
      trainingAreas: ["תחום ראשון ארוך במיוחד", "תחום שני ארוך במיוחד", "תחום שלישי ארוך במיוחד מאוד"],
      bio: "ביו שלא ייכנס.",
    });
    expect(d).not.toContain("ביו");
    expect([...d].length).toBeLessThanOrEqual(META_MAX);
  });

  it("stays inside the budget even when the name and areas alone overflow it", () => {
    const d = profileMetaDescription({
      name: "שם ".repeat(30),
      title: "פסיכולוגית",
      trainingAreas: ["תחום ארוך מאוד מאוד", "עוד תחום ארוך מאוד", "ותחום שלישי ארוך"],
    });
    expect([...d].length).toBeLessThanOrEqual(META_MAX);
    expect(d.endsWith("...")).toBe(true);
  });
});
