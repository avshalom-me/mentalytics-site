import { describe, it, expect } from "vitest";
import { sitemapLoc } from "./sitemap-loc";

const BASE = "https://www.mentalytics.co.il";

describe("sitemapLoc", () => {
  it("percent-encodes a Hebrew path the way the page's canonical is encoded", () => {
    expect(sitemapLoc(`${BASE}/therapists/city/תל-אביב`)).toBe(`${BASE}/therapists/city/%D7%AA%D7%9C-%D7%90%D7%91%D7%99%D7%91`);
    // The canonical is what the URL parser makes of the same address.
    expect(sitemapLoc(`${BASE}/therapists/city/חיפה/טיפול-בחרדה`)).toBe(new URL(`${BASE}/therapists/city/חיפה/טיפול-בחרדה`).href);
  });

  it("keeps a profile's name slug and uuid together, with the hyphens untouched", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    expect(sitemapLoc(`${BASE}/therapists/דר-פלונית-אלמונית-${id}`)).toBe(
      `${BASE}/therapists/%D7%93%D7%A8-%D7%A4%D7%9C%D7%95%D7%A0%D7%99%D7%AA-%D7%90%D7%9C%D7%9E%D7%95%D7%A0%D7%99%D7%AA-${id}`,
    );
  });

  it("returns an ASCII url byte for byte, the bare origin included", () => {
    expect(sitemapLoc(BASE)).toBe(BASE);
    expect(sitemapLoc(`${BASE}/research/first-session`)).toBe(`${BASE}/research/first-session`);
    expect(sitemapLoc(`${BASE}/therapists/city/%D7%AA%D7%9C-%D7%90%D7%91%D7%99%D7%91`)).toBe(`${BASE}/therapists/city/%D7%AA%D7%9C-%D7%90%D7%91%D7%99%D7%91`);
  });

  it("is idempotent", () => {
    const once = sitemapLoc(`${BASE}/therapists/specialty/טיפול-זוגי`);
    expect(sitemapLoc(once)).toBe(once);
  });
});
