// פענוח וניקוי של כללים שחולצו מתיקוני טיוטות. קובץ נפרד ובלי תלות בשרת,
// כדי שאפשר יהיה לבדוק אותו ישירות (inbox-lessons-parse.test.ts).

const MAX_RULE_LEN = 400;
const MAX_LESSONS = 3;
// כלל קצר מזה הוא כמעט תמיד שארית ("אין", "-"), לא הוראה.
const MIN_RULE_LEN = 8;

/** ניקוי כלל: מקף ארוך (אסור בטקסטים שלנו) נהפך ל-" - ", רווחים, אורך. */
export function cleanLessonRule(raw: string): string {
  return String(raw ?? "")
    .replace(/—/g, " - ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_RULE_LEN);
}

/** אותו כלל בהבדלי פיסוק ורווחים - כדי לא להציע לאדמין כפילות. */
export function sameRule(a: string, b: string): boolean {
  const n = (s: string) =>
    cleanLessonRule(s)
      .replace(/[.,!?;:'"״׳()\-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return n(a) === n(b);
}

export type ParsedLesson = { rule: string; why: string | null; conflict: string | null };

/** התשובה של המודל → עד 3 כללים נקיים ושונים זה מזה. JSON פגום → אין כללים. */
export function parseLessons(raw: string): ParsedLesson[] {
  let parsed: unknown;
  try {
    // מודל חשיבה עוטף לפעמים את ה-JSON בגדר קוד - לוקחים את האובייקט שבפנים.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
  } catch {
    return [];
  }
  const list = (parsed as { lessons?: unknown } | null)?.lessons;
  if (!Array.isArray(list)) return [];
  const out: ParsedLesson[] = [];
  for (const item of list) {
    const obj = (item ?? {}) as {
      rule?: unknown;
      why?: unknown;
      already_in_facts?: unknown;
      conflicts_with_facts?: unknown;
    };
    // מה שכבר כתוב בבסיס הידע לא מוצע שוב: כפילות רק מעמיסה על האדמין.
    // המודל מתעלם מהוראה כללית לדלג, אבל עונה נאמנה כשצריך לסמן כל כלל.
    if (obj.already_in_facts === true) continue;
    const rule = cleanLessonRule(String(obj.rule ?? ""));
    if (rule.length < MIN_RULE_LEN) continue;
    if (out.some((o) => sameRule(o.rule, rule))) continue;
    const why = obj.why ? cleanLessonRule(String(obj.why)) || null : null;
    const conflict = obj.conflicts_with_facts
      ? cleanLessonRule(String(obj.conflicts_with_facts)) || null
      : null;
    out.push({ rule, why, conflict });
    if (out.length >= MAX_LESSONS) break;
  }
  return out;
}
