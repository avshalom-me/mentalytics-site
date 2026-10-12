import { describe, expect, it } from "vitest";
import { ALL_REGIONS } from "./regions";
import { buildRegionCampaignSpec, DESCRIPTION_MAX, HEADLINE_MAX, MAX_HEADLINES, PATH_MAX, REGION_CAMPAIGNS, suggestedBudgetRaise } from "./ads-campaign-spec";

describe("buildRegionCampaignSpec", () => {
  it("builds a complete spec for every mapped region, within Google's limits", () => {
    for (const region of ALL_REGIONS) {
      const spec = buildRegionCampaignSpec(region);
      expect(spec, region).not.toBeNull();
      const s = spec!;
      expect(s.utm).toBe(REGION_CAMPAIGNS[region].utm);
      expect(s.name).toBe(s.utm);
      expect(s.finalUrlSuffix).toBe(`utm_source=google&utm_medium=cpc&utm_campaign=${s.utm}`);
      expect(s.finalUrl).toMatch(/^https:\/\/www\.mentalytics\.co\.il\/therapists\/region\/%/);
      expect(s.headlinesPinned1.length).toBeGreaterThanOrEqual(2);
      expect(s.headlines.length).toBeGreaterThanOrEqual(8);
      expect(s.headlinesPinned1.length + 1 + s.headlines.length).toBeLessThanOrEqual(MAX_HEADLINES);
      for (const h of [...s.headlinesPinned1, ...s.headlines]) expect(h.length, h).toBeLessThanOrEqual(HEADLINE_MAX);
      expect(s.descriptions).toHaveLength(4);
      for (const d of s.descriptions) expect(d.length, d).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(s.path1.length).toBeLessThanOrEqual(PATH_MAX);
      expect(s.path2.length).toBeLessThanOrEqual(PATH_MAX);
      expect(s.keywords.length).toBeGreaterThanOrEqual(20);
      expect(new Set(s.keywords).size).toBe(s.keywords.length);
      expect(s.negatives).toContain("חינם");
    }
  });

  it("names the main city in the copy and the neighbours in the regional description", () => {
    const s = buildRegionCampaignSpec("חיפה והקריות")!;
    expect(s.headlineKeywordInsertion).toBe("{KEYWORD:פסיכולוג בחיפה}");
    expect(s.headlinesPinned1).toContain("שאלון התאמה למטפל בחיפה");
    expect(s.descriptions[3]).toBe("מטפלים מוסמכים בחיפה, בקריית אתא, בקריית ביאליק ובקריית מוצקין. תעודות ההכשרה אומתו.");
    expect(s.keywords).toContain("פסיכולוג בחיפה");
    expect(s.keywords).toContain("פסיכולוגית קריית ים"); // העיר החמישית נכנסת, השישית (נשר) לא
    expect(s.path2).toBe("חיפה");
  });

  it("returns null for a region without a campaign mapping", () => {
    expect(buildRegionCampaignSpec("אזור שלא קיים")).toBeNull();
  });

  it("clamps the daily budget and keeps an explicit name", () => {
    expect(buildRegionCampaignSpec("דרום", { dailyBudgetIls: 1, name: "g-south2" })!.dailyBudgetIls).toBe(5);
    expect(buildRegionCampaignSpec("דרום", { dailyBudgetIls: 1000 })!.dailyBudgetIls).toBe(200);
    expect(buildRegionCampaignSpec("דרום", { name: "g-south2" })!.name).toBe("g-south2");
  });
});

describe("suggestedBudgetRaise", () => {
  it("raises by at least five shekels and at most half, inside the bounds", () => {
    expect(suggestedBudgetRaise(10)).toBe(15);
    expect(suggestedBudgetRaise(20)).toBe(30);
    expect(suggestedBudgetRaise(4)).toBe(9);
    expect(suggestedBudgetRaise(180)).toBe(200);
  });
});
