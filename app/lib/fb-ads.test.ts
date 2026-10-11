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

  it("gives a recruitment ad its accounts, counted against the join page's visitors", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-recruit-image", sessions: 38 }],
      [{ campaign: "fb-recruit-image", visitors: 40, signups: 3, filled: 2, approved: 2, paying: 1 }]
    );
    const ad = report.find((r) => r.campaign === "fb-recruit-image")!;
    expect(ad.visits).toBe(40);
    expect(ad.steps.map((s) => s.value)).toEqual([0, 0, 3, 0, 2, 2, 1]);
  });

  it("puts the press on the register button, the register screen, the account, the profile form and the profile in that order", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-recruit-video", sessions: 20, recruit_cta_clicks: 6, recruit_register_views: 5, recruit_profile_form_views: 3 }],
      [{ campaign: "fb-recruit-video", visitors: 20, signups: 4, filled: 1, approved: 1, paying: 0 }]
    );
    const ad = report.find((r) => r.campaign === "fb-recruit-video")!;
    expect(ad.steps).toEqual([
      { label: "לחצו על הרשמה", value: 6 },
      { label: "הגיעו למסך ההרשמה", value: 5 },
      { label: "פתחו חשבון", value: 4 },
      { label: "הגיעו לטופס הפרופיל", value: 3 },
      { label: "מילאו פרופיל", value: 1 },
      { label: "אושרו", value: 1 },
      { label: "במסלול המקודם", value: 0 },
    ]);
  });

  // The 10/10/2026 registrant: an account from the video ad, no name, nothing to
  // approve. The card used to read "נרשמו 1, אושרו 0", as if one was waiting.
  it("does not take an account with no name for a profile, and reads a missing count as zero", () => {
    const report = buildFbAdsReport(
      [{ campaign: "fb-recruit-video", sessions: 143 }],
      [{ campaign: "fb-recruit-video", visitors: 143, signups: 1, approved: 0, paying: 0 }]
    );
    const steps = Object.fromEntries(report.find((r) => r.campaign === "fb-recruit-video")!.steps.map((s) => [s.label, s.value]));
    expect(steps["פתחו חשבון"]).toBe(1);
    expect(steps["מילאו פרופיל"]).toBe(0);
    expect(steps["אושרו"]).toBe(0);
  });

  it("gives every step of a card its own label, since the card keys its rows by it", () => {
    for (const ad of buildFbAdsReport([], [])) {
      const labels = ad.steps.map((s) => s.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
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
