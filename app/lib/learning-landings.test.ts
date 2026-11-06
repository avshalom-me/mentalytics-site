import { describe, expect, it } from "vitest";
import { CITY_TO_REGION, neighborsOf } from "./regions";
import { TEACHER_SUBJECT_KEYS } from "./teacher-options";
import {
  LEARNING_CITY_MIN_TEACHERS,
  LEARNING_SUBJECT_MIN_TEACHERS,
  SUBJECT_LANDINGS,
  cityLandingOpen,
  cityLandingPath,
  learningLandings,
  subjectLandingBySlug,
  subjectLandingPath,
  type LandingRow,
} from "./learning-landings";

// עמודי תחום ועיר במאגר המורים נפתחים רק מעל סף של היצע (תוכנית השדרוג,
// 6/11/2026): עמוד דל לא נכנס לאינדקס ולא ל-sitemap, ונפתח לבד כשיש מורים.

const row = (subjects: string[], regions: string[] = []): LandingRow => ({ subjects, regions, remedial: false });

describe("עמודי תחום", () => {
  it("לכל תחום במאגר יש עמוד, עם כתובת ייחודית שחוזרת מהנתיב", () => {
    expect(SUBJECT_LANDINGS.map((l) => l.subject).sort()).toEqual([...TEACHER_SUBJECT_KEYS].sort());
    for (const l of SUBJECT_LANDINGS) {
      expect(subjectLandingBySlug(encodeURIComponent(l.slug))).toBe(l);
      expect(subjectLandingPath(l)).toBe(`/learning/teachers/subject/${l.slug}`);
      expect(l.intro.join(" ") + l.description + l.title).not.toContain("—");
    }
    expect(subjectLandingBySlug("לא-קיים")).toBeNull();
  });
  it("נפתח מחמישה מורים בתחום, לא מארבעה", () => {
    const four = Array.from({ length: LEARNING_SUBJECT_MIN_TEACHERS - 1 }, () => row(["math"]));
    expect(learningLandings(four).subjects).toEqual([]);
    const open = learningLandings([...four, row(["math", "english"])]).subjects;
    expect(open.map((s) => s.landing.subject)).toEqual(["math"]);
    expect(open[0].count).toBe(LEARNING_SUBJECT_MIN_TEACHERS);
  });
});

describe("עמודי עיר", () => {
  const city = "רמת גן";
  const neighbor = neighborsOf(city)[0];
  it("יש לעיר הבדיקה שכנה, כדי שהבדיקה של השכנות תבדוק משהו", () => {
    expect(CITY_TO_REGION[city]).toBeTruthy();
    expect(neighbor).toBeTruthy();
  });
  it("שלושה מורים בעיר פותחים אותה; שניים לא", () => {
    const two = [row(["math"], [city]), row(["english"], [city])];
    expect(cityLandingOpen(two, city).open).toBe(false);
    expect(LEARNING_CITY_MIN_TEACHERS).toBe(3);
    expect(cityLandingOpen([...two, row(["math"], [city])], city)).toEqual({ open: true, inCity: 3, nearby: 3 });
  });
  it("מורה אחד/ת בעיר וחמישה עם הערים הצמודות פותחים; בלי מורה בעיר לא", () => {
    const around = Array.from({ length: 4 }, () => row(["math"], [neighbor]));
    expect(cityLandingOpen([...around, row(["math"], [city])], city)).toEqual({ open: true, inCity: 1, nearby: 5 });
    expect(cityLandingOpen([...around, row(["math"], [neighbor])], city).open).toBe(false);
  });
  it("רשימת הערים הפתוחות, והנתיב בעברית עם מקפים", () => {
    const rows = [row(["math"], [city]), row(["math"], [city]), row(["math"], [city]), row(["math"], ["עיר שלא קיימת"])];
    expect(learningLandings(rows).cities.map((c) => c.city)).toEqual([city]);
    expect(cityLandingPath(city)).toBe("/learning/teachers/city/רמת-גן");
  });
});
