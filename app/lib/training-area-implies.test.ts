import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRAINING_AREAS, TRAINING_AREA_IMPLIES, withImpliedTrainingAreas } from "./therapist-options";

describe("withImpliedTrainingAreas", () => {
  it("adds dynamic therapy to whoever ticked dynamic trauma therapy", () => {
    expect(withImpliedTrainingAreas(["טיפול דינאמי בטראומה", "הדרכת הורים"])).toEqual([
      "טיפול דינאמי בטראומה",
      "הדרכת הורים",
      "טיפול דינאמי",
    ]);
  });

  it("leaves a list that already has it, or never needed it, as it was", () => {
    expect(withImpliedTrainingAreas(["טיפול דינאמי", "טיפול דינאמי בטראומה"])).toEqual([
      "טיפול דינאמי",
      "טיפול דינאמי בטראומה",
    ]);
    expect(withImpliedTrainingAreas(["CBT", "טיפול בטראומה"])).toEqual(["CBT", "טיפול בטראומה"]);
    expect(withImpliedTrainingAreas([])).toEqual([]);
  });

  it("names only areas the form offers", () => {
    const offered = new Set<string>(TRAINING_AREAS);
    for (const [area, implied] of Object.entries(TRAINING_AREA_IMPLIES)) {
      expect(offered.has(area)).toBe(true);
      for (const a of implied) expect(offered.has(a)).toBe(true);
    }
  });

  it("is mirrored by the database trigger, so every save path keeps it", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261030_training_area_implies.sql"),
      "utf8"
    );
    for (const [area, implied] of Object.entries(TRAINING_AREA_IMPLIES)) {
      expect(sql).toContain(`'${area}' = ANY(NEW.training_areas)`);
      for (const a of implied) expect(sql).toContain(`array_append(NEW.training_areas, '${a}')`);
    }
  });
});
