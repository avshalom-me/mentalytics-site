import { describe, expect, it } from "vitest";
import { PAGE_REVISED, latestLandingRevision } from "./page-revised";

describe("the landing-page revisions", () => {
  it("dates the city template with the city pages only", () => {
    const city = "app/therapists/city/[city]/page.tsx";
    expect(PAGE_REVISED["@landing-city"].sources).toContain(city);
    expect(PAGE_REVISED["@landing-families"].sources).not.toContain(city);
  });

  it("lists the shared files the city page renders from under both", () => {
    const families = new Set(PAGE_REVISED["@landing-families"].sources);
    for (const shared of ["app/components/TherapistResultCard.tsx", "app/lib/therapist-directory.ts", "app/therapists/CitySeoSection.tsx"]) {
      expect(families.has(shared)).toBe(true);
      expect(PAGE_REVISED["@landing-city"].sources).toContain(shared);
    }
  });

  it("gives the ads diagnosis the newest of them", () => {
    const newest = [PAGE_REVISED["@landing-families"].date, PAGE_REVISED["@landing-city"].date].sort().at(-1);
    expect(latestLandingRevision()).toBe(newest);
  });
});
