import { TRAINING_AREAS } from "./therapist-options";

// "Topic" landing pages - the two keyword layers the specialty pages don't
// cover (see docs/seo-roadmap.md):
//   - conditions ("טיפול בחרדה"): mapped to the approaches that treat them
//     (the which-therapy logic), listing therapists trained in those
//     approaches - honest framing, no per-therapist claims we can't back.
//   - audiences ("פסיכולוג ילדים"): filtered by the REAL age_groups tags
//     (ילדים 53, נוער 88, גיל שלישי 52 listed therapists).
// Same thin-page protection as cities/specialties: <MIN_LISTED_FOR_INDEX →
// noindex + out of the sitemap. Iron rule: no page without real supply.

export type Topic = {
  slug: string;
  name: string;
  /** H1 / <title> in searcher phrasing. */
  searchTitle: string;
  kind: "condition" | "audience";
  intro: string;
  /** Therapist filter - union within each field, intersection across fields. */
  filter: { trainingAreasAny?: string[]; ageGroupsAny?: string[] };
  /** How the supply line explains WHO is listed (honesty line). */
  supplyNote: string;
  related: { href: string; label: string }[];
};

export const TOPICS: Topic[] = [
  {
    slug: "טיפול-בחרדה",
    name: "טיפול בחרדה",
    searchTitle: "טיפול בחרדה - מטפלים מוסמכים בגישות מבוססות-מחקר",
    kind: "condition",
    intro:
      "חרדה היא הסיבה הנפוצה ביותר לפנייה לטיפול - והחדשות הטובות: היא גם מהמצבים המגיבים ביותר לטיפול. הגישות המובילות מחקרית הן CBT (עבודה ממוקדת על מחשבות, הימנעויות וחשיפה הדרגתית), ACT (שינוי היחס לחרדה במקום מאבק בה), טיפול דינאמי (הבנת השורשים הרגשיים) ו-DBT לוויסות רגשי עז. הבחירה תלויה באופי החרדה ובהעדפה האישית - השאלון שלנו מכוון בדיוק לזה.",
    filter: { trainingAreasAny: ["CBT", "ACT", "טיפול דינאמי", "DBT"] },
    supplyNote: "מוצגים מטפלים בעלי הכשרה בגישות המובילות לטיפול בחרדה (CBT / ACT / דינאמי / DBT)",
    related: [
      { href: "/research/which-therapy", label: "איזה טיפול מתאים לי?" },
      { href: "/therapists/specialty/CBT", label: "מטפלי CBT" },
      { href: "/therapists/specialty/ACT", label: "מטפלי ACT" },
    ],
  },
  {
    slug: "טיפול-בדיכאון",
    name: "טיפול בדיכאון",
    searchTitle: "טיפול בדיכאון - פסיכולוגים ומטפלים מוסמכים",
    kind: "condition",
    intro:
      "הפרעות דיכאון לסוגיהן הינן נפוצות מאוד, ולרוב מתרחשות ב\"גלים\" (הנקראים \"אפיזודות\"). ישנו דיכאון משמעותי (מג'ורי) ודיכאון עם תפקוד תקין יחסית (דיסתימיה). על פי המחקר, ניתן לטפל בהצלחה רבה בקושי זה בטיפול פסיכולוגי - מחקרים מראים יעילות דומה לטיפול תרופתי במקרים קלים-בינוניים, ויתרון לשילוב בשניהם במקרים מורכבים. הגישות המבוססות ביותר: CBT (כולל אקטיבציה התנהגותית - חזרה הדרגתית לפעילות), טיפול דינאמי (עיבוד רגשי עמוק יותר) ו-ACT. תסמינים כמו ירידה במצב הרוח, אובדן עניין, עייפות ושינה משובשת מעל שבועיים - סיבה טובה לשיחת היכרות.",
    filter: { trainingAreasAny: ["CBT", "טיפול דינאמי", "ACT"] },
    supplyNote: "מוצגים מטפלים בעלי הכשרה בגישות המובילות לטיפול בדיכאון (CBT / דינאמי / ACT)",
    related: [
      { href: "/research/which-therapy", label: "איזה טיפול מתאים לי?" },
      { href: "/research/cbt-vs-dynamic", label: "CBT או טיפול דינאמי - מה ההבדל?" },
    ],
  },
  {
    slug: "טיפול-ב-OCD",
    name: "טיפול ב-OCD",
    searchTitle: "טיפול ב-OCD (טורדנות כפייתית) - מטפלי CBT מוסמכים",
    kind: "condition",
    intro:
      "הטיפול המוביל מחקרית ב-OCD הוא CBT עם דגש על חשיפה ומניעת תגובה (ERP) - עבודה הדרגתית ומובנית שמפרקת את מעגל האובססיה-קומפולסיה. חשוב לבחור מטפל שמכיר עבודת חשיפה; בשיחת ההיכרות שווה לשאול על ניסיון ספציפי עם OCD.",
    filter: { trainingAreasAny: ["CBT"] },
    supplyNote: "מוצגים מטפלים בעלי הכשרת CBT - הגישה המובילה לטיפול ב-OCD",
    related: [
      { href: "/therapists/specialty/CBT", label: "כל מטפלי ה-CBT" },
      { href: "/research/which-therapy", label: "איזה טיפול מתאים לי?" },
    ],
  },
  {
    slug: "טיפול-בקשיי-קשב",
    name: "טיפול בקשיי קשב וריכוז",
    searchTitle: "טיפול בקשיי קשב וריכוז (ADHD) - למבוגרים ולילדים",
    kind: "condition",
    intro:
      "קשיי קשב וריכוז אינם רק עניין של ילדים - אצל מבוגרים הם מתבטאים בדחיינות, עומס כרוני ותסכול מתמשך. הטיפול המועיל משלב פסיכו-חינוך, כלים התנהגותיים (CBT מותאם-קשב) ובניית שגרות; אצל ילדים - גם COG-FUN (עבודה על תפקודים ניהוליים עם ריפוי בעיסוק) והדרכת הורים.",
    filter: { trainingAreasAny: ["CBT", "טיפול COG-FUN לקשיי קשב וריכוז", "הדרכת הורים"] },
    supplyNote: "מוצגים מטפלים בעלי הכשרה רלוונטית לקשיי קשב (CBT / COG-FUN / הדרכת הורים)",
    related: [
      { href: "/research/adhd-adults", label: "קשיי קשב אצל מבוגרים - המדריך" },
      { href: "/research/therapy-for-child", label: "מתי ילד צריך טיפול רגשי?" },
    ],
  },
  {
    slug: "פסיכולוג-ילדים",
    name: "פסיכולוג לילדים",
    searchTitle: "פסיכולוג ילדים - מטפלים רגשיים לילדים",
    kind: "audience",
    intro:
      "טיפול רגשי בילדים עובד אחרת מטיפול במבוגרים: דרך משחק, יצירה והקשר הטיפולי - ולרוב בשילוב הדרכת הורים, שפעמים רבות היא המנוף המרכזי. הסימנים שמצדיקים התייעצות: שינוי התנהגותי מתמשך, קשיי שינה או אכילה, הסתגרות, התפרצויות חוזרות או קושי חברתי. שאלון הילדים שלנו ממפה את הקושי וממליץ על סוג הטיפול המתאים.",
    filter: { ageGroupsAny: ["ילדים", "גיל הרך"] },
    supplyNote: "מוצגים מטפלים שמטפלים בילדים (כולל הגיל הרך)",
    related: [
      { href: "/kids", label: "✦ שאלון התאמה לילדים ונוער" },
      { href: "/research/therapy-for-child", label: "מתי ילד צריך טיפול רגשי?" },
      { href: "/therapists/specialty/הדרכת-הורים", label: "מדריכי הורים" },
    ],
  },
  {
    slug: "פסיכולוג-לנוער",
    name: "פסיכולוג לנוער ומתבגרים",
    searchTitle: "פסיכולוג לנוער ומתבגרים - מטפלים למתבגרים",
    kind: "audience",
    intro:
      "גיל ההתבגרות מזמן טלטלות אמיתיות: בעיות שקשורות לזהות העצמית של הנער/ה, קשיים ודילמות חברתיות, לחצים לימודיים והצורך להוכיח את היכולות שלי בגיל שבו אין עדיין עוגנים נפשיים חזקים. בשל הלחצים המרובים הללו גיל זה משופע בקשיים שקשורים לחרדה, דכדוך או פגיעה עצמית. מתבגרים זקוקים למטפל שמדבר בגובה העיניים ויודע לבנות אמון הדרגתי גם עם בני נוער שלא מעוניינים בשלב ההתחלתי בטיפול, ושידע לגייס אותם בצורה טובה לטיפול. טיפול פסיכולוגי בנוער משלב לרוב עבודה פרטנית עם קשר להורים במינון מותאם, ככל שגיל המתבגר/ה גדול יותר כך כדאי יותר להתייעץ איתו לגבי המינון של הדרכות ההורים והשילוב שלהם בטיפול.",
    filter: { ageGroupsAny: ["נוער"] },
    supplyNote: "מוצגים מטפלים שמטפלים בבני נוער",
    related: [
      { href: "/kids", label: "✦ שאלון התאמה לילדים ונוער" },
      { href: "/research/therapy-for-child", label: "מתי ילד/נער צריך טיפול?" },
    ],
  },
  {
    slug: "פסיכולוג-לגיל-השלישי",
    name: "פסיכולוג לגיל השלישי",
    searchTitle: "פסיכולוג לגיל השלישי - טיפול רגשי למבוגרים ותיקים",
    kind: "audience",
    intro:
      "פרישה, אובדן, בדידות, התמודדות עם מחלה או פשוט פרק חיים חדש - טיפול רגשי בגיל השלישי הוא תחום מתפתח עם עדויות טובות ליעילות. מטפלים המנוסים בעבודה עם ותיקים יודעים לכבד ניסיון חיים עשיר ולעבוד בקצב הנכון. טיפול אונליין פותח נגישות גם למי שהניידות מאתגרת. הדילמות העיקריות בגילאים הללו עוסקות בתכנים שקשורים למשמעות החיים, תחושת החמצה, ההתמודדות עם השינויים הגופניים, לחצים משפחתיים שונים, ועוד. ישנם מספר סוגי טיפול המתאימים לגיל השלישי, כתלות בקושי ובאישיות של המטופל. אחד הטיפולים הינו טיפול לוגו-תרפיה, טיפול שבו עוסקים בשאלות של קיומיות (אקסיסטנציאליזם) וזהות.",
    filter: { ageGroupsAny: ["הגיל השלישי"] },
    supplyNote: "מוצגים מטפלים שמטפלים בבני הגיל השלישי",
    related: [
      { href: "/research/online-therapy", label: "האם טיפול אונליין באמת עובד?" },
      { href: "/therapists/region/אונליין", label: "מטפלים אונליין" },
    ],
  },
];

export function topicToSlug(t: Topic): string {
  return t.slug;
}

export function slugToTopic(slug: string): Topic | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  return TOPICS.find((t) => t.slug === decoded) ?? null;
}

// ── City×topic pilot (M4) ────────────────────────────────────────────────────
// Deliberately narrow: 3 big cities only, indexable only at ≥MIN_CITY_TOPIC
// listed therapists. Expansion only after GSC proves the pattern (and never
// into doorway territory - see docs/seo-roadmap.md part 4).
export const PILOT_CITIES = ["תל אביב", "ירושלים", "חיפה"] as const;
export const MIN_CITY_TOPIC = 5;

/** Topics eligible for city×topic pages: the pilot uses approaches with clear
 *  local search demand + the audiences. */
export const CITY_TOPIC_SLUGS = [
  "פסיכולוג-ילדים",
  "פסיכולוג-לנוער",
  "טיפול-בחרדה",
  "טיפול-בדיכאון",
] as const;

/** Approaches allowed as city×topic pages ("CBT בתל אביב", "טיפול זוגי בירושלים"). */
export const CITY_TOPIC_APPROACHES = ["CBT", "טיפול זוגי"] as const;

export function isCityTopicAllowed(topic: Topic): boolean {
  return (
    (CITY_TOPIC_SLUGS as readonly string[]).includes(topic.slug) ||
    (CITY_TOPIC_APPROACHES as readonly string[]).includes(topic.name)
  );
}

// Approach-based city pages ride the same route via a synthetic topic.
export function approachAsTopic(name: string): Topic | null {
  if (!(TRAINING_AREAS as readonly string[]).includes(name)) return null;
  return {
    slug: name.replace(/\s+/g, "-"),
    name,
    searchTitle: `${name} - מטפלים מוסמכים`,
    kind: "condition",
    intro: "",
    filter: { trainingAreasAny: [name] },
    supplyNote: `מוצגים מטפלים בעלי הכשרת ${name}`,
    related: [],
  };
}

/** Resolve a city-topic slug: named topic first, then a raw approach. */
export function slugToCityTopic(slug: string): Topic | null {
  const named = slugToTopic(slug);
  if (named) return named;
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
  }
  return approachAsTopic(decoded.replace(/-/g, " ")) ?? approachAsTopic(decoded);
}
