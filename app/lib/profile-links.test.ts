import { describe, it, expect } from "vitest";
import { isPublicationLink, visibleProfileLinks } from "./profile-links";

// The real links on free therapists' profiles when the rule was introduced
// (18/9/26). The first group must disappear, the second must stay.
const OWN_SITES = [
  "https://www.limordi-psy.co.il/",
  "https://mosherosen.co.il/",
  "https://www.tamarpsy.com/mamarim/",
  "http://6863c8667e778.site123.me/",
  "https://group-therapy-hub.lovable.app/",
  "https://www.facebook.com/share/1Bsr4vpmAZ/",
  "https://www.hopp.bio/zohar-lavie",
];
const PUBLICATIONS = [
  "https://www.mdpi.com/2227-9067/9/8/1265",
  "https://www.ynet.co.il/laisha/article/rjlxz02rgg",
  "https://www.hebpsy.net/articles.asp?id=4577",
  "https://link.springer.com/article/10.3758/s13423-021-01936-7",
  "https://scholar.google.com/citations?user=YkPM0p8AAAAJ&hl=fr",
  "https://www.nli.org.il/en/books/NNL_ALEPH997012458437605171/NLI",
  "https://www.mentalytics.co.il/research/jealousy-polyamory",
  "https://psychology.huji.ac.il/people/someone",
];

describe("isPublicationLink", () => {
  it("recognises publications, and nothing that is the therapist's own site", () => {
    for (const u of PUBLICATIONS) expect(isPublicationLink(u), u).toBe(true);
    for (const u of OWN_SITES) expect(isPublicationLink(u), u).toBe(false);
  });
  it("matches whole domain labels, not look-alikes", () => {
    expect(isPublicationLink("https://ynet.co.il.my-clinic.com/")).toBe(false);
    expect(isPublicationLink("https://notynet.co.il/")).toBe(false);
    expect(isPublicationLink("https://mentalytics.co.il.evil.com/")).toBe(false);
  });
  it("on hebpsy, only article pages count - not a therapist's own page in its directory", () => {
    expect(isPublicationLink("https://www.hebpsy.net/articles.asp?id=4577")).toBe(true);
    expect(isPublicationLink("https://www.hebpsy.net/pl.asp?id=12345")).toBe(false);
    expect(isPublicationLink("https://www.hebpsy.net/me_list.asp")).toBe(false);
    expect(isPublicationLink("https://www.hebpsy.net/")).toBe(false);
  });
  it("rejects anything that is not an http(s) URL", () => {
    expect(isPublicationLink("javascript:alert(1)")).toBe(false);
    expect(isPublicationLink("www.ynet.co.il")).toBe(false);
    expect(isPublicationLink("")).toBe(false);
  });
});

describe("visibleProfileLinks", () => {
  it("a paying therapist keeps every valid link", () => {
    expect(visibleProfileLinks([...OWN_SITES, ...PUBLICATIONS], true)).toHaveLength(OWN_SITES.length + PUBLICATIONS.length);
  });
  it("a free therapist keeps only the publications, in their original order", () => {
    const mixed = ["https://www.hebpsy.net/articles.asp?id=4656", "https://www.tamarpsy.com/mamarim/", "https://www.mdpi.com/x"];
    expect(visibleProfileLinks(mixed, false)).toEqual(["https://www.hebpsy.net/articles.asp?id=4656", "https://www.mdpi.com/x"]);
  });
  it("a free therapist whose only links are their own sites shows none", () => {
    expect(visibleProfileLinks(OWN_SITES, false)).toEqual([]);
  });
  it("drops empty and invalid entries for everyone", () => {
    expect(visibleProfileLinks(["", "  ", "not a url", null as unknown as string], true)).toEqual([]);
    expect(visibleProfileLinks(null, true)).toEqual([]);
  });
});
