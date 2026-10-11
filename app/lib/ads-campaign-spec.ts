import { REGION_CITIES, regionToSlug } from "./regions";

// מפרט קמפיין חיפוש אזורי - טהור, בלי מסד ובלי גוגל. זו הגרסה בקוד של המפרטים
// שנכתבו ידנית ב-docs/ads-copy (g-tlv 22/9/26 הוא התבנית): קבוצת מודעות אחת,
// מילים בהתאמת ביטוי שנושאות את שם העיר, שלוש כותרות נעוצות למיקום 1, שורת
// keyword insertion נעוצה למיקום 2, שלושה תיאורים משותפים ורביעי אזורי,
// רשת חיפוש בלבד, Maximize clicks עם תקרת CPC. google-ads-write.ts הופך את
// המפרט לקריאת mutate אחת שיוצרת קמפיין מושהה.

export const SITE = "https://www.mentalytics.co.il";
/** תקציב יומי לקמפיין אזורי חדש (כמו צפון השרון וחיפה בתחילתם). */
export const NEW_CAMPAIGN_DAILY_ILS = 10;
export const MIN_DAILY_ILS = 5;
export const MAX_DAILY_ILS = 200;
export const CPC_CAP_ILS = 7;
/** רשימת השליליות המשותפת בחשבון (google-ads-copy.md). מוצמדת כשהיא נמצאת. */
export const SHARED_NEGATIVE_LIST = "מילים שליליות - מטופלים";
/** שליליות ברמת הקמפיין, מעל הרשימה המשותפת (כמו ב-/admin/ads). */
export const CAMPAIGN_NEGATIVES = ["חינם", "קופת חולים", 'קופ"ח', "דרושים", "משרות", "עבודה", "לימודים", "תואר", "קורס", "פסיכומטרי", "מבחן פסיכולוגי"];
/** כותרת RSA עד 30 תווים, תיאור עד 90, נתיב תצוגה עד 15. */
export const HEADLINE_MAX = 30;
export const DESCRIPTION_MAX = 90;
export const PATH_MAX = 15;
export const MAX_HEADLINES = 15;
export const MAX_KEYWORDS = 80;

/**
 * אזור → הקמפיין שמשרת אותו (utm) ושם קצר. ה-utm הוא המפתח המשותף עם
 * ads_campaign_registry (utm_campaign) ועם הייחוס באנליטיקס; שם הקמפיין בגוגל
 * יכול להיות עם ספרה בסוף (g-sharon1 ↔ g-sharon), ולכן ההתאמה היא דרך הרישום.
 */
export const REGION_CAMPAIGNS: Record<string, { utm: string; slug: string }> = {
  "גוש דן": { utm: "g-tlv", slug: "tlv" },
  "ירושלים והסביבה": { utm: "g-jerusalem", slug: "jerusalem" },
  "דרום השרון": { utm: "g-sharon", slug: "sharon" },
  "צפון השרון": { utm: "g-north-sharon", slug: "north-sharon" },
  "השפלה והמרכז": { utm: "g-shfela", slug: "shfela" },
  "חיפה והקריות": { utm: "g-haifa", slug: "haifa" },
  "עמק יזרעאל ונצרת": { utm: "g-emek", slug: "emek" },
  "גליל וצפון": { utm: "g-galil", slug: "galil" },
  "דרום": { utm: "g-south", slug: "south" },
  "נגב ואילת": { utm: "g-negev", slug: "negev" },
  "יהודה ושומרון": { utm: "g-yosh", slug: "yosh" },
};

export type CampaignSpec = {
  region: string;
  utm: string;
  /** שם הקמפיין בגוגל. ברירת המחדל = ה-utm; google-ads-write מוסיף ספרה כשהשם תפוס. */
  name: string;
  adGroupName: string;
  dailyBudgetIls: number;
  cpcCapIls: number;
  finalUrl: string;
  finalUrlSuffix: string;
  path1: string;
  path2: string;
  /** התאמת ביטוי, כולן. */
  keywords: string[];
  /** נעוצות למיקום 1. */
  headlinesPinned1: string[];
  /** נעוצה למיקום 2: שורת keyword insertion. */
  headlineKeywordInsertion: string;
  /** לא נעוצות. */
  headlines: string[];
  /** הראשון נעוץ למיקום 1. */
  descriptions: string[];
  negatives: string[];
};

const SHARED_DESCRIPTIONS = [
  "מלאו שאלון מקצועי מבוסס מחקר, הבינו את מוקד הקושי, ומצאו את המטפל המתאים לכם ביותר.",
  "שאלון מקצועי שנבנה ע\"י פסיכולוגים וחוקרים יתאים לכם את המטפל הנכון.",
  "לא עוד בחירת מטפל לפי מזל או תמונה. ענו על שאלון פסיכולוגי קצר והבינו מה הקושי.",
];

/** "ב" + עיר: בעברית זה תמיד תקין, גם לשמות עם מקף או שתי מילים. */
const inCity = (city: string) => `ב${city}`;

function joinCities(cities: string[], withPrefix: boolean): string {
  const parts = cities.map((c) => (withPrefix ? inCity(c) : c));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} ו${parts[parts.length - 1]}`;
}

/** המילים לעיר: הדפוס של g-tlv, בלי תחומים (היצע התחומים משתנה בין אזורים). */
function keywordsForCity(city: string, main: boolean): string[] {
  const base = [
    `פסיכולוג ${city}`,
    `פסיכולוג ${inCity(city)}`,
    `פסיכולוגית ${city}`,
    `פסיכולוגית ${inCity(city)}`,
    `פסיכולוגים ${inCity(city)}`,
    `טיפול פסיכולוגי ${city}`,
    `מטפל ${city}`,
    `מטפלת ${city}`,
  ];
  if (!main) return base;
  return [
    ...base,
    `פסיכולוג קליני ${city}`,
    `פסיכולוג מומלץ ${inCity(city)}`,
    `פסיכולוגים מומלצים ${inCity(city)}`,
    `טיפול פסיכולוגי ${inCity(city)}`,
    `פסיכותרפיה ${city}`,
    `טיפול רגשי ${city}`,
    `מטפל רגשי ${city}`,
    `טיפול נפשי ${city}`,
    `טיפול בחרדה ${city}`,
    `טיפול בדיכאון ${city}`,
  ];
}

/**
 * המפרט לאזור. null לאזור שאינו ברשימה (אין לו utm) או בלי ערים.
 * הערים: הראשונה ברשימת האזור היא העיר הראשית (בכותרות ובנתיב), ועד חמש
 * ערים נכנסות למילים.
 */
export function buildRegionCampaignSpec(region: string, opts?: { dailyBudgetIls?: number; name?: string }): CampaignSpec | null {
  const mapping = REGION_CAMPAIGNS[region];
  const cities = REGION_CITIES[region] ?? [];
  if (!mapping || cities.length === 0) return null;
  const main = cities[0];
  const others = cities.slice(1, 4);
  const keywordCities = cities.slice(0, 5);

  const keywords: string[] = [];
  for (const c of keywordCities) for (const k of keywordsForCity(c, c === main)) if (!keywords.includes(k)) keywords.push(k);

  const fits = (max: number) => (s: string) => s.trim().length > 0 && s.trim().length <= max;
  const headlinesPinned1 = ["השאלון שמוצא לך מטפל/ת", `שאלון התאמה למטפל ${inCity(main)}`, `השאלון שמוצא מטפל ${inCity(main)}`].filter(fits(HEADLINE_MAX));
  const headlines = [
    `פסיכולוגית ${inCity(main)}`,
    `פסיכולוגים ומטפלים ${inCity(main)}`,
    `טיפול פסיכולוגי ${inCity(main)}`,
    others.length > 0 ? `גם ${joinCities(others, true)}` : "",
    `פסיכולוגים מומלצים ${inCity(main)}`,
    "במקום המלצות: שאלון התאמה",
    "תעודות ההכשרה מאומתות",
    "השאלון חינם, בלי הרשמה",
    "דוח אישי בסוף השאלון",
    `קליניקה ${inCity(main)} או אונליין`,
    "מטפל שמתאים בדיוק לך",
    `פסיכולוג מומלץ ${inCity(main)}`,
    `מטפלים מוסמכים ${inCity(main)}`,
    "טיפול בחרדה, דיכאון ועוד",
  ]
    .filter(fits(HEADLINE_MAX))
    .slice(0, MAX_HEADLINES - headlinesPinned1.length - 1);
  const regional = others.length > 0
    ? `מטפלים מוסמכים ${inCity(main)}, ${joinCities(others, true)}. תעודות ההכשרה אומתו.`
    : `מטפלים מוסמכים ${inCity(main)} ובסביבה. תעודות ההכשרה אומתו.`;
  const descriptions = [...SHARED_DESCRIPTIONS, fits(DESCRIPTION_MAX)(regional) ? regional : `מטפלים מוסמכים ${inCity(main)} ובסביבה. תעודות ההכשרה אומתו.`].filter(fits(DESCRIPTION_MAX));

  const path2 = regionToSlug(main);
  const dailyBudgetIls = Math.min(MAX_DAILY_ILS, Math.max(MIN_DAILY_ILS, Math.round(opts?.dailyBudgetIls ?? NEW_CAMPAIGN_DAILY_ILS)));
  return {
    region,
    utm: mapping.utm,
    name: opts?.name?.trim() || mapping.utm,
    adGroupName: mapping.slug,
    dailyBudgetIls,
    cpcCapIls: CPC_CAP_ILS,
    finalUrl: `${SITE}/therapists/region/${encodeURIComponent(regionToSlug(region))}`,
    finalUrlSuffix: `utm_source=google&utm_medium=cpc&utm_campaign=${mapping.utm}`,
    path1: "פסיכולוג",
    path2: path2.length <= PATH_MAX ? path2 : "",
    keywords: keywords.slice(0, MAX_KEYWORDS),
    headlinesPinned1,
    headlineKeywordInsertion: `{KEYWORD:פסיכולוג ${inCity(main)}}`,
    headlines,
    descriptions,
    negatives: [...CAMPAIGN_NEGATIVES],
  };
}

/** התקציב המוצע כשמעלים קמפיין קיים: לפחות ₪5 יותר, לכל היותר פי 1.5, בתקרה. */
export function suggestedBudgetRaise(currentIls: number): number {
  const raised = Math.max(currentIls + 5, Math.round(currentIls * 1.5));
  return Math.min(MAX_DAILY_ILS, Math.max(MIN_DAILY_ILS, raised));
}
