import { describe, it, expect } from "vitest";
import type { KidsDomainResult } from "./kids-recommendations";
import { profileChart, triedChart, exhaustionLine } from "./report-charts";
import { buildSchoolSummary, type Ans, type SummaryDomain } from "./school-report";

const empty: KidsDomainResult = { groups: [], externalNotes: [], standaloneWarnings: [] };
const finding = (urgent = false): KidsDomainResult => ({
  groups: [{
    treatmentKey: "CBT", treatmentLabel: "טיפול CBT", kind: "treatment", urgent,
    recs: [{ id: "r", domain: "emotional", symptoms: ["📊 סימני חרדה"], kind: "treatment", treatmentKey: "CBT", treatmentLabel: "טיפול CBT", referralText: "", tools: [], urgent }],
  }],
  externalNotes: [],
  standaloneWarnings: [],
});
const domains = (over: Partial<Record<string, KidsDomainResult>> = {}): SummaryDomain[] =>
  (["emotional", "academic", "developmental", "behavioral", "social"] as const).map(key => ({ key, label: key, result: over[key] ?? empty }));

describe("chart A - the difficulty by domain", () => {
  it("draws the rated domains in the questionnaire's order, with what the items found", () => {
    const A: Ans = { a_soc: "מעט", a_emo: "הרבה", a_aca: "הרבה מאוד", a_beh: "כלל לא" };
    const c = profileChart(A, domains({ emotional: finding(), academic: finding(true) }))!;
    expect(c.rows.map(r => [r.label, r.level, r.status])).toEqual([
      ["רגשי", 2, "found"],
      ["לימודי", 3, "urgent"],
      ["התנהגותי", 0, "not_marked"],
      ["חברתי", 1, "none"],
    ]);
  });

  it("leaves out a domain the opening screen never showed", () => {
    expect(profileChart({ a_emo: "הרבה" }, domains())!.rows.map(r => r.key)).toEqual(["emotional"]);
  });

  it("draws nothing when nothing was rated above 'כלל לא'", () => {
    expect(profileChart({ a_emo: "כלל לא", a_soc: "כלל לא" }, domains())).toBeNull();
    expect(profileChart({}, domains())).toBeNull();
  });

  it("counts a warning as a finding, and an urgent one as urgent", () => {
    const warned: KidsDomainResult = { ...empty, standaloneWarnings: [{ text: "🚨 דחוף", urgent: true }] };
    expect(profileChart({ a_beh: "הרבה" }, domains({ behavioral: warned }))!.rows[0].status).toBe("urgent");
  });
});

describe("chart B - what was tried and what came of it", () => {
  it("groups the school's attempts by kind, lists what was not tried, and says the floor", () => {
    const c = triedChart({ _grade: "ד", a_emo: "הרבה", c_tried: { shach: "partial", talks: "helped", tachi: "no_help" } })!;
    expect(c.groups.map(g => [g.title, g.rows.map(r => r.outcome)])).toEqual([
      ["טיפולי", ["partial"]],
      ["מערכתי", ["helped", "no_help"]],
    ]);
    expect(c.untried).toHaveLength(4);
    // tachi did not help, so the system floor is met even though talks helped.
    expect(c.exhaustion).toEqual({ treatment: true, system: true });
    expect(c.anyHelped).toBe(true);
  });

  it("does not count 'הועיל' toward the floor", () => {
    const c = triedChart({ _grade: "ד", a_emo: "הרבה", c_tried: { shach: "partial", talks: "helped" } })!;
    expect(c.exhaustion).toEqual({ treatment: true, system: false });
    expect(exhaustionLine(c.exhaustion!)).toBe("מיצוי: ניסיון טיפולי ✓ · התערבות מערכתית ✗");
  });

  it("says nothing about the floor when no route asks for it", () => {
    expect(triedChart({ _grade: "ד", a_soc: "הרבה", c_tried: { talks: "partial", plan: "no_help" } })!.exhaustion).toBeUndefined();
  });

  it("draws nothing for fewer than two attempts", () => {
    expect(triedChart({ _grade: "ד", c_tried: { talks: "partial" } })).toBeNull();
    expect(triedChart({ _grade: "ד" })).toBeNull();
  });

  it("uses the kindergarten's list, and only what a day-care could have tried", () => {
    const g = triedChart({ _grade: "גן", c_gan_tried: { gan_plan: "partial", paramedical: "no_help", shach: "helped" } })!;
    expect(g.groups.map(x => x.title)).toEqual(["בגן", "טיפולי", "התפתחותי"]);
    expect(g.exhaustion).toBeUndefined();   // no emotional finding: no floor in a kindergarten
    const t = triedChart({ _grade: "פעוט", c_gan_tried: { parents: "partial", paramedical: "no_help" } })!;
    expect(t.groups[0].title).toBe("במסגרת");
    expect(t.untried).not.toContain("תוכנית התערבות בגן (הגננת)");
  });

  it("holds the kindergarten's emotional route to its floor", () => {
    const c = triedChart({ _grade: "גן", _found: ["emotional"], c_gan_tried: { shach: "partial", parents: "helped" } })!;
    expect(c.exhaustion).toEqual({ treatment: true, system: false });
    expect(exhaustionLine(c.exhaustion!, true)).toContain("התערבות בגן ✗");
  });
});

describe("where the charts go in the summary", () => {
  it("tags the background and the attempts sections, and leaves the copied text alone", () => {
    const A: Ans = { _audience: "counselor", _grade: "ד", _age: "10", c_duration: "years", c_tried: { talks: "partial", shach: "no_help" } };
    const s = buildSchoolSummary(A, [], "2026-10-25");
    expect(s.doc.sections.find(x => x.id === "background")?.title).toBe("רקע");
    expect(s.doc.sections.find(x => x.id === "tried")?.title).toBe("התערבויות שנוסו בבית הספר");
    expect(s.text).not.toContain("background");
  });
});
