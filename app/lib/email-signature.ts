// כלל אחד, משותף לשרת ולאדמין: שורת סיום בטיוטה שחוזרת על השורה הראשונה
// של החתימה יורדת מהמייל היוצא.
//
// למה: הטיוטות נחתמות "בברכה,\nצוות טיפול חכם", וחתימת ה-Gmail של admin@
// נפתחת באותו "צוות טיפול חכם". בלי הכלל השם יוצא פעמיים ברצף. ההסרה
// קורית רק בשליחה - הטקסט שנשמר כדוגמה ללמידה נשאר כמו שאושר, וכשהחתימה
// לא נטענה הטיוטה שומרת על שורת השם שלה.
//
// בלי "server-only": עמוד האדמין מייבא את אותה פונקציה כדי להסביר מראש
// מה יקרה, כך שהתצוגה המקדימה והשליחה לא יכולות להיפרד.

function norm(line: string): string {
  return line.replace(/[\s.,!:;-]+$/g, "").replace(/\s+/g, " ").trim();
}

function firstLine(text: string): string {
  return norm(text.split("\n").find((l) => l.trim()) ?? "");
}

/** השורה האחרונה של הטיוטה, אם היא זהה לשורה הראשונה של החתימה. */
export function repeatedClosingLine(body: string, signatureText: string): string | null {
  const sigFirst = firstLine(signatureText);
  if (!sigFirst) return null;
  const lines = body.replace(/\s+$/, "").split("\n");
  const last = lines[lines.length - 1] ?? "";
  return lines.length > 1 && norm(last) === sigFirst ? last.trim() : null;
}

/** הטיוטה בלי שורת הסיום שהחתימה כבר אומרת. */
export function dropRepeatedClosing(body: string, signatureText: string): string {
  if (!repeatedClosingLine(body, signatureText)) return body;
  const lines = body.replace(/\s+$/, "").split("\n");
  return lines.slice(0, -1).join("\n").replace(/\s+$/, "");
}
