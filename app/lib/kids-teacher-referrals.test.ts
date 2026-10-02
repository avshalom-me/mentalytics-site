import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { scoreKidsQuestionnaire } from "./kids-score.server";
import { parseKidsBoxes, aggregateForMatch, findingExternalKeys } from "./kids-recommendations";
import { TEACHER_REFERRAL_KEYS, teacherSearchFromKey } from "./teacher-options";

// ענף המורים בשאלון הילדים, מקצה לקצה: תשובות → מנוע הניקוד → המפענח →
// מפתח ההמלצה שכפתור "חיפוש מורה" שולח. הטקסט שהמנוע כותב והביטוי שהמפענח
// מחפש יושבים בשני קבצים, וסחיפה ביניהם שקטה מטבעה: הכרטיס פשוט חוזר להיות
// "פנייה נוספת" בלי כפתור. כך "קלינאית/קלינאות תקשורת" נשארה שבורה חודשים.

const K = TEACHER_REFERRAL_KEYS;

function academic(answers: Record<string, unknown>) {
  const score = scoreKidsQuestionnaire({ a_aca: "הרבה", ...answers });
  const result = parseKidsBoxes(score.academic, "academic");
  const groups = result.groups;
  return {
    groups,
    teacherKeys: groups.filter((g) => g.kind === "teacher").map((g) => g.treatmentKey),
    assessmentKeys: groups.filter((g) => g.kind === "assessment").map((g) => g.treatmentKey),
    agg: aggregateForMatch([result]),
  };
}

describe("maths only, grades א-ו: remedial teaching, searchable", () => {
  for (const [grade, field, value] of [
    ["ג", "ag_math", "5% הכי מתקשה בכיתה"],
    ["ג", "ag_math", "10% הכי מתקשה בכיתה"],
    ["ג", "ag_math", "30% הכי מתקשה בכיתה"],
    ["ה", "dv_math", "5% הכי נמוכים בכיתה"],
    ["ה", "dv_math", "10% הכי נמוכים בכיתה"],
    ["ה", "dv_math", "30% הכי נמוכים בכיתה"],
  ] as const) {
    it(`grade ${grade}, ${value.split(" ")[0]}`, () => {
      const r = academic({ _grade: grade, [field]: value });
      expect(r.teacherKeys).toEqual([K.remedialMath]);
      expect(r.assessmentKeys).toEqual([]);
      expect(r.agg.teacherKeys).toEqual([K.remedialMath]);
    });
  }

  it("never headlines the card as an assessment, though the follow-up note mentions one", () => {
    const r = academic({ _grade: "ג", ag_math: "5% הכי מתקשה בכיתה" });
    const card = r.groups.find((g) => g.kind === "teacher")!;
    expect(card.treatmentLabel).toBe("מורה להוראה מתקנת בחשבון");
    expect(card.recs[0].notes ?? "").toContain("פסיכודידקטי");
  });
});

describe("maths at 5% with a reading difficulty, grades ד-ו", () => {
  it("leads with the assessment and adds a searchable remedial-maths card beside it", () => {
    const r = academic({ _grade: "ה", dv_math: "5% הכי נמוכים בכיתה", dv_read: "כן", dv_h1: "כן", dv_h2: "כן", dv_h3: "כן", dv_h4: "כן" });
    expect(r.assessmentKeys).toContain("פסיכו-דידקטי");
    expect(r.teacherKeys).toEqual([K.remedialMath]);
  });
});

describe("reading, grades א-ו: remedial reading beside the school programme", () => {
  it("grade ג, no history flags, not motivated", () => {
    const r = academic({ _grade: "ג", ag_read: "כן", ag_read_motiv: "לא" });
    expect(r.teacherKeys).toEqual([K.remedialReading]);
  });
  it("grade ה, one to three history flags with a speech history", () => {
    const r = academic({ _grade: "ה", dv_read: "כן", dv_h1: "כן", dv_read_speech: "כן", dv_speech_motiv: "כן" });
    expect(r.teacherKeys).toEqual([K.remedialReading]);
  });
  it("not when the flow goes to a speech therapist or straight to an assessment", () => {
    expect(academic({ _grade: "ג", ag_read: "כן", ag_read_motiv: "כן" }).teacherKeys).toEqual([]);
    expect(academic({ _grade: "ה", dv_read: "כן", dv_h1: "כן", dv_h2: "כן", dv_h3: "כן", dv_h4: "כן" }).teacherKeys).toEqual([]);
  });
});

describe("maths or English only, grades ז-יב: private tutoring", () => {
  it("maths in ח, at any severity", () => {
    for (const v of ["10%", "20%", "מעל 20%"]) {
      const r = academic({ _grade: "ח", zh_math: v });
      expect(r.teacherKeys, v).toEqual([K.tutorMath]);
      expect(r.assessmentKeys, v).toEqual([]);
    }
  });
  it("English in יא", () => {
    expect(academic({ _grade: "יא", tyb_eng: "20%" }).teacherKeys).toEqual([K.tutorEnglish]);
  });
  it("both, as two cards", () => {
    expect(academic({ _grade: "י", tyb_math: "20%", tyb_eng: "מעל 20%" }).teacherKeys.sort()).toEqual([K.tutorEnglish, K.tutorMath].sort());
  });
  it("a severe difficulty alongside a verbal one goes to the assessment instead", () => {
    const r = academic({ _grade: "ח", zh_math: "10%", zh_verbal: "5%" });
    expect(r.teacherKeys).toEqual([]);
    expect(r.assessmentKeys).toContain("פסיכו-דידקטי");
  });
});

describe("what the keys mean downstream", () => {
  it("every key the scorer can produce resolves to a subject and a teacher kind", () => {
    expect(teacherSearchFromKey(K.remedialMath)).toMatchObject({ subject: "math", remedial: true });
    expect(teacherSearchFromKey(K.remedialReading)).toMatchObject({ subject: "reading_writing", remedial: true });
    expect(teacherSearchFromKey(K.tutorMath)).toMatchObject({ subject: "math", remedial: false });
    expect(teacherSearchFromKey(K.tutorEnglish)).toMatchObject({ subject: "english", remedial: false });
  });
  it("the counsellor's tracks input hears remedial teaching under its old key, and never hears tutoring", () => {
    expect(findingExternalKeys(academic({ _grade: "ג", ag_math: "10% הכי מתקשה בכיתה" }).agg)).toContain("הוראה מתקנת");
    expect(findingExternalKeys(academic({ _grade: "ח", zh_math: "20%" }).agg)).not.toContain("הוראה מתקנת");
  });
  it("a child with no academic difficulty gets no teacher card", () => {
    expect(academic({ _grade: "ג" }).teacherKeys).toEqual([]);
  });
});
