import { describe, it, expect } from "vitest";
import {
  budgetRecommendation,
  daysInMonth,
  defaultTargetMonth,
  narrativeIsFaithful,
  numbersIn,
  projectBudget,
  summarySentence,
  type BudgetCampaignInput,
} from "./budget-agent";

// The owner's manual analysis of 29/9/2026, as budget_campaign_stats returns it
// for that day (costs before rounding are within a shekel of these), and the
// registry budgets of that evening.
const base = { active: true, budgetType: "daily" as const, protectedReason: null, protectedUntil: null };
const CAMPAIGNS: BudgetCampaignInput[] = [
  { ...base, googleName: "g-tlv", utmCampaign: "g-tlv", dailyBudget: 25, firstSpend: "2026-09-22", cost30: 177, cost60: 177, seekers30: 6, seekers60: 6, paidSeekers60: 3, trialSeekers60: 3 },
  { ...base, googleName: "Website traffic-Search-jerusalem", utmCampaign: "g-jerusalem", dailyBudget: 25, firstSpend: "2026-07-31", cost30: 772, cost60: 1265, seekers30: 17, seekers60: 29, paidSeekers60: 14, trialSeekers60: 13 },
  { ...base, googleName: "Website traffic-Search-telaviv", utmCampaign: "g-telaviv", active: false, budgetType: "total", dailyBudget: null, firstSpend: "2026-07-31", cost30: 492, cost60: 1607, seekers30: 7, seekers60: 27, paidSeekers60: 10, trialSeekers60: 11 },
  { ...base, googleName: "Search-patients", utmCampaign: "g-online", dailyBudget: 30, firstSpend: "2026-07-31", cost30: 870, cost60: 1846, seekers30: 20, seekers60: 30, paidSeekers60: 19, trialSeekers60: 12 },
  { ...base, googleName: "g-sharon1", utmCampaign: "g-sharon", dailyBudget: 12, firstSpend: "2026-08-06", cost30: 367, cost60: 892, seekers30: 4, seekers60: 13, paidSeekers60: 4, trialSeekers60: 8 },
  { ...base, googleName: "g-north-sharon1", utmCampaign: "g-north-sharon", dailyBudget: 15, firstSpend: "2026-08-25", cost30: 454, cost60: 548, seekers30: 4, seekers60: 8, paidSeekers60: 3, trialSeekers60: 1 },
  { ...base, googleName: "g-haifa", utmCampaign: "g-haifa", dailyBudget: 25, firstSpend: "2026-08-17", cost30: 757, cost60: 988, seekers30: 9, seekers60: 14, paidSeekers60: 4, trialSeekers60: 7 },
  { ...base, googleName: "g-kids-center", utmCampaign: "g-kids-center", dailyBudget: 15, firstSpend: "2026-07-31", cost30: 463, cost60: 1045, seekers30: 4, seekers60: 9, paidSeekers60: 4, trialSeekers60: 2 },
  { ...base, googleName: "g-emek1", utmCampaign: "g-emek", dailyBudget: 10, firstSpend: "2026-08-26", cost30: 300, cost60: 311, seekers30: 2, seekers60: 2, paidSeekers60: 2, trialSeekers60: 0 },
  { ...base, googleName: "g-shfela", utmCampaign: "g-shfela", dailyBudget: 10, firstSpend: null, cost30: 0, cost60: 0, seekers30: 0, seekers60: 0, paidSeekers60: 0, trialSeekers60: 0 },
];

const byName = (p: ReturnType<typeof projectBudget>, name: string) => p.campaigns.find((c) => c.googleName === name)!;

describe("the 29/9/2026 figures", () => {
  const p = projectBudget({ campaigns: CAMPAIGNS, ceiling: null, month: "2026-10", today: "2026-09-29" });

  it("reproduces the manual cost per seeker, 30 and 60 days", () => {
    const got = Object.fromEntries(p.campaigns.map((c) => [c.utmCampaign, [c.cpl30, c.cpl60]]));
    expect(got).toEqual({
      "g-tlv": [30, 30],
      "g-jerusalem": [45, 44],
      "g-telaviv": [70, 60],
      "g-online": [44, 62],
      "g-sharon": [92, 69],
      "g-north-sharon": [114, 69],
      "g-haifa": [84, 71],
      "g-kids-center": [116, 116],
      "g-emek": [150, 156],
      "g-shfela": [null, null],
    });
  });

  it("totals the last 30 days across every Google campaign, the paused one included", () => {
    // Taboola's six seekers made the manual figure 79; its spend is not in the
    // database until step 3.
    expect(p.lastMonth).toEqual({ cost: 4652, seekers: 73, cpl: 64 });
  });

  it("ranks on 30 days only when at least eight seekers stand behind it", () => {
    expect(byName(p, "Search-patients")).toMatchObject({ rate: 44, rateWindow: 30, noisy: false });
    expect(byName(p, "g-haifa")).toMatchObject({ rate: 84, rateWindow: 30 });
    expect(byName(p, "g-north-sharon1")).toMatchObject({ rate: 69, rateWindow: 60, noisy: false });
    expect(byName(p, "g-emek1")).toMatchObject({ rate: 156, rateWindow: 60, noisy: true });
  });

  it("without a ceiling, reports what the current budgets buy and recommends nothing", () => {
    expect(p.current).toEqual({ daily: 167, monthly: 5177 });
    expect(p.plan.monthly).toBe(5177);
    expect(p.campaigns.every((c) => c.decision === "report")).toBe(true);
    expect(p.plan.unknown).toEqual(["g-shfela"]);
  });
});

describe("splitting ₪3,500 for October", () => {
  const withEmekProtected = CAMPAIGNS.map((c) =>
    c.googleName === "g-emek1" ? { ...c, protectedReason: "the only source for a centre billing from 17/10", protectedUntil: "2026-11-17" } : c
  );
  const p = projectBudget({ campaigns: withEmekProtected, ceiling: 3500, month: "2026-10", today: "2026-09-29" });

  it("keeps the protected and the learning campaigns as they are", () => {
    expect(byName(p, "g-emek1")).toMatchObject({ isProtected: true, proposedDaily: 10, decision: "keep" });
    expect(byName(p, "g-tlv")).toMatchObject({ learning: true, proposedDaily: 25, decision: "keep" });
    expect(byName(p, "g-shfela")).toMatchObject({ learning: true, proposedDaily: 10, decision: "keep" });
  });

  it("fills the rest cheapest-first and pauses what the ceiling cannot hold", () => {
    const split = Object.fromEntries(
      p.campaigns.filter((c) => c.inPlan).map((c) => [c.utmCampaign, [c.proposedDaily, c.decision]])
    );
    expect(split).toEqual({
      "g-tlv": [25, "keep"],
      "g-jerusalem": [25, "keep"],
      "g-online": [30, "keep"],
      "g-sharon": [12, "keep"],
      "g-north-sharon": [0, "pause"],
      "g-haifa": [0, "pause"],
      "g-kids-center": [0, "pause"],
      "g-emek": [10, "keep"],
      "g-shfela": [10, "keep"],
    });
    expect(p.plan.monthly).toBeLessThanOrEqual(3500);
    expect(p.plan.monthly).toBe(112 * 31);
  });

  it("projects the seekers from each campaign's own rate", () => {
    // tlv 775/30 + online 930/44 + jerusalem 775/45 + sharon 372/69 + emek 310/156
    expect(p.plan.seekers).toBe(72);
    expect(p.plan.unknown).toEqual(["g-shfela"]);
    expect(p.overCeiling).toBe(false);
  });

  it("never raises a budget above what is set today", () => {
    for (const c of p.campaigns) expect(c.proposedDaily).toBeLessThanOrEqual(c.dailyBudget ?? 0);
  });

  it("says it in one sentence", () => {
    // ₪44 a seeker = the ₪3,162 whose seekers can be projected (g-shfela's ₪310 cannot) over 71.6 seekers.
    expect(summarySentence(p)).toBe(
      "הצפי לאוקטובר: כ-72 פונים ב-₪3,472 (כ-₪44 לפונה), לא כולל g-shfela שעוד אין לו נתונים, " +
        "מול 73 פונים ב-30 הימים האחרונים, שעלו ₪4,652 (₪64 לפונה). התקרה: ₪3,500."
    );
  });
});

describe("the recommendation that goes into the queue", () => {
  const withEmekProtected = CAMPAIGNS.map((c) =>
    c.googleName === "g-emek1" ? { ...c, protectedReason: "המקור היחיד של מרכז שמתחיל לשלם", protectedUntil: "2026-11-17" } : c
  );
  const p = projectBudget({ campaigns: withEmekProtected, ceiling: 3500, month: "2026-10", today: "2026-09-29" });
  const rec = budgetRecommendation(p);

  it("asks for a change only when the budgets in Google exceed the ceiling", () => {
    expect(rec.needed).toBe(true);
    expect(rec.title).toBe("תקציב אוקטובר: להוריד מ-₪5,177 ל-₪3,472 (כ-72 פונים)");
  });

  it("lists the pauses first: the bigger budget, then the dearer seeker", () => {
    expect(rec.changes.map((c) => [c.googleName, c.from, c.to, c.decision])).toEqual([
      ["g-haifa", 25, 0, "pause"],
      ["g-kids-center", 15, 0, "pause"],
      ["g-north-sharon1", 15, 0, "pause"],
    ]);
    expect(rec.body).toContain("• להשהות את g-haifa (היום ₪25 ליום; ₪84 לפונה ב-30 יום)");
    expect(rec.body).toContain("• להשהות את g-kids-center (היום ₪15 ליום; ₪116 לפונה ב-60 יום)");
  });

  it("says what stays, why a protected campaign stays, and that nothing was changed", () => {
    expect(rec.body).toContain("ללא שינוי:");
    expect(rec.body).toContain("Search-patients");
    expect(rec.body).toContain("g-emek1 (מוגן)");
    expect(rec.body).toContain("g-tlv (בלמידה)");
    expect(rec.body).toContain("מוגן = נשאר בתקציב שלו גם כשהוא יקר");
    expect(rec.body).toContain("שום דבר לא שונה בגוגל");
    expect(rec.body).not.toContain("—");
  });

  it("stays quiet when the budgets already fit", () => {
    const fits = projectBudget({ campaigns: withEmekProtected, ceiling: 6000, month: "2026-10", today: "2026-09-29" });
    const r = budgetRecommendation(fits);
    expect(r.needed).toBe(false);
    expect(r.changes).toEqual([]);
    expect(r.title).toBe("תקציב אוקטובר: התקציבים בגוגל בתוך התקרה");
  });

  it("recommends nothing without a ceiling", () => {
    const none = projectBudget({ campaigns: withEmekProtected, ceiling: null, month: "2026-10", today: "2026-09-29" });
    expect(budgetRecommendation(none)).toMatchObject({ needed: false, title: "אין תקרת פרסום לאוקטובר", changes: [] });
  });
});

describe("the guard on the model's wording", () => {
  const source = "תקציב אוקטובר: להוריד מ-₪5,177 ל-₪3,472 (כ-72 פונים). ₪84 לפונה ב-30 יום.";

  it("reads numbers the way they are written, without thousands separators", () => {
    expect(numbersIn(source)).toEqual(["5177", "3472", "72", "84", "30"]);
  });

  it("accepts wording that only repeats the numbers it was given", () => {
    expect(narrativeIsFaithful("חיפה יקרה (₪84 לפונה), ולכן היא נעצרת כדי לרדת ל-₪3,472.", source)).toBe(true);
    expect(narrativeIsFaithful("אין כאן מספרים בכלל.", source)).toBe(true);
  });

  it("rejects wording with a number that was not in the input", () => {
    expect(narrativeIsFaithful("זה חוסך כ-₪1,700 בחודש.", source)).toBe(false);
    expect(narrativeIsFaithful("כ-70 פונים", source)).toBe(false);
  });
});

describe("edges", () => {
  it("lets a protection lapse at the end of its date", () => {
    const campaigns = CAMPAIGNS.map((c) =>
      c.googleName === "g-kids-center" ? { ...c, protectedReason: "until September only", protectedUntil: "2026-09-30" } : c
    );
    const p = projectBudget({ campaigns, ceiling: 3500, month: "2026-10", today: "2026-09-29" });
    expect(byName(p, "g-kids-center").isProtected).toBe(false);
  });

  it("pauses a campaign that has spent without a single seeker in 60 days", () => {
    const campaigns: BudgetCampaignInput[] = [
      { ...base, googleName: "dry", utmCampaign: "dry", dailyBudget: 10, firstSpend: "2026-07-01", cost30: 300, cost60: 600, seekers30: 0, seekers60: 0, paidSeekers60: 0, trialSeekers60: 0 },
    ];
    const p = projectBudget({ campaigns, ceiling: 3500, month: "2026-10", today: "2026-09-29" });
    expect(byName(p, "dry")).toMatchObject({ proposedDaily: 0, decision: "pause" });
  });

  it("flags a ceiling that the protected campaigns alone exceed", () => {
    const campaigns = CAMPAIGNS.map((c) => ({ ...c, protectedReason: "all protected", protectedUntil: null }));
    const p = projectBudget({ campaigns, ceiling: 1000, month: "2026-10", today: "2026-09-29" });
    expect(p.overCeiling).toBe(true);
    expect(summarySentence(p)).toContain("לבדם כבר עוברים אותה");
  });

  it("plans ahead from the 15th, and the month under way before it", () => {
    expect(defaultTargetMonth("2026-09-29")).toBe("2026-10");
    expect(defaultTargetMonth("2026-10-01")).toBe("2026-10");
    expect(defaultTargetMonth("2026-12-20")).toBe("2027-01");
    expect(daysInMonth("2026-10")).toBe(31);
    expect(daysInMonth("2027-02")).toBe(28);
  });
});
