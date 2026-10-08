import { describe, it, expect } from "vitest";
import { FB_ADS, buildFbAdsReport, fbAdLink, shareOfVisits } from "./fb-ads";
import { PAID_MEDIUMS } from "./attribution";

describe("the link pasted into a Facebook ad", () => {
  it("carries the ad's own campaign and opens its landing page", () => {
    const ad = FB_ADS.find((a) => a.campaign === "fb-recruit-video")!;
    expect(fbAdLink(ad)).toBe(
      "https://www.mentalytics.co.il/therapists/join?utm_source=facebook&utm_medium=paid&utm_campaign=fb-recruit-video"
    );
  });

  // attribution.ts files a visit under "Meta - paid" only when the source is a
  // Meta one and the medium is a paid one; anything else lands as organic and
  // the ad's visitors vanish into the general traffic.
  it("is tagged the way the site recognises as paid Meta traffic, for every listed ad", () => {
    for (const ad of FB_ADS) {
      const params = new URL(fbAdLink(ad)).searchParams;
      expect(params.get("utm_source")).toBe("facebook");
      expect(PAID_MEDIUMS.has(params.get("utm_medium") ?? "")).toBe(true);
    }
  });

  it("uses a campaign name the marketing dashboard keeps (fb- prefix), once", () => {
    const names = FB_ADS.map((a) => a.campaign);
    expect(names.every((n) => n.startsWith("fb-"))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("the per-ad report", () => {
  it("lists every ad with zeros before anyone arrives", () => {
    const report = buildFbAdsReport([], []);
    expect(report.map((r) => r.campaign)).toEqual(FB_ADS.map((a) => a.campaign));
    expect(report.every((r) => r.visits === 0 && r.steps.every((s) => s.value === 0))).toBe(true);
    expect(report.every((r) => r.link !== null)).toBe(true);
  });

  it("gives a patients' ad its questionnaire steps", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-patients-video", sessions: 120, quiz_started: 30, quiz_completed: 18, viewed_profile: 9, contacting_people: 2 }],
      []
    );
    const ad = report.find((r) => r.campaign === "fb-patients-video")!;
    expect(ad.visits).toBe(120);
    expect(ad.steps).toEqual([
      { label: "התחילו שאלון", value: 30 },
      { label: "סיימו שאלון", value: 18 },
      { label: "צפו בפרופיל מטפל", value: 9 },
      { label: "פנו למטפל", value: 2 },
    ]);
  });

  it("gives a recruitment ad its signups, counted against the join page's visitors", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-recruit-image", sessions: 38 }],
      [{ campaign: "fb-recruit-image", visitors: 40, signups: 3, approved: 2, paying: 1 }]
    );
    const ad = report.find((r) => r.campaign === "fb-recruit-image")!;
    expect(ad.visits).toBe(40);
    expect(ad.steps.map((s) => s.value)).toEqual([0, 0, 3, 2, 1]);
  });

  it("puts the press on the register button and the register screen between arriving and signing up", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-recruit-video", sessions: 20, recruit_cta_clicks: 6, recruit_register_views: 5 }],
      [{ campaign: "fb-recruit-video", visitors: 20, signups: 1, approved: 0, paying: 0 }]
    );
    const ad = report.find((r) => r.campaign === "fb-recruit-video")!;
    expect(ad.steps).toEqual([
      { label: "לחצו על הרשמה", value: 6 },
      { label: "הגיעו למסך ההרשמה", value: 5 },
      { label: "נרשמו", value: 1 },
      { label: "אושרו", value: 0 },
      { label: "במסלול המקודם", value: 0 },
    ]);
  });

  it("does not give a patients' ad the recruitment steps", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-patients-image", sessions: 10, recruit_cta_clicks: 3, recruit_register_views: 3 }],
      []
    );
    const ad = report.find((r) => r.campaign === "fb-patients-image")!;
    expect(ad.steps.map((s) => s.label)).toEqual(["התחילו שאלון", "סיימו שאלון", "צפו בפרופיל מטפל", "פנו למטפל"]);
  });

  it("shows an unlisted fb- campaign after the listed ones, on the side its name says", () => {
    const report = buildFbAdsReport(
      [
        { campaign: "fb-patients-video-reels", sessions: 7 },
        { campaign: "g-haifa", sessions: 500 },
      ],
      [
        { campaign: "fb-recruit-video-feed", visitors: 12, signups: 1, approved: 0, paying: 0 },
        { campaign: "therapist-direct", visitors: 20, signups: 0, approved: 0, paying: 0 },
      ]
    );
    const extra = report.slice(FB_ADS.length);
    expect(extra.map((r) => [r.campaign, r.audience, r.visits])).toEqual([
      ["fb-recruit-video-feed", "recruit", 12],
      ["fb-patients-video-reels", "patients", 7],
    ]);
    expect(extra.every((r) => r.link === null)).toBe(true);
  });
});

describe("a step as a share of the arrivals", () => {
  it("is a whole percent, and nothing at all when nobody arrived", () => {
    expect(shareOfVisits(18, 120)).toBe(15);
    expect(shareOfVisits(0, 120)).toBe(0);
    expect(shareOfVisits(0, 0)).toBeNull();
  });
});
