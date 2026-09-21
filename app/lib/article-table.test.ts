import { describe, expect, it } from "vitest";
import { parseMarkdownTable } from "./article-table";

describe("parseMarkdownTable", () => {
  it("parses a header, a separator and body rows, keeping an empty corner cell", () => {
    const t = parseMarkdownTable(
      ["|  | אבחון תעסוקתי | טיפול תעסוקתי |", "|---|---|---|", "| השאלה | מה מתאים לי | למה אני תקוע |"].join("\n")
    );
    expect(t).toEqual({
      head: ["", "אבחון תעסוקתי", "טיפול תעסוקתי"],
      rows: [["השאלה", "מה מתאים לי", "למה אני תקוע"]],
    });
  });

  it("accepts alignment colons and surrounding whitespace", () => {
    const t = parseMarkdownTable("  | a | b |\n| :--- | ---: |\n| 1 | 2 |  ");
    expect(t).toEqual({ head: ["a", "b"], rows: [["1", "2"]] });
  });

  it("returns null without a separator row", () => {
    expect(parseMarkdownTable("| a | b |\n| 1 | 2 |\n| 3 | 4 |")).toBeNull();
  });

  it("returns null when a row has a different number of cells", () => {
    expect(parseMarkdownTable("| a | b |\n|---|---|\n| 1 | 2 | 3 |")).toBeNull();
  });

  it("returns null for an ordinary paragraph that happens to contain a pipe", () => {
    expect(parseMarkdownTable("טקסט רגיל | עם קו אנכי")).toBeNull();
  });
});
