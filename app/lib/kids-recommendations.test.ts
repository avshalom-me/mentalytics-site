import { describe, it, expect, vi } from "vitest";

// The end-to-end cases drive the real scorer, which imports "server-only".
vi.mock("server-only", () => ({}));

import { scoreKidsQuestionnaire } from "./kids-score.server";
import {
  parseKidsBoxes,
  mainFinding,
  type FindingDomain,
  type KidsRecommendationGroup,
  type RecKind,
} from "./kids-recommendations";

// ── mainFinding: the finding named at the top of the kids report ─────────────

const group = (treatmentKey: string, kind: RecKind, urgent = false): KidsRecommendationGroup =>
  ({ treatmentKey, treatmentLabel: treatmentKey, kind, urgent, recs: [] });

const domain = (key: string, groups: KidsRecommendationGroup[], urgentWarning = false): FindingDomain => ({
  key,
  treatments: groups.filter(g => g.kind === "treatment"),
  assessments: groups.filter(g => g.kind === "assessment"),
  professionals: groups.filter(g => g.kind === "professional"),
  standaloneWarnings: urgentWarning ? [{ text: "🚨 דווח על מחשבות אובדניות", urgent: true }] : [],
});

const lead = (domains: FindingDomain[], A: Record<string, unknown>) => {
  const top = mainFinding(domains, A);
  return top && `${top.domainKey}::${top.group.treatmentKey}`;
};

describe("mainFinding", () => {
  const emotional = domain("emotional", [group("טיפול דינאמי", "treatment")]);
  const academic = domain("academic", [group("פסיכו-דידקטי", "assessment")]);

  it("names the area rated hardest, not the first domain in order", () => {
    expect(lead([emotional, academic], { a_emo: "מעט", a_aca: "הרבה מאוד" })).toBe("academic::פסיכו-דידקטי");
    expect(lead([emotional, academic], { a_emo: "הרבה", a_aca: "הרבה מאוד" })).toBe("academic::פסיכו-דידקטי");
    expect(lead([emotional, academic], { a_emo: "הרבה מאוד", a_aca: "מעט" })).toBe("emotional::טיפול דינאמי");
  });

  it("keeps the report's order on a tie: domain order, then treatment before assessment", () => {
    expect(lead([emotional, academic], { a_emo: "הרבה", a_aca: "הרבה" })).toBe("emotional::טיפול דינאמי");
    const both = domain("academic", [group("פסיכו-דידקטי", "assessment"), group("ריפוי בעיסוק", "treatment")]);
    expect(lead([both], { a_aca: "הרבה" })).toBe("academic::ריפוי בעיסוק");
  });

  it("puts an urgent finding first, whatever the areas were rated", () => {
    const social = domain("social", [group("טיפול דינאמי", "treatment", true)]);
    expect(lead([emotional, academic, social], { a_emo: "מעט", a_aca: "הרבה מאוד", a_soc: "מעט" })).toBe("social::טיפול דינאמי");
  });

  it("counts a domain's own urgent warning as urgent - suicidal thoughts never attach to a card", () => {
    const flagged = domain("emotional", [group("טיפול דינאמי", "treatment")], true);
    expect(lead([flagged, academic], { a_emo: "מעט", a_aca: "הרבה מאוד" })).toBe("emotional::טיפול דינאמי");
  });

  it("ranks an area left unrated below the rated ones, and still names it when it is all there is", () => {
    expect(lead([emotional, academic], { a_aca: "מעט" })).toBe("academic::פסיכו-דידקטי");
    expect(lead([emotional], {})).toBe("emotional::טיפול דינאמי");
  });

  it("puts a teacher last: it leads only where nothing else was found, or its area is rated hardest", () => {
    const withTeacher = { ...domain("academic", [group("פסיכו-דידקטי", "assessment")]), teachers: [group("הוראה מתקנת", "teacher")] };
    // Beside an assessment in the same domain, the assessment keeps the button.
    expect(lead([withTeacher], { a_aca: "הרבה" })).toBe("academic::פסיכו-דידקטי");
    // Alone, a learning difficulty rated hardest is headed by the teacher.
    const teacherOnly = { ...domain("academic", []), teachers: [group("הוראה מתקנת", "teacher")] };
    expect(lead([emotional, teacherOnly], { a_emo: "מעט", a_aca: "הרבה מאוד" })).toBe("academic::הוראה מתקנת");
    // On a tie the report's own order stands, so the emotional treatment first.
    expect(lead([emotional, teacherOnly], { a_emo: "הרבה", a_aca: "הרבה" })).toBe("emotional::טיפול דינאמי");
  });

  it("names nothing when no domain has a referral with a search button", () => {
    expect(mainFinding([domain("emotional", []), domain("academic", [], true)], { a_emo: "הרבה מאוד" })).toBeNull();
  });
});

// ── End to end: the scorer's own output, split the way the results screen does ──

const DOMAINS = ["emotional", "academic", "developmental", "behavioral", "social"] as const;

/** Mirrors byDomain in app/kids/KidsQuiz.tsx: the referrals with a search button. */
function screenDomains(A: Record<string, unknown>): FindingDomain[] {
  const scored = scoreKidsQuestionnaire(A);
  return DOMAINS.map(key => {
    const r = parseKidsBoxes(scored[key], key);
    return {
      key,
      treatments: r.groups.filter(g => g.kind === "treatment" && g.treatmentKey !== "_no_action"),
      assessments: r.groups.filter(g => g.kind === "assessment"),
      professionals: r.groups.filter(g => g.kind === "professional"),
      standaloneWarnings: r.standaloneWarnings,
    };
  });
}

describe("mainFinding on scored questionnaires", () => {
  // The case seen on 30/9/26 through /school: grade 8, some tension before
  // tests, reading and English well below the class.
  const grade8 = {
    _audience: "counselor", _grade: "ח", _age: "13",
    a_emo: "מעט", a_aca: "הרבה מאוד",
    q1: 3, zh_verbal: "5%", zh_eng: "10%",
  };

  it("a learning difficulty rated 'הרבה מאוד' leads over low-level tension rated 'מעט'", () => {
    const domains = screenDomains(grade8);
    // What the header named before: the first domain in order, which here is
    // only the scorer's default referral for low-level stress.
    expect(domains[0].treatments.map(g => g.treatmentKey)).toEqual(["טיפול דינאמי"]);
    const top = mainFinding(domains, grade8);
    expect(top?.domainKey).toBe("academic");
    expect(top?.group.treatmentKey).toBe("פסיכו-דידקטי");
    expect(top?.group.kind).toBe("assessment");
  });

  it("reported suicidal thoughts keep the emotional finding first, even rated 'מעט'", () => {
    const A = { ...grade8, q3_sui: "כן" };
    const domains = screenDomains(A);
    expect(domains[0].standaloneWarnings.some(w => w.urgent)).toBe(true);
    expect(mainFinding(domains, A)?.domainKey).toBe("emotional");
  });

  it("marked social anxiety - an urgent card - leads over a learning area rated higher", () => {
    const lsas = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`lsas_a${i + 1}`, 3]));
    const A = { ...grade8, a_emo: "כלל לא", q1: 0, a_soc: "מעט", soc1: "כן", ...lsas };
    const top = mainFinding(screenDomains(A), A);
    expect(top?.domainKey).toBe("social");
    expect(top?.group.urgent).toBe(true);
  });
});
