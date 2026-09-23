import { describe, it, expect } from "vitest";
import type { KidsDomainResult } from "./kids-recommendations";
import { buildKidsReportDoc, toolGroupsOf, KIDS_REPORT_FOOT } from "./kids-report-doc";

const anxiety: KidsDomainResult = {
  groups: [
    {
      treatmentKey: "CBT", treatmentLabel: "טיפול CBT לחרדה", kind: "treatment", urgent: false,
      recs: [{
        id: "r1", domain: "emotional", symptoms: ["📊 נמצאו סימנים לחרדה"], kind: "treatment",
        treatmentKey: "CBT", treatmentLabel: "טיפול CBT לחרדה", referralText: "✅ הפנייה: טיפול CBT לחרדה",
        notes: "בעדיפות למטפל/ת עם ניסיון בגיל הרך",
        tools: [{ text: "📌 כלים להפחתת מתח: 🟢 קרקוע 🟢 נשימות", sourceSymptom: "📊 נמצאו סימנים לחרדה" }],
        urgent: false,
      }],
    },
    {
      treatmentKey: "פסיכיאטר", treatmentLabel: "הערכה פסיכיאטרית", kind: "professional", urgent: true,
      recs: [{
        id: "r2", domain: "emotional", symptoms: ["📊 נמצאו סימנים לחרדה"], kind: "professional",
        treatmentKey: "פסיכיאטר", treatmentLabel: "הערכה פסיכיאטרית", referralText: "", tools: [], urgent: true,
      }],
    },
    {
      treatmentKey: "_no_action", treatmentLabel: "", kind: "treatment", urgent: false,
      recs: [{
        id: "r3", domain: "emotional", symptoms: ["📊 מתח ברמה נמוכה"], kind: "treatment",
        treatmentKey: "_no_action", treatmentLabel: "", referralText: "", tools: [], urgent: false,
      }],
    },
  ],
  externalNotes: [],
  standaloneWarnings: [{ text: "⚠️ מומלץ לשלול גורם רפואי לפני הטיפול", urgent: false }],
};

const base = {
  dateLabel: "23.9.2026",
  details: [["גיל", "9"], ["כיתה", "כיתה ג"], ["מגדר", ""], ["BMI", "-"]] as [string, string][],
  areas: [["רגשי", "הרבה"], ["לימודי", "מעט"]] as [string, string][],
  domains: [{ label: "🧠 תחום רגשי", result: anxiety }],
  notes: [],
};

describe("buildKidsReportDoc - the parent's report as a document", () => {
  const doc = buildKidsReportDoc(base);
  const section = (title: string) => doc.sections.find(s => s.title === title);

  it("opens with the report's own title and the date, and closes with the disclaimer", () => {
    expect(doc.head).toBe("דוח ממצאים - שאלון הכוונה טיפולית לילדים ונוער");
    expect(doc.meta).toContain("23.9.2026");
    expect(doc.foot).toBe(KIDS_REPORT_FOOT);
  });

  it("lists the details that were given, and the areas with the level the parent chose", () => {
    expect(section("פרטים")?.lines).toEqual(["גיל: 9", "כיתה: כיתה ג", "תחומי קושי שסומנו: רגשי (הרבה), לימודי (מעט)"]);
  });

  it("names the domain without its emoji, findings first, then each kind of referral in the screen's order", () => {
    const emo = section("תחום רגשי")!;
    expect(emo.lines[0]).toBe("ממצאים: נמצאו סימנים לחרדה; מתח ברמה נמוכה");
    expect(emo.lines[1]).toBe("טיפול מומלץ: טיפול CBT לחרדה");
    expect(emo.lines[2]).toBe("פנייה לאיש/ת מקצוע: הערכה פסיכיאטרית (דחוף)");
  });

  it("carries the referral's own notes and the domain's warnings", () => {
    const emo = section("תחום רגשי")!;
    expect(emo.lines).toContain("בעדיפות למטפל/ת עם ניסיון בגיל הרך");
    expect(emo.lines).toContain("מומלץ לשלול גורם רפואי לפני הטיפול");
  });

  it("never prints the no-action group as a referral", () => {
    expect(doc.sections.flatMap(s => s.lines).some(l => l.includes("טיפול מומלץ: ;") || l.endsWith(": "))).toBe(false);
  });

  it("says what the screen says when nothing was found", () => {
    const empty = buildKidsReportDoc({
      ...base, domains: [],
      noFindings: { title: "לא נמצאו ממצאים משמעותיים בתחומים שנבדקו", line: "✅ מומלץ לפנות לטיפול פסיכודינאמי." },
    });
    expect(empty.sections.map(s => s.title)).toContain("לא נמצאו ממצאים משמעותיים בתחומים שנבדקו");
    expect(empty.sections.flatMap(s => s.lines)).toContain("מומלץ לפנות לטיפול פסיכודינאמי.");
  });

  it("gives the medical note a section of its own, and splits cross-domain notes into lines", () => {
    const d = buildKidsReportDoc({ ...base, medicalNote: "ה-BMI של הילד/ה אינו בטווח", notes: ["📌 שורה א\nשורה ב", "שורה ב"] });
    expect(d.sections.find(s => s.title === "לתשומת לב")?.lines).toEqual(["ה-BMI של הילד/ה אינו בטווח"]);
    expect(d.sections.find(s => s.title === "הערות נוספות")?.lines).toEqual(["שורה א", "שורה ב"]);
  });
});

describe("toolGroupsOf - the tools appendix both reports share", () => {
  it("groups a tool under the finding that produced it, without the screen's marks", () => {
    expect(toolGroupsOf([{ result: anxiety }])).toEqual([
      { title: "נמצאו סימנים לחרדה", tools: ["כלים להפחתת מתח: 🟢 קרקוע 🟢 נשימות"] },
    ]);
  });

  it("leaves out a finding with no tools", () => {
    expect(toolGroupsOf([{ result: { ...anxiety, groups: [anxiety.groups[1]] } }])).toEqual([]);
  });
});
