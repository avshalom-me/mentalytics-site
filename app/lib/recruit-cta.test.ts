import { describe, it, expect } from "vitest";
import { isRecruitRegisterHref, scrollPercent } from "./recruit-cta";

const ORIGIN = "https://www.mentalytics.co.il";

describe("a press on the register button of a recruitment page", () => {
  it("is a link to the login screen opened on its register tab", () => {
    expect(isRecruitRegisterHref("/therapists/login?mode=register", ORIGIN)).toBe(true);
    expect(isRecruitRegisterHref("/therapists/login/?mode=register", ORIGIN)).toBe(true);
    expect(isRecruitRegisterHref("/therapists/login?plan=promoted&mode=register", ORIGIN)).toBe(true);
    expect(isRecruitRegisterHref("https://www.mentalytics.co.il/therapists/login?mode=register", ORIGIN)).toBe(true);
  });

  it("is not the login link of a therapist who already has a profile", () => {
    expect(isRecruitRegisterHref("/therapists/login?mode=login", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("/therapists/login", ORIGIN)).toBe(false);
  });

  it("is not another page, another site, or something that is not a page at all", () => {
    expect(isRecruitRegisterHref("/lp/story-c", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("/therapists/register", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("https://example.com/therapists/login?mode=register", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("mailto:someone@example.com", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("#how-it-works", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref("", ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref(null, ORIGIN)).toBe(false);
    expect(isRecruitRegisterHref(undefined, ORIGIN)).toBe(false);
  });

  it("is read against the origin of the page, so a dev server and the live site agree", () => {
    expect(isRecruitRegisterHref("/therapists/login?mode=register", "http://localhost:3010")).toBe(true);
    expect(isRecruitRegisterHref("https://www.mentalytics.co.il/therapists/login?mode=register", "http://localhost:3010")).toBe(false);
  });
});

describe("how far down the page the press happened", () => {
  it("is 0 at the top and 100 at the end", () => {
    expect(scrollPercent(0, 3000, 800)).toBe(0);
    expect(scrollPercent(2200, 3000, 800)).toBe(100);
  });

  it("is a whole percent in between", () => {
    expect(scrollPercent(1100, 3000, 800)).toBe(50);
    expect(scrollPercent(733, 3000, 800)).toBe(33);
  });

  it("stays inside 0-100 when the browser overshoots (iOS rubber-banding), and is 0 on a page that fits the screen", () => {
    expect(scrollPercent(-40, 3000, 800)).toBe(0);
    expect(scrollPercent(2400, 3000, 800)).toBe(100);
    expect(scrollPercent(0, 700, 800)).toBe(0);
    expect(scrollPercent(10, 800, 800)).toBe(0);
  });
});
