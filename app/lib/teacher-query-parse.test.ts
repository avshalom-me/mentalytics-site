import { describe, it, expect } from "vitest";
import { parseTeacherQuery, describeParsedQuery } from "./teacher-query-parse";

// החילוץ מהטקסט החופשי של ההורה. הבדיקות כתובות כמשפטים שהורה באמת כותב,
// כי הכשל האופייני כאן אינו קריסה אלא מילוי שגוי ושקט של הטופס.

describe("the example the owner gave", () => {
  it("teacher kind, city, a language-based learning disability and more", () => {
    const p = parseTeacherQuery("מחפשת מורה להוראה מתקנת בחיפה לבת שלי בכיתה ג׳, יש ברקע לקות למידה שפתית וגם קשיי קשב");
    expect(p).toMatchObject({ remedial: true, city: "חיפה", region: "חיפה והקריות", gradeGroup: "ag", online: false });
    expect(p.needs).toEqual(["language", "attention"]);
    // אין תחום בטקסט ואין אבחנה שמרמזת עליו: נשאר ריק, וההורה בוחר.
    expect(p.subject).toBeNull();
  });
});

describe("subject", () => {
  it.each([
    ["מורה פרטי למתמטיקה לכיתה י", "math"],
    ["עזרה בחשבון לילד בכיתה ב", "math"],
    ["מורה לאנגלית", "english"],
    ["הילדה מתקשה לקרוא", "reading_writing"],
    ["הכנה לבגרות בלשון", "hebrew"],
    ["מישהו שיעזור עם שיעורי בית והכנה למבחנים", "learning_strategies"],
  ])("%s", (text, subject) => {
    expect(parseTeacherQuery(text).subject).toBe(subject);
  });

  it("reading in English is a request for an English teacher", () => {
    expect(parseTeacherQuery("מתקשה בקריאה באנגלית, כיתה ה").subject).toBe("english");
  });

  it("a diagnosis with no subject points at the subject it belongs to", () => {
    expect(parseTeacherQuery("ילד עם דיסלקציה בכיתה ד")).toMatchObject({ subject: "reading_writing", needs: ["literacy"] });
    expect(parseTeacherQuery("לבן שלי יש דיסקלקוליה")).toMatchObject({ subject: "math", needs: ["numeracy"] });
  });

  it("an explicit subject wins over the one a diagnosis hints at", () => {
    expect(parseTeacherQuery("מורה למתמטיקה לנער עם דיסלקסיה")).toMatchObject({ subject: "math", needs: ["literacy"] });
  });
});

describe("teacher kind", () => {
  it("names remedial teaching only when it is named", () => {
    expect(parseTeacherQuery("הוראה מתקנת בקריאה").remedial).toBe(true);
    expect(parseTeacherQuery("מורה פרטית לאנגלית").remedial).toBe(false);
    expect(parseTeacherQuery("תגבור במתמטיקה").remedial).toBe(false);
    expect(parseTeacherQuery("מורה לאנגלית").remedial).toBeNull();
  });

  it("a learning disability alone does not force a remedial teacher - it becomes a preference", () => {
    const p = parseTeacherQuery("מורה למתמטיקה לנערה עם לקות למידה");
    expect(p.remedial).toBeNull();
    expect(p.needs).toEqual(["numeracy"]);
  });
});

describe("grade", () => {
  it.each([
    ["כיתה א", "ag"],
    ["בכיתה ג'", "ag"],
    ["עולה לכיתה ד׳", "dv"],
    ["כיתה ו", "dv"],
    ["כיתה ח", "zh"],
    ["כיתה ט", "tyb"],
    ["כיתה י״ב", "tyb"],
    ["כיתה יא", "tyb"],
    ["כיתה 5", "dv"],
    ["כיתות א-ג", "ag"],
    ["תלמיד תיכון, 5 יחידות", "tyb"],
    ["בחטיבת ביניים", "zh"],
    ["בן 8", "ag"],
    ["בת 10", "dv"],
    ["בן שמונה", "ag"],
    ["נער בגיל 15", "tyb"],
  ])("%s", (text, group) => {
    expect(parseTeacherQuery(text).gradeGroup).toBe(group);
  });

  it("leaves it empty when nothing says it", () => {
    expect(parseTeacherQuery("מורה למתמטיקה ביסודי").gradeGroup).toBeNull();
    expect(parseTeacherQuery("כיתה גבוהה").gradeGroup).toBeNull();
    expect(parseTeacherQuery("הבן שלי מתקשה").gradeGroup).toBeNull();
  });
});

describe("place", () => {
  it.each([
    ["מורה ברעננה", "רעננה", "דרום השרון"],
    ["אנחנו גרים בתל אביב", "תל אביב", "גוש דן"],
    ["באזור ת\"א", "תל אביב", "גוש דן"],
    ["מפתח תקוה", "פתח תקווה", "גוש דן"],
    ["קרית אתא", "קריית אתא", "חיפה והקריות"],
    ["קריית טבעון", "קריית טבעון", "עמק יזרעאל ונצרת"],
    ["במודיעין עילית", "מודיעין עילית", "יהודה ושומרון"],
    ["במודיעין", "מודיעין", "השפלה והמרכז"],
    ["פרדס חנה", "פרדס חנה-כרכור", "צפון השרון"],
    ["באר שבע", "באר שבע", "דרום"],
  ])("%s", (text, city, region) => {
    expect(parseTeacherQuery(text)).toMatchObject({ city, region });
  });

  it("a region named without a city", () => {
    expect(parseTeacherQuery("מורה באזור הקריות")).toMatchObject({ city: null, region: "חיפה והקריות" });
    expect(parseTeacherQuery("גרים בגליל")).toMatchObject({ city: null, region: "גליל וצפון" });
  });

  it("does not take a child's name for a town", () => {
    expect(parseTeacherQuery("הבן שלי אריאל בכיתה ג מתקשה בחשבון").city).toBeNull();
    expect(parseTeacherQuery("שלומי בן 9 וצריך עזרה באנגלית").city).toBeNull();
    expect(parseTeacherQuery("מורה באריאל").city).toBe("אריאל");
  });

  it("does not find a town inside another word", () => {
    expect(parseTeacherQuery("ילד בכיתה ב").city).toBeNull();
    expect(parseTeacherQuery("יהודה מתקשה בקריאה").city).toBeNull();
  });

  it("online", () => {
    expect(parseTeacherQuery("אפשר גם בזום").online).toBe(true);
    expect(parseTeacherQuery("רק פנים אל פנים, לא אונליין").online).toBe(false);
  });
});

describe("the difficulties in the background", () => {
  it.each([
    ["יש לו דיסלקסיה", ["literacy"]],
    ["עיכוב שפתי בגיל הגן", ["language"]],
    ["מאובחן עם ADHD", ["attention"]],
    ["קשיי קשב וריכוז ובעיות התארגנות", ["attention", "executive"]],
    ["מתוסכל מאוד ונמנע משיעורי בית", ["avoidance"]],
  ])("%s", (text, needs) => {
    expect(parseTeacherQuery(text).needs).toEqual(needs);
  });

  it("a denied difficulty is not a difficulty", () => {
    expect(parseTeacherQuery("אין לו בעיות קשב, רק פער בחומר במתמטיקה").needs).toEqual([]);
    expect(parseTeacherQuery("בלי קשיי קריאה").needs).toEqual([]);
    expect(parseTeacherQuery("ללא לקות למידה").needs).toEqual([]);
  });

  it("a word that merely contains the letters is not a match", () => {
    expect(parseTeacherQuery("we need an additional teacher").needs).toEqual([]);
  });
});

describe("language of instruction", () => {
  it("only when the lessons themselves are asked for in it", () => {
    expect(parseTeacherQuery("מורה למתמטיקה ברוסית").language).toBe("רוסית");
    expect(parseTeacherQuery("מורה דוברת ערבית").language).toBe("ערבית");
    expect(parseTeacherQuery("מורה לאנגלית").language).toBeNull();
  });
});

describe("empty and unrelated text", () => {
  it("finds nothing, and says nothing", () => {
    for (const text of ["", "   ", "שלום, רציתי לשאול משהו"]) {
      const p = parseTeacherQuery(text);
      expect(p).toEqual({ subject: null, remedial: null, gradeGroup: null, city: null, region: null, online: false, needs: [], language: null });
      expect(describeParsedQuery(p)).toEqual([]);
    }
  });
});

describe("what the parent is shown", () => {
  it("lists what was understood, in the order of the form", () => {
    const p = parseTeacherQuery("הוראה מתקנת בקריאה לכיתה ב ברעננה, אפשר גם בזום. יש קשיי קשב.");
    expect(describeParsedQuery(p)).toEqual(["הוראה מתקנת", "קריאה וכתיבה", "כיתות א׳-ג׳", "רעננה", "אונליין", "קשב וריכוז"]);
  });
});
