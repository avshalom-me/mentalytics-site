import { describe, it, expect } from "vitest";
import { parseLessons, cleanLessonRule, sameRule } from "./inbox-lessons-parse";

// The model's answer becomes pending rules the admin approves. What reaches
// the admin must be clean: at most three, no duplicates, no em dash (house
// rule for every Hebrew text we show), and malformed output means no rules
// rather than a crash.

describe("parseLessons", () => {
  it("returns clean rules with their explanation", () => {
    const raw = JSON.stringify({
      lessons: [
        {
          rule: "כשמטפל/ת מבקש/ת לבטל בחודשיים הראשונים — מאשרים ביטול והחזר מלא.",
          why: "הטיוטה כתבה שאין החזר; תוקן להחזר מלא.",
        },
      ],
    });
    expect(parseLessons(raw)).toEqual([
      {
        rule: "כשמטפל/ת מבקש/ת לבטל בחודשיים הראשונים - מאשרים ביטול והחזר מלא.",
        why: "הטיוטה כתבה שאין החזר; תוקן להחזר מלא.",
        conflict: null,
      },
    ]);
  });

  it("keeps the conflict note, and reads JSON wrapped in a code fence", () => {
    const raw =
      "```json\n" +
      JSON.stringify({
        lessons: [
          {
            rule: "כשמטפל/ת מבקש/ת לבטל - לאשר החזר מלא.",
            why: "תוקן להחזר.",
            already_in_facts: false,
            conflicts_with_facts: "בבסיס הידע ההחזר מוגבל לחודשיים הראשונים.",
          },
        ],
      }) +
      "\n```";
    expect(parseLessons(raw)).toEqual([
      {
        rule: "כשמטפל/ת מבקש/ת לבטל - לאשר החזר מלא.",
        why: "תוקן להחזר.",
        conflict: "בבסיס הידע ההחזר מוגבל לחודשיים הראשונים.",
      },
    ]);
  });

  it("keeps at most three rules and drops duplicates and fragments", () => {
    const raw = JSON.stringify({
      lessons: [
        { rule: "למרכזים: מסלול מקודם בלבד, בלי מסלול חינמי." },
        { rule: "למרכזים - מסלול מקודם בלבד, בלי מסלול חינמי" },
        { rule: "-" },
        { rule: "כשמטופל שואל על מחיר טיפול - המחיר נקבע מול המטפל." },
        { rule: "לפתוח תשובה לביטול במשפט 'תודה שניסית אותנו'." },
        { rule: "כלל רביעי שלא אמור להיכנס בגלל התקרה." },
      ],
    });
    const out = parseLessons(raw);
    expect(out.map((l) => l.rule)).toEqual([
      "למרכזים: מסלול מקודם בלבד, בלי מסלול חינמי.",
      "כשמטופל שואל על מחיר טיפול - המחיר נקבע מול המטפל.",
      "לפתוח תשובה לביטול במשפט 'תודה שניסית אותנו'.",
    ]);
    expect(out[0].why).toBeNull();
  });

  it("drops a rule the model marked as already in the facts", () => {
    const raw = JSON.stringify({
      lessons: [
        { rule: "למרכזים: מסלול מקודם בלבד, בלי מסלול חינמי.", already_in_facts: true },
        { rule: "כשמטפל/ת שואל/ת איך מגיעים מטופלים - לפרט את ערוצי הפרסום.", already_in_facts: false },
      ],
    });
    expect(parseLessons(raw).map((l) => l.rule)).toEqual([
      "כשמטפל/ת שואל/ת איך מגיעים מטופלים - לפרט את ערוצי הפרסום.",
    ]);
  });

  it("treats an empty list, a wrong shape and broken JSON as no rules", () => {
    expect(parseLessons('{"lessons": []}')).toEqual([]);
    expect(parseLessons('{"rules": [{"rule": "משהו ארוך מספיק"}]}')).toEqual([]);
    expect(parseLessons("not json")).toEqual([]);
    expect(parseLessons("null")).toEqual([]);
  });
});

describe("cleanLessonRule / sameRule", () => {
  it("collapses whitespace and replaces the em dash", () => {
    expect(cleanLessonRule("  כלל\n\nעם   רווחים—ומקף ")).toBe("כלל עם רווחים - ומקף");
  });

  it("matches the same rule across punctuation differences only", () => {
    expect(sameRule("מרכזים: מקודם בלבד.", "מרכזים - מקודם בלבד")).toBe(true);
    expect(sameRule("מרכזים: מקודם בלבד.", "מטפלים: מקודם בלבד.")).toBe(false);
  });
});
