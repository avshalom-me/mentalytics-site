import { describe, expect, it } from "vitest";
import { deriveChannel, referrerHost } from "./attribution";

const q = (s: string) => new URLSearchParams(s);

describe("deriveChannel", () => {
  it("reads the paid click ids and the tagged sources", () => {
    expect(deriveChannel(q("gclid=abc"), "")).toBe("google_paid");
    expect(deriveChannel(q("tblci=x"), "")).toBe("taboola_paid");
    expect(deriveChannel(q("utm_source=google&utm_medium=cpc"), "")).toBe("google_paid");
    expect(deriveChannel(q("utm_source=facebook&utm_medium=social"), "")).toBe("meta_organic");
  });

  it("infers organic search, mail and assistants from the referrer", () => {
    expect(deriveChannel(q(""), "https://www.google.com/")).toBe("google_organic");
    expect(deriveChannel(q(""), "android-app://com.google.android.gm/")).toBe("email");
    expect(deriveChannel(q(""), "https://gemini.google.com/app")).toBe("ai");
    expect(deriveChannel(q(""), "https://www.bing.com/search?q=x")).toBe("search_other");
    expect(deriveChannel(q(""), "https://some-blog.co.il/post")).toBe("referral");
    expect(deriveChannel(q(""), "")).toBe("direct");
  });

  it("a referrer from our own site is not a referral - it is a visit whose origin is unknown", () => {
    // Seen when a stored touch expired mid-session, or a hard navigation from
    // the dashboard; until 13/10/2026 these were counted next to the backlinks.
    expect(deriveChannel(q(""), "https://www.mentalytics.co.il/therapists/dashboard")).toBe("direct");
    expect(deriveChannel(q(""), "https://mentalytics.co.il/")).toBe("direct");
    expect(deriveChannel(q(""), "https://www.mentalytics.co.il/learning")).toBe("direct");
    // A tagged campaign still wins over the referrer.
    expect(deriveChannel(q("utm_source=google&utm_medium=cpc"), "https://www.mentalytics.co.il/")).toBe("google_paid");
    // Look-alike hosts are not us.
    expect(deriveChannel(q(""), "https://mentalytics.co.il.example.com/")).toBe("referral");
  });
});

describe("referrerHost", () => {
  it("strips www and drops our own host", () => {
    expect(referrerHost("https://www.example.com/a", "www.mentalytics.co.il")).toBe("example.com");
    expect(referrerHost("https://www.mentalytics.co.il/a", "www.mentalytics.co.il")).toBeNull();
    expect(referrerHost("not a url", "www.mentalytics.co.il")).toBeNull();
  });
});
