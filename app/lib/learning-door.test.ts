import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { LEARNING_DOOR_PUBLIC, LEARNING_PRIVATE_SEGMENTS, isLearningPath, learningRobots } from "./learning-door";

describe("the learning door", () => {
  it("knows its own paths, and nothing that merely starts with the same letters", () => {
    expect(isLearningPath("/learning")).toBe(true);
    expect(isLearningPath("/learning/join")).toBe(true);
    expect(isLearningPath("/learning/t/some-teacher")).toBe(true);
    expect(isLearningPath("/learning-disabilities")).toBe(false);
    expect(isLearningPath("/research/learning")).toBe(false);
    expect(isLearningPath("/")).toBe(false);
    expect(isLearningPath(null)).toBe(false);
    expect(isLearningPath(undefined)).toBe(false);
  });

  it("the door pages follow the one switch", () => {
    expect(learningRobots()).toEqual(LEARNING_DOOR_PUBLIC ? { index: true, follow: true } : { index: false, follow: false });
  });

  it("the teacher's own pages and the profiles are never opened by the switch", () => {
    expect([...LEARNING_PRIVATE_SEGMENTS].sort()).toEqual(["k", "me", "pay", "t"]);
    // כל אזור פרטי הוא תיקייה אמיתית תחת app/learning; אזור שנוסף בלי להיכנס
    // לרשימה היה נשאר בלי כותרת X-Robots-Tag כשהדלת נפתחת.
    for (const segment of LEARNING_PRIVATE_SEGMENTS) {
      const file = segment === "k" ? "app/learning/k/[token]/route.ts" : segment === "t" ? "app/learning/t/[slug]/page.tsx" : `app/learning/${segment}/page.tsx`;
      expect(() => readFileSync(file, "utf8"), segment).not.toThrow();
    }
  });

  it("the module stays free of imports - next.config.ts loads it before path aliases exist", () => {
    const source = readFileSync("app/lib/learning-door.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
    expect(source).not.toContain('from "@/');
  });

  it("the private pages do not ask to be indexed", () => {
    for (const file of ["app/learning/me/page.tsx", "app/learning/pay/layout.tsx", "app/learning/t/[slug]/page.tsx", "app/learning/layout.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("index: false");
      expect(source, file).not.toMatch(/robots:\s*learningRobots\(/);
    }
  });
});
