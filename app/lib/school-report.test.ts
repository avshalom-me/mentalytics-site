import { describe, it, expect } from "vitest";
import type { KidsDomainResult } from "./kids-recommendations";
import {
  toTracksInput, buildSchoolSummary, SCHOOL_DIAGNOSIS_KINDS, emotionalAloneCaveat,
  eligibilityDirections, eligibilityRoutes, acaExhaustionAdequate, acaProfileQualifies,
  psychiatricSeverity, exhaustionMessage, INTERVENTIONS, type Ans,
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
  c_fill: "phone_parent",
  c_tried: { talks: "partial", shach: "no_help" },
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

describe("eligibilityRoutes - which committee route, if any", () => {
  const worked = { remedial: "done", inclusion: "done" } as const;
  /** The floor under every referral: one treatment attempt and one system attempt, neither of which sufficed. */
  const attempts = { c_tried: { shach: "partial", talks: "no_help" } } as const;
  const nothing = { live: [], pending: [], missing: [], helpedOnly: [], ladderPending: false };

  it("opens nothing for a social or a behavioural finding", () => {
    expect(eligibilityRoutes({ a_soc: "הרבה מאוד", a_beh: "הרבה מאוד", ...attempts })).toEqual(nothing);
  });

  it("opens the emotional route on a real emotional finding, not on a slight one", () => {
    expect(eligibilityDirections({ a_emo: "מעט", ...attempts })).toEqual([]);
    expect(eligibilityDirections({ a_emo: "הרבה", ...attempts })).toEqual(["emotional"]);
  });

  it("raises 57 beside 55 only where the questionnaire found what 57 is for", () => {
    expect(eligibilityDirections({ a_emo: "הרבה", ...attempts })).toEqual(["emotional"]);
    expect(eligibilityDirections({ a_emo: "הרבה", q3_sui: "כן", ...attempts })).toEqual(["emotional", "psychiatric"]);
    expect(eligibilityDirections({ a_emo: "הרבה", q7a: "כן", ...attempts })).toEqual(["emotional", "psychiatric"]);
    expect(eligibilityDirections({ a_emo: "הרבה", aq_tot: 21, ...attempts })).toEqual(["emotional", "psychiatric"]);
    expect(eligibilityDirections({ a_emo: "הרבה", q3: 3, mq_tot: 4, ...attempts })).toEqual(["emotional", "psychiatric"]);
  });

  it("raises 57 even where the opening screen was ticked only 'מעט'", () => {
    expect(eligibilityDirections({ a_emo: "מעט", q3_sui: "כן", ...attempts })).toEqual(["psychiatric"]);
    expect(psychiatricSeverity({ aq_tot: 20 })).toBe(false);
    expect(psychiatricSeverity({ aq_tot: 21 })).toBe(true);
  });

  it("makes reading the anchor of the learning profile, and needs a second domain beside anything else", () => {
    expect(acaProfileQualifies({ dv_read: "5% מהכי נמוכים בכיתה" })).toBe(true);
    expect(acaProfileQualifies({ dv_math: "5% מהכי נמוכים בכיתה" })).toBe(false);
    expect(acaProfileQualifies({ dv_math: "5% מהכי נמוכים בכיתה", dv_read: "10% מהכי נמוכים בכיתה" })).toBe(true);
    expect(acaProfileQualifies({ dv_math: "5% מהכי נמוכים בכיתה", dv_comp: "כן" })).toBe(true);
    expect(acaProfileQualifies({ dv_comp: "כן" })).toBe(false);
    expect(acaProfileQualifies({})).toBe(false);
  });

  it("needs the school to have worked the learning difficulty as well as the profile", () => {
    const profile = { a_aca: "הרבה", dv_read: "5% מהכי נמוכים בכיתה", ...attempts };
    expect(eligibilityDirections(profile)).toEqual([]);                                             // ladder untouched
    expect(eligibilityDirections({ a_aca: "הרבה", c_aca_steps: worked, ...attempts })).toEqual([]);  // no profile
    expect(eligibilityDirections({ ...profile, c_aca_steps: worked })).toEqual(["learning"]);
  });

  it("says so, rather than nothing, when the profile is there and the ladder is not", () => {
    // Silence here left a counsellor who had marked "בתהליך" with no committee and no idea why.
    const r = eligibilityRoutes({ a_aca: "הרבה", dv_read: "5% מהכי נמוכים בכיתה", c_aca_steps: { remedial: "in_progress" }, ...attempts });
    expect(r.live).toEqual([]);
    expect(r.pending).toEqual(["learning"]);
    expect(r.ladderPending).toBe(true);
    expect(exhaustionMessage(r)).toContain("הוראה מתקנת ותמיכה מסל השילוב");
    expect(exhaustionMessage(r)).toContain("ולאחר מכן");
  });

  it("holds the route back while something the school said was needed is still open", () => {
    const A = { a_aca: "הרבה", ag_read: "5% מהכי מתקשים בכיתה", ...attempts, c_aca_steps: { ...worked, adhd_doc: "not_done" } };
    expect(eligibilityDirections(A)).toEqual([]);
    expect(eligibilityDirections({ ...A, c_aca_steps: { ...worked, adhd_doc: "not_needed" } })).toEqual(["learning"]);
  });

  it("counts an unanswered optional row as nothing said, not as a blocker", () => {
    expect(acaExhaustionAdequate({ c_aca_steps: worked })).toBe(true);
    expect(acaExhaustionAdequate({ c_aca_steps: { remedial: "done" } })).toBe(false);
    expect(acaExhaustionAdequate({ c_aca_steps: { remedial: "in_progress", inclusion: "done" } })).toBe(false);
  });

  it("holds every route behind one treatment attempt and one system attempt", () => {
    const finding = { a_emo: "הרבה" };
    expect(eligibilityRoutes(finding)).toMatchObject({ live: [], pending: ["emotional"], missing: ["treatment", "system"] });
    expect(eligibilityRoutes({ ...finding, c_tried: { talks: "partial" } })).toMatchObject({ live: [], pending: ["emotional"], missing: ["treatment"] });
    expect(eligibilityRoutes({ ...finding, c_tried: { shach: "no_help" } })).toMatchObject({ live: [], pending: ["emotional"], missing: ["system"] });
    expect(eligibilityRoutes({ ...finding, ...attempts }).live).toEqual(["emotional"]);
  });

  it("does not count an attempt that helped - exhaustion is an attempt that did not suffice", () => {
    const r = eligibilityRoutes({ a_emo: "הרבה", c_tried: { shach: "helped", talks: "helped" } });
    expect(r.live).toEqual([]);
    expect(r.missing).toEqual(["treatment", "system"]);
    expect(r.helpedOnly).toEqual(["treatment", "system"]);
    expect(exhaustionMessage(r)).toContain("'הועיל' אינה נספרת כמיצוי");
    // One that helped beside one that did not: the one that did not is enough.
    expect(eligibilityRoutes({ a_emo: "הרבה", c_tried: { shach: "helped", external: "partial", talks: "no_help" } }).live).toEqual(["emotional"]);
  });

  it("counts the academic ladder as the treatment the learning route already had", () => {
    const A = { a_aca: "הרבה", dv_read: "5% מהכי נמוכים בכיתה", c_aca_steps: worked, c_tried: { talks: "partial" } };
    expect(eligibilityRoutes(A).live).toEqual(["learning"]);
  });

  it("carries the route, what is pending, and the sentence that says why", () => {
    const pending = toTracksInput({ _grade: "ד", a_emo: "הרבה" }, TODAY)!;
    expect(pending.directions).toEqual([]);
    expect(pending.pendingDirections).toEqual(["emotional"]);
    expect(pending.exhaustionNote).toContain("מיצוי אפשרויות");
    expect(pending.exhaustionNote).toContain("ולאחר מכן");

    const live = toTracksInput({ _grade: "ד", a_emo: "הרבה", ...attempts }, TODAY)!;
    expect(live.directions).toEqual(["emotional"]);
    expect(live.exhaustionNote).toBeUndefined();
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
    expect(input.risk).toEqual({ schoolRefusal: false, frequentAbsence: true });   // c_attend is "frequent"
    expect(input.duration).toBe("over_year");
    expect(input.academicSupport).toBe("partial");
    expect(input.diagnoses).toEqual([{ kind: "פסיכיאטר ילדים", year: 2025 }]);
    // Nothing the engine does not read travels into it.
    expect("interventionsTried" in input).toBe(false);
    expect("economicConstraint" in input).toBe(false);
  });

  it("reads refusal and frequent absence from the attendance answer, and nothing from 'not known'", () => {
    expect(toTracksInput({ ...full, c_attend: "refusal" }, TODAY)?.risk).toEqual({ schoolRefusal: true, frequentAbsence: false });
    expect(toTracksInput({ ...full, c_attend: "unknown", c_support: "unknown" }, TODAY)).toMatchObject({ risk: { schoolRefusal: false, frequentAbsence: false }, academicSupport: undefined });
  });

  it("no longer asks about remedial teaching twice", () => {
    // It lives in the academic ladder now - see ACA_STEPS.
    expect(INTERVENTIONS.map(i => i.key)).not.toContain("remedial");
    expect(INTERVENTIONS.some(i => i.kind === "treatment")).toBe(true);
    expect(INTERVENTIONS.some(i => i.kind === "system")).toBe(true);
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
    expect(text).toContain("מעורבות שפ\"ח או פסיכולוג/ית בית הספר: לא הועיל");
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

describe("בהתלבטות - a committee the team is still weighing", () => {
  // An emotional route that is live (both attempts recorded) and no diagnosis.
  const weighing: Ans = {
    _audience: "counselor", _grade: "ח", _age: "14", a_emo: "הרבה", aq_tot: 21,
    c_tried: { shach: "partial", talks: "no_help" }, c_team: "no",
    c_zakaut: "considering", c_diag: [],
  };

  it("reaches the engine as considering", () => {
    expect(toTracksInput(weighing, TODAY)?.zakaut?.status).toBe("considering");
  });

  it("writes what stands between the team and a decision, and the deadline, into the summary", () => {
    const tracks = mapSchoolTracks(toTracksInput(weighing, TODAY)!);
    const t = buildSchoolSummary(weighing, tracks, TODAY).text;
    expect(t).toContain("ועדת זכאות ואפיון: בהתלבטות. כדי להחליט חסר:");
    expect(t).toContain("אבחנה של פסיכיאטר/ית ילדים ונוער ל-57");
    expect(t).toContain("התכנסות הצוות הרב-מקצועי");
    // No duration was given, so it sits with consent under "לוודא".
    expect(t).toContain("קושי מתמשך (2-3 שנים לפחות): משך הקושי לא דווח");
    expect(t).toContain("הסכמת ההורים לפנייה");
    expect(t).toContain("מועד אחרון להפניה: 31.3.2027");
  });

  it("falls back to the bare answer when there is no track to take the reasons from", () => {
    expect(buildSchoolSummary({ ...full, c_zakaut: "considering" }, [], TODAY).text).toContain("ועדת זכאות ואפיון: בהתלבטות");
  });
});

describe("what the school gets back for what it reported", () => {
  it("gives two lines of guidance beside each observation it used to only echo", () => {
    const t = buildSchoolSummary({ ...full, c_regulation: 2 }, [], TODAY).text;
    expect(t).toContain("כלים והכוונה לצוות");
    expect(t).toContain("ויסות בכיתה ובהפסקות");
    expect(t).toContain("בידוד או דחייה חברתית");   // c_isolation is 2 in the fixture
    expect(t).toContain("חשד להצקות או לחרם");   // c_bully_victim is "suspected"
  });

  it("says nothing where nothing was reported", () => {
    expect(buildSchoolSummary({ _grade: "ח" }, [], TODAY).text).not.toContain("כלים והכוונה");
  });

  it("names the public route before the private one when money is the constraint", () => {
    expect(buildSchoolSummary(full, [], TODAY).text).toContain("אפשרויות ציבוריות");
    expect(buildSchoolSummary({ ...full, c_economic: "no" }, [], TODAY).text).not.toContain("אפשרויות ציבוריות");
  });
});

describe("what the counsellor herself said about each area", () => {
  const domains = [
    { key: "emotional", label: "🔵 תחום רגשי", result: anxietyDomain },
    { key: "social", label: "🤝 תחום חברתי", result: { groups: [], externalNotes: [], standaloneWarnings: [] } },
  ];

  it("opens each domain's section with the level she gave it, and says when the items found nothing", () => {
    const t = buildSchoolSummary({ ...full, a_soc: "מעט" }, [], TODAY, domains).text;
    expect(t).toContain("תחום רגשי\n- רמת הקושי לפי דיווח היועצת: הרבה");
    expect(t).toContain("תחום חברתי\n- רמת הקושי לפי דיווח היועצת: מעט\n- מהפריטים לא עלה ממצא");
  });

  it("puts a domain marked 'הרבה מאוד' first and marks it", () => {
    const t = buildSchoolSummary({ ...full, a_soc: "הרבה מאוד" }, [], TODAY, domains).text;
    expect(t.indexOf("תחום חברתי")).toBeLessThan(t.indexOf("תחום רגשי"));
    expect(t).toContain("רמת הקושי לפי דיווח היועצת: הרבה מאוד - בולט");
  });

  it("prints no level line for a domain the caller did not key", () => {
    expect(buildSchoolSummary(full, [], TODAY, [{ label: "🔵 תחום רגשי", result: anxietyDomain }]).text).not.toContain("רמת הקושי לפי דיווח");
  });
});

describe("what else the summary now says", () => {
  it("flags a diagnosis older than five years for the supervisor to confirm", () => {
    const t = buildSchoolSummary({ ...full, c_diag: [{ kind: "פסיכיאטר ילדים", year: 2019 }] }, [], TODAY).text;
    expect(t).toContain("(2019) - אבחון ישן, יש לוודא עם המפקח/ת או פסיכולוג/ית המסגרת שעדיין קביל");
    expect(buildSchoolSummary(full, [], TODAY).text).not.toContain("אבחון ישן");
  });

  it("names a kindergarten by its own label, not as a class", () => {
    expect(buildSchoolSummary({ _audience: "counselor", c_role: "gan", _grade: "גן", _age: "5" }, [], TODAY).text).toContain("- גן חובה, גיל 5");
    expect(buildSchoolSummary(full, [], TODAY).text).toContain("- כיתה ד, גיל 10");
  });

  it("asks for the event behind a sudden change", () => {
    expect(buildSchoolSummary(full, [], TODAY).text).toContain("שינוי חד בהתנהגות או במצב הרוח השנה - מצדיק בירור של אירוע לפני הפניה");
  });

  it("says when the emotional part was answered without the parents, and only then", () => {
    expect(emotionalAloneCaveat({ c_fill: "counselor_alone", a_emo: "הרבה" })).toContain("התחום הרגשי מולא ללא ההורים");
    expect(emotionalAloneCaveat({ c_fill: "counselor_alone" })).toBe("");
    expect(emotionalAloneCaveat({ c_fill: "with_parent", a_emo: "הרבה" })).toBe("");
    expect(buildSchoolSummary({ ...full, c_fill: "counselor_alone" }, [], TODAY).text).toContain("היעדר ממצא בו אינו שולל קושי");
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
