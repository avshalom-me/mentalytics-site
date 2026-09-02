import { describe, it, expect } from "vitest";
import { toTracksInput, buildSchoolSummary, interventionsTried, SCHOOL_DIAGNOSIS_KINDS, type SchoolAnswers } from "./school-report";
import { mapSchoolTracks } from "./school-tracks-engine";

const TODAY = "2026-09-02";

const full: SchoolAnswers = {
  role: "counselor", fillMode: "phone_parent", parents: "aware_consent", initiator: "teacher",
  grade: "ד", gender: "נקבה", duration: "over_year",
  attendance: "frequent", lateness: "some", refusal: "signs",
  cls_attention: 2, cls_org: 1, cls_authority: 0,
  soc_isolation: 2, bully_victim: "suspected",
  emo_internal: 3, emo_change: "yes",
  acad_gap: 2, acad_response: "partial",
  safety: "no",
  interventions: { talks: "helped", plan: "partial", remedial: "no_help" },
  diagnoses: [{ kind: "פסיכיאטר ילדים", year: 2025 }],
  schoolTeam: "yes", zakautStatus: "none", hatamotStatus: "none",
  supports: ["הוראה מתקנת"], health: ["מעקב פסיכיאטר/ית"],
  fam_cooperation: "partial", fam_economic: "yes", fam_welfare: "no",
};

describe("toTracksInput", () => {
  it("needs a grade and nothing else", () => {
    expect(toTracksInput({}, TODAY)).toBeNull();
    expect(toTracksInput({ grade: "ז" }, TODAY)?.grade).toBe("ז");
  });

  it("carries the counsellor's report into the engine's vocabulary", () => {
    const input = toTracksInput(full, TODAY)!;
    expect(input.schoolTeam).toEqual({ convened: true });
    expect(input.zakaut).toEqual({ status: "none", decisionReceivedOn: undefined });
    expect(input.interventionsTried).toBe(3);
    expect(input.economicConstraint).toBe(true);
    expect(input.risk).toEqual({ suicidality: false, schoolRefusal: true });
    expect(input.diagnoses).toEqual([{ kind: "פסיכיאטר ילדים", year: 2025 }]);
  });

  it("counts an intervention as tried whatever its outcome", () => {
    expect(interventionsTried({ interventions: { talks: "no_help", plan: "not_tried" } })).toBe(1);
    expect(interventionsTried({})).toBe(0);
  });

  it("never offers the two questionnaire kinds that have no meaning in a school file", () => {
    expect(SCHOOL_DIAGNOSIS_KINDS).not.toContain("אבחון תעסוקתי");
    expect(SCHOOL_DIAGNOSIS_KINDS).not.toContain("הערכת בשלות לגן");
    expect(SCHOOL_DIAGNOSIS_KINDS).toContain("פסיכו-דידקטי");
  });
});

describe("buildSchoolSummary", () => {
  const tracks = mapSchoolTracks(toTracksInput(full, TODAY)!);
  const { text, html } = buildSchoolSummary(full, tracks, TODAY);

  it("opens with who reported and how, and closes with the disclaimer", () => {
    expect(text.startsWith("סיכום לקראת הפניה - התלמידה")).toBe(true);
    expect(text).toContain("יועצת חינוכית");
    expect(text).toContain("בשיחת טלפון עם הורה");
    expect(text).toContain("2.9.2026");
    expect(text.trim().endsWith("אינו מכיל פרטים מזהים.")).toBe(true);
  });

  it("writes what was reported and stays silent about what was not", () => {
    expect(text).toContain("היעדרויות תכופות");
    expect(text).toContain("סרבנות בית ספר - סימנים");
    expect(text).toContain("קשב והתמדה בשיעור: הרבה");
    expect(text).toContain("מופנמות, עצב או חרדה נצפית: הרבה מאוד");
    expect(text).not.toContain("התנהלות מול סמכות");   // answered כלל לא
    expect(text).not.toContain("חיכוכים");             // not answered
    expect(text).not.toContain("החצנה");               // not answered
  });

  it("lists the interventions with their outcomes, then the ones not tried", () => {
    expect(text).toContain("שיחות פרטניות עם מחנכ/ת או יועצת: הועיל");
    expect(text).toContain("הוראה מתקנת או תגבור לימודי: לא הועיל");
    expect(text).toContain("טרם נוסו: תוכנית אישית");
  });

  it("records the file and the family in the committee's terms", () => {
    expect(text).toContain("אבחנה של פסיכיאטר/ית ילדים ונוער (2025)");
    expect(text).toContain("צוות רב-מקצועי: התכנס");
    expect(text).toContain("ועדת זכאות ואפיון: לא הופנה/תה");
    expect(text).toContain("תמיכות פעילות: הוראה מתקנת");
    expect(text).toContain("קיימת מגבלה כלכלית מוכרת");
  });

  it("names the tracks the map raised, with their deadlines", () => {
    expect(text).toContain("מסלולים לבדיקה");
    expect(text).toContain("ועדת זכאות ואפיון (לשיקול) - הפניה עד 31.3.2027");
    expect(text).not.toContain("(מידע)");
  });

  it("mirrors the text as HTML with headings and lists, escaped", () => {
    expect(html).toContain("<h2>סיכום לקראת הפניה - התלמידה</h2>");
    expect(html).toContain("<h3>תפקוד בבית הספר</h3><ul><li>");
    expect(html).not.toContain("<script");
    expect(buildSchoolSummary({ ...full, supports: ["<b>x</b>"] }, tracks, TODAY).html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("flags a safety concern in the summary and asks for the parents when they were not told", () => {
    const risky = buildSchoolSummary({ ...full, safety: "yes" }, tracks, TODAY).text;
    expect(risky).toContain("חשש לפגיעה עצמית");
    const bare = buildSchoolSummary({ grade: "ח" }, [], TODAY).text;
    expect(bare).toContain("התלמיד/ה");
    expect(bare).not.toContain("התערבויות");
  });
});
