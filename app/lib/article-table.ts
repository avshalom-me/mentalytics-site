// A GitHub-style Markdown table inside an article body:
//
//   |  | אבחון תעסוקתי | טיפול תעסוקתי |
//   |---|---|---|
//   | השאלה | מה מתאים לי | למה אני תקוע |
//
// Kept separate from ArticleBody so the parsing can be unit-tested without a
// React renderer. Strict on purpose: a block that is not a well-formed table
// (no separator row, or a row with a different number of cells) returns null
// and renders as an ordinary paragraph, so the author sees the pipes and fixes
// the table instead of getting a silently mangled one.

export type MarkdownTable = { head: string[]; rows: string[][] };

const ROW = /^\|.*\|$/;
const SEPARATOR_CELL = /^:?-{3,}:?$/;

function cells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseMarkdownTable(block: string): MarkdownTable | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3 || !lines.every((l) => ROW.test(l))) return null;

  const head = cells(lines[0]);
  const separator = cells(lines[1]);
  if (separator.length !== head.length || !separator.every((c) => SEPARATOR_CELL.test(c))) return null;

  const rows = lines.slice(2).map(cells);
  if (rows.some((r) => r.length !== head.length)) return null;
  return { head, rows };
}
