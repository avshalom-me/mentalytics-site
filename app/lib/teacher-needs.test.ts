import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("server-only", () => ({}));

import { scoreKidsQuestionnaire } from "./kids-score.server";
import { needsFromKidsReport, sanitizeNeeds, defaultNeedForSubject, KIDS_ANSWER_KEYS_READ, TEACHER_NEEDS } from "./teacher-needs";
import { TEACHER_EXPERTISE_KEYS } from "./teacher-options";

// מה ששאלון הילדים כבר יודע, כפי שמנוע ההתאמה למורים מקבל אותו. הבדיקה מריצה
// את מנוע הניקוד האמיתי: הקשיים נגזרים מנוסח שורות הדוח, והנוסח יושב בקובץ
// אחר. שינוי ניסוח שם בלי עדכון כאן היה מעלים את ההעדפה בשקט - אף מורה לא
// היה נעלם, רק הסדר היה חוזר להיות מרחק בלבד, ואיש לא היה רואה.

const ADHD_INATTENTION = { _ad1: true, _ad2: true, _ad3: true };

function needs(answers: Record<string, unknown>, gradeGroup: string) {
  const full = { a_aca: "הרבה", ...answers };
  return needsFromKidsReport(full, scoreKidsQuestionnaire(full), gradeGroup);
}

describe("the vocabulary", () => {
  it("is the teachers' expertise list, key for key - matching is a comparison of keys", () => {
    expect(TEACHER_NEEDS.map((n) => n.key)).toEqual(TEACHER_EXPERTISE_KEYS);
  });

  it("sanitizeNeeds keeps known keys only, once, in list order", () => {
    expect(sanitizeNeeds(["attention", "nope", "literacy", "attention", 7])).toEqual(["literacy", "attention"]);
    expect(sanitizeNeeds("attention")).toEqual([]);
    expect(sanitizeNeeds(null)).toEqual([]);
  });

  it("an unspecified learning disability leans on the subject", () => {
    expect(defaultNeedForSubject("math")).toBe("numeracy");
    expect(defaultNeedForSubject("english")).toBe("literacy");
    expect(defaultNeedForSubject(null)).toBe("literacy");
  });
});

describe("nothing found, nothing preferred", () => {
  it("no academic difficulty", () => {
    expect(needsFromKidsReport({}, scoreKidsQuestionnaire({}), "ag")).toEqual([]);
    expect(needsFromKidsReport(null, null, null)).toEqual([]);
  });

  it("answers left over from a section the parent switched off do not count", () => {
    const stale = { a_aca: "בכלל לא", _grade: "ג", ag_read: "כן", ag_h1: "כן" };
    expect(needsFromKidsReport(stale, scoreKidsQuestionnaire(stale), "ag")).toEqual([]);
  });
});

describe("maths, grades א-ו", () => {
  it("5% and 10% ask for experience with persistent maths difficulty; the mild tier does not", () => {
    expect(needs({ _grade: "ג", ag_math: "5% הכי מתקשה בכיתה" }, "ag")).toEqual(["numeracy"]);
    expect(needs({ _grade: "ה", dv_math: "10% הכי נמוכים בכיתה" }, "dv")).toEqual(["numeracy"]);
    expect(needs({ _grade: "ג", ag_math: "30% הכי מתקשה בכיתה" }, "ag")).toEqual([]);
  });

  it("maths with an attention screen that came out positive", () => {
    const r = needs({ _grade: "ג", ag_math: "10% הכי מתקשה בכיתה", ag_adhd_yn: "כן", ...prefixed("ag", ADHD_INATTENTION) }, "ag");
    expect(r).toContain("numeracy");
    expect(r).toContain("attention");
    // שלושת הפריטים שסומנו הם גם פריטי ההתארגנות (2, 3) ואחד נוסף.
    expect(r).toContain("executive");
  });
});

describe("reading, grades א-ו", () => {
  it("a reading difficulty asks for literacy experience", () => {
    expect(needs({ _grade: "ג", ag_read: "כן", ag_read_motiv: "לא" }, "ag")).toContain("literacy");
  });

  it("a language background adds language experience - the case the owner named", () => {
    const r = needs({ _grade: "ה", dv_read: "כן", dv_h1: "כן", dv_read_speech: "כן", dv_speech_motiv: "כן" }, "dv");
    expect(r).toEqual(["literacy", "language"]);
  });

  it("an early sign that is not about language does not", () => {
    // dv_h2 = קשיים בזיהוי אותיות ומספרים; dv_h3 = צורות וצבעים.
    const r = needs({ _grade: "ה", dv_read: "כן", dv_h2: "כן", dv_read_speech: "לא" }, "dv");
    expect(r).toContain("literacy");
    expect(r).not.toContain("language");
  });

  it("speech therapy in the past counts as a language background", () => {
    const r = needs({ _grade: "ב", ag_read: "כן", ag_h2: "כן", ag_read_speech: "כן", ag_speech_motiv: "כן" }, "ag");
    expect(r).toContain("language");
  });

  it("emotional difficulty around learning asks for experience with avoidance", () => {
    const r = needs({ _grade: "ג", ag_read: "כן", ag_read_motiv: "לא", ag_mot1: 3, ag_mot2: 3, ag_mot3: 3 }, "ag");
    expect(r).toContain("avoidance");
  });
});

describe("grades ז-יב", () => {
  it("the severe maths tier, and only it", () => {
    expect(needs({ _grade: "ח", zh_math: "10%" }, "zh")).toEqual(["numeracy"]);
    expect(needs({ _grade: "ח", zh_math: "מעל 20%" }, "zh")).toEqual([]);
    expect(needs({ _grade: "יא", tyb_math: "10%" }, "tyb")).toEqual(["numeracy"]);
  });

  it("mild English with a positive attention screen: tutoring, with attention experience first", () => {
    const r = needs({ _grade: "ח", zh_eng: "מעל 20%", zh_adhd_yn: "כן", ...prefixed("zh", ADHD_INATTENTION) }, "zh");
    expect(r).toContain("attention");
  });

  it("difficulty in text-heavy subjects asks for literacy experience", () => {
    expect(needs({ _grade: "ח", zh_verbal: "20%" }, "zh")).toContain("literacy");
  });
});

describe("drift guard", () => {
  it("every answer key read directly still exists on the questionnaire screen", () => {
    const screen = readFileSync("app/kids/KidsQuiz.tsx", "utf8");
    for (const key of KIDS_ANSWER_KEYS_READ) {
      const literal = screen.includes(`"${key}"`) || screen.includes(`A.${key}`);
      // zh_math / tyb_math נבנים במסך מקידומת השכבה (ga + "_math").
      const built = /_math$/.test(key) && /\+\s*"_math"|`\$\{[a-zA-Z]+\}_math`/.test(screen);
      expect(literal || built, key).toBe(true);
    }
  });
});

function prefixed(prefix: string, items: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(items).map(([k, v]) => [prefix + k, v]));
}
