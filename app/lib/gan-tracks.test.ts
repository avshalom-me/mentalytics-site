import { describe, it, expect } from "vitest";
import {
  ganTracks,
  ganWindow,
  ganEntryCohort,
  ganCategoryStates,
  ganTimelineMarks,
  type GanTracksInput,
} from "./gan-tracks";
import { diagnosisGate } from "./school-tracks";

const TODAY = "2026-09-23";
const base = (over: Partial<GanTracksInput> = {}): GanTracksInput => ({ grade: "גן3", today: TODAY, diagnoses: [], ...over });
const byKey = (tracks: ReturnType<typeof ganTracks>, key: string) => tracks.find(t => t.key === key);
const keys = (tracks: ReturnType<typeof ganTracks>) => tracks.map(t => t.key);

describe("the kindergarten calendar", () => {
  it("puts referral at 31.3, the team from 1.3, hearings to 31.5 and the follow-up to 15.7", () => {
    const w = ganWindow(TODAY);
    expect(w.deadline).toBe("2027-03-31");
    expect(w.teamFrom).toBe("2027-03-01");
    expect(w.committeesFinishBy).toBe("2027-05-31");
    expect(w.followUpBy).toBe("2027-07-15");
    expect(w.extraYearFormsBy).toBe("2027-03-01");
    expect(w.extraYearNoticeBy).toBe("2027-05-31");
    expect(w.placementStart).toBe(2027);
    expect(w.placementYear).toContain("2027/28");
  });

  it("closes the window after 31.3 and points at the next September", () => {
    const w = ganWindow("2027-04-02");
    expect(w.open).toBe(false);
    expect(w.nextOpens).toBe("2027-09-01");
  });

  it("sends a child to the age-3 kindergarten by civil year of birth", () => {
    // תשפ"ז (September 2026) took the children born in 2023 [G9].
    expect(ganEntryCohort(2026)).toBe(2023);
    expect(ganEntryCohort(2027)).toBe(2024);
  });
});

describe("the documents a kindergarten file holds", () => {
  it("accepts a speech therapist's report for language delay only from a development institute", () => {
    expect(diagnosisGate({ kind: "קלינאית תקשורת - מכון התפתחות", year: 2026 }, "עיכוב התפתחותי בתחום השפה")).toBe("acceptable");
    expect(diagnosisGate({ kind: "קלינאית תקשורת", year: 2026 }, "עיכוב התפתחותי בתחום השפה")).toBe("not_acceptable");
  });

  it("asks who signed a development institute's summary, and knows the answer's reach", () => {
    const summary = { kind: "סיכום מכון התפתחות הילד" as const, year: 2026 };
    expect(diagnosisGate(summary, "מוגבלות על רצף האוטיזם")).toBe("verify_signer");
    const byPaediatrician = { ...summary, signedBy: "רופא ילדים בעל ניסיון של שלוש שנים לפחות במכון מוכר להתפתחות הילד" as const };
    expect(diagnosisGate(byPaediatrician, "מוגבלות על רצף האוטיזם")).toBe("acceptable");
    // The functional-delay entry names the neurologist, not the developmental paediatrician [A].
    expect(diagnosisGate(byPaediatrician, "עיכוב התפתחותי בתחום התפקודי")).toBe("not_acceptable");
  });

  it("reads the functional-delay combination across two reports", () => {
    const psych = { kind: "פסיכולוג התפתחותי" as const, year: 2026 };
    const ot = { kind: "ריפוי בעיסוק" as const, year: 2026 };
    expect(ganCategoryStates([ot])["עיכוב התפתחותי בתחום התפקודי"]).toBe("not_acceptable");
    expect(ganCategoryStates([psych])["עיכוב התפתחותי בתחום התפקודי"]).toBe("not_acceptable");
    expect(ganCategoryStates([psych, ot])["עיכוב התפתחותי בתחום התפקודי"]).toBe("acceptable");
  });
});

describe("the kindergarten map", () => {
  it("shows only the kindergarten team when nothing points anywhere", () => {
    expect(keys(ganTracks(base()))).toEqual(["gan_team"]);
    expect(byKey(ganTracks(base()), "gan_team")!.relevance).toBe("primary");
  });

  it("sends a language finding to the development institute first, with the committee behind it", () => {
    const t = ganTracks(base({ directions: ["language"], age: 4 }));
    expect(byKey(t, "gan_team")!.relevance).toBe("primary");
    expect(byKey(t, "dev_center")!.relevance).toBe("primary");
    expect(byKey(t, "dev_center")!.cautions.join(" ")).toContain("עד גיל שנה - 3 חודשים");
    const z = byKey(t, "zakaut")!;
    expect(z.relevance).toBe("info");
    expect(z.why.join(" ")).toContain("בהיעדר מסמך קביל על אבחנת המוגבלות לא תתאפשר קביעת זכאות");
    expect(z.deadline!.label).toContain("31.3.2027");
    expect(z.steps.join(" ")).toContain("15.7.2027");
    // The speech ground starts at 3.
    expect(byKey(t, "btl")!.why.join(" ")).toContain("בעיות בדיבור");
  });

  it("raises the committee to 'consider' once the file holds an acceptable document", () => {
    const t = ganTracks(base({ directions: ["language"], diagnoses: [{ kind: "קלינאית תקשורת - מכון התפתחות", year: 2026 }], devCenter: "done" }));
    expect(byKey(t, "zakaut")!.relevance).toBe("consider");
    expect(byKey(t, "dev_center")!.relevance).toBe("info");
  });

  it("warns when the longest wait would carry the assessment past 31.3, and names the 15.7 way through", () => {
    const late = ganTracks(base({ today: "2026-12-15", directions: ["functional"] }));
    expect(byKey(late, "dev_center")!.cautions.join(" ")).toContain("אישור שהאבחון בתהליך");
    const early = ganTracks(base({ directions: ["functional"] }));
    expect(byKey(early, "dev_center")!.cautions.join(" ")).not.toContain("אישור שהאבחון בתהליך");
  });

  it("gives a toddler the day-care centre and the committee ahead of kindergarten, and no kindergarten team", () => {
    const t = ganTracks(base({ grade: "פעוט", age: 2, directions: ["functional"] }));
    expect(byKey(t, "gan_team")).toBeUndefined();
    expect(byKey(t, "rehab_daycare")!.relevance).toBe("consider");
    const z = byKey(t, "zakaut")!;
    expect(z.name).toContain("לקראת הכניסה לגן");
    expect(z.why.join(" ")).toContain("ילידי 2024 נכנסים לגן בספטמבר 2027");
    // Under 3 the developmental-delay ground applies, not the speech one.
    const btl = byKey(t, "btl")!.why.join(" ");
    expect(btl).toContain("עיכוב התפתחותי: מגיל 91 יום ועד 3");
    expect(btl).not.toContain("בעיות בדיבור");
  });

  it("hears an eligible child in גן חובה again for first grade instead of referring anew", () => {
    const t = ganTracks(base({ grade: "גן", setting: "special_gan", directions: ["language"] }));
    expect(byKey(t, "first_grade")!.relevance).toBe("primary");
    expect(byKey(t, "first_grade")!.why.join(" ")).toContain("עד גיל 9");
    expect(byKey(t, "zakaut")).toBeUndefined();
    // A special-education kindergarten has its own team.
    expect(byKey(t, "gan_team")).toBeUndefined();
  });

  it("puts the extra year on the map only when the teacher raised it, with 0448's dates", () => {
    expect(byKey(ganTracks(base({ grade: "גן" })), "extra_year")).toBeUndefined();
    const t = ganTracks(base({ grade: "גן", extraYear: "considering" }));
    const e = byKey(t, "extra_year")!;
    expect(e.relevance).toBe("consider");
    expect(e.deadline!.label).toContain("1.3.2027");
    expect(e.why.join(" ")).toContain("ילידי ספטמבר-דצמבר");
    expect(e.steps.join(" ")).toContain("אינה דנה בהשארה בגן חובה");
    const afterForms = byKey(ganTracks(base({ grade: "גן", extraYear: "requested", today: "2027-04-10" })), "extra_year")!;
    expect(afterForms.deadline!.label).toContain("סוף מאי");
  });

  it("opens the 21-day objection with the kindergarten's noun", () => {
    const t = ganTracks(base({ zakaut: { status: "decided", decisionReceivedOn: "2026-09-10" } }));
    const a = byKey(t, "zakaut_appeal")!;
    expect(a.relevance).toBe("primary");
    expect(a.steps[0]).toContain("את הילד/ה");
  });

  it("answers בהתלבטות with the kindergarten's conditions", () => {
    const z = byKey(ganTracks(base({ directions: ["language"], zakaut: { status: "considering" }, team: { convened: false } })), "zakaut")!;
    const labels = z.decision!.items.map(i => i.label);
    expect(labels).toContain("הערכה במכון להתפתחות הילד");
    expect(labels).toContain("שאלון הפניה ומסמך מיצוי אפשרויות מהגן - עד סוף מרץ");
    expect(z.decision!.headline).toMatch(/^כדי להחליט חסר: /);
  });

  it("holds the emotional route behind its attempts, as at school", () => {
    const t = ganTracks(base({ pendingDirections: ["emotional"], exhaustionNote: "מומלץ להשלים ..." }));
    expect(byKey(t, "exhaustion")!.relevance).toBe("primary");
    expect(byKey(t, "zakaut")).toBeUndefined();
  });

  it("says after 31.3 that a kindergarten child may still be heard outside the dates", () => {
    const z = byKey(ganTracks(base({ today: "2027-04-15", directions: ["autism"] })), "zakaut")!;
    expect(z.deadline!.label).toContain("חלף");
    expect(z.deadline!.note).toContain("לכל סוגי המוגבלויות");
  });
});

describe("the kindergarten year line", () => {
  it("draws the committee's calendar - the extra year's dates stay on their card", () => {
    const tracks = ganTracks(base({ grade: "גן", extraYear: "considering" }));
    expect(ganTimelineMarks("גן", tracks, TODAY).map(m => m.iso)).toEqual(["2027-03-31", "2027-05-31", "2027-07-15"]);
    expect(byKey(tracks, "extra_year")!.deadline!.label).toContain("1.3.2027");
  });

  it("adds the end of the objection window while it is open", () => {
    const tracks = ganTracks(base({ zakaut: { status: "decided", decisionReceivedOn: "2026-09-10" } }));
    const marks = ganTimelineMarks("גן3", tracks, TODAY);
    expect(marks[0]).toEqual({ iso: "2026-10-01", label: "סוף חלון ההשגה", tone: "gold" });
  });
});
