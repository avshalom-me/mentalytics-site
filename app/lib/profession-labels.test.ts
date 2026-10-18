import { describe, expect, it } from "vitest";
import { THERAPIST_TYPES, TRAINING_AREAS, ASSESSMENT_TYPES } from "./therapist-options";
import { EN_THERAPIST_TYPES, EN_TRAINING_AREAS } from "./english-labels";
import { genderTitle } from "./gender-text";
import { DIAGNOSIS_KINDS } from "./school-tracks";

// A value without an English label is simply not shown on /en (CLAUDE.md), so a
// new profession or treatment area must arrive with one.
describe("every profile option has an English label", () => {
  it("therapist types", () => {
    for (const t of THERAPIST_TYPES) expect(EN_THERAPIST_TYPES[t], t).toBeTruthy();
  });

  it("treatment areas", () => {
    for (const t of TRAINING_AREAS) expect(EN_TRAINING_AREAS[t], t).toBeTruthy();
  });
});

// Added for centres with a medical team (18/10/2026).
describe("psychiatrist, nurse and psychiatric opinions", () => {
  it("are offered in the profile forms", () => {
    expect(THERAPIST_TYPES).toContain("פסיכיאטר/ית");
    expect(THERAPIST_TYPES).toContain("אח/ות מוסמך/ת");
    expect(TRAINING_AREAS).toContain("חוות דעת פסיכיאטרית לילדים ונוער");
    expect(TRAINING_AREAS).toContain("חוות דעת פסיכיאטרית למבוגרים");
  });

  it("read in the therapist's gender", () => {
    expect(genderTitle("פסיכיאטר/ית", "נקבה")).toBe("פסיכיאטרית");
    expect(genderTitle("פסיכיאטר/ית", "זכר")).toBe("פסיכיאטר");
    expect(genderTitle("אח/ות מוסמך/ת", "נקבה")).toBe("אחות מוסמכת");
    expect(genderTitle("אח/ות מוסמך/ת", "זכר")).toBe("אח מוסמך");
  });

  // Assessment types flow into the school counsellors' tool, where each kind
  // carries admissibility rules and "פסיכיאטר ילדים" already exists.
  it("keep the opinions out of the assessment types and the counsellors' tool", () => {
    for (const k of ["חוות דעת פסיכיאטרית לילדים ונוער", "חוות דעת פסיכיאטרית למבוגרים"]) {
      expect(ASSESSMENT_TYPES as readonly string[]).not.toContain(k);
      expect(DIAGNOSIS_KINDS as readonly string[]).not.toContain(k);
    }
  });
});
