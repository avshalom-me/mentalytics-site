import { describe, it, expect } from "vitest";
import { scoreQuestionnaire } from "./questionnaire-score";
import type { QuestionnaireAnswers } from "./questionnaire-types";

// How the first two "therapy style" answers reach the treatment type in the
// adults questionnaire - the owner's decision of 3/10/2026, finding by finding.
//
// The questions, as asked:
//   Q1: 1 = immediate practical relief ... 7 = deep insight      (high = dynamic)
//   Q2: 1 = open, free space ... 7 = clear frame, tools, tasks   (high = CBT)
//
// From 12/4/2026 until this rule the two were simply added, although they run in
// opposite directions: the clearest dynamic profile (7,1) and the clearest CBT
// profile (1,7) got the same result, and "CBT only" meant agreeing with both.

const EMO = "מורכבויות בתחום הרגשי/האישי";

function recs(emotional: Record<string, unknown>) {
  const answers = { age: 30, gender: "x", domains: ["emotional"], emotional } as unknown as QuestionnaireAnswers;
  return scoreQuestionnaire(answers).recommendations.filter((r) => r.domain === EMO);
}
const style = (q1: number, q2: number) => ({ therapistStyleQ1: q1, therapistStyleQ2: q2, therapistStyleQ3: 4 });
/** [finding text → treatment] pairs, in order. */
const report = (emotional: Record<string, unknown>) => recs(emotional).map((r) => `${r.symptomText} → ${r.treatmentLabel}`);
const treatmentOf = (emotional: Record<string, unknown>, idPrefix: string) =>
  recs(emotional).find((r) => r.id.startsWith(idPrefix))?.treatment;

// Three clear profiles and the skipped screen.
const CBT_LEAN = style(1, 7); // immediate relief + structure and tools
const DYNAMIC_LEAN = style(7, 1); // deep insight + open space
const MIXED = style(4, 4);
const SKIPPED = {};

const ALSO_WITH_CBT = "בנוסף לגישה CBT, מומלץ גם טיפול דינאמי.";
const ALSO_PLAIN = "בנוסף, מומלץ גם טיפול דינאמי.";

const LOW_MOOD = { moodItems: [0, 1, 2, 3, 4, 5] };
const MILD_MOOD = { moodItems: [0, 1, 2, 3] };
const MANIA = { maniaItems: [0, 1, 2] };
const PRODROME = { e3a: true, prodromeItems: [] };
const ANXIETY = { e4: true, gad7Scores: [3, 2, 3, 2, 2, 3, 2, 1, 2] }; // 20
const MILD_STRESS = { e4: true, gad7Scores: [2, 2, 2, 1, 1, 2, 1, 1, 1] }; // 13
const SOCIAL = { socialAnxiety: true, socialSeverity: 5 };
const SLEEP_MILD = { sleepItems: [true, false, false, false, false, false] };
const SLEEP_NEURO = { sleepItems: [false, false, true, false, false, false] };
const SLEEP_ENT = { sleepItems: [false, false, false, false, false, true] };
const OCD = { e5: true, ocdScores: [3, 3, 3, 2, 2, 2] };
const TRAUMA = { e9: true, traumaScores: [3, 3, 3, 3, 3], traumaType: "accident", traumaFreq: "single" };
const COMM = { persMainScores: [3, 3], disQAnswers: [1, 1, 1, 2] };

describe("the direction of the two style answers", () => {
  it("reads a high Q1 as leaning dynamic and a high Q2 as leaning CBT", () => {
    expect(treatmentOf({ ...LOW_MOOD, ...DYNAMIC_LEAN }, "mood-severe")).toBe("טיפול דינאמי");
    expect(treatmentOf({ ...LOW_MOOD, ...CBT_LEAN }, "mood-severe")).toBe("CBT");
  });

  it("no longer gives the two opposite profiles the same result", () => {
    expect(report({ ...LOW_MOOD, ...DYNAMIC_LEAN })).not.toEqual(report({ ...LOW_MOOD, ...CBT_LEAN }));
  });

  it("puts every pair of answers in the zone its own meaning says", () => {
    // practical = (8 - Q1) + Q2: >= 12 CBT, 7-11 mixed, <= 6 dynamic.
    const zone = (q1: number, q2: number) => {
      const r = recs({ ...LOW_MOOD, ...style(q1, q2) });
      const mood = r.find((x) => x.id.startsWith("mood-severe"))!.treatment;
      const also = r.some((x) => x.id.startsWith("emotional-dynamic-mixed"));
      return mood === "CBT" ? (also ? "mixed" : "cbt") : "dynamic";
    };
    const counts = { cbt: 0, mixed: 0, dynamic: 0 };
    for (let q1 = 1; q1 <= 7; q1++) {
      for (let q2 = 1; q2 <= 7; q2++) {
        const practical = 8 - q1 + q2;
        const expected = practical >= 12 ? "cbt" : practical >= 7 ? "mixed" : "dynamic";
        expect(zone(q1, q2), `Q1=${q1}, Q2=${q2}`).toBe(expected);
        counts[expected]++;
      }
    }
    expect(counts).toEqual({ cbt: 6, mixed: 28, dynamic: 15 });
    // The corners: agreeing with both statements, or with neither, is a mixed
    // picture - not "CBT only" and "dynamic only" as it was.
    expect(zone(7, 7)).toBe("mixed");
    expect(zone(1, 1)).toBe("mixed");
    expect(zone(1, 7)).toBe("cbt");
    expect(zone(7, 1)).toBe("dynamic");
  });

  it("needs both answers: with one missing there is no lean at all", () => {
    expect(report({ ...LOW_MOOD, therapistStyleQ1: 1 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
    expect(report({ ...LOW_MOOD, therapistStyleQ2: 7 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
  });
});

describe("findings that follow the style lean: low mood, elevated mood, reality testing", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["marked low mood", LOW_MOOD, "mood-severe"],
    ["possible low mood", MILD_MOOD, "mood-mild"],
    ["low mood with suicidality", { moodSuicidal: true, moodItems: [] }, "mood-suicidal"],
    ["elevated mood", MANIA, "mania"],
    ["reality testing", PRODROME, "prodrome"],
    ["reality testing with suicidality", { ...PRODROME, prodromeSuicidal: true }, "prodrome-suicidal"],
  ];
  for (const [name, finding, id] of cases) {
    it(`${name}: CBT on a CBT or mixed lean, dynamic on a dynamic lean or a skipped screen`, () => {
      expect(treatmentOf({ ...finding, ...CBT_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...MIXED }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...DYNAMIC_LEAN }, id)).toBe("טיפול דינאמי");
      expect(treatmentOf({ ...finding, ...SKIPPED }, id)).toBe("טיפול דינאמי");
    });
  }

  it("on a mixed lean the dynamic option is offered beside the CBT, as before", () => {
    expect(report({ ...LOW_MOOD, ...MIXED })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
    expect(report({ ...LOW_MOOD, ...CBT_LEAN })).toEqual(["נמצאו סימנים מובהקים של מצב רוח ירוד. → CBT"]);
    expect(report({ ...LOW_MOOD, ...DYNAMIC_LEAN })).toEqual(["נמצאו סימנים מובהקים של מצב רוח ירוד. → טיפול דינאמי"]);
  });
});

describe("anxiety: CBT first", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["general anxiety", ANXIETY, "gad7-severe"],
    ["mild stress", MILD_STRESS, "gad7-mild"],
    ["social anxiety, high", SOCIAL, "social-anxiety-high"],
    ["social anxiety", { socialAnxiety: true, socialSeverity: 2 }, "social-anxiety-low"],
  ];
  for (const [name, finding, id] of cases) {
    it(`${name}: always CBT, whatever the lean`, () => {
      for (const s of [CBT_LEAN, MIXED, DYNAMIC_LEAN, SKIPPED]) {
        expect(treatmentOf({ ...finding, ...s }, id)).toBe("CBT");
      }
    });
  }

  it("offers dynamic therapy beside it when the lean is mixed or dynamic, and not when it is CBT or unknown", () => {
    const text = "נמצאו קשיים בניהול חרדה ומתח. → CBT";
    expect(report({ ...ANXIETY, ...CBT_LEAN })).toEqual([text]);
    expect(report({ ...ANXIETY, ...MIXED })).toEqual([text, `${ALSO_WITH_CBT} → טיפול דינאמי`]);
    expect(report({ ...ANXIETY, ...DYNAMIC_LEAN })).toEqual([text, `${ALSO_WITH_CBT} → טיפול דינאמי`]);
    expect(report({ ...ANXIETY, ...SKIPPED })).toEqual([text]);
  });

  it("with low mood beside it on a dynamic lean: mood goes dynamic, anxiety stays CBT", () => {
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...DYNAMIC_LEAN })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → טיפול דינאמי",
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
  });
});

describe("findings that are always dynamic: sleep, the communication finding, the default", () => {
  for (const s of [CBT_LEAN, MIXED, DYNAMIC_LEAN, SKIPPED]) {
    const label = s === CBT_LEAN ? "CBT lean" : s === MIXED ? "mixed lean" : s === DYNAMIC_LEAN ? "dynamic lean" : "skipped";
    it(`${label}: each of them is dynamic therapy and nothing else`, () => {
      expect(report({ ...SLEEP_MILD, ...s })).toEqual(["דווחו קשיי שינה קלים. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_NEURO, ...s })).toEqual(["נמצאו סימנים להפרעת שינה. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_ENT, ...s })).toEqual(["דווח על נזלת כרונית מרובה. → טיפול דינאמי"]);
      expect(report({ ...COMM, ...s })).toEqual(["נמצאו סימנים לקשיים בתקשורת הבינאישית. → טיפול דינאמי"]);
      expect(report({ ...s })).toEqual(["נמצאו סימנים כלליים בתחום הרגשי. → טיפול דינאמי"]);
    });
  }

  it("sleep keeps its referral to a physician", () => {
    expect(recs({ ...SLEEP_NEURO, ...MIXED })[0].notes).toMatch(/רופא המשפחה או נוירולוג/);
    expect(recs({ ...SLEEP_ENT, ...MIXED })[0].notes).toMatch(/אף-אוזן-גרון/);
  });
});

describe("the 'also dynamic' line", () => {
  it("still joins a symptom-fixed CBT finding on a mixed lean", () => {
    expect(report({ ...OCD, ...MIXED })).toEqual([
      "נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
    // ...and only on a mixed lean: OCD is not an anxiety finding that the lean reopens.
    expect(report({ ...OCD, ...DYNAMIC_LEAN })).toEqual(["נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות. → CBT"]);
    expect(report({ ...OCD, ...CBT_LEAN })).toEqual(["נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות. → CBT"]);
  });

  it("does not speak of CBT when no CBT was recommended", () => {
    const r = report({ ...TRAUMA, ...MIXED });
    expect(r).toContain(`${ALSO_PLAIN} → טיפול דינאמי`);
    expect(r.join("\n")).not.toContain("לגישה CBT");
  });

  it("stands beside CBT even when another finding is already dynamic", () => {
    expect(report({ ...LOW_MOOD, ...SLEEP_MILD, ...MIXED })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → CBT",
      "דווחו קשיי שינה קלים. → טיפול דינאמי",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
  });

  it("appears once, and only in the emotional domain", () => {
    const all = scoreQuestionnaire({
      age: 30, gender: "x", domains: ["emotional"], emotional: { ...LOW_MOOD, ...ANXIETY, ...OCD, ...MIXED },
    } as unknown as QuestionnaireAnswers).recommendations;
    expect(all.filter((r) => r.id.startsWith("emotional-dynamic-mixed"))).toHaveLength(1);
  });
});

describe("what did not change", () => {
  it("findings fixed by the symptom ignore the style answers", () => {
    for (const s of [CBT_LEAN, DYNAMIC_LEAN, SKIPPED]) {
      expect(treatmentOf({ ...OCD, ...s }, "ocd-sig")).toBe("CBT");
      expect(treatmentOf({ ...TRAUMA, ...s }, "trauma-emdr")).toBe("EMDR");
      expect(treatmentOf({ maniaItems: [0, 1, 2], maniaDeath: true, ...s }, "mania-suicidal")).toBe("CBT");
      expect(treatmentOf({ e4: true, gad7Scores: [], ...s }, "gad7-unspecified")).toBe("CBT");
    }
  });

  it("the style answers of someone who did not choose the emotional domain change nothing", () => {
    const base = { age: 30, gender: "x", domains: ["personal_development"] };
    const a = scoreQuestionnaire({ ...base, emotional: CBT_LEAN } as unknown as QuestionnaireAnswers).recommendations;
    const b = scoreQuestionnaire({ ...base, emotional: DYNAMIC_LEAN } as unknown as QuestionnaireAnswers).recommendations;
    expect(a.map((r) => r.treatment)).toEqual(["טיפול דינאמי"]);
    expect(b.map((r) => r.treatment)).toEqual(["טיפול דינאמי"]);
  });
});
