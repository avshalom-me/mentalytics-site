import { describe, expect, it } from "vitest";
import { splitSeriesLinks } from "./learning-series-links";
import { LEARNING_ARTICLES, articleByN } from "@/app/learning/articles/content";

const all = () => true;
const rendered = (text: string) =>
  splitSeriesLinks(text, all)
    .map((p) => (p.kind === "text" ? p.text : p.label ?? "למדריך"))
    .join("");

describe("קישורי הסדרה במדריכים", () => {
  it("כשנקודתיים פותחות את שם הנושא, הביטוי עצמו הוא הקישור, בלי כפילות", () => {
    expect(splitSeriesLinks("פירוט: כמה עולה הוראה מתקנת (מאמר 4 בסדרה).", all)).toEqual([
      { kind: "text", text: "פירוט: " },
      { kind: "link", n: 4, label: "כמה עולה הוראה מתקנת" },
      { kind: "text", text: "." },
    ]);
  });
  it("בלי נקודתיים: '(למדריך)' במקום הסמן, והמשפט נשאר שלם", () => {
    expect(rendered("כדאי לברר את הקריאה (מאמר 3 בסדרה). אחר כך עוד.")).toBe("כדאי לברר את הקריאה (למדריך). אחר כך עוד.");
  });
  it("נקודתיים במשפט קודם לא נחשבות", () => {
    expect(splitSeriesLinks("רשימה: א, ב. כדאי לברר את הקריאה (מאמר 3 בסדרה).", all)[1]).toEqual({ kind: "link", n: 3, label: null });
  });
  it("מספר בן שתי ספרות; מספר בלי מדריך נשאר טקסט", () => {
    expect(splitSeriesLinks("להרחבה: אונליין (מאמר 10 בסדרה)", all)[1]).toEqual({ kind: "link", n: 10, label: "אונליין" });
    expect(rendered("ראו (מאמר 99 בסדרה)")).toBe("ראו (למדריך)");
    expect(splitSeriesLinks("ראו (מאמר 99 בסדרה)", (n) => n < 50)).toEqual([{ kind: "text", text: "ראו (מאמר 99 בסדרה)" }]);
  });
  it("בשום מדריך באתר שם הנושא לא מופיע פעמיים ברצף, וכל סמן מצביע על מדריך קיים", () => {
    const texts = LEARNING_ARTICLES.flatMap((a) => [
      ...a.blocks.flatMap((b) => ("text" in b ? [b.text] : "items" in b ? b.items : [])),
      ...a.faq.map((f) => f.a),
    ]);
    for (const t of texts) {
      for (const p of splitSeriesLinks(t, (n) => !!articleByN(n))) {
        if (p.kind === "link") expect(articleByN(p.n), t).not.toBeNull();
      }
      const out = rendered(t);
      expect(out, t).not.toMatch(/\(מאמר \d+ בסדרה\)/);
      for (const a of LEARNING_ARTICLES) expect(out.includes(`${a.title.split(":")[0]} ${a.title}`), t).toBe(false);
    }
  });
});
