// פירוק ונרמול של "טיפול מבוקש" כפי שהוא נשמר בצפיות ובאירועים - מודול טהור,
// משותף לסוכן פערי ההיצע (supply-gaps.ts) ולניתוח ריכוז הפניות
// (contact-concentration.ts), כדי ששניהם יחתכו את אותו ביקוש לאותם חיתוכים.
//
// ── חיתוך משולב ────────────────────────────────────────────────────────
// מטופל שמבקש "CBT + טיפול דינאמי" מייצר מחרוזת אחת, ועד 20/8/26 היא
// הושוותה כמכלול מול תחומי ההתמחות של המטפל. אין מטפל שרשום אצלו תחום
// בשם "CBT + טיפול דינאמי", ולכן אף מועמד לא נמצא לעולם וכל חיתוך משולב
// סווג כ"אין לנו אף מטפל" ונשלח לרשימת הגיוס. בפועל 15 מתוך 26 פערי
// הגיוס היו כאלה, והביקוש הגדול ביותר בנתונים הוא בדיוק שילוב כזה.
//
// נוסף לזה פיצול וריאנטים: "טיפול CBT + טיפול דינאמי" ו-"CBT + טיפול
// דינאמי" נספרו כשני חיתוכים נפרדים, כל אחד מתחת לסף - וכך ריכוז ביקוש
// אמיתי נראה כפירורים.

function normTreat(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

// וריאנטים שהם אותו תחום. הרשימה מכוונת ומינימלית: רק תחילית "טיפול"
// לפני ראשי תיבות לועזיים, שם ההבדל הוא ניסוח ולא תוכן.
const TREATMENT_ALIASES: Record<string, string> = {
  "טיפול cbt": "cbt",
  "טיפול dbt": "dbt",
  "טיפול emdr": "emdr",
  "טיפול cpt": "cpt",
  "טיפול act": "act",
};

export function canonicalPart(raw: string): string {
  const n = normTreat(raw);
  return TREATMENT_ALIASES[n] ?? n;
}

/** הרכיב כפי שהוא נבדק מול training_areas של המטפל.
 *
 *  תוויות ההמלצה מהשאלון נושאות לעיתים סיוג בסוגריים - "טיפול זוגי (בהעדפה
 *  לגישה דינמית)". הסיוג הוא העדפה ולא דרישה, אבל ההשוואה מול training_areas
 *  היא שוויון מחרוזות מנורמל, ולכן התווית המלאה לא תאמה אף מטפל: כל פער של
 *  טיפול זוגי סווג כ"אין במאגר אף מטפל חינמי מאושר שמתאים" ונשלח לגיוס במקום
 *  להצעת מתנה (14 ממצאים ב-60 יום, מול הצעת מתנה אחת). מסירים את הסיוג לצורך
 *  ההתאמה בלבד - התווית המלאה נשארת בכותרת הממצא ובמפתח הצבירה. */
export function matchPart(raw: string): string {
  return raw.replace(/\s*\([^)]*\)\s*/g, " ").trim() || raw.trim();
}

/** פירוק "CBT + טיפול דינאמי" לרכיביו, בלי כפילויות ובסדר קבוע. */
export function treatmentParts(raw: string): string[] {
  const parts = raw
    .split("+")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [raw.trim()].filter(Boolean);
}

function canonicalParts(raw: string): string[] {
  return Array.from(new Set(treatmentParts(raw).map(canonicalPart))).sort();
}

/** מפתח הצבירה: שני ניסוחים של אותו שילוב מתמזגים לחיתוך אחד. */
export function treatmentKey(raw: string): string {
  return canonicalParts(raw).join(" + ");
}

// ראשי תיבות לועזיים (cbt/dbt/emdr) נשמרים במאגר באותיות קטנות ונראים
// שבורים בתוך משפט בעברית - מוצגים באותיות גדולות.
export function treatmentLabel(t: string): string {
  return /^[a-z0-9\s-]+$/i.test(t) ? t.toUpperCase() : t;
}

/** ניסוח קריא לשילוב: "שילוב של CBT וטיפול דינאמי", "X, Y ו-Z".
 *  ו' לפני מילה לועזית מקבלת מקף ("ו-CPT"), אחרת היא נדבקת אליה. */
function joinWithVav(word: string): string {
  return /^[a-z0-9]/i.test(word) ? `ו-${word}` : `ו${word}`;
}

export function treatmentPhrase(raw: string): string {
  const parts = treatmentParts(raw).map(treatmentLabel);
  if (parts.length === 1) return parts[0];
  const last = joinWithVav(parts[parts.length - 1]);
  const head = parts.slice(0, -1).join(", ");
  // "שילוב של" - כדי שהמטפל יבין שהמטופל ביקש את הצירוף, ולא שהיו כמה
  // מטופלים שכל אחד ביקש משהו אחר.
  return `שילוב של ${head} ${last}`;
}
