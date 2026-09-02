import { describe, it, expect } from "vitest";
import type { KidsDomainResult } from "./kids-recommendations";
import { toTracksInput, buildSchoolSummary, interventionsTried, SCHOOL_DIAGNOSIS_KINDS, type Ans } from "./school-report";
import { mapSchoolTracks } from "./school-tracks-engine";

const TODAY = "2026-09-02";

/** A counsellor's answers: the questionnaire's own keys plus the c_ layer. */
const full: Ans = {
  _audience: "counselor", _age: "10", _grade: "ד", c_duration: "over_year",
  a_emo: "הרבה", q1: 4, aq_tot: 19, q3: 2,
  c_attend: "frequent", c_change: "כן",
  a_aca: "הרבה", c_support: "partial", c_org: 2,
  a_soc: "הרבה", soc1: "כן", c_isolation: 2, c_bully_victim: "suspected",
  c_fill: "phone_parent", c_parents: "aware_consent",
  c_tried: { talks: "helped", remedial: "no_help" },
  c_diag: [{ kind: "פסיכיאטר ילדים", year: 2025 }],
  c_team: "yes", c_zakaut: "none", c_hatamot: "none", c_economic: "yes",
};

const anxietyDomain: KidsDomainResult = {
  groups: [{
    treatmentKey: "CBT", treatmentLabel: "טיפול CBT לחרדה", kind: "treatment", urgent: false,
    recs: [{
      id: "r1", domain: "emotional", symptoms: ["📊 נמצאו סימנים לחרדה"], kind: "treatment",
      treatmentKey: "CBT", treatmentLabel: "טיפול CBT לחרדה", referralText: "✅ הפנייה: טיפול CBT לחרדה", tools: [], urgent: false,
    }],
  }],
  externalNotes: [],
  standaloneWarnings: [{ text: "⚠️ מומלץ לשלול גורם רפואי לפני הטיפול", urgent: false }],
};

describe("toTracksInput", () => {
  it("needs a school grade and nothing else", () => {
    expect(toTracksInput({}, TODAY)).toBeNull();
    expect(toTracksInput({ _grade: "גן" }, TODAY)).toBeNull();
    expect(toTracksInput({ _grade: "ז" }, TODAY)?.grade).toBe("ז");
  });

  it("carries the counsellor layer into the engine's vocabulary", () => {
    const input = toTracksInput(full, TODAY)!;
    expect(input.schoolTeam).toEqual({ convened: true });
    expect(input.zakaut).toEqual({ status: "none", decisionReceivedOn: undefined });
    expect(input.interventionsTried).toBe(2);
    expect(input.economicConstraint).toBe(true);
    expect(input.risk).toEqual({ suicidality: false, schoolRefusal: false });
    expect(input.diagnoses).toEqual([{ kind: "פסיכיאטר ילדים", year: 2025 }]);
  });

  it("reads suicidality from the questionnaire's own screen, and refusal from the attendance answer", () => {
    expect(toTracksInput({ ...full, q3_sui: "כן", c_attend: "refusal" }, TODAY)?.risk).toEqual({ suicidality: true, schoolRefusal: true });
  });

  it("counts an intervention as tried whatever its outcome", () => {
    expect(interventionsTried({ c_tried: { talks: "no_help" } })).toBe(1);
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
  const { text, html } = buildSchoolSummary(full, tracks, TODAY, [{ label: "🔵 תחום רגשי", result: anxietyDomain }]);

  it("opens with the date and the fill mode, and closes with the disclaimer", () => {
    expect(text.startsWith("סיכום לקראת הפניה - התלמיד/ה")).toBe(true);
    expect(text).toContain("2.9.2026");
    expect(text).toContain("בשיחת טלפון עם הורה");
    expect(text.trim().endsWith("אינו מכיל פרטים מזהים.")).toBe(true);
  });

  it("writes the questionnaire's own findings and referral per domain, without the emoji", () => {
    expect(text).toContain("\nתחום רגשי\n");
    expect(text).toContain("ממצאים: נמצאו סימנים לחרדה");
    expect(text).toContain("הפניה מומלצת: טיפול CBT לחרדה (טיפול)");
    expect(text).toContain("מומלץ לשלול גורם רפואי");
    expect(text).not.toContain("📊");
    expect(text).not.toContain("🔵");
  });

  it("drops the engine's 'consult the school counsellor' line from a counsellor's own summary", () => {
    const withSelfReferral: KidsDomainResult = {
      ...anxietyDomain,
      groups: [...anxietyDomain.groups, {
        treatmentKey: "יועצת בית ספר", treatmentLabel: "התייעצות עם יועצת בית הספר", kind: "external", urgent: false,
        recs: [{ id: "r2", domain: "academic", symptoms: [], kind: "external", treatmentKey: "יועצת בית ספר", treatmentLabel: "התייעצות עם יועצת בית הספר", referralText: "", tools: [], urgent: false }],
      }],
    };
    const t = buildSchoolSummary(full, tracks, TODAY, [{ label: "📚 תחום לימודי", result: withSelfReferral }]).text;
    expect(t).toContain("טיפול CBT לחרדה");
    expect(t).not.toContain("התייעצות עם יועצת בית הספר");
  });

  it("writes what the school reported and stays silent about what was not answered", () => {
    expect(text).toContain("ביקור סדיר: היעדרויות תכופות");
    expect(text).toContain("שינוי חד בהתנהגות");
    expect(text).toContain("קושי בהתארגנות (ציוד, שיעורי בית, זמנים): הרבה");
    expect(text).toContain("נפגע/ת מהצקות או חרם: חשד");
    expect(text).not.toContain("ויסות בכיתה");   // not answered
  });

  it("lists the interventions with their outcomes, then the ones not tried", () => {
    expect(text).toContain("שיחות פרטניות עם מחנכ/ת או יועצת: הועיל");
    expect(text).toContain("הוראה מתקנת או תגבור לימודי: לא הועיל");
    expect(text).toContain("טרם נוסו: תוכנית התנהגותית");
  });

  it("records the file and the family in the committee's terms", () => {
    expect(text).toContain("אבחנה של פסיכיאטר/ית ילדים ונוער (2025)");
    expect(text).toContain("צוות רב-מקצועי: התכנס");
    expect(text).toContain("ועדת זכאות ואפיון: לא הופנה/תה");
    expect(text).toContain("קיימת מגבלה כלכלית מוכרת");
  });

  it("names the tracks the map raised, with their deadlines, and never the informational ones", () => {
    expect(text).toContain("ועדת זכאות ואפיון (לשיקול) - הפניה עד 31.3.2027");
    expect(text).not.toContain("(מידע)");
  });

  it("mirrors the text as HTML with headings and lists, escaped", () => {
    expect(html).toContain("<h2>סיכום לקראת הפניה - התלמיד/ה</h2>");
    expect(html).toContain("<h3>תחום רגשי</h3><ul><li>");
    expect(html).not.toContain("<script");
  });

  it("stays quiet when there is nothing to say", () => {
    const bare = buildSchoolSummary({ _grade: "ח" }, [], TODAY).text;
    expect(bare).toContain("כיתה ח");
    expect(bare).not.toContain("התערבויות");
    expect(bare).not.toContain("תחום");
  });
});
