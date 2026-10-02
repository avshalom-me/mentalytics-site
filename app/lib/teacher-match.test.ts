import { describe, it, expect } from "vitest";
import { matchTeachers, isTeacherListed, type TeacherRow, type TeacherMatchInput } from "./teacher-match";
import { teacherSearchFromKey, TEACHER_REFERRAL_KEYS, qualificationAllowsRemedial } from "./teacher-options";

const NOW = new Date("2026-10-02T10:00:00Z");

function row(over: Partial<TeacherRow>): TeacherRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    full_name: "מורה",
    gender: "נקבה",
    slug: "mora",
    subjects: ["math"],
    remedial: true,
    grade_groups: ["ag", "dv"],
    regions: ["כפר סבא"],
    online: false,
    languages: ["עברית"],
    listing_state: "trial",
    paused_until: null,
    bio: null,
    phone: null,
    price_text: null,
    qualification: "remedial_cert",
    photo_path: null,
    experience_years: null,
    ...over,
  };
}

function input(over: Partial<TeacherMatchInput>): TeacherMatchInput {
  return {
    subject: "math",
    remedial: true,
    gradeGroup: "ag",
    city: null,
    region: null,
    onlineRequired: false,
    language: "עברית",
    genderPreference: null,
    limit: 10,
    ...over,
  };
}

describe("teacher referral keys", () => {
  it("every key the questionnaire can emit resolves to a subject and a teacher kind", () => {
    expect(teacherSearchFromKey(TEACHER_REFERRAL_KEYS.remedialMath)).toMatchObject({ subject: "math", remedial: true });
    expect(teacherSearchFromKey(TEACHER_REFERRAL_KEYS.remedialReading)).toMatchObject({ subject: "reading_writing", remedial: true });
    expect(teacherSearchFromKey(TEACHER_REFERRAL_KEYS.tutorMath)).toMatchObject({ subject: "math", remedial: false });
    expect(teacherSearchFromKey(TEACHER_REFERRAL_KEYS.tutorEnglish)).toMatchObject({ subject: "english", remedial: false });
    expect(teacherSearchFromKey(TEACHER_REFERRAL_KEYS.remedialGeneric)).toMatchObject({ subject: null, remedial: true });
  });

  it("only the specialised qualifications allow a remedial listing", () => {
    expect(qualificationAllowsRemedial("remedial_cert")).toBe(true);
    expect(qualificationAllowsRemedial("special_ed_degree")).toBe(true);
    expect(qualificationAllowsRemedial("teaching_cert")).toBe(false);
    expect(qualificationAllowsRemedial(null)).toBe(false);
  });
});

describe("who is listed", () => {
  it("trial and paying are listed; pending, archived and rejected are not", () => {
    for (const s of ["trial", "paying"]) expect(isTeacherListed(row({ listing_state: s }), NOW)).toBe(true);
    for (const s of ["pending", "archived", "rejected"]) expect(isTeacherListed(row({ listing_state: s }), NOW)).toBe(false);
  });
  it("a pause with a future date hides the teacher, a past one does not", () => {
    expect(isTeacherListed(row({ paused_until: "2026-10-09T00:00:00Z" }), NOW)).toBe(false);
    expect(isTeacherListed(row({ paused_until: "2026-09-01T00:00:00Z" }), NOW)).toBe(true);
  });
});

describe("matchTeachers", () => {
  it("hard-filters subject, remedial, grade group and language", () => {
    const rows = [
      row({ id: "ok" }),
      row({ id: "english-only", subjects: ["english"] }),
      row({ id: "tutor-only", remedial: false }),
      row({ id: "high-school", grade_groups: ["tyb"] }),
      row({ id: "arabic", languages: ["ערבית"] }),
      row({ id: "pending", listing_state: "pending" }),
    ];
    const out = matchTeachers(rows, input({}), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["ok"]);
    expect(out[0].score).toBe(100);
  });

  it("a tutoring request accepts tutors and remedial teachers alike, both as a full fit", () => {
    const rows = [row({ id: "tutor", remedial: false }), row({ id: "remedial", remedial: true })];
    const out = matchTeachers(rows, input({ remedial: false }), NOW);
    expect(out.map((m) => m.teacher.id).sort()).toEqual(["remedial", "tutor"]);
    for (const m of out) expect(m.score).toBe(100);
  });

  it("without a location everyone is in the requested area", () => {
    const out = matchTeachers([row({ regions: ["אילת"] })], input({}), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].inRequestedArea).toBe(true);
  });

  it("with a city: local first, then neighbours and online, and far-away teachers are dropped", () => {
    const rows = [
      row({ id: "far", regions: ["אילת"] }),
      row({ id: "online-far", regions: ["אילת"], online: true }),
      row({ id: "neighbour", regions: ["תל אביב"] }), // גוש דן שכן לדרום השרון
      row({ id: "same-region", regions: ["רעננה"] }),
      row({ id: "same-city", regions: ["כפר סבא"] }),
    ];
    const out = matchTeachers(rows, input({ city: "כפר סבא", region: "דרום השרון" }), NOW);
    const ids = out.map((m) => m.teacher.id);
    expect(ids.slice(0, 2)).toEqual(["same-city", "same-region"]);
    expect(ids).not.toContain("far");
    expect(ids).toContain("neighbour");
    expect(ids).toContain("online-far");
    expect(out.find((m) => m.teacher.id === "same-city")!.inRequestedArea).toBe(true);
    expect(out.find((m) => m.teacher.id === "neighbour")!.inRequestedArea).toBe(false);
  });

  it("online-only request keeps online teachers only", () => {
    const rows = [row({ id: "f2f" }), row({ id: "online", online: true })];
    const out = matchTeachers(rows, input({ onlineRequired: true }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["online"]);
  });

  it("paying teachers come before trial teachers among equals", () => {
    const rows = [row({ id: "trial", listing_state: "trial" }), row({ id: "paying", listing_state: "paying" })];
    const out = matchTeachers(rows, input({}), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["paying", "trial"]);
  });

  it("respects the limit", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({ id: `t${i}` }));
    expect(matchTeachers(rows, input({ limit: 5 }), NOW)).toHaveLength(5);
  });
});
