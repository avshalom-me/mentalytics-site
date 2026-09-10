import { describe, it, expect } from "vitest";
import type { KidsDomainResult } from "./kids-recommendations";
import {
  toTracksInput, buildSchoolSummary, interventionsTried, SCHOOL_DIAGNOSIS_KINDS,
  eligibilityDirections, acaExhaustionAdequate, acaSevere, type Ans,
} from "./school-report";
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

describe("eligibilityDirections - which committee route, if any", () => {
  const worked = { remedial: "done", inclusion: "done" } as const;

  it("opens nothing for a social or a behavioural finding", () => {
    expect(eligibilityDirections({ a_soc: "הרבה מאוד", a_beh: "הרבה מאוד" })).toEqual([]);
  });

  it("opens the emotional route on a real emotional finding, not on a slight one", () => {
    expect(eligibilityDirections({ a_emo: "מעט" })).toEqual([]);
    expect(eligibilityDirections({ a_emo: "הרבה" })).toEqual(["emotional"]);
    expect(eligibilityDirections({ a_emo: "הרבה מאוד" })).toEqual(["emotional"]);
  });

  it("needs the school to have worked the learning difficulty AND a bottom-5% subject", () => {
    const severe = { a_aca: "הרבה", dv_math: "5% מהכי נמוכים בכיתה" };
    expect(eligibilityDirections(severe)).toEqual([]);                                   // nothing tried
    expect(eligibilityDirections({ a_aca: "הרבה", c_aca_steps: worked })).toEqual([]);   // tried, not severe
    expect(eligibilityDirections({ ...severe, c_aca_steps: worked })).toEqual(["learning"]);
  });

  it("holds the route back while something the school said was needed is still open", () => {
    const A = { a_aca: "הרבה", ag_read: "5% מהכי מתקשים בכיתה", c_aca_steps: { ...worked, adhd_doc: "not_done" } };
    expect(eligibilityDirections(A)).toEqual([]);
    expect(eligibilityDirections({ ...A, c_aca_steps: { ...worked, adhd_doc: "not_needed" } })).toEqual(["learning"]);
  });

  it("reads the 5% wording of every age band, and nothing weaker", () => {
    expect(acaSevere({ ag_read: "5% מהכי מתקשים בכיתה" })).toBe(true);
    expect(acaSevere({ dv_math: "5% מהכי נמוכים בכיתה" })).toBe(true);
    expect(acaSevere({ tyb_verbal: "5%" })).toBe(true);
    expect(acaSevere({ zh_math: "10%" })).toBe(false);
    expect(acaSevere({ q1: "5%" })).toBe(false);   // not an academic key
  });

  it("counts an unanswered optional row as nothing said, not as a blocker", () => {
    expect(acaExhaustionAdequate({ c_aca_steps: worked })).toBe(true);
    expect(acaExhaustionAdequate({ c_aca_steps: { remedial: "done" } })).toBe(false);
    expect(acaExhaustionAdequate({ c_aca_steps: { remedial: "in_progress", inclusion: "done" } })).toBe(false);
  });

  it("carries the route into the engine's input", () => {
    expect(toTracksInput({ _grade: "ד", a_emo: "הרבה" }, TODAY)?.directions).toEqual(["emotional"]);
    expect(toTracksInput({ _grade: "ד", a_soc: "הרבה" }, TODAY)?.directions).toEqual([]);
  });
});

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

describe("the partial-information caveat", () => {
  it("says nothing when every item was answered", () => {
    const t = buildSchoolSummary(full, [], TODAY).text;
    expect(t).not.toContain("לא ידוע");
  });

  it("names the count when items were marked not known, and says how they were scored", () => {
    const t = buildSchoolSummary({ ...full, aq1__unk: true, aq2__unk: true, q5__unk: true }, [], TODAY).text;
    expect(t).toContain("3 פריטים סומנו");
    expect(t).toContain("נספרו כאילו הקושי אינו קיים");
  });

  it("counts only the flags that are actually set", () => {
    const t = buildSchoolSummary({ ...full, aq1__unk: true, aq2__unk: false }, [], TODAY).text;
    expect(t).toContain("פריט אחד סומן");
  });
});
