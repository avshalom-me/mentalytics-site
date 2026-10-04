import { describe, it, expect } from "vitest";
import { leadingGroups, EMOTIONAL_DOMAIN, RELATIONSHIP_DOMAIN } from "./results-leads";

const FUNCTIONAL = "סימני שאלה לגבי התחומים התפקודיים, התעסוקתיים או האקדמאיים";

const group = (treatment: string, urgent = false) => ({ treatment, urgent });
const section = (key: string, ...groups: ReturnType<typeof group>[]) => ({ key, groups });
const names = (leads: { treatment: string }[]) => leads.map((g) => g.treatment);

describe("the search buttons above the adults report", () => {
  it("gives the relationship finding a button beside the emotional one", () => {
    const cbt = group("CBT");
    const dynamic = group("טיפול דינאמי");
    const couples = group("טיפול זוגי");
    const sections = [section(EMOTIONAL_DOMAIN, cbt, dynamic), section(RELATIONSHIP_DOMAIN, couples)];
    expect(names(leadingGroups([cbt, dynamic, couples], sections))).toEqual(["CBT", "טיפול זוגי"]);
  });

  it("takes the first finding of the relationship section, as the section itself does", () => {
    const cbt = group("CBT");
    const sexual = group("טיפול מיני");
    const couples = group("טיפול זוגי");
    const sections = [section(EMOTIONAL_DOMAIN, cbt), section(RELATIONSHIP_DOMAIN, sexual, couples)];
    expect(names(leadingGroups([cbt, sexual, couples], sections))).toEqual(["CBT", "טיפול מיני"]);
  });

  it("finds the relationship section wherever it sits among the others", () => {
    const cbt = group("CBT");
    const cogfun = group("טיפול COG-FUN לקשיי קשב וריכוז");
    const couples = group("טיפול זוגי");
    const sections = [
      section(EMOTIONAL_DOMAIN, cbt),
      section(RELATIONSHIP_DOMAIN, couples),
      section(FUNCTIONAL, cogfun),
    ];
    expect(names(leadingGroups([cbt, couples, cogfun], sections))).toEqual(["CBT", "טיפול זוגי"]);
  });

  it("keeps a single button when only one of the two domains is in the report", () => {
    const cbt = group("CBT");
    const couples = group("טיפול זוגי");
    expect(names(leadingGroups([cbt], [section(EMOTIONAL_DOMAIN, cbt)]))).toEqual(["CBT"]);
    expect(names(leadingGroups([couples], [section(RELATIONSHIP_DOMAIN, couples)]))).toEqual(["טיפול זוגי"]);
  });

  it("does not add a button for any other pair of domains", () => {
    const cbt = group("CBT");
    const couples = group("טיפול זוגי");
    const cogfun = group("טיפול COG-FUN לקשיי קשב וריכוז");
    expect(names(leadingGroups([cbt, cogfun], [section(EMOTIONAL_DOMAIN, cbt), section(FUNCTIONAL, cogfun)]))).toEqual(["CBT"]);
    // Without the emotional domain the relationship finding already leads.
    expect(names(leadingGroups([couples, cogfun], [section(RELATIONSHIP_DOMAIN, couples), section(FUNCTIONAL, cogfun)]))).toEqual(["טיפול זוגי"]);
  });

  it("lets an urgent finding lead alone", () => {
    const urgent = group("טיפול דינאמי", true);
    const cbt = group("CBT");
    const couples = group("טיפול זוגי");
    const sections = [section(EMOTIONAL_DOMAIN, urgent, cbt), section(RELATIONSHIP_DOMAIN, couples)];
    expect(leadingGroups([urgent, cbt, couples], sections)).toEqual([urgent]);
  });

  it("has nothing to offer when the report is empty", () => {
    expect(leadingGroups([], [])).toEqual([]);
  });
});
