import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCHOOL_GRADES,
  EXTERNAL_DIAGNOSER_KEYS,
  DIAGNOSIS_KINDS,
  DISABILITY_CATEGORIES,
  ACCEPTABLE_BY_CATEGORY,
  diagnosisGate,
  eligibilityByCategory,
  isoAddDays,
  isoDiffDays,
  formatDateHe,
  israelToday,
  hebrewYearLabel,
  schoolYear,
  zakautWindow,
  hatamotAssessmentFloor,
  assessmentCurrency,
  mechanicalTracks,
  type SchoolTracksInput,
} from "./school-tracks";
import { mapSchoolTracks } from "./school-tracks-engine";
import { CLINICAL_RULES, PENDING_CLINICAL_DECISIONS, approvedRules } from "./school-tracks-clinical";
import { ASSESSMENT_TYPES } from "./therapist-options";
import { GA_GRADES, BV_GRADES, ZY_GRADES } from "../kids/quiz-logic";

const TODAY = "2026-09-02";
const base = (over: Partial<SchoolTracksInput> = {}): SchoolTracksInput => ({
  grade: "ד", today: TODAY, diagnoses: [], ...over,
});
const byKey = (tracks: ReturnType<typeof mechanicalTracks>, key: string) => tracks.find(t => t.key === key);
/**
 * A file whose findings opened a route to the committee.
 *
 * The eligibility tracks exist only on one: a questionnaire that raised a
 * social or a behavioural finding and nothing else gets no committee at all,
 * which is what the bare base() now stands for.
 */
const onRoute = (over: Partial<SchoolTracksInput> = {}) => base({ directions: ["emotional"], ...over });

describe("vocabulary shared with the kids questionnaire", () => {
  it("uses only grades the kids questionnaire knows", () => {
    const known = [...GA_GRADES, ...BV_GRADES, ...ZY_GRADES];
    for (const g of SCHOOL_GRADES) expect(known).toContain(g);
  });

  it("accepts every assessment type the questionnaire can recommend", () => {
    for (const t of ASSESSMENT_TYPES) expect(DIAGNOSIS_KINDS).toContain(t);
  });

  it("names external diagnosers with the exact keys the questionnaire parser emits", () => {
    const src = readFileSync(join(process.cwd(), "app", "lib", "kids-recommendations.ts"), "utf8");
    for (const key of EXTERNAL_DIAGNOSER_KEYS) {
      expect(src, `${key} is not a key in EXTERNAL_PATTERNS any more`).toContain(`key: "${key}"`);
    }
  });

  it("covers every category of the First Schedule", () => {
    for (const c of DISABILITY_CATEGORIES) expect(ACCEPTABLE_BY_CATEGORY[c].bodies.length).toBeGreaterThan(0);
  });
});

describe("diagnosisGate - the First Schedule as a function", () => {
  it("a child psychiatrist's diagnosis is acceptable for mental disorders and not for learning disability", () => {
    const d = { kind: "פסיכיאטר ילדים" as const, year: 2025 };
    expect(diagnosisGate(d, "הפרעות נפשיות")).toBe("acceptable");
    expect(diagnosisGate(d, "הפרעות התנהגותיות ורגשיות")).toBe("acceptable");
    expect(diagnosisGate(d, "AD(H)D")).toBe("acceptable");
    expect(diagnosisGate(d, "לקות למידה רב-בעייתית")).toBe("not_acceptable");
  });

  it("a psycho-didactic assessment guarantees the didactic half; the psychologist half must be named", () => {
    const unsigned = { kind: "פסיכו-דידקטי" as const, year: 2025 };
    expect(diagnosisGate(unsigned, "לקות למידה רב-בעייתית")).toBe("verify_signer");
    expect(diagnosisGate(unsigned, "AD(H)D")).toBe("verify_signer");
    expect(diagnosisGate(unsigned, "הפרעות נפשיות")).toBe("not_acceptable");
    // Naming the psychologist completes the Schedule's combination...
    expect(diagnosisGate({ ...unsigned, signedBy: "פסיכולוג מומחה" }, "לקות למידה רב-בעייתית")).toBe("acceptable");
    // ...or matches a body that is acceptable on its own, with the didactic part still attached.
    expect(diagnosisGate({ ...unsigned, signedBy: "פסיכולוג חינוכי" }, "לקות למידה רב-בעייתית")).toBe("acceptable");
    expect(diagnosisGate({ ...unsigned, signedBy: "פסיכולוג קליני" }, "לקות למידה רב-בעייתית")).toBe("not_acceptable");
  });

  it("a psychological evaluation of unknown specialty is 'verify the signer', not a yes and not a no", () => {
    const d = { kind: "הערכה פסיכולוגית" as const, year: 2025 };
    expect(diagnosisGate(d, "הפרעות התנהגותיות ורגשיות")).toBe("verify_signer");
    expect(diagnosisGate(d, "משכל גבולי")).toBe("verify_signer");
    expect(diagnosisGate(d, "הפרעות נפשיות")).toBe("not_acceptable");
  });

  it("becomes exact once the counsellor names the signer", () => {
    const d = { kind: "הערכה פסיכולוגית" as const, year: 2025, signedBy: "פסיכולוג קליני" as const };
    expect(diagnosisGate(d, "הפרעות התנהגותיות ורגשיות")).toBe("acceptable");
    expect(diagnosisGate(d, "AD(H)D")).toBe("not_acceptable");
  });

  it("an ASD assessment of unknown signer is 'verify' for ASD, because the Schedule requires a physician", () => {
    expect(diagnosisGate({ kind: "אבחון קשיי תקשורת ASD", year: 2025 }, "מוגבלות על רצף האוטיזם")).toBe("verify_signer");
    expect(diagnosisGate({ kind: "אבחון קשיי תקשורת ASD", year: 2025, signedBy: "רופא מומחה בפסיכיאטריה של ילדים ונוער" }, "מוגבלות על רצף האוטיזם")).toBe("acceptable");
  });

  it("documents with no committee meaning are not acceptable anywhere", () => {
    for (const c of DISABILITY_CATEGORIES) {
      expect(diagnosisGate({ kind: "אבחון תעסוקתי", year: 2025 }, c)).toBe("not_acceptable");
      expect(diagnosisGate({ kind: "הערכת בשלות לגן", year: 2025 }, c)).toBe("not_acceptable");
    }
  });

  it("eligibilityByCategory keeps the best result per category", () => {
    const e = eligibilityByCategory([
      { kind: "הערכה פסיכולוגית", year: 2024 },
      { kind: "פסיכיאטר ילדים", year: 2025 },
    ]);
    expect(e["הפרעות התנהגותיות ורגשיות"]).toBe("acceptable");
    expect(e["משכל גבולי"]).toBe("verify_signer");
    expect(e["מוגבלות בראייה"]).toBe("not_acceptable");
  });
});

describe("dates", () => {
  it("adds and diffs ISO days without a timezone in sight", () => {
    expect(isoAddDays("2027-03-20", 21)).toBe("2027-04-10");
    expect(isoDiffDays("2026-09-02", "2027-03-31")).toBe(210);
    expect(formatDateHe("2027-03-31")).toBe("31.3.2027");
  });

  it("reads today's date in Israel even when the clock is UTC", () => {
    // 23:30 UTC on 1 September is already 2 September in Israel (UTC+3).
    expect(israelToday(new Date("2026-09-01T23:30:00Z"))).toBe("2026-09-02");
    expect(israelToday(new Date("2026-09-01T20:30:00Z"))).toBe("2026-09-01");
  });

  it("writes Hebrew year labels the way people type them", () => {
    expect(hebrewYearLabel(5787)).toBe('תשפ"ז');
    expect(hebrewYearLabel(5785)).toBe('תשפ"ה');
    expect(hebrewYearLabel(5775)).toBe('תשע"ה');
    expect(hebrewYearLabel(5715)).toBe('תשט"ו');
    expect(hebrewYearLabel(5716)).toBe('תשט"ז');
    expect(hebrewYearLabel(5790)).toBe('תש"צ');
    expect(hebrewYearLabel(5800)).toBe('ת"ת');
  });

  it("starts the school year on 1 September and names it for the Hebrew year", () => {
    expect(schoolYear("2026-09-02")).toEqual({ start: 2026, hebrew: 'תשפ"ז', label: 'תשפ"ז (2026/27)' });
    expect(schoolYear("2027-03-31").start).toBe(2026);
    expect(schoolYear("2027-08-31").start).toBe(2026);
    expect(schoolYear("2027-09-01").start).toBe(2027);
    // The circular dated December 2024 calls itself תשפ"ה.
    expect(schoolYear("2024-12-09").hebrew).toBe('תשפ"ה');
  });

  it("opens the referral window until 31 March and closes it until 1 September", () => {
    const open = zakautWindow("2026-09-02");
    expect(open.open).toBe(true);
    expect(open.deadline).toBe("2027-03-31");
    expect(open.daysLeft).toBe(210);
    expect(open.committeesFinishBy).toBe("2027-05-15");
    expect(open.followUpAfterAssessmentBy).toBe("2027-07-15");
    expect(open.placementYear).toBe('תשפ"ח (2027/28)');

    expect(zakautWindow("2027-03-31").open).toBe(true);
    expect(zakautWindow("2027-03-31").daysLeft).toBe(0);

    const closed = zakautWindow("2027-04-01");
    expect(closed.open).toBe(false);
    expect(closed.daysLeft).toBeNull();
    expect(closed.nextOpens).toBe("2027-09-01");
  });

  it("puts the accommodations assessment floor at 1 July of the student's own grade-ו summer", () => {
    expect(hatamotAssessmentFloor("ז", TODAY)).toBe("2026-07-01");
    expect(hatamotAssessmentFloor("י", TODAY)).toBe("2023-07-01");
    expect(hatamotAssessmentFloor("יב", TODAY)).toBe("2021-07-01");
    expect(hatamotAssessmentFloor("א", TODAY)).toBe("2032-07-01");
  });

  it("judges an assessment's currency by the floor, and admits when only the year is known", () => {
    expect(assessmentCurrency({ kind: "פסיכו-דידקטי", year: 2022 }, "י", TODAY)).toBe("too_early");
    expect(assessmentCurrency({ kind: "פסיכו-דידקטי", year: 2023 }, "י", TODAY)).toBe("verify_month");
    expect(assessmentCurrency({ kind: "פסיכו-דידקטי", year: 2024 }, "י", TODAY)).toBe("valid");
    expect(assessmentCurrency({ kind: "פסיכיאטר ילדים", year: 2025 }, "י", TODAY)).toBe("not_for_hatamot");
  });
});

describe("mechanicalTracks", () => {
  it("always starts with the school team, primary until it has convened", () => {
    expect(byKey(mechanicalTracks(base()), "school_team")?.relevance).toBe("primary");
    expect(byKey(mechanicalTracks(base({ schoolTeam: { convened: true } })), "school_team")?.relevance).toBe("info");
  });

  it("says nothing at all about committees when no rubric opened a route", () => {
    const t = mechanicalTracks(base());
    expect(byKey(t, "zakaut")).toBeUndefined();
    expect(byKey(t, "assessment")).toBeUndefined();
    expect(byKey(t, "school_team")?.steps.join(" ")).not.toContain("ועדת זכאות");
  });

  it("does not send a child without an acceptable diagnosis to the eligibility committee", () => {
    const z = byKey(mechanicalTracks(onRoute()), "zakaut");
    expect(z?.relevance).toBe("info");
    expect(z?.why.join(" ")).toContain("אבחון קודם");
    expect(byKey(mechanicalTracks(onRoute()), "assessment")).toBeDefined();
  });

  it("names the route it is checking, and checks the file against that route's categories only", () => {
    const learning = byKey(mechanicalTracks(base({ directions: ["learning"] })), "zakaut");
    expect(learning?.why.join(" ")).toContain("לימודי/קשב");
    expect(learning?.why.join(" ")).toContain("לקות למידה רב-בעייתית");
    expect(learning?.why.join(" ")).not.toContain("הפרעות נפשיות");
  });

  it("reads the same document differently on the two routes", () => {
    // A child neurologist's attention diagnosis answers AD(H)D and answers
    // nothing on the emotional route - which is the whole reason the check is
    // per route rather than across all fourteen categories at once.
    const doc = [{ kind: "נוירולוג קשב" as const, year: 2025 }];
    expect(byKey(mechanicalTracks(base({ directions: ["learning"], diagnoses: doc })), "zakaut")?.relevance).toBe("consider");
    expect(byKey(mechanicalTracks(base({ directions: ["emotional"], diagnoses: doc })), "zakaut")?.relevance).toBe("info");
  });

  it("raises the committee to 'consider' once an acceptable diagnosis exists, and names the category", () => {
    const z = byKey(mechanicalTracks(onRoute({ diagnoses: [{ kind: "פסיכיאטר ילדים", year: 2025 }] })), "zakaut");
    expect(z?.relevance).toBe("consider");
    expect(z?.why.join(" ")).toContain("הפרעות התנהגותיות ורגשיות");
    // The same signature also answers 57, which is the only route it answers.
    const psych = byKey(mechanicalTracks(base({ directions: ["psychiatric"], diagnoses: [{ kind: "פסיכיאטר ילדים", year: 2025 }] })), "zakaut");
    expect(psych?.why.join(" ")).toContain("הפרעות נפשיות");
    const psychOnly = byKey(mechanicalTracks(base({ directions: ["psychiatric"], diagnoses: [{ kind: "פסיכולוג חינוכי", year: 2025 }] })), "zakaut");
    expect(psychOnly?.relevance).toBe("info");
  });

  it("asks to verify the signer when that is all the document tells us", () => {
    const z = byKey(mechanicalTracks(onRoute({ diagnoses: [{ kind: "הערכה פסיכולוגית", year: 2025 }] })), "zakaut");
    expect(z?.relevance).toBe("consider");
    expect(z?.cautions.join(" ")).toContain("חתום");
  });

  it("states the statutory deadline and warns that the municipality may close earlier", () => {
    const z = byKey(mechanicalTracks(onRoute()), "zakaut");
    expect(z?.deadline?.date).toBe("2027-03-31");
    expect(z?.deadline?.note).toContain("מועד פנימי");
  });

  it("switches to the next window once 31 March has passed", () => {
    const z = byKey(mechanicalTracks(onRoute({ today: "2027-04-02" })), "zakaut");
    expect(z?.deadline?.date).toBe("2027-09-01");
    expect(z?.deadline?.label).toContain("חלף");
  });

  it("opens a 21-day appeal track after a decision, and closes it after", () => {
    const fresh = byKey(mechanicalTracks(onRoute({ zakaut: { status: "decided", decisionReceivedOn: "2026-08-25" } })), "zakaut_appeal");
    expect(fresh?.relevance).toBe("primary");
    expect(fresh?.deadline?.date).toBe("2026-09-15");

    const late = byKey(mechanicalTracks(onRoute({ zakaut: { status: "decided", decisionReceivedOn: "2026-07-01" } })), "zakaut_appeal");
    expect(late?.relevance).toBe("info");
    expect(late?.deadline?.label).toContain("חלף");
    expect(byKey(mechanicalTracks(onRoute({ zakaut: { status: "decided", decisionReceivedOn: "2026-07-01" } })), "zakaut")).toBeUndefined();
  });

  it("names the work when the findings point somewhere the file cannot yet follow", () => {
    const t = mechanicalTracks(base({ directions: [], pendingDirections: ["emotional"], exhaustionNote: "מומלץ להשלים X" }));
    const ex = byKey(t, "exhaustion");
    expect(ex?.relevance).toBe("primary");
    expect(ex?.why.join(" ")).toContain("רגשי/התנהגותי");
    expect(ex?.why.join(" ")).toContain("מומלץ להשלים X");
    // The committee itself is still not named: the route is not live.
    expect(byKey(t, "zakaut")).toBeUndefined();
  });

  it("warns that 57 takes a psychiatrist and nothing else", () => {
    const z = byKey(mechanicalTracks(base({ directions: ["psychiatric"] })), "zakaut");
    expect(z?.cautions.join(" ")).toContain("פסיכיאטריה של ילדים ונוער");
    expect(z?.why.join(" ")).toContain("הפרעות נפשיות");
    expect(byKey(mechanicalTracks(base({ directions: ["emotional"] })), "zakaut")?.cautions.join(" "))
      .not.toContain("פסיכיאטריה של ילדים ונוער");
  });

  it("does not say the word accommodations before ח, in any track", () => {
    for (const grade of ["א", "ד", "ו", "ז"] as const) {
      const t = mechanicalTracks(onRoute({ grade }));
      expect(byKey(t, "hatamot")).toBeUndefined();
      expect(byKey(t, "hatamot_appeal")).toBeUndefined();
      expect(JSON.stringify(t)).not.toContain("התאמות בדרכי היבחנות");
    }
    expect(byKey(mechanicalTracks(onRoute({ grade: "ח" })), "hatamot")).toBeDefined();
  });

  it("spells out the assessment floor from ח onward", () => {
    expect(byKey(mechanicalTracks(base({ grade: "ח" })), "hatamot")?.why.join(" ")).toContain("1.7.2025");
  });

  it("makes grade י the year to consider accommodations", () => {
    expect(byKey(mechanicalTracks(base({ grade: "י" })), "hatamot")?.relevance).toBe("consider");
    expect(byKey(mechanicalTracks(base({ grade: "ח" })), "hatamot")?.relevance).toBe("info");
  });

  it("flags an assessment that predates the floor and never computes last year's round dates forward", () => {
    const h = byKey(mechanicalTracks(base({ grade: "י", diagnoses: [{ kind: "פסיכו-דידקטי", year: 2021 }] })), "hatamot");
    expect(h?.cautions.join(" ")).toContain("2021");
    expect(h?.cautions.join(" ")).toContain("1.7.2023");
    const steps = h?.steps.join(" ") ?? "";
    expect(steps).toContain('תשפ"ה');
    expect(steps).toContain("7.1.2025");
    expect(steps).not.toContain("7.1.2027");
  });

  it("opens the accommodations appeal with both windows and the conservative date first", () => {
    const a = byKey(mechanicalTracks(base({ grade: "יא", hatamot: { status: "district_decided", districtAnswerReceivedOn: "2026-08-25" } })), "hatamot_appeal");
    expect(a?.relevance).toBe("primary");
    expect(a?.deadline?.date).toBe("2026-09-08");
    expect(a?.deadline?.label).toContain("15.9.2026");
  });

  it("orders primary before consider before info", () => {
    const tracks = mechanicalTracks(base({ grade: "י", diagnoses: [{ kind: "פסיכיאטר ילדים", year: 2025 }] }));
    const ranks = tracks.map(t => ({ primary: 0, consider: 1, info: 2 })[t.relevance]);
    expect(ranks).toEqual([...ranks].sort());
  });

  it("stamps every track with the source it was verified against", () => {
    for (const t of mechanicalTracks(onRoute({ grade: "י", zakaut: { status: "decided", decisionReceivedOn: "2026-08-25" } }))) {
      expect(t.verified.length).toBeGreaterThan(0);
      expect(t.officialLinks.length).toBeGreaterThan(0);
    }
  });

  it("keeps the source but drops the link off a committee route", () => {
    // The school team's only official link is the eligibility committee's own
    // portal, and its name is the committee's name - the one thing the map is
    // deliberately not saying here. The provenance stamp still stands.
    const team = mechanicalTracks(base())[0];
    expect(team.verified.length).toBeGreaterThan(0);
    expect(team.officialLinks).toEqual([]);
  });
});

describe("clinical layer", () => {
  it("lets nothing clinical reach a counsellor unreviewed", () => {
    expect(CLINICAL_RULES.length).toBeGreaterThan(0);
    for (const r of approvedRules()) expect(r.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("raises the attendance officer on school refusal, now that the rule is approved", () => {
    const t = mapSchoolTracks(base({ risk: { schoolRefusal: true } }));
    const kabas = t.find(x => x.key === "attendance");
    expect(kabas?.relevance).toBe("primary");
    expect(kabas?.steps.join(" ")).toContain("קב\"ס");
    // The cause before the enforcement - the rule says so in its own steps.
    expect(kabas?.steps.join(" ")).toContain("הטיפול בסיבה קודם לאכיפה");
    expect(mapSchoolTracks(base()).find(x => x.key === "attendance")).toBeUndefined();
  });

  it("requires a review date on every approved rule", () => {
    for (const r of CLINICAL_RULES) if (r.status === "approved") expect(r.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ignores draft rules at runtime", () => {
    // Suicidality and the learning-findings promotion are both still drafts, so
    // neither shows up; school refusal is left out here because its rule is not.
    const input = base({ grade: "ז", risk: { suicidality: true }, findings: { assessmentKeys: ["פסיכו-דידקטי"], treatmentKeys: [], externalKeys: [] } });
    expect(mapSchoolTracks(input)).toEqual(mechanicalTracks(input));
  });

  it("applies a rule once it is approved", () => {
    const input = base({ grade: "ז", risk: { suicidality: true } });
    const rule = CLINICAL_RULES.find(r => r.id === "risk.suicidality")!;
    const out = mapSchoolTracks(input, [{ ...rule, status: "approved", reviewedOn: "2026-09-02" }]);
    expect(out[0].key).toBe("risk_protocol");
    expect(out[0].relevance).toBe("primary");
  });

  it("publishes its open questions", () => {
    expect(PENDING_CLINICAL_DECISIONS.length).toBeGreaterThanOrEqual(5);
  });
});
