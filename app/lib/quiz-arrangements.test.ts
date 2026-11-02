import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The owner's decision of 1/11/2026: the questionnaires no longer offer
// "therapists who work with the health funds". The option stays in the
// therapist forms and in the directory (/therapists/arrangement).
const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("payment arrangements offered in the questionnaires", () => {
  it("the adults questionnaire offers no health-fund option, and drops a stale one before searching", () => {
    const src = read("app/adults/page.tsx");
    expect(src).toContain('const QUIZ_ARRANGEMENTS = ["ביטוח לאומי", "משרד הביטחון", "ביטוחים פרטיים"];');
    expect(src).toContain("{QUIZ_ARRANGEMENTS.map((arr) => (");
    expect(src).toContain("arrangements: matchPrefs.arrangements.filter((a) => QUIZ_ARRANGEMENTS.includes(a)),");
  });

  it("the kids questionnaire and the counsellor tool offer none either, and drop a stale one", () => {
    const src = read("app/kids/KidsQuiz.tsx");
    expect(src).toContain('const KIDS_ARRANGEMENTS: readonly string[] = ["משרד הביטחון", "ביטוח לאומי", "ביטוחים פרטיים"];');
    expect(src).toContain("arrangements: arrangements.filter((a) => KIDS_ARRANGEMENTS.includes(a)),");
  });

  it("neither questionnaire lists the health funds as a choice anywhere", () => {
    for (const f of ["app/adults/page.tsx", "app/kids/KidsQuiz.tsx"]) {
      expect(read(f)).not.toMatch(/\[[^\]]*"קופות החולים"[^\]]*\]/);
    }
  });
});
