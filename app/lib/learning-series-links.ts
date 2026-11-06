// "(מאמר N בסדרה)" במדריכים של לימוד חכם (app/learning/articles/content.ts)
// הופך לקישור לאותו מדריך. כשנקודתיים פותחות לפניו את שם הנושא ("להרחבה: כמה
// עולה הוראה מתקנת (מאמר 4 בסדרה)"), הקישור הוא הביטוי הזה עצמו; אחרת הסמן
// הופך ל"(למדריך)". עד 6/11/2026 הסמן הוחלף בשם המדריך המלא, וכך הנושא הופיע
// פעמיים ברצף ("מורה פרטי או הוראה מתקנת מורה פרטי או הוראה מתקנת: איך בוחרים").

export const SERIES_RE = /\(מאמר (\d+) בסדרה\)/g;

export type SeriesPart = { kind: "text"; text: string } | { kind: "link"; n: number; label: string | null };

/** הביטוי שבין הנקודתיים לסמן, באותו משפט; null כשאין כזה. */
function phraseStart(text: string, from: number, markerAt: number): number | null {
  const before = text.slice(from, markerAt);
  const sentence = Math.max(before.lastIndexOf(". "), before.lastIndexOf('"'), before.lastIndexOf("? "));
  const colon = before.lastIndexOf(":");
  if (colon <= sentence) return null;
  const phrase = before.slice(colon + 1).trim();
  return phrase.length >= 2 && phrase.length <= 80 ? from + before.indexOf(phrase, colon + 1) : null;
}

/** הטקסט מחולק לקטעים ולקישורים. exists: האם יש מדריך במספר הזה (אחרת הסמן נשאר טקסט). */
export function splitSeriesLinks(text: string, exists: (n: number) => boolean): SeriesPart[] {
  const parts: SeriesPart[] = [];
  const push = (t: string) => {
    if (!t) return;
    const prev = parts[parts.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else parts.push({ kind: "text", text: t });
  };
  let last = 0;
  for (const m of text.matchAll(SERIES_RE)) {
    const at = m.index ?? 0;
    const n = Number(m[1]);
    if (!exists(n)) {
      push(text.slice(last, at + m[0].length));
    } else {
      const start = phraseStart(text, last, at);
      if (start !== null) {
        push(text.slice(last, start));
        parts.push({ kind: "link", n, label: text.slice(start, at).trimEnd() });
      } else {
        push(`${text.slice(last, at)}(`);
        parts.push({ kind: "link", n, label: null });
        push(")");
      }
    }
    last = at + m[0].length;
  }
  push(text.slice(last));
  return parts;
}
