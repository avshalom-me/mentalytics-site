// הפרדה בין מה שנכתב עכשיו במייל לבין הציטוט שמתחתיו.
//
// קובץ משותף ובלי תלות בשרת: הסוכן מסווג לפי הטקסט החדש (gmail.ts מייצא
// מכאן), ועמוד האדמין מציג רק אותו - ציטוט של שרשור ארוך הוא בעיקר רעש.

// תווי כיוון בלתי נראים (LRM/RLM, LRE/RLE/PDF/LRO/RLO, isolates). Gmail בממשק
// עברי עוטף בהם את שורת הציטוט, ובגללם "On ... wrote:" לא זוהה. כתובים
// כ-escape ולא כתווים עצמם: תו בלתי נראה נמחק בעריכה בלי שאיש יראה.
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;

/**
 * פיצול המייל למה שנכתב עכשיו ולציטוט שמתחתיו - וגם לחתימה, שמתחילה
 * בשורה "-- " (המפריד הסטנדרטי).
 *
 * זה לא ניקוי קוסמטי: תשובה בשרשור היא לרוב שתי שורות אדם מעל מאות שורות
 * ציטוט, ולפעמים הציטוט הוא התראה אוטומטית שלנו. סיווג שמסתכל על הגוף
 * המלא קורא בעיקר את הציטוט. קרה ב-18/9/26: "לצערי לא יכול, מטפל בשעה
 * הזאת" (52 תווים) מעל ציטוט של התראת "פנייה חדשה" סווג כמייל אוטומטי
 * שלא דורש מענה, והפנייה לא הופיעה בתור.
 */
export function splitQuoted(body: string): { text: string; quoted: string } {
  const lines = body.split("\n");
  const cut = lines.findIndex((raw, i) => {
    const l = raw.replace(BIDI_MARKS, "");
    const next = (lines[i + 1] ?? "").replace(BIDI_MARKS, "");
    return (
      /^--\s*$/.test(l) ||
      /^\s*>/.test(l) ||
      /^\s*(On .+ wrote:|בתאריך .+ מאת)/.test(l) ||
      // כותרת ציטוט ארוכה נשברת לשתי שורות: "On <תאריך> <שם> <כתובת>" ואז "wrote:".
      (/^\s*On .*\d{4}/.test(l) && /^\s*wrote:\s*$/.test(next)) ||
      /^-{2,}\s*Original Message/i.test(l)
    );
  });
  // cut === 0 הוא העברה (forward) שכולה ציטוט: אין טקסט חדש להפריד.
  if (cut <= 0) return { text: body.trim(), quoted: "" };
  return {
    text: lines.slice(0, cut).join("\n").trim(),
    quoted: lines.slice(cut).join("\n").trim(),
  };
}

/** מה שנכתב עכשיו בלבד. */
export function stripQuoted(body: string): string {
  return splitQuoted(body).text;
}
