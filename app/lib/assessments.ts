import { ASSESSMENT_TYPES } from "@/app/lib/therapist-options";

/**
 * Landing pages for assessments - the niche the big Israeli portals do not hold.
 *
 * A SERP check on "אבחון פסיכודידקטי מחיר" and its siblings returns health funds
 * and small private institutes; neither בטיפולנט nor על הספה rank there. That is
 * the cheapest entry into a competitive market we have, and we already carry
 * real supply in `therapists.assessment_types`.
 *
 * `intro` and `whoFor` are the editorial half. Without them these would be seven
 * therapist lists differing only by a filter, which is exactly the thin
 * near-duplicate pattern the roadmap's anti-doorway rules exist to prevent. Each
 * page has to answer the question a searcher actually typed before it lists
 * anyone.
 */

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export type AssessmentMeta = {
  /** Value stored in therapists.assessment_types - the join key. */
  value: AssessmentType;
  /** URL segment. */
  slug: string;
  /** H1 / <title>, phrased the way people search. */
  searchTitle: string;
  /** Short display name for links and breadcrumbs. */
  name: string;
  intro: string;
  /** Who typically needs it - the qualifying paragraph. */
  whoFor: string;
  /** Who is licensed to perform it. Honest about what the title does not mean. */
  performedBy: string;
  related: { href: string; label: string }[];
};

export const ASSESSMENTS: AssessmentMeta[] = [
  {
    value: "פסיכו-דידקטי",
    slug: "פסיכודידקטי",
    name: "אבחון פסיכודידקטי",
    searchTitle: "אבחון פסיכודידקטי - מאבחנים מוסמכים",
    intro:
      "אבחון פסיכודידקטי בודק שני דברים יחד: איך התלמיד מתמודד עם הלמידה בפועל, ומה מקורו של הקושי. החלק הדידקטי ממפה קריאה, שטף, הבנת הנקרא, כתיבה, איות וחשבון; החלק הפסיכולוגי בודק מה שמתחת - יכולות חשיבה, זיכרון עבודה, מהירות עיבוד, קשב ומצב רגשי. השילוב הוא הסיבה שהאבחון קיים: ילד שקורא לאט יכול לקרוא לאט בגלל דיסלקסיה, בגלל חרדה, בגלל הוראה לקויה או בגלל קושי קשבי, ואבחון שבודק רק קריאה יראה את אותה תוצאה בכל ארבעת המקרים.",
    whoFor:
      "כשיש פער עקבי בין ההשקעה לתוצאה, כשקושי בקריאה או בחשבון נמשך למרות תרגול, כשלא ברור אם הקושי לימודי או רגשי, או כשנדרשות התאמות מתקדמות לבגרות. שימו לב: לתוספת זמן של 25% אין צורך באבחון כלל.",
    performedBy:
      "פסיכולוג מומחה שהוכשר גם בתחום הדידקטי, או צמד של מאבחן דידקטי ופסיכולוג מומחה שאחראי על האינטגרציה ועל החתימה. בישראל אין רישיון בשם \"מאבחן פסיכודידקטי\" - מה שקובע הוא ההסמכה של מי שמבצע וחותם.",
    related: [
      { href: "/research/psychodidactic", label: "המדריך המלא לאבחון פסיכודידקטי" },
      { href: "/research/assessments", label: "השוואה בין כל סוגי האבחונים" },
    ],
  },
  {
    value: "פסיכו-דיאגנוסטי",
    slug: "פסיכודיאגנוסטי",
    name: "אבחון פסיכודיאגנוסטי",
    searchTitle: "אבחון פסיכודיאגנוסטי - פסיכולוגים קליניים מוסמכים",
    intro:
      "האבחון הפסיכולוגי המעמיק ביותר שקיים. מטרתו אינה להדביק תווית אלא לשרטט מפה מפורטת של מבנה האישיות: איך האדם מתמודד עם מתחים, מהם מנגנוני ההגנה שלו, איך הוא מעבד מידע ותופס מציאות, ואיפה נקודות החוזק והפגיעות. התהליך כולל ראיון קליני מעמיק, מבחנים אובייקטיביים ומבחנים השלכתיים, ומסתיים בדוח עם המלצות טיפוליות מעשיות.",
    whoFor:
      "כשטיפול נמשך זמן רב בלי שיפור וגם המטפל וגם המטופל חשים שמשהו חסר, כשצריך אבחנה מבדלת בין מצבים דומים, או לקראת צמתים כמו ועדות רפואיות וחוות דעת.",
    performedBy: "פסיכולוג קליני מומחה, לרוב לאחר הכשרה של כעשר שנות לימודים והתמחות.",
    related: [
      { href: "/research/psychodiagnostic", label: "מה כולל אבחון פסיכודיאגנוסטי" },
      { href: "/research/assessments", label: "השוואה בין כל סוגי האבחונים" },
    ],
  },
  {
    value: "אבחון קשיי תקשורת ASD",
    slug: "אבחון-אוטיזם",
    name: "אבחון אוטיזם ותקשורת",
    searchTitle: "אבחון אוטיזם (ASD) - מאבחנים מוסמכים לילדים ולמבוגרים",
    intro:
      "אבחון על רצף האוטיזם בודק אם קיימים מאפיינים מתמשכים של קושי בתקשורת ובאינטראקציה חברתית, לצד דפוסים מצומצמים או חזרתיים. לפי הנחיות משרד הבריאות האבחון בילדים נעשה בשני מסלולים במקביל: שלב פסיכולוגי הכולל תצפית וכלים ייעודיים כמו ADOS-2, ושלב רפואי. חשוב להבדיל בינו לבין חרדה חברתית: באוטיזם מדובר בקושי התפתחותי בקריאת רמזים חברתיים, ובחרדה חברתית היכולת החברתית לרוב תקינה אך נבלמת מהפחד.",
    whoFor:
      "חשד לקושי בתקשורת חברתית, דפוסים חזרתיים, קשיי ויסות חושי, או מבוגר שמזהה בעצמו מאפיינים ורוצה בירור מסודר.",
    performedBy:
      "פסיכולוג קליני לילדים, התפתחותי, שיקומי או חינוכי עם הכשרה ייעודית, לצד רכיב רפואי (פסיכיאטר ילדים, נוירולוג ילדים או רופא ילדים התפתחותי).",
    related: [
      { href: "/research/autism-assessment", label: "מדריך לאבחון תקשורת ואוטיזם" },
      { href: "/research/social-anxiety", label: "ההבדל בין אוטיזם לחרדה חברתית" },
    ],
  },
  {
    value: "הערכת בשלות לגן",
    slug: "בשלות-לגן",
    name: "הערכת בשלות לגן",
    searchTitle: "הערכת בשלות לגן ולכיתה א' - מאבחנים מוסמכים",
    intro:
      "הערכה שבודקת אם הילד מוכן למסגרת הבאה - מעבר לגן חובה או לכיתה א'. היא בוחנת מיומנויות שפה וחשיבה, מוטוריקה עדינה וגסה, קשב, ובעיקר בשלות רגשית וחברתית: היכולת להיפרד, להתמודד עם תסכול, לתפקד בקבוצה ולעמוד בכללים. המטרה אינה לתייג אלא לתת להורים ולצוות החינוכי בסיס להחלטה, ולעיתים לזהות מוקדם קושי שאפשר לעבוד עליו לפני המעבר.",
    whoFor:
      "כשיש התלבטות אמיתית לגבי המעבר, כשהצוות החינוכי מעלה ספק, כשיש עיכוב התפתחותי ידוע, או כשהילד יליד סוף השנה וההורים מתלבטים לגבי דחיית המעבר.",
    performedBy: "פסיכולוג התפתחותי או פסיכולוג חינוכי.",
    related: [
      { href: "/research/therapy-for-child", label: "מתי ילד צריך טיפול רגשי" },
      { href: "/research/child-emotional-developmental", label: "קשיים פיזיולוגיים שנראים כקושי רגשי" },
    ],
  },
  {
    value: "נוירו-פסיכולוגי",
    slug: "נוירופסיכולוגי",
    name: "אבחון נוירופסיכולוגי",
    searchTitle: "אבחון נוירופסיכולוגי - מאבחנים מוסמכים",
    intro:
      "מיפוי רחב של תפקודי מוח: זיכרון, קשב, שפה, תפיסה חזותית-מרחבית ותפקודים ניהוליים, ביחס לנורמות גיל. זהו אינו האבחון הסטנדרטי ללקות למידה, והוא מקיף ויקר יותר. הוא מיועד למצבים שבהם השאלה היא מה מצב התפקוד הקוגניטיבי עצמו ולא מה מקור הקושי הלימודי.",
    whoFor:
      "אחרי פגיעת ראש או תאונה, אחרי אירוע נוירולוגי כמו שבץ, כשיש חשד לירידה קוגניטיבית, או לקראת ועדות רפואיות שדורשות הערכה תפקודית.",
    performedBy: "נוירופסיכולוג או פסיכולוג שיקומי.",
    related: [
      { href: "/research/assessments", label: "השוואה בין כל סוגי האבחונים" },
      { href: "/research/adhd-adults", label: "אבחון ADHD למבוגרים" },
    ],
  },
  {
    value: "הערכה פסיכולוגית",
    slug: "הערכה-פסיכולוגית",
    name: "הערכה פסיכולוגית",
    searchTitle: "הערכה פסיכולוגית - פסיכולוגים מוסמכים",
    intro:
      "הערכה ממוקדת שנועדה לענות על שאלה מוגדרת, ולא למפות את כל האישיות. היא קצרה ומצומצמת יותר מאבחון פסיכודיאגנוסטי מלא, ולרוב כוללת ראיון קליני, איסוף רקע ושאלונים או מבחנים לפי הצורך. פעמים רבות היא הצעד הנכון לפני שמחליטים אם בכלל דרוש אבחון מעמיק.",
    whoFor:
      "כשצריך כיוון לפני תחילת טיפול, כשיש שאלה ספציפית שדורשת מענה מקצועי, או כשרוצים ייעוץ חד-פעמי בלי להיכנס לתהליך אבחון מלא.",
    performedBy: "פסיכולוג קליני או פסיכולוג חינוכי.",
    related: [
      { href: "/research/assessments", label: "השוואה בין כל סוגי האבחונים" },
      { href: "/research/which-therapy", label: "איזה טיפול מתאים לי" },
    ],
  },
  {
    value: "אבחון תעסוקתי",
    slug: "אבחון-תעסוקתי",
    name: "אבחון תעסוקתי",
    searchTitle: "אבחון תעסוקתי - פסיכולוגים תעסוקתיים",
    intro:
      "מיפוי כישורים, תחומי עניין, ערכים ומאפייני אישיות ביחס לעולם העבודה, עם המלצות על כיווני תעסוקה או הכשרה. משמש גם בשיקום תעסוקתי ולעיתים נדרש בוועדות של ביטוח לאומי.",
    whoFor: "קושי בבחירת מסלול לימודים או קריירה, שינוי כיוון מקצועי, או שיקום תעסוקתי אחרי פגיעה.",
    performedBy: "פסיכולוג תעסוקתי.",
    related: [{ href: "/research/assessments", label: "השוואה בין כל סוגי האבחונים" }],
  },
];

export function assessmentBySlug(slug: string): AssessmentMeta | null {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return ASSESSMENTS.find((a) => a.slug === decoded) ?? null;
}

export function assessmentByValue(value: string): AssessmentMeta | null {
  return ASSESSMENTS.find((a) => a.value === value) ?? null;
}
