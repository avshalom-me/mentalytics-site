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
//
// practical = (8 - Q1) + Q2, 2-14 with 8 in the middle:
//   12-14  a clear CBT lean
//   7-11   mixed
//   5-6    a dynamic lean
//   2-4    a markedly dynamic lean - the only one that turns anxiety to dynamic

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
const hasAlsoLine = (emotional: Record<string, unknown>) =>
  recs(emotional).some((r) => r.id.startsWith("emotional-dynamic-mixed"));

const CBT_LEAN = style(1, 7); // immediate relief + structure and tools (14)
const MIXED = style(4, 4); // the middle (8)
const DYNAMIC_LEAN = style(6, 3); // leans to insight and open space, not at the edge (5)
const CLEAR_DYNAMIC = style(7, 1); // deep insight + open space (2)
const SKIPPED = {};
const ALL_STYLES = [CBT_LEAN, MIXED, DYNAMIC_LEAN, CLEAR_DYNAMIC, SKIPPED];

const EVERY_PAIR: [number, number][] = [];
for (let q1 = 1; q1 <= 7; q1++) for (let q2 = 1; q2 <= 7; q2++) EVERY_PAIR.push([q1, q2]);
const practical = (q1: number, q2: number) => 8 - q1 + q2;

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
const EATING = { eating1Count: 2 };
const COMM = { persMainScores: [3, 3], disQAnswers: [1, 1, 1, 2] };

describe("the direction of the two style answers", () => {
  it("reads a high Q1 as leaning dynamic and a high Q2 as leaning CBT", () => {
    expect(treatmentOf({ ...LOW_MOOD, ...CLEAR_DYNAMIC }, "mood-severe")).toBe("טיפול דינאמי");
    expect(treatmentOf({ ...LOW_MOOD, ...CBT_LEAN }, "mood-severe")).toBe("CBT");
  });

  it("no longer gives the two opposite profiles the same result", () => {
    expect(report({ ...LOW_MOOD, ...CLEAR_DYNAMIC })).not.toEqual(report({ ...LOW_MOOD, ...CBT_LEAN }));
  });

  it("agreeing with both statements, or with neither, is the middle - not an edge", () => {
    // Until this rule 7/7 was "CBT only" and 1/1 "dynamic only".
    expect(report({ ...LOW_MOOD, ...style(7, 7) })).toEqual(report({ ...LOW_MOOD, ...MIXED }));
    expect(report({ ...LOW_MOOD, ...style(1, 1) })).toEqual(report({ ...LOW_MOOD, ...MIXED }));
  });

  it("needs both answers: with one missing there is no lean at all", () => {
    expect(report({ ...LOW_MOOD, therapistStyleQ1: 1 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
    expect(report({ ...LOW_MOOD, therapistStyleQ2: 7 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
    expect(report({ ...ANXIETY, therapistStyleQ1: 7 })).toEqual(report({ ...ANXIETY, ...SKIPPED }));
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
      expect(treatmentOf({ ...finding, ...CLEAR_DYNAMIC }, id)).toBe("טיפול דינאמי");
      expect(treatmentOf({ ...finding, ...SKIPPED }, id)).toBe("טיפול דינאמי");
    });
  }

  it("the cut is at 7: every pair of answers from there up is CBT, below it dynamic", () => {
    const counts = { CBT: 0, "טיפול דינאמי": 0 };
    for (const [q1, q2] of EVERY_PAIR) {
      const expected = practical(q1, q2) >= 7 ? "CBT" : "טיפול דינאמי";
      expect(treatmentOf({ ...LOW_MOOD, ...style(q1, q2) }, "mood-severe"), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      counts[expected]++;
    }
    expect(counts).toEqual({ CBT: 34, "טיפול דינאמי": 15 });
  });
});

describe("anxiety: one method, with CBT ahead", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["general anxiety", ANXIETY, "gad7-severe"],
    ["mild stress", MILD_STRESS, "gad7-mild"],
    ["social anxiety, high", SOCIAL, "social-anxiety-high"],
    ["social anxiety", { socialAnxiety: true, socialSeverity: 2 }, "social-anxiety-low"],
  ];
  for (const [name, finding, id] of cases) {
    it(`${name}: CBT, and dynamic therapy only on a markedly dynamic lean`, () => {
      expect(treatmentOf({ ...finding, ...CBT_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...MIXED }, id)).toBe("CBT");
      // Leaning dynamic is not enough - this is where CBT's head start shows.
      expect(treatmentOf({ ...finding, ...DYNAMIC_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...CLEAR_DYNAMIC }, id)).toBe("טיפול דינאמי");
      // Nothing to lean on: CBT.
      expect(treatmentOf({ ...finding, ...SKIPPED }, id)).toBe("CBT");
    });
  }

  it("the cut is at 4: the six pairs that mirror the 'CBT only' zone, and no others", () => {
    const dynamicPairs: string[] = [];
    for (const [q1, q2] of EVERY_PAIR) {
      const expected = practical(q1, q2) <= 4 ? "טיפול דינאמי" : "CBT";
      expect(treatmentOf({ ...ANXIETY, ...style(q1, q2) }, "gad7-severe"), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      if (expected === "טיפול דינאמי") dynamicPairs.push(`${q1}/${q2}`);
    }
    expect(dynamicPairs).toEqual(["5/1", "6/1", "6/2", "7/1", "7/2", "7/3"]);
  });

  it("is never given two methods: one line, whatever the lean", () => {
    expect(report({ ...ANXIETY, ...CBT_LEAN })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...MIXED })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...DYNAMIC_LEAN })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...CLEAR_DYNAMIC })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → טיפול דינאמי"]);
    expect(report({ ...ANXIETY, ...SKIPPED })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
  });
});

describe("findings that are always dynamic: sleep, the communication finding, the default", () => {
  ALL_STYLES.forEach((s, i) => {
    const label = ["CBT lean", "mixed lean", "dynamic lean", "markedly dynamic lean", "skipped"][i];
    it(`${label}: each of them is dynamic therapy and nothing else`, () => {
      expect(report({ ...SLEEP_MILD, ...s })).toEqual(["דווחו קשיי שינה קלים. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_NEURO, ...s })).toEqual(["נמצאו סימנים להפרעת שינה. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_ENT, ...s })).toEqual(["דווח על נזלת כרונית מרובה. → טיפול דינאמי"]);
      expect(report({ ...COMM, ...s })).toEqual(["נמצאו סימנים לקשיים בתקשורת הבינאישית. → טיפול דינאמי"]);
      expect(report({ ...s })).toEqual(["נמצאו סימנים כלליים בתחום הרגשי. → טיפול דינאמי"]);
    });
  });

  it("every sleep finding sends to a physician, the mild one included", () => {
    expect(recs({ ...SLEEP_NEURO, ...MIXED })[0].notes).toMatch(/רופא המשפחה או נוירולוג/);
    expect(recs({ ...SLEEP_ENT, ...MIXED })[0].notes).toMatch(/אף-אוזן-גרון/);
    const mild = recs({ ...SLEEP_MILD, ...MIXED })[0];
    expect(mild.notes).toMatch(/^התייעצות עם רופא המשפחה\./);
    // ...and keeps the sleep-hygiene advice it had.
    expect(mild.notes).toMatch(/היגיינת שינה/);
    expect(mild.tools).toMatch(/שעות שינה קבועות/);
  });
});

describe("two methods side by side: only in a report with several symptoms", () => {
  const SINGLE_SYMPTOMS: [string, Record<string, unknown>][] = [
    ["low mood", LOW_MOOD],
    ["low mood, urgent card and regular card", { moodSuicidal: true, ...LOW_MOOD }],
    ["elevated mood", MANIA],
    ["reality testing", PRODROME],
    ["general anxiety", ANXIETY],
    ["social anxiety", SOCIAL],
    ["sleep, two cards", { sleepItems: [true, false, false, false, false, true] }],
    ["communication", COMM],
    ["OCD", OCD],
    ["trauma, several cards", TRAUMA],
    ["eating, two cards", EATING],
    ["nothing found", {}],
  ];
  for (const [name, finding] of SINGLE_SYMPTOMS) {
    it(`a single symptom (${name}) never gets the 'also dynamic' line, on any pair of answers`, () => {
      for (const [q1, q2] of EVERY_PAIR) {
        expect(hasAlsoLine({ ...finding, ...style(q1, q2) }), `Q1=${q1}, Q2=${q2}`).toBe(false);
      }
      expect(hasAlsoLine({ ...finding, ...SKIPPED })).toBe(false);
    });
  }

  it("one symptom whose method follows the style answers comes out as exactly one method", () => {
    for (const finding of [LOW_MOOD, MANIA, PRODROME, ANXIETY, SOCIAL]) {
      for (const [q1, q2] of EVERY_PAIR) {
        const methods = new Set(recs({ ...finding, ...style(q1, q2) }).map((r) => r.treatment));
        expect(methods.size, `Q1=${q1}, Q2=${q2}`).toBe(1);
      }
    }
  });

  it("several symptoms on a mixed lean: the dynamic option joins the CBT", () => {
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...MIXED })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → CBT",
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
    // A symptom-fixed CBT finding counts as a symptom like any other.
    expect(report({ ...ANXIETY, ...OCD, ...MIXED })).toEqual([
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
      "נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
  });

  it("the line needs a mixed lean: across all pairs it appears from 7 to 11 and nowhere else", () => {
    const counts = { with: 0, without: 0 };
    for (const [q1, q2] of EVERY_PAIR) {
      const p = practical(q1, q2);
      const expected = p >= 7 && p <= 11;
      expect(hasAlsoLine({ ...LOW_MOOD, ...OCD, ...style(q1, q2) }), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      counts[expected ? "with" : "without"]++;
    }
    expect(counts).toEqual({ with: 28, without: 21 });
    expect(hasAlsoLine({ ...LOW_MOOD, ...OCD, ...SKIPPED })).toBe(false);
  });

  it("several symptoms on a dynamic lean: each symptom its own method, and no extra line", () => {
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...DYNAMIC_LEAN })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → טיפול דינאמי",
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
    ]);
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...CLEAR_DYNAMIC })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → טיפול דינאמי",
      "נמצאו קשיים בניהול חרדה ומתח. → טיפול דינאמי",
    ]);
  });

  it("several symptoms on a CBT lean: CBT, and no extra line", () => {
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...CBT_LEAN })).toEqual([
      "נמצאו סימנים מובהקים של מצב רוח ירוד. → CBT",
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
    ]);
  });

  it("does not speak of CBT when no CBT was recommended", () => {
    const r = report({ ...TRAUMA, ...EATING, ...MIXED });
    expect(r).toContain(`${ALSO_PLAIN} → טיפול דינאמי`);
    expect(r.join("\n")).not.toContain("לגישה CBT");
  });

  it("is left out when dynamic therapy is already the only recommendation", () => {
    expect(report({ ...SLEEP_MILD, ...COMM, ...MIXED })).toEqual([
      "דווחו קשיי שינה קלים. → טיפול דינאמי",
      "נמצאו סימנים לקשיים בתקשורת הבינאישית. → טיפול דינאמי",
    ]);
  });

  it("stands beside CBT even when another symptom is already dynamic", () => {
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
    for (const s of ALL_STYLES) {
      expect(treatmentOf({ ...OCD, ...s }, "ocd-sig")).toBe("CBT");
      expect(treatmentOf({ ...TRAUMA, ...s }, "trauma-emdr")).toBe("EMDR");
      expect(treatmentOf({ maniaItems: [0, 1, 2], maniaDeath: true, ...s }, "mania-suicidal")).toBe("CBT");
      expect(treatmentOf({ e4: true, gad7Scores: [], ...s }, "gad7-unspecified")).toBe("CBT");
    }
  });

  it("the style answers of someone who did not choose the emotional domain change nothing", () => {
    const base = { age: 30, gender: "x", domains: ["personal_development"] };
    const a = scoreQuestionnaire({ ...base, emotional: CBT_LEAN } as unknown as QuestionnaireAnswers).recommendations;
    const b = scoreQuestionnaire({ ...base, emotional: CLEAR_DYNAMIC } as unknown as QuestionnaireAnswers).recommendations;
    expect(a.map((r) => r.treatment)).toEqual(["טיפול דינאמי"]);
    expect(b.map((r) => r.treatment)).toEqual(["טיפול דינאמי"]);
  });
});
