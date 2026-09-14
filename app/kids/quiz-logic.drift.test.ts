/**
 * Guards the hand-maintained duplication between the questionnaire's client
 * logic and the server scoring engine.
 *
 * Five declarations exist twice, once in app/kids/quiz-logic.ts and once in
 * app/lib/kids-score.server.ts, and the code says so in its own comments
 * ("Kept in sync with kids-score.server.ts", "Must stay identical to the copy
 * in kids-score.server.ts"). Nothing enforced it. Drift here does not throw
 * and does not show up in the UI: the client asks one set of questions and the
 * server scores against another, so a child is either asked something the
 * report will not use or, worse, not asked something the report then treats as
 * a real answer of 0.
 *
 * The comparison is on source text rather than behaviour because the server
 * module imports "server-only", which cannot be loaded outside a React Server
 * Component. Whitespace is normalised away, so reformatting is free and only a
 * real change in the logic fails.
 *
 * When this fails: change BOTH copies, or delete one of them and import it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CLIENT_PATH = join(process.cwd(), "app", "kids", "quiz-logic.ts");
const SERVER_PATH = join(process.cwd(), "app", "lib", "kids-score.server.ts");

const client = readFileSync(CLIENT_PATH, "utf8");
const server = readFileSync(SERVER_PATH, "utf8");

/** Whitespace and the export keyword are not part of the logic. */
function normalise(src: string): string {
  return src.replace(/^export\s+/, "").replace(/\s+/g, "");
}

/** A top-level function, from its signature to the closing brace at column 0. */
function fn(src: string, name: string, file: string): string {
  const m = src.match(new RegExp(`(?:export )?function ${name}\\([\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`${name}() not found in ${file} - was it renamed or moved?`);
  return normalise(m[0]);
}

/** A top-level single-statement const. */
function decl(src: string, name: string, file: string): string {
  const m = src.match(new RegExp(`(?:export )?const ${name} = .*?;`));
  if (!m) throw new Error(`${name} not found in ${file} - was it renamed or moved?`);
  return normalise(m[0]);
}

describe("client/server duplication", () => {
  it.each(["GA_GRADES", "BV_GRADES", "ZY_GRADES"])(
    "%s holds the same grades on both sides",
    (name) => {
      expect(decl(client, name, "quiz-logic.ts")).toBe(decl(server, name, "kids-score.server.ts"));
    },
  );

  it.each(["gg", "acadGg", "devAgeOk"])("%s() is the same function on both sides", (name) => {
    expect(fn(client, name, "quiz-logic.ts")).toBe(fn(server, name, "kids-score.server.ts"));
  });

  it("ADHD_BLOCK_THRESHOLD is the same number on both sides", () => {
    // The client copy only decides whether the general-distress screen is
    // shown. If the two drift, a child the scoring flags for ADHD is still
    // asked "is there anything else?", or is asked nothing while the report
    // says ADHD.
    expect(decl(client, "ADHD_BLOCK_THRESHOLD", "quiz-logic.ts")).toBe(
      decl(server, "ADHD_BLOCK_THRESHOLD", "kids-score.server.ts"),
    );
  });

  it("the psychosis threshold is the same rule on both sides", () => {
    // The client keeps it as pqThresholdFor(); the server inlines it. Compared
    // as the rule rather than as text: hallucinations need no confirming item,
    // beliefs alone need 2 of 3, and an untouched section is unreachable.
    expect(normalise(fn(client, "pqThresholdFor", "quiz-logic.ts"))).toContain(
      normalise('if (A.q7a === "כן") return 0;'),
    );
    expect(normalise(fn(client, "pqThresholdFor", "quiz-logic.ts"))).toContain(
      normalise('if (A.q7b === "כן") return 2;'),
    );
    expect(normalise(server)).toContain(normalise('const q7Hall = A.q7a === "כן";'));
    expect(normalise(server)).toContain(normalise('const q7Bel = A.q7b === "כן";'));
    expect(normalise(server)).toContain(
      normalise("const pqThreshold = q7Hall ? 0 : (q7Bel ? 2 : Infinity);"),
    );
  });
});
