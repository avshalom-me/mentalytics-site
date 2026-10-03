import { describe, it, expect } from "vitest";
import { matchTeachers, isTeacherListed, teacherSupplyForKeys, teacherDoorSupply, type TeacherRow, type TeacherMatchInput } from "./teacher-match";
import { teacherSearchFromKey, TEACHER_REFERRAL_KEYS, qualificationAllowsRemedial, hasActiveStandingOrder } from "./teacher-options";

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
    expertise: [],
    focuses: [],
    lesson_settings: [],
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

describe("an active standing order", () => {
  it("needs an id and no cancellation - the one rule the cron, the admin and the checkout share", () => {
    expect(hasActiveStandingOrder({ sumit_recurring_id: "123", sumit_cancelled_at: null })).toBe(true);
    expect(hasActiveStandingOrder({ sumit_recurring_id: "123", sumit_cancelled_at: "2026-12-01T00:00:00Z" })).toBe(false);
    expect(hasActiveStandingOrder({ sumit_recurring_id: null, sumit_cancelled_at: null })).toBe(false);
    expect(hasActiveStandingOrder({})).toBe(false);
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

describe("the supply gate: is there anyone to show for a referral", () => {
  const K = TEACHER_REFERRAL_KEYS;
  const all = [K.remedialMath, K.remedialReading, K.tutorMath, K.tutorEnglish];

  it("an empty directory offers no search at all", () => {
    expect(teacherSupplyForKeys([], all, "ag", NOW)).toEqual({ [K.remedialMath]: false, [K.remedialReading]: false, [K.tutorMath]: false, [K.tutorEnglish]: false });
  });
  it("one remedial maths teacher opens remedial maths and maths tutoring, and nothing else", () => {
    const rows = [row({ subjects: ["math"], remedial: true, grade_groups: ["ag", "dv"] })];
    expect(teacherSupplyForKeys(rows, all, "ag", NOW)).toEqual({ [K.remedialMath]: true, [K.remedialReading]: false, [K.tutorMath]: true, [K.tutorEnglish]: false });
  });
  it("a tutor does not open a remedial referral", () => {
    const rows = [row({ subjects: ["math"], remedial: false })];
    expect(teacherSupplyForKeys(rows, [K.remedialMath, K.tutorMath], "ag", NOW)).toEqual({ [K.remedialMath]: false, [K.tutorMath]: true });
  });
  it("respects the child's grade group, and ignores it when there is none", () => {
    const rows = [row({ subjects: ["english"], remedial: false, grade_groups: ["tyb"] })];
    expect(teacherSupplyForKeys(rows, [K.tutorEnglish], "zh", NOW)[K.tutorEnglish]).toBe(false);
    expect(teacherSupplyForKeys(rows, [K.tutorEnglish], "tyb", NOW)[K.tutorEnglish]).toBe(true);
    expect(teacherSupplyForKeys(rows, [K.tutorEnglish], null, NOW)[K.tutorEnglish]).toBe(true);
  });
  it("counts only teachers who are shown right now", () => {
    const hidden = [
      row({ listing_state: "pending" }),
      row({ listing_state: "archived" }),
      row({ paused_until: "2026-10-09T00:00:00Z" }),
    ];
    expect(teacherSupplyForKeys(hidden, [K.remedialMath], "ag", NOW)[K.remedialMath]).toBe(false);
  });
  it("agrees with the search itself: a key is open exactly when a location-free search returns someone", () => {
    const rows = [
      row({ id: "a", subjects: ["math"], remedial: true, grade_groups: ["ag"] }),
      row({ id: "b", subjects: ["english"], remedial: false, grade_groups: ["zh", "tyb"], languages: ["אנגלית"] }),
    ];
    for (const grade of ["ag", "dv", "zh", "tyb"] as const) {
      const supply = teacherSupplyForKeys(rows, all, grade, NOW);
      for (const key of all) {
        const s = teacherSearchFromKey(key);
        const found = matchTeachers(rows, input({ subject: s.subject, remedial: s.remedial, gradeGroup: grade, language: "" }), NOW).length > 0;
        expect(supply[key], `${key} / ${grade}`).toBe(found);
      }
    }
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

  it("says why a teacher outside the area is there: a neighbouring region, or online", () => {
    // המסך כותב את התווית לפי הסיבות האלה, ולא לפי מה שההורה סימן בטופס.
    const rows = [
      row({ id: "online-far", regions: ["אילת"], online: true }),
      row({ id: "neighbour", regions: ["תל אביב"] }),
      row({ id: "neighbour-online", regions: ["תל אביב"], online: true }),
    ];
    const out = matchTeachers(rows, input({ city: "כפר סבא", region: "דרום השרון" }), NOW);
    const reasons = (id: string) => out.find((m) => m.teacher.id === id)!.reasons;
    expect(reasons("online-far")).toContain("אונליין");
    expect(reasons("online-far")).not.toContain("אזור סמוך");
    expect(reasons("neighbour")).toContain("אזור סמוך");
    expect(reasons("neighbour")).not.toContain("אונליין");
    expect(reasons("neighbour-online")).toEqual(expect.arrayContaining(["אזור סמוך", "אונליין"]));
    for (const m of out) expect(m.inRequestedArea).toBe(false);
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

// ההבטחה לבעלים (3/10/2026), כפי שנוסחה לו: "אף מורה לא מדולגת, והמרחק נשאר
// ראשון. ההתאמה לקושי משנה את הסדר רק בין מורות מאותו אזור." הדוגמה שלו:
// חיפוש בתל אביב, ומורה מתאימה יותר בבאר שבע.
describe("the difficulties in the background: a preference inside the area, never a filter", () => {
  const TLV = { city: "תל אביב", region: "גוש דן" };

  it("the owner's example: a Tel Aviv search does not skip the Tel Aviv teacher for one in Beer Sheva", () => {
    const rows = [
      row({ id: "beer-sheva-expert", regions: ["באר שבע"], expertise: ["attention"] }),
      row({ id: "beer-sheva-expert-online", regions: ["באר שבע"], online: true, expertise: ["attention"] }),
      row({ id: "tel-aviv-plain", regions: ["תל אביב"] }),
    ];
    const out = matchTeachers(rows, input({ ...TLV, needs: ["attention"] }), NOW);
    const ids = out.map((m) => m.teacher.id);
    // באר שבע אינה אזור סמוך לגוש דן: בלי אונליין המורה משם לא מוצגת בכלל,
    // ועם אונליין היא מוצגת אחרי המורה מתל אביב, מחוץ לאזור.
    expect(ids).toEqual(["tel-aviv-plain", "beer-sheva-expert-online"]);
    expect(out[0].inRequestedArea).toBe(true);
    expect(out[1].inRequestedArea).toBe(false);
  });

  it("inside the area, the teacher with the matching experience comes first - even over the exact city", () => {
    const rows = [
      row({ id: "same-city-plain", regions: ["תל אביב"] }),
      row({ id: "same-region-expert", regions: ["רמת גן"], expertise: ["attention"] }),
    ];
    const out = matchTeachers(rows, input({ ...TLV, needs: ["attention"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["same-region-expert", "same-city-plain"]);
    expect(out[0].needsMatched).toEqual(["attention"]);
    expect(out[1].needsMatched).toEqual([]);
    // בלי קשיים שצוינו הסדר חוזר להיות מרחק בלבד.
    expect(matchTeachers(rows, input(TLV), NOW).map((m) => m.teacher.id)).toEqual(["same-city-plain", "same-region-expert"]);
  });

  it("nobody is dropped for lacking the experience", () => {
    const rows = [row({ id: "plain" }), row({ id: "expert", expertise: ["literacy"] })];
    const out = matchTeachers(rows, input({ needs: ["literacy"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["expert", "plain"]);
  });

  it("the score the parent sees reflects it: full only with the declared experience", () => {
    const rows = [row({ id: "plain" }), row({ id: "expert", expertise: ["literacy"] })];
    const out = matchTeachers(rows, input({ needs: ["literacy"] }), NOW);
    const score = (id: string) => out.find((m) => m.teacher.id === id)!.score;
    expect(score("expert")).toBe(100);
    expect(score("plain")).toBeLessThan(100);
    // בלי קשיים שצוינו שניהם התאמה מלאה, כמו לפני השינוי.
    for (const m of matchTeachers(rows, input({}), NOW)) expect(m.score).toBe(100);
  });

  it("in a tutoring search, verified remedial training outranks experience that was only declared", () => {
    const rows = [
      row({ id: "tutor-plain", remedial: false }),
      row({ id: "tutor-declared", remedial: false, expertise: ["attention"] }),
      row({ id: "remedial-plain", remedial: true }),
      row({ id: "remedial-declared", remedial: true, expertise: ["attention"] }),
    ];
    const out = matchTeachers(rows, input({ remedial: false, needs: ["attention"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["remedial-declared", "remedial-plain", "tutor-declared", "tutor-plain"]);
    expect(out.map((m) => m.needCredit)).toEqual([1, 0.8, 0.6, 0]);
  });

  it("several difficulties: the more of them covered, the earlier", () => {
    const rows = [
      row({ id: "one", expertise: ["attention"] }),
      row({ id: "both", expertise: ["attention", "literacy"] }),
      row({ id: "none" }),
    ];
    const out = matchTeachers(rows, input({ needs: ["attention", "literacy"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["both", "one", "none"]);
  });

  it("the hard filters are untouched by it", () => {
    const rows = [row({ id: "wrong-subject", subjects: ["english"], expertise: ["attention"] }), row({ id: "right-subject" })];
    const out = matchTeachers(rows, input({ needs: ["attention"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["right-subject"]);
  });

  it("a paying teacher does not jump over a better fit", () => {
    const rows = [
      row({ id: "paying-plain", listing_state: "paying" }),
      row({ id: "trial-expert", listing_state: "trial", expertise: ["numeracy"] }),
    ];
    const out = matchTeachers(rows, input({ needs: ["numeracy"] }), NOW);
    expect(out.map((m) => m.teacher.id)).toEqual(["trial-expert", "paying-plain"]);
  });
});

describe("the door's supply", () => {
  it("counts teachers shown right now, and the subjects they cover", () => {
    const rows = [
      row({ subjects: ["math", "english"] }),
      row({ subjects: ["math"], listing_state: "archived" }),
      row({ subjects: ["reading_writing"], paused_until: "2026-12-01T00:00:00Z" }),
    ];
    expect(teacherDoorSupply(rows, NOW)).toEqual({ total: 1, subjects: ["math", "english"] });
    expect(teacherDoorSupply([], NOW)).toEqual({ total: 0, subjects: [] });
  });
});
