import { describe, it, expect } from "vitest";
import { scoreQuestionnaire } from "./questionnaire-score";
import type { QuestionnaireAnswers } from "./questionnaire-types";

// How the first two "therapy style" answers reach the treatment type in the
// adults questionnaire - the owner's decision of 3/10/2026, finding by finding,
// with the "both" zone of 30/10/2026.
//
// The questions, as asked:
//   Q1: 1 = immediate practical relief ... 7 = deep insight      (high = dynamic)
//   Q2: 1 = open, free space ... 7 = clear frame, tools, tasks   (high = CBT)
//
// From 12/4/2026 until 30/10/2026 the two were simply added in production,
// although they run in opposite directions: the clearest dynamic profile (7,1)
// and the clearest CBT profile (1,7) got the same result, and "CBT only" meant
// agreeing with both.
//
// practical = (8 - Q1) + Q2, 2-14 with 8 in the middle:
//   9-14   a CBT lean
//   6-8    both: the two methods side by side, neither first
//   5      a dynamic lean
//   2-4    a markedly dynamic lean - the only one that turns anxiety to dynamic

const EMO = "מורכבויות בתחום הרגשי/האישי";
const BOTH = "CBT או טיפול דינאמי";
const DYN = "טיפול דינאמי";

function score(emotional: Record<string, unknown>) {
  const answers = { age: 30, gender: "x", domains: ["emotional"], emotional } as unknown as QuestionnaireAnswers;
  return scoreQuestionnaire(answers);
}
function recs(emotional: Record<string, unknown>) {
  return score(emotional).recommendations.filter((r) => r.domain === EMO);
}
const style = (q1: number, q2: number) => ({ therapistStyleQ1: q1, therapistStyleQ2: q2, therapistStyleQ3: 4 });
/** [finding text → treatment] pairs, in order. */
const report = (emotional: Record<string, unknown>) => recs(emotional).map((r) => `${r.symptomText} → ${r.treatmentLabel}`);
const treatmentOf = (emotional: Record<string, unknown>, idPrefix: string) =>
  recs(emotional).find((r) => r.id.startsWith(idPrefix))?.treatment;
const hasAlsoLine = (emotional: Record<string, unknown>) =>
  recs(emotional).some((r) => r.id.startsWith("emotional-dynamic-mixed"));

const CBT_LEAN = style(1, 7); // immediate relief + structure and tools (14)
const BOTH_LEAN = style(4, 4); // the middle (8)
const DYNAMIC_LEAN = style(6, 3); // leans to insight and open space, not at the edge (5)
const CLEAR_DYNAMIC = style(7, 1); // deep insight + open space (2)
const SKIPPED = {};
const ALL_STYLES = [CBT_LEAN, BOTH_LEAN, DYNAMIC_LEAN, CLEAR_DYNAMIC, SKIPPED];

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
const UNSPECIFIED_ANXIETY = { e4: true, gad7Scores: [] };
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
    expect(treatmentOf({ ...LOW_MOOD, ...CLEAR_DYNAMIC }, "mood-severe")).toBe(DYN);
    expect(treatmentOf({ ...LOW_MOOD, ...CBT_LEAN }, "mood-severe")).toBe("CBT");
  });

  it("no longer gives the two opposite profiles the same result", () => {
    expect(report({ ...LOW_MOOD, ...CLEAR_DYNAMIC })).not.toEqual(report({ ...LOW_MOOD, ...CBT_LEAN }));
  });

  it("more wish for insight never moves a person towards CBT", () => {
    // The bug in production until 30/10/2026: 5/1 gave dynamic, 6/1 gave CBT.
    const rank = { [DYN]: 0, [BOTH]: 1, CBT: 2 } as Record<string, number>;
    for (let q2 = 1; q2 <= 7; q2++) {
      for (let q1 = 1; q1 < 7; q1++) {
        const less = rank[treatmentOf({ ...LOW_MOOD, ...style(q1, q2) }, "mood-severe") ?? ""];
        const more = rank[treatmentOf({ ...LOW_MOOD, ...style(q1 + 1, q2) }, "mood-severe") ?? ""];
        expect(more, `Q1=${q1}→${q1 + 1}, Q2=${q2}`).toBeLessThanOrEqual(less);
      }
    }
  });

  it("agreeing with both statements, or with neither, is the middle - not an edge", () => {
    expect(report({ ...LOW_MOOD, ...style(7, 7) })).toEqual(report({ ...LOW_MOOD, ...BOTH_LEAN }));
    expect(report({ ...LOW_MOOD, ...style(1, 1) })).toEqual(report({ ...LOW_MOOD, ...BOTH_LEAN }));
  });

  it("needs both answers: with one missing there is no lean at all", () => {
    expect(report({ ...LOW_MOOD, therapistStyleQ1: 1 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
    expect(report({ ...LOW_MOOD, therapistStyleQ2: 7 })).toEqual(report({ ...LOW_MOOD, ...SKIPPED }));
    expect(report({ ...ANXIETY, therapistStyleQ1: 7 })).toEqual(report({ ...ANXIETY, ...SKIPPED }));
  });

  it("returns where the answers lean, for the research record", () => {
    expect(score({ ...LOW_MOOD, ...CBT_LEAN }).styleLean).toBe("cbt");
    expect(score({ ...LOW_MOOD, ...BOTH_LEAN }).styleLean).toBe("both");
    expect(score({ ...LOW_MOOD, ...DYNAMIC_LEAN }).styleLean).toBe("dynamic");
    expect(score({ ...LOW_MOOD, ...SKIPPED }).styleLean).toBe("none");
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
    it(`${name}: CBT on a CBT lean, dynamic on a dynamic lean, both in the middle or on a skipped screen`, () => {
      expect(treatmentOf({ ...finding, ...CBT_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...BOTH_LEAN }, id)).toBe(BOTH);
      expect(treatmentOf({ ...finding, ...DYNAMIC_LEAN }, id)).toBe(DYN);
      expect(treatmentOf({ ...finding, ...CLEAR_DYNAMIC }, id)).toBe(DYN);
      expect(treatmentOf({ ...finding, ...SKIPPED }, id)).toBe(BOTH);
    });
  }

  it("a 'both' card names the two methods it offers, CBT first in the data (the screen orders them)", () => {
    const card = recs({ ...LOW_MOOD, ...BOTH_LEAN }).find((r) => r.id.startsWith("mood-severe"));
    expect(card?.treatmentOptions).toEqual(["CBT", DYN]);
    expect(card?.treatmentLabel).toBe(BOTH);
    const single = recs({ ...LOW_MOOD, ...CBT_LEAN }).find((r) => r.id.startsWith("mood-severe"));
    expect(single?.treatmentOptions).toBeUndefined();
  });

  it("the cuts are at 9 and 5: CBT from 9, dynamic up to 5, both in between", () => {
    const counts = { CBT: 0, [BOTH]: 0, [DYN]: 0 } as Record<string, number>;
    for (const [q1, q2] of EVERY_PAIR) {
      const p = practical(q1, q2);
      const expected = p >= 9 ? "CBT" : p <= 5 ? DYN : BOTH;
      expect(treatmentOf({ ...LOW_MOOD, ...style(q1, q2) }, "mood-severe"), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      counts[expected]++;
    }
    expect(counts).toEqual({ CBT: 21, [BOTH]: 18, [DYN]: 10 });
  });

  it("an elevated mood also sends to a psychiatrist, like reality testing", () => {
    for (const s of ALL_STYLES) {
      expect(recs({ ...MANIA, ...s }).find((r) => r.id.startsWith("mania"))?.notes).toMatch(/פסיכיאטרי/);
    }
  });
});

describe("anxiety: one method, with CBT ahead", () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ["general anxiety", ANXIETY, "gad7-severe"],
    ["mild stress", MILD_STRESS, "gad7-mild"],
    ["social anxiety, high", SOCIAL, "social-anxiety-high"],
    ["social anxiety", { socialAnxiety: true, socialSeverity: 2 }, "social-anxiety-low"],
    ["anxiety left unspecified", UNSPECIFIED_ANXIETY, "gad7-unspecified"],
  ];
  for (const [name, finding, id] of cases) {
    it(`${name}: CBT, and dynamic therapy only on a markedly dynamic lean`, () => {
      expect(treatmentOf({ ...finding, ...CBT_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...BOTH_LEAN }, id)).toBe("CBT");
      // Leaning dynamic is not enough - this is where CBT's head start shows.
      expect(treatmentOf({ ...finding, ...DYNAMIC_LEAN }, id)).toBe("CBT");
      expect(treatmentOf({ ...finding, ...CLEAR_DYNAMIC }, id)).toBe(DYN);
      // Nothing to lean on: CBT.
      expect(treatmentOf({ ...finding, ...SKIPPED }, id)).toBe("CBT");
    });
  }

  it("the cut is at 4: the six pairs that mirror the old 'CBT only' zone, and no others", () => {
    const dynamicPairs: string[] = [];
    for (const [q1, q2] of EVERY_PAIR) {
      const expected = practical(q1, q2) <= 4 ? DYN : "CBT";
      expect(treatmentOf({ ...ANXIETY, ...style(q1, q2) }, "gad7-severe"), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      if (expected === DYN) dynamicPairs.push(`${q1}/${q2}`);
    }
    expect(dynamicPairs).toEqual(["5/1", "6/1", "6/2", "7/1", "7/2", "7/3"]);
  });

  it("is never given two methods: one line, whatever the lean", () => {
    expect(report({ ...ANXIETY, ...CBT_LEAN })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...BOTH_LEAN })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...DYNAMIC_LEAN })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
    expect(report({ ...ANXIETY, ...CLEAR_DYNAMIC })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → טיפול דינאמי"]);
    expect(report({ ...ANXIETY, ...SKIPPED })).toEqual(["נמצאו קשיים בניהול חרדה ומתח. → CBT"]);
  });
});

describe("findings that are always dynamic: sleep, the communication finding, the default", () => {
  ALL_STYLES.forEach((s, i) => {
    const label = ["CBT lean", "both lean", "dynamic lean", "markedly dynamic lean", "skipped"][i];
    it(`${label}: each of them is dynamic therapy and nothing else`, () => {
      expect(report({ ...SLEEP_MILD, ...s })).toEqual(["דווחו קשיי שינה קלים. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_NEURO, ...s })).toEqual(["נמצאו סימנים להפרעת שינה. → טיפול דינאמי"]);
      expect(report({ ...SLEEP_ENT, ...s })).toEqual(["דווח על נזלת כרונית מרובה. → טיפול דינאמי"]);
      expect(report({ ...COMM, ...s })).toEqual(["נמצאו סימנים לקשיים בתקשורת הבינאישית. → טיפול דינאמי"]);
      expect(report({ ...s })).toEqual(["נמצאו סימנים כלליים בתחום הרגשי. → טיפול דינאמי"]);
    });
  });

  it("every sleep finding sends to a physician, the mild one included", () => {
    expect(recs({ ...SLEEP_NEURO, ...BOTH_LEAN })[0].notes).toMatch(/רופא המשפחה או נוירולוג/);
    expect(recs({ ...SLEEP_ENT, ...BOTH_LEAN })[0].notes).toMatch(/אף-אוזן-גרון/);
    const mild = recs({ ...SLEEP_MILD, ...BOTH_LEAN })[0];
    expect(mild.notes).toMatch(/^התייעצות עם רופא המשפחה\./);
    // ...and keeps the sleep-hygiene advice it had.
    expect(mild.notes).toMatch(/היגיינת שינה/);
    expect(mild.tools).toMatch(/שעות שינה קבועות/);
  });
});

describe("the 'also dynamic' line: only in a report with several symptoms", () => {
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

  it("one symptom whose method follows the style answers comes out as exactly one card", () => {
    for (const finding of [LOW_MOOD, MANIA, PRODROME, ANXIETY, SOCIAL]) {
      for (const [q1, q2] of EVERY_PAIR) {
        const methods = new Set(recs({ ...finding, ...style(q1, q2) }).map((r) => r.treatment));
        expect(methods.size, `Q1=${q1}, Q2=${q2}`).toBe(1);
      }
    }
  });

  it("a 'both' card already offers dynamic therapy, so the line stays out", () => {
    expect(report({ ...LOW_MOOD, ...ANXIETY, ...BOTH_LEAN })).toEqual([
      `נמצאו סימנים מובהקים של מצב רוח ירוד. → ${BOTH}`,
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
    ]);
  });

  it("several symptoms on a both lean with no 'both' card: the dynamic option joins the CBT", () => {
    // A symptom-fixed CBT finding counts as a symptom like any other.
    expect(report({ ...ANXIETY, ...OCD, ...BOTH_LEAN })).toEqual([
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
      "נמצאו קשיים משמעותיים בתחום המחשבות האובססיביות. → CBT",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
  });

  it("the line needs a both lean: across all pairs it appears from 6 to 8 and nowhere else", () => {
    const counts = { with: 0, without: 0 };
    for (const [q1, q2] of EVERY_PAIR) {
      const p = practical(q1, q2);
      const expected = p >= 6 && p <= 8;
      expect(hasAlsoLine({ ...ANXIETY, ...OCD, ...style(q1, q2) }), `Q1=${q1}, Q2=${q2}`).toBe(expected);
      counts[expected ? "with" : "without"]++;
    }
    expect(counts).toEqual({ with: 18, without: 31 });
    expect(hasAlsoLine({ ...ANXIETY, ...OCD, ...SKIPPED })).toBe(false);
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
    const r = report({ ...TRAUMA, ...EATING, ...BOTH_LEAN });
    expect(r).toContain(`${ALSO_PLAIN} → טיפול דינאמי`);
    expect(r.join("\n")).not.toContain("לגישה CBT");
  });

  it("is left out when dynamic therapy is already the only recommendation", () => {
    expect(report({ ...SLEEP_MILD, ...COMM, ...BOTH_LEAN })).toEqual([
      "דווחו קשיי שינה קלים. → טיפול דינאמי",
      "נמצאו סימנים לקשיים בתקשורת הבינאישית. → טיפול דינאמי",
    ]);
  });

  it("stands beside CBT even when another symptom is already dynamic", () => {
    expect(report({ ...ANXIETY, ...SLEEP_MILD, ...BOTH_LEAN })).toEqual([
      "נמצאו קשיים בניהול חרדה ומתח. → CBT",
      "דווחו קשיי שינה קלים. → טיפול דינאמי",
      `${ALSO_WITH_CBT} → טיפול דינאמי`,
    ]);
  });

  it("appears once, and only in the emotional domain", () => {
    const all = scoreQuestionnaire({
      age: 30, gender: "x", domains: ["emotional"], emotional: { ...ANXIETY, ...OCD, ...SOCIAL, ...BOTH_LEAN },
    } as unknown as QuestionnaireAnswers).recommendations;
    expect(all.filter((r) => r.id.startsWith("emotional-dynamic-mixed"))).toHaveLength(1);
  });
});

describe("trauma findings lead the emotional section", () => {
  it("comes before the anxiety and mood cards that the questionnaire asks first", () => {
    const ids = recs({ ...LOW_MOOD, ...ANXIETY, ...TRAUMA, ...CBT_LEAN }).map((r) => r.id);
    expect(ids[0]).toMatch(/^trauma-emdr/);
    expect(ids.findIndex((id) => id.startsWith("mood-"))).toBeGreaterThan(ids.findIndex((id) => id.startsWith("trauma-cpt")));
  });

  it("an urgent card still comes first", () => {
    const ids = recs({ moodSuicidal: true, ...LOW_MOOD, ...TRAUMA, ...CBT_LEAN }).map((r) => r.id);
    expect(ids[0]).toMatch(/^mood-suicidal/);
    expect(ids[1]).toMatch(/^trauma-/);
  });
});

describe("what did not change", () => {
  it("findings fixed by the symptom ignore the style answers", () => {
    for (const s of ALL_STYLES) {
      expect(treatmentOf({ ...OCD, ...s }, "ocd-sig")).toBe("CBT");
      expect(treatmentOf({ ...TRAUMA, ...s }, "trauma-emdr")).toBe("EMDR");
      expect(treatmentOf({ maniaItems: [0, 1, 2], maniaDeath: true, ...s }, "mania-suicidal")).toBe("CBT");
    }
  });

  it("the style answers of someone who did not choose the emotional domain change nothing", () => {
    const base = { age: 30, gender: "x", domains: ["personal_development"] };
    const a = scoreQuestionnaire({ ...base, emotional: CBT_LEAN } as unknown as QuestionnaireAnswers).recommendations;
    const b = scoreQuestionnaire({ ...base, emotional: CLEAR_DYNAMIC } as unknown as QuestionnaireAnswers).recommendations;
    expect(a.map((r) => r.treatment)).toEqual([DYN]);
    expect(b.map((r) => r.treatment)).toEqual([DYN]);
  });
});
