import { describe, expect, it } from "vitest";
import { SOURCE_GROUPS, countBySource, sourceGroup } from "./traffic-source-groups";

describe("SOURCE_GROUPS", () => {
  it("puts every channel in exactly one group", () => {
    const keys = SOURCE_GROUPS.flatMap((g) => g.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("looks a group up by id and fails loudly on a typo", () => {
    expect(sourceGroup("meta").label).toBe("פייסבוק ואינסטגרם");
    expect(() => sourceGroup("facebook")).toThrow();
  });
});

describe("countBySource", () => {
  it("answers 'where did the rest come from' for a coverage chip", () => {
    // 21 פניות למטפלים בתשלום, 11 מהן מגוגל אדס: השאר הן 10, לפי מקור.
    const rest = countBySource({ google_paid: 11, direct: 5, google_organic: 4, meta_paid: 1 }, ["google_paid"]);
    expect(rest).toEqual([
      { id: "direct", label: "כניסות ישירות", n: 5 },
      { id: "google_organic", label: "גוגל אורגני", n: 4 },
      { id: "meta", label: "פייסבוק ואינסטגרם", n: 1 },
    ]);
    expect(rest.reduce((s, r) => s + r.n, 0)).toBe(21 - 11);
  });

  it("counts paid and organic Facebook as one source", () => {
    expect(countBySource({ meta_paid: 2, meta_organic: 3 })).toEqual([{ id: "meta", label: "פייסבוק ואינסטגרם", n: 5 }]);
  });

  it("keeps a channel it does not know, under 'לא מזוהה', so the sum still adds up", () => {
    const out = countBySource({ some_new_channel: 2, unknown: 1, direct: 1 });
    expect(out).toEqual([
      { id: "unknown", label: "לא מזוהה", n: 3 },
      { id: "direct", label: "כניסות ישירות", n: 1 },
    ]);
  });

  it("returns nothing when all the inquiries came from the skipped channel", () => {
    expect(countBySource({ google_paid: 4 }, ["google_paid"])).toEqual([]);
    expect(countBySource({})).toEqual([]);
  });
});
