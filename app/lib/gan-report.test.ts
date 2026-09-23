import { describe, it, expect } from "vitest";
import {
  ganLanguageFinding,
  ganFunctionalFinding,
  ganAutismFinding,
  ganRoutes,
  ganExhaustionMessage,
  toGanTracksInput,
} from "./gan-report";
import { buildSchoolSummary, SCHOOL_DIAGNOSIS_KINDS, GAN_DIAGNOSIS_KINDS, type Ans } from "./school-report";
import { GAN_DOC_KINDS } from "./school-tracks";

const TODAY = "2026-09-23";

describe("which kindergarten findings point where", () => {
  it("reads language from the three items the scoring sends to a speech therapist, not from rhyming alone", () => {
    expect(ganLanguageFinding({ gan_q4: "כן" })).toBe(true);
    expect(ganLanguageFinding({ gan_q1: "כן" })).toBe(true);
    expect(ganLanguageFinding({ gan_q3: "כן" })).toBe(false);
  });

  it("reads a functional direction from fine motor, an OT referral, three items at once, or a toddler's flag", () => {
    expect(ganFunctionalFinding({ gan_q5: "כן" })).toBe(true);
    expect(ganFunctionalFinding({ _findingKeys: { treatmentKeys: ["ריפוי בעיסוק"] } })).toBe(true);
    expect(ganFunctionalFinding({ gan_q1: "כן", gan_q2: "כן", gan_q3: "כן" })).toBe(true);
    expect(ganFunctionalFinding({ _grade: "פעוט", a_dev: "הרבה" })).toBe(true);
    expect(ganFunctionalFinding({ _grade: "פעוט", a_dev: "מעט" })).toBe(false);
    expect(ganFunctionalFinding({ _grade: "גן3", a_dev: "הרבה" })).toBe(false);
  });

  it("reads autism only from the full communication pattern the scoring reports", () => {
    const full = { soc3: "כן", comm1: "כן", comm2: "כן", comm3: "כן", comm_rigid: "כן" };
    expect(ganAutismFinding(full)).toBe(true);
    expect(ganAutismFinding({ ...full, comm_rigid: "לא" })).toBe(false);
    expect(ganAutismFinding({ ...full, comm3: "לא" })).toBe(false);
  });

  it("opens the developmental directions on the finding alone, and holds the emotional one behind attempts", () => {
    expect(ganRoutes({ gan_q4: "כן" }).live).toEqual(["language"]);
    const emo = { _found: ["emotional"] };
    expect(ganRoutes(emo)).toMatchObject({ live: [], pending: ["emotional"], missing: ["treatment", "system"] });
    expect(ganRoutes({ ...emo, c_gan_tried: { shach: "partial", gan_plan: "no_help" } }).live).toEqual(["emotional"]);
    // Paramedical therapy is recorded, but it is not the emotional route's treatment.
    expect(ganRoutes({ ...emo, c_gan_tried: { paramedical: "no_help", gan_plan: "no_help" } }).missing).toEqual(["treatment"]);
  });

  it("does not count an attempt that helped, and says why", () => {
    const r = ganRoutes({ _found: ["emotional"], c_gan_tried: { shach: "helped", parents: "helped" } });
    expect(r.helpedOnly).toEqual(["treatment", "system"]);
    expect(ganExhaustionMessage(r)).toContain("'הועיל' אינה נספרת כמיצוי");
  });

  it("takes a determination in the file as a direction of its own", () => {
    expect(ganRoutes({ c_diag: [{ kind: "אבחון קשיי תקשורת ASD", year: 2026 }] }).live).toEqual(["autism"]);
    expect(ganRoutes({ c_diag: [{ kind: "ועדת אבחון - חוק הסעד", year: 2025 }] }).live).toEqual(["intellectual"]);
  });
});

describe("toGanTracksInput", () => {
  it("serves the kindergarten grades only", () => {
    expect(toGanTracksInput({ _grade: "ד" }, TODAY)).toBeNull();
    expect(toGanTracksInput({ _grade: "גן" }, TODAY)?.grade).toBe("גן");
  });

  it("carries the teacher's statuses, and leaves 'not known' out", () => {
    const input = toGanTracksInput({
      _grade: "פעוט", _age: "2", gan_q4: "כן",
      c_team: "unknown", c_devcenter: "unknown", c_setting: "daycare", c_daycare: "considering",
    }, TODAY)!;
    expect(input.age).toBe(2);
    expect(input.team).toBeUndefined();
    expect(input.devCenter).toBeUndefined();
    expect(input.setting).toBe("daycare");
    expect(input.rehabDaycare).toBe("considering");
    expect(input.directions).toEqual(["language"]);
  });
});

describe("the kindergarten teacher's summary", () => {
  const A: Ans = {
    _audience: "counselor", c_role: "gan", _grade: "גן", _age: "5", c_duration: "over_year",
    a_emo: "הרבה", c_attend: "refusal", c_regulation: 2, c_isolation: 2, c_bully_victim: "suspected",
    c_fill: "with_parent", c_gan_tried: { shach: "partial", gan_plan: "no_help" },
    c_setting: "regular_support", c_devcenter: "waiting", c_team: "yes", c_extra_year: "considering",
  };

  it("is written in the kindergarten's words", () => {
    const t = buildSchoolSummary(A, [], TODAY, [{ key: "emotional", label: "🔵 תחום רגשי", result: { groups: [], externalNotes: [], standaloneWarnings: [] } }]).text;
    expect(t).toContain("סיכום לקראת הפניה - הילד/ה");
    expect(t).toContain("רמת הקושי לפי דיווח הגננת: הרבה");
    expect(t).toContain("כפי שנצפה בגן");
    expect(t).toContain("הגעה לגן: סירוב להגיע לגן");
    expect(t).toContain("קושי בוויסות בגן ובחצר: הרבה");
    expect(t).toContain("בידוד או דחייה חברתית בגן: הרבה");
    expect(t).toContain("נפגע/ת מילדים אחרים בגן: חשד");
    expect(t).not.toContain("בבית הספר");
  });

  it("reports the kindergarten's attempts, tips and statuses", () => {
    const t = buildSchoolSummary(A, [], TODAY).text;
    expect(t).toContain("התערבויות שנוסו בגן");
    expect(t).toContain("ייעוץ או תצפית של פסיכולוג/ית שפ\"ח: הועיל חלקית");
    expect(t).toContain("כלים והכוונה לצוות הגן");
    expect(t).toContain("ויסות בגן ובחצר");
    expect(t).toContain("מסגרת נוכחית: גן רגיל, עם תמיכה מסל השילוב");
    expect(t).toContain("הערכה במכון להתפתחות הילד: הופנו וממתינים לתור");
    expect(t).toContain("צוות רב-מקצועי בגן (מתי\"א): דן בילד/ה");
    expect(t).toContain("השארה בגן חובה שנה נוספת: בהתלבטות");
  });
});

describe("the two document lists", () => {
  it("keep the kindergarten's kinds off the counsellor's list and on the teacher's", () => {
    for (const k of GAN_DOC_KINDS) {
      expect(SCHOOL_DIAGNOSIS_KINDS).not.toContain(k);
      expect(GAN_DIAGNOSIS_KINDS).toContain(k);
    }
    expect(GAN_DIAGNOSIS_KINDS).not.toContain("פסיכו-דידקטי");
  });
});
