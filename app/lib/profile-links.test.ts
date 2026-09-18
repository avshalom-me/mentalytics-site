import { describe, it, expect } from "vitest";
import { isOwnSiteLink, visibleProfileLinks } from "./profile-links";

// Real links on free therapists' profiles when the rule was introduced
// (18/9/26): their own sites, and publications elsewhere. A free therapist
// shows none of them - only links into our own site survive.
const OWN_SITES = [
  "https://www.limordi-psy.co.il/",
  "https://mosherosen.co.il/",
  "https://www.tamarpsy.com/mamarim/",
  "https://www.facebook.com/share/1Bsr4vpmAZ/",
];
const PUBLICATIONS_ELSEWHERE = [
  "https://www.mdpi.com/2227-9067/9/8/1265",
  "https://www.ynet.co.il/laisha/article/rjlxz02rgg",
  "https://www.hebpsy.net/articles.asp?id=4577",
];
const OURS = "https://www.mentalytics.co.il/research/jealousy-polyamory";

describe("isOwnSiteLink", () => {
  it("is true only for our own domain, with or without www", () => {
    expect(isOwnSiteLink(OURS)).toBe(true);
    expect(isOwnSiteLink("https://mentalytics.co.il/research")).toBe(true);
    for (const u of [...OWN_SITES, ...PUBLICATIONS_ELSEWHERE]) expect(isOwnSiteLink(u), u).toBe(false);
  });
  it("is not fooled by look-alike hosts or non-http schemes", () => {
    expect(isOwnSiteLink("https://mentalytics.co.il.evil.com/")).toBe(false);
    expect(isOwnSiteLink("https://notmentalytics.co.il/")).toBe(false);
    expect(isOwnSiteLink("javascript:alert(1)")).toBe(false);
    expect(isOwnSiteLink("www.mentalytics.co.il/research")).toBe(false);
  });
});

describe("visibleProfileLinks", () => {
  it("a paying therapist keeps every valid link", () => {
    const all = [...OWN_SITES, ...PUBLICATIONS_ELSEWHERE, OURS];
    expect(visibleProfileLinks(all, true)).toEqual(all);
  });
  it("a free therapist keeps only links into our own site", () => {
    expect(visibleProfileLinks([...OWN_SITES, ...PUBLICATIONS_ELSEWHERE, OURS], false)).toEqual([OURS]);
  });
  it("a free therapist with only outside links shows none", () => {
    expect(visibleProfileLinks([...OWN_SITES, ...PUBLICATIONS_ELSEWHERE], false)).toEqual([]);
  });
  it("drops empty and invalid entries for everyone", () => {
    expect(visibleProfileLinks(["", "  ", "not a url", null as unknown as string], true)).toEqual([]);
    expect(visibleProfileLinks(null, true)).toEqual([]);
  });
});
