import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  TEACHER_FREE_LISTING,
  TEACHER_PRICE_GROSS,
  TEACHER_QUALIFICATION_KEYS,
  listingStateLabel,
  qualificationAllowsRemedial,
  qualificationNeedsCertificate,
} from "./teacher-options";
import { rankTeachers, matchTeachers, type TeacherRow } from "./teacher-match";
import { teacherCard } from "./teacher-card";
import { approvedHtml, signupReceivedHtml, teacherEmailPreview, TEACHER_EMAIL_PREVIEWS } from "./teacher-email-templates";
import { LEARNING_DIRECTORY_MIN_TO_INDEX, LEARNING_DOOR_PUBLIC, learningDirectoryIndexed, learningDirectoryRobots } from "./learning-door";

// שלוש החלטות של הבעלים מ-13/10/2026, והמקומות שבהם הן נאכפות:
//   1. "כרגע המודל חינם, בלי לכתוב מחיר עתידי."
//   2. "לא צריך תעודה ברישום, מלבד מי שהוא מורה לחינוך מיוחד ולתיקון למידה."
//   3. מאגר מורים עם חיפוש, "כמו בחלק של המטפלים".

const END = "2026-12-31T21:59:59.000Z";
const T = { full_name: "דנה לוי", edit_token: "tok_ABC-123" };
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const read = (file: string) => readFileSync(file, "utf8");

function row(over: Partial<TeacherRow>): TeacherRow {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    full_name: "מורה",
    gender: "נקבה",
    slug: "mora",
    subjects: ["math"],
    remedial: false,
    grade_groups: ["ag", "dv"],
    regions: ["כפר סבא"],
    online: false,
    languages: ["עברית"],
    listing_state: "trial",
    paused_until: null,
    bio: null,
    phone: null,
    price_text: null,
    qualification: "teaching_cert",
    photo_path: null,
    experience_years: null,
    expertise: [],
    focuses: [],
    lesson_settings: [],
    ...over,
  };
}

describe("המאגר חינם למורים, בלי מחיר עתידי", () => {
  it("המתג דלוק, והמורה המוצג אינו נקרא 'בתקופת ניסיון'", () => {
    expect(TEACHER_FREE_LISTING).toBe(true);
    expect(listingStateLabel("trial")).not.toContain("ניסיון");
  });

  it("המיילים שמורה מקבל היום אינם נוקבים במחיר ואינם מזכירים תקופת ניסיון", () => {
    for (const p of TEACHER_EMAIL_PREVIEWS) {
      const t = text(teacherEmailPreview(p.key, END)?.html ?? "");
      expect(t, p.key).not.toContain(`${TEACHER_PRICE_GROSS} ש"ח`);
      expect(t, p.key).not.toContain("תקופת הניסיון");
      expect(t, p.key).not.toContain("?to=pay");
    }
    // מיילי הגבייה אינם ברשימה של מה שנשלח.
    const keys = TEACHER_EMAIL_PREVIEWS.map((p) => p.key as string);
    for (const billing of ["trial_ending", "trial_last_day", "payment_confirmed"]) expect(keys).not.toContain(billing);
  });

  it("מייל האישור בלי תאריך סיום אומר 'ללא תשלום'; עם תאריך (מצב הגבייה, כבוי) הוא עדיין מציין אותו", () => {
    const free = text(approvedHtml({ ...T, trial_ends_at: null }));
    expect(free).toContain("אינה כרוכה כרגע בתשלום");
    expect(free).not.toContain("תקופת הניסיון");
    const billed = text(approvedHtml({ ...T, trial_ends_at: END }));
    expect(billed).toContain("תקופת הניסיון");
    expect(billed).toContain("31 בדצמבר 2026");
  });

  it("העמודים שמורים והורים רואים אינם קוראים את קבועי המחיר ותקופת הניסיון", () => {
    for (const file of [
      "app/learning/page.tsx",
      "app/learning/join/page.tsx",
      "app/learning/join/JoinForm.tsx",
      "app/learning/teachers/page.tsx",
      "app/learning/teachers/TeachersDirectory.tsx",
      "app/learning/TeacherProfileFields.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toMatch(/TEACHER_PRICE_GROSS|TEACHER_TRIAL_DAYS|TEACHER_PAY_EMAIL_DAY/);
      expect(source, file).not.toMatch(/\d+\s*ש״ח לחודש/);
      expect(source, file).not.toContain("—");
    }
  });

  it("הקרון, האישור באדמין וההרשמה לתשלום קוראים את המתג", () => {
    expect(read("app/api/cron/teacher-status/route.ts")).toMatch(/TEACHER_FREE_LISTING \? \[\] : planTrialActions\(/);
    expect(read("app/api/admin-teachers/route.ts")).toMatch(/TEACHER_FREE_LISTING \? null :/);
    expect(read("app/api/teachers/subscribe/route.ts")).toContain("!TEACHER_FREE_LISTING &&");
    expect(read("app/api/teachers/profile/route.ts")).toContain("can_subscribe: !TEACHER_FREE_LISTING &&");
  });
});

describe("תעודה רק להוראה מתקנת ולחינוך מיוחד", () => {
  it("בדיוק שלוש ההכשרות שמאפשרות 'הוראה מתקנת' מחייבות תעודה", () => {
    const needing = TEACHER_QUALIFICATION_KEYS.filter((k) => qualificationNeedsCertificate(k));
    expect(needing.sort()).toEqual(["ld_masters", "remedial_cert", "special_ed_degree"]);
    for (const k of TEACHER_QUALIFICATION_KEYS) expect(qualificationNeedsCertificate(k), k).toBe(qualificationAllowsRemedial(k));
    expect(qualificationNeedsCertificate(null)).toBe(false);
    expect(qualificationNeedsCertificate("teaching_cert")).toBe(false);
    expect(qualificationNeedsCertificate("student")).toBe(false);
  });

  it("הכרטיס נושא 'תעודה נבדקה' רק למי שהכשרתו מחייבת תעודה", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    const [tutor] = rankTeachers([row({ qualification: "subject_degree" })], { subject: null, remedial: false, gradeGroup: null, city: null, region: null, onlineRequired: false, language: "", genderPreference: null }, now);
    const [remedial] = rankTeachers([row({ qualification: "remedial_cert", remedial: true })], { subject: null, remedial: false, gradeGroup: null, city: null, region: null, onlineRequired: false, language: "", genderPreference: null }, now);
    expect(teacherCard(tutor, null).certificate_checked).toBe(false);
    expect(teacherCard(remedial, null).certificate_checked).toBe(true);
  });

  it("המיילים אומרים 'נבדוק את התעודה' ו'בדקנו את התעודה' רק למי שצירף אחת", () => {
    expect(text(signupReceivedHtml({ ...T, needs_certificate: true }))).toContain("נבדוק את התעודה שצירפת");
    const tutor = text(signupReceivedHtml(T));
    expect(tutor).toContain("נעבור על הפרטים");
    expect(tutor).not.toContain("תעודה");
    expect(text(approvedHtml({ ...T, trial_ends_at: null, certificate_checked: true }))).toContain("בדקנו את התעודה");
    const approvedTutor = text(approvedHtml({ ...T, trial_ends_at: null }));
    expect(approvedTutor).toContain("הפרופיל שלך אושר");
    expect(approvedTutor).not.toContain("תעודה");
  });

  it("הטופס מבקש תעודה רק כשהיא נדרשת, והאישור באדמין דורש אותה רק אז", () => {
    const form = read("app/learning/join/JoinForm.tsx");
    expect(form).toContain("if (needsCertificate && !cert)");
    expect(form).not.toMatch(/if \(!cert\)/);
    expect(read("app/api/admin-teachers/route.ts")).toContain("if (needsCert && !t.certificate_path && !t.approved_at && body.without_certificate !== true)");
  });

  it("התג 'מאומת' אינו מוצג למורה שהכשרתו לפי הצהרה, ונשאר ברירת המחדל למטפלים", () => {
    expect(read("app/learning/TeacherResults.tsx")).toContain('verifiedLabel={t.certificate_checked ? "✓ תעודה נבדקה" : null}');
    expect(read("app/components/MatchResultCard.tsx")).toContain('verifiedLabel = "✓ מאומת"');
    expect(read("app/learning/t/[slug]/page.tsx")).not.toContain("ההכשרה אומתה");
  });
});

describe("מאגר המורים", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  const all = { subject: null, remedial: false, gradeGroup: null, city: null, region: null, onlineRequired: false, language: "", genderPreference: null } as const;

  it("מציג את כל המורים, בלי התקרה של החיפוש מתוך השאלון, ובאותו סדר", () => {
    const rows = Array.from({ length: 45 }, (_, i) => row({ id: `t${i}` }));
    const ranked = rankTeachers(rows, all, now);
    expect(ranked).toHaveLength(45);
    const capped = matchTeachers(rows, { ...all, limit: 20 }, now);
    expect(capped).toHaveLength(20);
    expect(capped.map((m) => m.teacher.id)).toEqual(ranked.slice(0, 20).map((m) => m.teacher.id));
  });

  it("מורה מוקפא או בארכיון אינו ברשימה, ובלי שפה מבוקשת אף מורה לא נושר בגלל שפה", () => {
    const rows = [
      row({ id: "ok" }),
      row({ id: "paused", paused_until: "2026-12-01T00:00:00Z" }),
      row({ id: "archived", listing_state: "archived" }),
      row({ id: "russian", languages: ["רוסית"] }),
    ];
    expect(rankTeachers(rows, all, now).map((m) => m.teacher.id).sort()).toEqual(["ok", "russian"]);
  });

  it("נכנס לאינדקס ול-sitemap רק מעל סף המורים, ורק כשהדלת פתוחה", () => {
    expect(learningDirectoryIndexed(0)).toBe(false);
    expect(learningDirectoryIndexed(LEARNING_DIRECTORY_MIN_TO_INDEX - 1)).toBe(false);
    expect(learningDirectoryIndexed(LEARNING_DIRECTORY_MIN_TO_INDEX)).toBe(LEARNING_DOOR_PUBLIC);
    expect(learningDirectoryRobots(0)).toEqual({ index: false, follow: LEARNING_DOOR_PUBLIC });
    expect(read("app/sitemap.ts")).toContain("learningDirectoryIndexed(listedTeachers)");
    expect(read("app/learning/teachers/page.tsx")).toContain("robots: learningDirectoryRobots(teachers.length)");
  });

  it("המורים לדוגמה מוצגים רק על מאגר ריק עם ?preview=1, ואין להם דרך פנייה", async () => {
    const { SAMPLE_TEACHERS } = await import("@/app/learning/teachers/sample-teachers");
    for (const t of SAMPLE_TEACHERS) {
      expect(t.phone, t.id).toBeNull();
      expect(t.slug, t.id).toBeNull();
      expect(t.full_name, t.id).toContain("לדוגמה");
    }
    expect(read("app/learning/teachers/TeachersDirectory.tsx")).toContain("const sample = preview && teachers.length === 0;");
  });
});
