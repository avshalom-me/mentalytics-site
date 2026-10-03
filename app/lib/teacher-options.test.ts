import { describe, it, expect } from "vitest";
import {
  TEACHER_EXPERTISE_KEYS,
  TEACHER_EXPERTISE_MAX,
  TEACHER_FOCUSES,
  TEACHER_SUBJECT_KEYS,
  focusKeysFor,
  focusesBySubject,
  lessonSettingsText,
  sanitizeTeacherExtras,
  teachesInPerson,
  teacherSearchLabel,
} from "./teacher-options";

// שלוש הרובריקות שנוספו לטופס המורה ב-3/10/2026. הניקוי הוא המקום היחיד שבו
// נאכפים "עד שלושה" ו"מוקד רק של תחום שסומן", ולכן הוא נבדק כאן ולא דרך הטופס.

describe("אוצר המילים של הרובריקות", () => {
  it("לכל תחום הוראה יש מוקדים", () => {
    for (const s of TEACHER_SUBJECT_KEYS) expect(TEACHER_FOCUSES[s].length).toBeGreaterThan(0);
  });

  it("מפתחות המוקדים ייחודיים על פני כל התחומים", () => {
    const all = focusKeysFor(TEACHER_SUBJECT_KEYS);
    expect(new Set(all).size).toBe(all.length);
  });

  it("מפתחות מאפייני הלמידה אינם מפתחות של תחומים", () => {
    for (const k of TEACHER_EXPERTISE_KEYS) expect((TEACHER_SUBJECT_KEYS as string[]).includes(k)).toBe(false);
  });
});

describe("sanitizeTeacherExtras", () => {
  it("מאפייני למידה: רק מוכרים, בלי כפילויות, בסדר הרשימה, ועד שלושה", () => {
    const out = sanitizeTeacherExtras({ expertise: ["avoidance", "nope", "literacy", "literacy", "attention", "language"] }, []);
    expect(out.expertise).toEqual(["literacy", "language", "attention"]);
    expect(out.expertise.length).toBeLessThanOrEqual(TEACHER_EXPERTISE_MAX);
  });

  it("מוקד של תחום שלא סומן נושר", () => {
    const out = sanitizeTeacherExtras({ focuses: ["math_5u", "rw_fluency", "en_3u", "made_up"] }, ["math", "english"]);
    expect(out.focuses).toEqual(["math_5u", "en_3u"]);
  });

  it("בלי תחומים אין מוקדים", () => {
    expect(sanitizeTeacherExtras({ focuses: ["math_5u"] }, []).focuses).toEqual([]);
  });

  it("מקום השיעור: רק ערכים מוכרים, בסדר הרשימה", () => {
    const out = sanitizeTeacherExtras({ lesson_settings: ["online", "cafe", "student_home"] }, []);
    expect(out.lesson_settings).toEqual(["student_home", "online"]);
  });

  it("קלט חסר או שאינו מערך מתנקה לריק", () => {
    expect(sanitizeTeacherExtras({}, ["math"])).toEqual({ expertise: [], focuses: [], lesson_settings: [] });
    expect(sanitizeTeacherExtras({ expertise: "literacy", focuses: null, lesson_settings: 7 }, ["math"])).toEqual({
      expertise: [],
      focuses: [],
      lesson_settings: [],
    });
  });
});

describe("הצגה", () => {
  it("teachesInPerson: אצל המורה או בבית התלמיד, לא אונליין בלבד", () => {
    expect(teachesInPerson(["online"])).toBe(false);
    expect(teachesInPerson([])).toBe(false);
    expect(teachesInPerson(["online", "teacher_place"])).toBe(true);
    expect(teachesInPerson(["student_home"])).toBe(true);
  });

  it("focusesBySubject מקבץ לפי תחום, בסדר התחומים, ומדלג על תחום בלי מוקדים", () => {
    const groups = focusesBySubject(["english", "math", "hebrew"], ["en_5u", "math_basics", "math_middle"]);
    expect(groups.map((g) => g.subject)).toEqual(["math", "english"]);
    expect(groups[0].focuses).toEqual(["יסודות החשבון", "מתמטיקה בחטיבת הביניים"]);
    expect(groups[1].focuses).toEqual(["תיכון, 5 יחידות"]);
  });

  it("lessonSettingsText: לפי הרובריקה, בסדר קבוע", () => {
    expect(lessonSettingsText({ lesson_settings: ["online", "student_home"] })).toBe("בבית התלמיד, אונליין");
  });

  it("lessonSettingsText: שורה בלי הרובריקה נופלת חזרה לערים ולאונליין", () => {
    expect(lessonSettingsText({ lesson_settings: [], online: true, regions: ["חיפה"] })).toBe("פנים אל פנים, אונליין");
    expect(lessonSettingsText({ lesson_settings: null, online: true, regions: [] })).toBe("אונליין");
    expect(lessonSettingsText({ online: false, regions: [] })).toBe("");
  });
});

describe("teacherSearchLabel - the heading of a direct search", () => {
  it("names the teacher kind and the subject", () => {
    expect(teacherSearchLabel("reading_writing", true)).toBe("מורה להוראה מתקנת בקריאה וכתיבה");
    expect(teacherSearchLabel("english", false)).toBe("מורה פרטי/ת לאנגלית");
    expect(teacherSearchLabel(null, true)).toBe("מורה להוראה מתקנת");
    expect(teacherSearchLabel(null, false)).toBe("מורה");
  });
});
