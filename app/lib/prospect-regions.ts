import { CITY_TO_REGION, REGION_GROUPS, REGION_GROUP_LABELS, regionGroupOf } from "./regions";

// בקובץ נפרד ולא ב-regions.ts: regions.ts מזין דפים ציבוריים (הבית, דפי הנחיתה),
// ו-check-page-revised מחייב לעדכן להם תאריך שינוי בכל נגיעה בו. השכבה הזו
// משמשת רק את האדמין, ותאריך שינוי שקרי לדפים ציבוריים הוא בדיוק מה שגוגל
// לומד להתעלם ממנו.

// ── אזורי סוכן איתור המכונים ─────────────────────────────────────────────────
// הקבוצות הגסות, עם "המרכז והשפלה" מפוצל לשניים: "מרכז" (גוש דן) ו"שפלה"
// (השפלה והמרכז). בקבוצה המאוחדת ראשון לציון ורחובות ישבו באותה עמודה עם
// תל אביב, ורשימת החיוג לא הבחינה בין שני אזורים שונים לגמרי בהיצע שלנו.
//
// הפיצול כאן ולא ב-REGION_GROUPS בכוונה: `center` הגס הוא הרזולוציה של כל
// דוחות הצפיות (viewer_region), של כותרות התראות פערי הגיוס, ושל מפתח הצינון
// מול gift_offers.region - שינוי שלו היה שובר רצף בדוחות ופותח מחדש פערים
// שממתינים לתשובה. לכן רשימת המכונים (והעסקאות שיוצאות ממנה) מקבלת מפתחות
// עדינים משלה, וכל מה שצריך את הקבוצה הכללית - דירוג לפי פערי גיוס - חוזר
// דרך prospectRegionGroup.
export const PROSPECT_REGION_GROUPS: Record<string, string[]> = {
  ...REGION_GROUPS,
  center: ["גוש דן"],
  shfela: ["השפלה והמרכז"],
};

export const PROSPECT_REGION_LABELS: Record<string, string> = {
  ...REGION_GROUP_LABELS,
  center: "מרכז",
  shfela: "שפלה",
};

/** שם אזור מלא → מפתח אזור של רשימת המכונים ("השפלה והמרכז" → "shfela"). */
export function prospectRegionOf(region: string): string {
  const r = String(region ?? "").trim();
  for (const [key, members] of Object.entries(PROSPECT_REGION_GROUPS)) {
    if (members.includes(r)) return key;
  }
  // regionGroupOf מזהה "שפלה" בטקסט כ-center; כאן זה אזור בפני עצמו.
  if (r.includes("שפלה")) return "shfela";
  return regionGroupOf(r);
}

/** הקבוצה הכללית שמפתח אזור של רשימת המכונים שייך אליה ("shfela" → "center"). */
export function prospectRegionGroup(key: string): string {
  return key === "shfela" ? "center" : key;
}

// כתיבים שאנשים באמת מקלידים או מדביקים, מול השם שב-REGION_CITIES. בלי זה
// "קרית ביאליק" (יו"ד אחת) או "מודיעין-מכבים-רעות" לא נקשרים לאזור בכלל.
const CITY_ALIASES: Record<string, string> = {
  "תל אביב-יפו": "תל אביב",
  "תל-אביב": "תל אביב",
  "ת\"א": "תל אביב",
  "ת״א": "תל אביב",
  "פתח תקוה": "פתח תקווה",
  "פתח-תקווה": "פתח תקווה",
  "פ\"ת": "פתח תקווה",
  "פ״ת": "פתח תקווה",
  "ראשל\"צ": "ראשון לציון",
  "ראשל״צ": "ראשון לציון",
  "מודיעין-מכבים-רעות": "מודיעין",
  "מודיעין מכבים רעות": "מודיעין",
  "פרדס חנה": "פרדס חנה-כרכור",
  "כרכור": "פרדס חנה-כרכור",
  "רמת-גן": "רמת גן",
  "ר\"ג": "רמת גן",
  "ר״ג": "רמת גן",
};

/**
 * השם הקנוני של עיר כפי שהוא מופיע ב-REGION_CITIES, או null אם אינה במילון.
 * "קרית" מתוקנת ל"קריית" (כך כתובות כל הקריות במילון).
 */
export function canonicalCity(name: string | null | undefined): string | null {
  const c = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!c) return null;
  if (CITY_TO_REGION[c]) return c;
  const alias = CITY_ALIASES[c];
  if (alias) return alias;
  const kirya = c.replace(/^קרית /, "קריית ");
  if (CITY_TO_REGION[kirya]) return kirya;
  return null;
}

/** מפתח אזור של רשימת המכונים לפי עיר, או null כשהעיר לא במילון. */
export function prospectRegionOfCity(city: string | null | undefined): string | null {
  const canonical = canonicalCity(city);
  return canonical ? prospectRegionOf(CITY_TO_REGION[canonical]) : null;
}
