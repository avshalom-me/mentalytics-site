import { describe, it, expect } from "vitest";
import { adultResultKeys, kidsResultKeys } from "./quiz-result-facts";
import { generalizeFinding, isSuicidalityText, GENERAL_EMOTIONAL_FINDING } from "./sensitive-findings";
import type { KidsDomainResult, KidsRecommendation } from "./kids-recommendations";

const rec = (id: string, treatment: string, professionalType?: string) => ({ id, treatment, professionalType });

describe("adultResultKeys", () => {
  it("records each treatment once, however many findings asked for it", () => {
    // The shape that broke the old recording: three CBT findings pushed the
    // dynamic recommendation past the cap of five and out of the record.
    const keys = adultResultKeys([
      rec("gad-1", "CBT"), rec("ocd-2", "CBT"), rec("sleep-3", "CBT"),
      rec("social-4", "CBT"), rec("panic-5", "CBT"), rec("style-6", "טיפול דינאמי"),
    ]);
    expect(keys.treatments).toEqual(["CBT", "טיפול דינאמי"]);
    expect(keys.nRecs).toBe(6);
  });

  it("separates professionals and assessments from treatments", () => {
    const keys = adultResultKeys([
      rec("bmi-1", "דיאטנ/ית קליני/ת", "דיאטנ/ית קליני/ת"),
      rec("emp-2", "אבחון תעסוקתי"),
      rec("emp-3", "טיפול תעסוקתי"),
    ]);
    expect(keys.professionals).toEqual(["דיאטנ/ית קליני/ת"]);
    expect(keys.assessments).toEqual(["אבחון תעסוקתי"]);
    expect(keys.treatments).toEqual(["טיפול תעסוקתי"]);
  });

  it("marks a treatment as default only when no finding also produced it", () => {
    expect(adultResultKeys([rec("emotional-default-1", "טיפול דינאמי")]).defaultTreatments).toEqual(["טיפול דינאמי"]);
    // Same key, but a relationship finding asked for it too - not "only by default".
    expect(adultResultKeys([
      rec("emotional-default-1", "טיפול דינאמי"),
      rec("single-2", "טיפול דינאמי"),
    ]).defaultTreatments).toEqual([]);
  });

  it("reports nothing found as zero recommendations, not as an absent record", () => {
    expect(adultResultKeys([])).toEqual({ treatments: [], assessments: [], professionals: [], defaultTreatments: [], nRecs: 0 });
  });
});

describe("kidsResultKeys", () => {
  const krec = (treatmentKey: string, extra?: string[]): KidsRecommendation => ({
    id: "x", domain: "emotional", symptoms: [], kind: "treatment", treatmentKey,
    treatmentLabel: treatmentKey, referralText: "", tools: [], urgent: false, extraTreatmentKeys: extra,
  });
  const domain = (...recs: KidsRecommendation[]): KidsDomainResult => ({
    groups: recs.map((r) => ({ treatmentKey: r.treatmentKey, treatmentLabel: r.treatmentLabel, kind: r.kind, urgent: false, recs: [r] })),
    externalNotes: [], standaloneWarnings: [],
  });
  const keys = (...t: string[]) => ({ treatmentKeys: t, assessmentKeys: [], professionalKeys: [] });

  it("flags the dynamic referral as default when it is the scorer's fallback and nothing else named it", () => {
    const out = kidsResultKeys([domain(krec("טיפול דינאמי"))], keys("טיפול דינאמי"), true);
    expect(out.defaultTreatments).toEqual(["טיפול דינאמי"]);
    expect(out.nRecs).toBe(1);
  });

  it("does not flag it when a finding in another domain asked for the same treatment", () => {
    const out = kidsResultKeys(
      [domain(krec("טיפול דינאמי")), domain(krec("הדרכת הורים", ["טיפול דינאמי"]))],
      keys("טיפול דינאמי", "הדרכת הורים"), true,
    );
    expect(out.defaultTreatments).toEqual([]);
  });

  it("does not flag it when the scorer emitted no fallback", () => {
    expect(kidsResultKeys([domain(krec("טיפול דינאמי"))], keys("טיפול דינאמי"), false).defaultTreatments).toEqual([]);
  });

  it("does not count findings that carry no referral as recommendations", () => {
    expect(kidsResultKeys([domain(krec("_no_action"))], keys(), false).nRecs).toBe(0);
  });
});

describe("generalizeFinding", () => {
  it("pools every suicidality wording either scorer produces", () => {
    for (const text of [
      "נמצאו סימנים של אובדנות.",
      "נמצאו סימנים של מצב רוח מרומם/רוגזני, כולל סימני אובדנות.",
      "נמצאו מחשבות אובדניות בהקשר טראומה.",
      "🚨 דווח על מחשבות אובדניות - נדרשת הערכת סיכון דחופה אצל פסיכיאטר ילדים",
    ]) {
      expect(isSuicidalityText(text)).toBe(true);
      expect(generalizeFinding(text)).toBe(GENERAL_EMOTIONAL_FINDING);
    }
  });

  it("leaves every other finding, and empty values, exactly as they were", () => {
    expect(generalizeFinding("נמצאו קשיים בניהול חרדה ומתח.")).toBe("נמצאו קשיים בניהול חרדה ומתח.");
    expect(generalizeFinding(null)).toBeNull();
    expect(generalizeFinding(undefined)).toBeUndefined();
  });
});
