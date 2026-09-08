import { TRAINING_AREAS } from "./therapist-options";
import { CITY_SEO_LIST } from "./regions";
import { specialtyIntro } from "./specialties";

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
  /**
   * Paid-landing only: noindex + kept out of the sitemap.
   *
   * Reserved for a topic that exists purely as an ad destination. It used to
   * hide the kids+youth union page on the theory that nobody searches
   * "פסיכולוג לילדים ונוער" as one phrase. A SERP check on 9/9/26 showed the
   * opposite: the top result for exactly that query in Jerusalem is a
   * competitor page titled "פסיכולוגים מומלצים לילדים ולבני נוער בירושלים",
   * and the owner searched the phrase himself. The union page is indexed
   * since then; the field stays for any future paid-only topic.
   */
  adsOnly?: boolean;
  /**
   * Parent-facing questions the page answers above its listings, each answer
   * also emitted as FAQPage JSON-LD. Written per topic, once - the competitor
   * pages that rank for "פסיכולוג ילדים ב<עיר>" carry 1,000-1,300 words shaped
   * as a parent's questions (מתי לפנות, מה ההבדל, כמה עולה); ours carried 170
   * below the cards. The answers claim no counts and no prices, so the same
   * text is true in every city.
   */
  faq?: { q: string; a: string }[];
  /**
   * Second half of the city page <title>. The pages that rank carry both
   * lexical variants ("פסיכולוג ילדים" and "מטפלים רגשיים לילדים"); the
   * default tail, "מטפלים מאומתים", carries neither.
   */
  cityTitleTail?: string;
};

/**
 * Age groups that make a page a parent's destination rather than a patient's.
 * "הגיל השלישי" is deliberately absent: it is an adult audience.
 */
const YOUTH_AGE_GROUPS = ["גיל הרך", "ילדים", "נוער"];

/**
 * Does this topic address a parent looking for their child, rather than an
 * adult looking for themselves? Decides which questionnaire the page's CTA
 * opens - a page titled "פסיכולוג לילדים" that sends people to the adults
 * questionnaire contradicts its own headline.
 *
 * Uses `every`, not `some`: a topic that spans children AND adults belongs to
 * both audiences, so it keeps the general two-button CTA rather than forcing
 * the kids flow on everyone.
 */
export function isYouthTopic(topic: Pick<Topic, "filter">): boolean {
  const ages = topic.filter.ageGroupsAny ?? [];
  return ages.length > 0 && ages.every((a) => YOUTH_AGE_GROUPS.includes(a));
}

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
    slug: "טיפול-בטראומה",
    name: "טיפול בטראומה",
    searchTitle: "טיפול בטראומה ובפוסט טראומה - מטפלים בגישות מבוססות-מחקר",
    kind: "condition",
    intro:
      "טראומה אינה רק האירוע עצמו אלא מה שנשאר אחריו: דריכות שלא מרפה, סיוטים או פלאשבקים, הימנעות ממקומות ומחשבות, ותחושה שחלק מהחיים נעצר. שתי עובדות חשובות מנחות את הטיפול. הראשונה היא שרוב האנשים שחווים אירוע קשה מתאוששים ממנו בכוחות עצמם, ולכן לא כל מצוקה אחרי אירוע היא הפרעה. השנייה היא שמי שהקושי כן נשאר אצלו מגיב היטב לטיפול ממוקד - זהו אחד התחומים שבהם לטיפול הפסיכולוגי יש את הבסיס המחקרי החזק ביותר. הגישות המובילות הן EMDR, שבה מעבדים את הזיכרון בעזרת גירוי דו-צדדי, CBT ממוקד-טראומה ו-CPT, שעובדות על המשמעויות שהאירוע הותיר ועל ההימנעות, וטיפול דינאמי ממוקד-טראומה, שמתמקד בהשפעה על העולם הרגשי ועל הקשרים. בשנים האחרונות רבים בישראל מתמודדים עם טראומה ישירה או משנית, כולל מילואימניקים ובני משפחותיהם, ופנייה לעזרה בשלב מוקדם מקצרת את הדרך.",
    filter: { trainingAreasAny: ["טיפול בטראומה", "טיפול דינאמי בטראומה", "EMDR", "CPT"] },
    supplyNote:
      "מוצגים מטפלים בעלי הכשרה ייעודית בטראומה (טיפול ממוקד-טראומה / דינאמי בטראומה / EMDR / CPT)",
    related: [
      { href: "/therapists/specialty/EMDR", label: "מטפלי EMDR" },
      { href: "/research/community/החזר-טיפול-נפשי-מילואים-מדריך-זכאות", label: "מילואימניק/ית? מדריך הזכאות להחזר" },
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
    cityTitleTail: "מטפלים רגשיים לילדים",
    faq: [
      { q: "מתי ילד צריך טיפול רגשי, ומתי זה פשוט שלב?", a: "רוב הקשיים בילדות חולפים מעצמם, וזה חלק מההתפתחות. מה שמצדיק התייעצות הוא לא הקושי עצמו אלא שלושה מאפיינים שלו: משך, עוצמה והשפעה על התפקוד. שינוי התנהגותי שנמשך יותר מכמה שבועות, התפרצויות שחוזרות ומחריפות, קשיי שינה או אכילה חדשים, הסתגרות, סירוב ללכת לגן או לבית הספר, או קושי חברתי שהילד עצמו סובל ממנו. השאלה השימושית ביותר להורים היא לא \"איזו אבחנה יש לילד\" אלא מתי הקושי מופיע ומתי הוא נעלם: ילד שמתפרק בשיעורי הבית אבל פורח בחוג מספר סיפור אחד, וילד שקשה לו בכל מסגרת מספר סיפור אחר." },
      { q: "מה ההבדל בין פסיכולוג ילדים למטפל רגשי לילדים?", a: "פסיכולוג ילדים הוא בעל תואר שני בפסיכולוגיה ורישום בפנקס הפסיכולוגים, ולרוב מומחיות קלינית, חינוכית או התפתחותית. מטפל רגשי מגיע מהכשרה טיפולית אחרת: עבודה סוציאלית קלינית, טיפול באמנות, בדרמה או בתנועה, או פסיכותרפיה. שניהם יכולים לטפל היטב בילדים, וההבדל המעשי הוא בסוג ההכשרה ובמה שכל אחד מוסמך לעשות: אבחון פסיכולוגי, למשל, הוא עניין של פסיכולוג. במאגר שלנו מוצגים שני הסוגים, ותעודות ההכשרה של כולם אומתו, כך שההשוואה היא על מה שבאמת חשוב - ההתאמה לילד." },
      { q: "איך נראה טיפול פסיכולוגי בילדים? הילד רק ידבר?", a: "לא. ילדים לא תמיד מסוגלים לבטא במילים מה עובר עליהם, ולכן טיפול בילדים עובד דרך משחק, ציור, יצירה וסיפורים, והמטפל קורא את הרגש דרך הפעילות. הפגישה הראשונה היא בדרך כלל עם ההורים בלבד, כדי לשמוע את הסיפור ולהבין את ההיסטוריה, ורק אחר כך המטפל פוגש את הילד. הקשר עם ההורים נמשך לאורך כל הטיפול: מטפל טוב ישלב אתכם ולא יבודד אתכם מהתהליך. הגיל קובע הרבה - הגיל הרך, גיל בית הספר וגיל ההתבגרות דורשים גישות שונות לחלוטין." },
      { q: "למה מציעים לנו הדרכת הורים במקום טיפול לילד?", a: "כי בגילאים הצעירים זו ההתערבות עם הביסוס המחקרי החזק ביותר. ההורים נמצאים עם הילד הרבה יותר זמן ממטפל שפוגש אותו שעה בשבוע, ודרכם אפשר לייצר שינוי סביבתי, התנהגותי ורגשי עמוק ויציב. המונח המקצועי הוא \"טיפול בילד דרך ההורים\", וזו לא הנחתה של הבעיה על ההורים אלא שימוש במנוף החזק ביותר שיש. עם זאת, הדרכת הורים אינה מענה לכל דבר, והיא פחות מתאימה כפתרון יחיד לילדים גדולים יותר או במצבים של ריבוי קשיים. שם כדאי שאיש מקצוע יבודד קודם את מקור הקושי." },
      { q: "האם צריך אבחון לפני שמתחילים טיפול?", a: "לא בהכרח, וזו אחת הטעויות היקרות ביותר. הורים רבים מופנים לאבחון מהסוג המוכר או הזמין ביותר, לא בהכרח המדויק ביותר, ואבחונים הם יקרים וממושכים. פעמים רבות, איש מקצוע שרואה את התמונה הרחבה יכול לזהות את מקור הקושי ולהפנות ישירות לטיפול או להדרכה המתאימים, בלי אבחון בכלל. אבחון נחוץ כשיש שאלה שרק הוא עונה עליה: התאמות בלימודים, אבחנה מבדלת בין מצבים דומים, או ועדה. אם אינכם בטוחים, שאלון הילדים שלנו ממפה את הקושי ואומר גם מתי אבחון באמת נדרש." },
      { q: "כמה עולה פסיכולוג לילדים, ומה האפשרויות דרך קופת החולים והשירות הפסיכולוגי החינוכי?", a: "יש שלושה מסלולים, והם לא מתחרים זה בזה. השירות הפסיכולוגי החינוכי של הרשות המקומית נותן מענה לילדים בגנים ובבתי הספר, ללא תשלום, והפנייה אליו נעשית דרך הצוות החינוכי. קופות החולים מפעילות מרפאות בריאות הנפש לילדים ונוער וגם מטפלים בהסדר, בהשתתפות עצמית, אך זמני ההמתנה יכולים להיות ארוכים. במסלול הפרטי המחיר תלוי בהכשרה ובוותק של המטפל, ואפשר לשאול עליו מראש בלי מבוכה. הבחירה בין המסלולים תלויה בדחיפות, בסוג הקושי ובתקציב, ורוב המשפחות משלבות ביניהם." },
      { q: "איך בוחרים פסיכולוג לילד שלנו?", a: "שלושה דברים חשובים יותר מכל השאר: הכשרה מתאימה לגיל ולסוג הקושי, ניסיון עם ילדים דומים, ותחושת האמון שלכם כהורים בשיחת ההיכרות. הכימיה של הילד עם המטפל נבנית בפגישות הראשונות, ומותר לתת לה שתיים או שלוש פגישות. אם אתם לא בטוחים איזה סוג טיפול מתאים, שאלון הילדים שלנו נבנה בדיוק בשביל השלב הזה - הוא ממפה את הקושי, מתחשב בגיל, וממליץ על סוג הטיפול לפני שמתחילים לחפש מטפל." },
    ],
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
    cityTitleTail: "מטפלים למתבגרים",
    faq: [
      { q: "איך יודעים אם מתבגר צריך טיפול, או שזה סתם גיל ההתבגרות?", a: "גיל ההתבגרות מזמן טלטלות אמיתיות, ורובן אינן סיבה לטיפול. מה שכן מצדיק התייעצות הוא שינוי מובהק ומתמשך: ירידה חדה בתפקוד בלימודים או בחברה, הסתגרות שנמשכת שבועות, שינויים בשינה ובאכילה, דכדוך שלא חולף, חרדה שמצמצמת את החיים, או כל סימן של פגיעה עצמית. הגיל הזה משופע בקשיים שקשורים לחרדה, דכדוך ופגיעה עצמית דווקא כי עדיין אין בו עוגנים נפשיים חזקים, ולכן פנייה מוקדמת חשובה יותר מאשר בכל גיל אחר." },
      { q: "הנער או הנערה שלנו מסרבים לטיפול. מה עושים?", a: "זה המצב הנפוץ, לא החריג, ומטפלים לנוער יודעים לעבוד איתו. מתבגרים זקוקים למטפל שמדבר בגובה העיניים ויודע לבנות אמון הדרגתי גם עם מי שלא מעוניין בטיפול בשלב ההתחלתי. לעיתים מתחילים מהדרכת הורים בלבד, ולעיתים מפגישת היכרות אחת \"בלי התחייבות\" שהמתבגר בוחר אם להמשיך אחריה. מה שלא עובד הוא כפייה: היא הופכת את המטפל לשלוחה של ההורים ומחבלת באמון שהטיפול כולו נשען עליו." },
      { q: "כמה ההורים מעורבים בטיפול של מתבגר?", a: "פחות מאשר בטיפול בילדים, ובמינון שעולה לדיון עם המתבגר עצמו. ככל שהגיל עולה, כך כדאי יותר להתייעץ איתו על מידת השילוב של ההורים. הכלל המקובל: תוכן הפגישות הוא של המתבגר ונשמר בסודיות, וההורים מעודכנים על הכיוון הכללי ועל כל מה שנוגע לביטחון. מטפל טוב יגדיר את זה בפגישה הראשונה, מול ההורים ומול המתבגר, כדי שאף אחד לא ירגיש שמאחורי גבו." },
      { q: "מה ההבדל בין פסיכולוג לנוער לבין מטפל רגשי או פסיכותרפיסט?", a: "פסיכולוג הוא בעל תואר שני בפסיכולוגיה ורישום בפנקס הפסיכולוגים, ולרוב מומחיות קלינית או חינוכית. פסיכותרפיסט או מטפל רגשי מגיעים מהכשרה טיפולית אחרת, כמו עבודה סוציאלית קלינית או טיפול באמנויות. עם מתבגרים ההבדל שקובע הוא לרוב לא התואר אלא הניסיון הספציפי עם בני נוער והיכולת לבנות קשר, ולכן כדאי לשאול על זה ישירות בשיחת ההיכרות. במאגר שלנו מוצגים שני הסוגים, ותעודות ההכשרה של כולם אומתו." },
      { q: "האם הטיפול סודי? מה ההורים ישמעו?", a: "כן. מטפל מחויב בסודיות גם כלפי מתבגר, וזה תנאי לכך שהוא בכלל ידבר. החריג הוא סכנה: אם עולה סיכון ממשי לביטחון של המתבגר או של אחרים, המטפל יערב את ההורים, ובדרך כלל יעשה זאת יחד עם המתבגר ולא מאחורי גבו. מחשבות קשות בפני עצמן אינן סכנה מיידית, ומטפלים שומעים עליהן כל יום. כדאי שההורים והמתבגר ישמעו את הכללים האלה מהמטפל בפגישה הראשונה." },
      { q: "כמה זמן לוקח טיפול פסיכולוגי לנוער, וכמה זה עולה?", a: "המנעד רחב. טיפול ממוקד בקושי ספציפי, כמו חרדת בחינות או קושי חברתי, יכול להסתכם בעשרה עד עשרים מפגשים. קשיים עמוקים יותר או משבר מתמשך דורשים זמן ארוך יותר, ולעיתים גם שילוב של הדרכת הורים. מבחינת עלות, מרפאות בריאות הנפש לילדים ונוער של קופות החולים נותנות מענה בהשתתפות עצמית, לעיתים עם המתנה, ובמסלול הפרטי המחיר תלוי בהכשרה ובוותק של המטפל. במסגרת בית הספר, היועצת והשירות הפסיכולוגי החינוכי הם כתובת ראשונה שלא עולה כסף." },
      { q: "איך בוחרים פסיכולוג למתבגר?", a: "בשונה מטיפול בילדים צעירים, כאן כדאי לשתף את המתבגר בבחירה - למשל להציע שניים או שלושה מטפלים ולתת לו לבחור עם מי לקבוע היכרות. תחושת הבחירה שלו היא חלק מהטיפול. מעבר לזה: ניסיון מוכח עם בני נוער, גישה שמתאימה לסוג הקושי, ומיקום או אונליין שלא הופכים כל פגישה למאבק. שאלון הילדים והנוער שלנו ממפה את הקושי, מתחשב בגיל, וממליץ על סוג הטיפול לפני שמתחילים לחפש." },
    ],
    filter: { ageGroupsAny: ["נוער"] },
    supplyNote: "מוצגים מטפלים שמטפלים בבני נוער",
    related: [
      { href: "/kids", label: "✦ שאלון התאמה לילדים ונוער" },
      { href: "/research/therapy-for-child", label: "מתי ילד/נער צריך טיפול?" },
    ],
  },
  {
    slug: "פסיכולוג-ילדים-ונוער",
    // "לילדים ונוער", not "לילדים ולנוער": the former is how the query is
    // typed (and how the competitor that ranks for it phrases its title).
    name: "פסיכולוג לילדים ונוער",
    searchTitle: "פסיכולוג לילדים ונוער - מטפלים רגשיים לילדים ומתבגרים",
    kind: "audience",
    intro:
      "טיפול רגשי בילדים עובד אחרת מטיפול במבוגרים: דרך משחק, יצירה והקשר הטיפולי, ולרוב בשילוב הדרכת הורים שפעמים רבות היא המנוף המרכזי. הסימנים שמצדיקים התייעצות בגיל הזה הם שינוי התנהגותי מתמשך, קשיי שינה או אכילה, הסתגרות, התפרצויות חוזרות או קושי חברתי. בגיל ההתבגרות התמונה משתנה: עולות שאלות של זהות עצמית, דילמות חברתיות ולחצים לימודיים, והכל בגיל שבו עדיין אין עוגנים נפשיים חזקים, ולכן הוא משופע בקשיים שקשורים לחרדה, דכדוך או פגיעה עצמית. מתבגרים זקוקים למטפל שמדבר בגובה העיניים ויודע לבנות אמון הדרגתי גם עם מי שאינו מעוניין בטיפול בשלב ההתחלתי. גם כאן נמשכת העבודה עם ההורים, אך במינון מותאם: ככל שגיל המתבגר/ת עולה, כך כדאי יותר להתייעץ איתו/ה על מידת השילוב של ההורים בטיפול. שאלון הילדים והנוער שלנו ממפה את הקושי, מתחשב בגיל, וממליץ על סוג הטיפול המתאים.",
    cityTitleTail: "מטפלים רגשיים לילדים ונוער",
    faq: [
      { q: "מתי ילד או מתבגר צריכים טיפול פסיכולוגי?", a: "לא הקושי עצמו מצדיק טיפול אלא שלושה מאפיינים שלו: משך, עוצמה והשפעה על התפקוד. בילדים: שינוי התנהגותי מתמשך, קשיי שינה או אכילה, הסתגרות, התפרצויות חוזרות או קושי חברתי. במתבגרים: ירידה חדה בתפקוד, דכדוך שלא חולף, חרדה שמצמצמת את החיים, או כל סימן של פגיעה עצמית. השאלה השימושית ביותר להורים בכל גיל היא מתי הקושי מופיע ומתי הוא נעלם - ילד שמתפרק בבית אבל פורח בחוג מספר סיפור אחר מילד שקשה לו בכל מסגרת." },
      { q: "מה ההבדל בין טיפול בילדים לטיפול בנוער?", a: "כמעט הכל. טיפול בילדים עובד דרך משחק, יצירה והקשר הטיפולי, וההורים הם חלק מרכזי ממנו, לעיתים המנוף העיקרי דרך הדרכת הורים. טיפול במתבגרים הוא שיחתי יותר, מבוסס על אמון שנבנה בהדרגה ובגובה העיניים, והמעורבות של ההורים מצטמצמת למינון שעולה לדיון עם המתבגר עצמו. גם הקשיים שונים: בילדות עולות שאלות של ויסות, התנהגות ומסגרת, ובהתבגרות שאלות של זהות, חברה ולחצים לימודיים. לכן מטפל שמצוין עם ילדים אינו בהכרח המטפל הנכון למתבגר, ולהפך." },
      { q: "מה ההבדל בין פסיכולוג ילדים ונוער למטפל רגשי?", a: "פסיכולוג הוא בעל תואר שני בפסיכולוגיה ורישום בפנקס הפסיכולוגים, ולרוב מומחיות קלינית, חינוכית או התפתחותית. מטפל רגשי מגיע מהכשרה טיפולית אחרת: עבודה סוציאלית קלינית, טיפול באמנות, בדרמה או בתנועה, או פסיכותרפיה. שניהם יכולים לטפל היטב, וההבדל המעשי הוא במה שכל אחד מוסמך לעשות: אבחון פסיכולוגי, למשל, הוא עניין של פסיכולוג. במאגר שלנו מוצגים שני הסוגים, ותעודות ההכשרה של כולם אומתו." },
      { q: "למה מציעים להורים הדרכת הורים במקום טיפול לילד?", a: "כי בגילאים הצעירים זו ההתערבות עם הביסוס המחקרי החזק ביותר. ההורים נמצאים עם הילד הרבה יותר זמן ממטפל שפוגש אותו שעה בשבוע, ודרכם אפשר לייצר שינוי סביבתי, התנהגותי ורגשי עמוק ויציב. במתבגרים הדרכת הורים היא לרוב תוספת ולא תחליף, ולעיתים היא הדרך היחידה להתחיל כשהמתבגר עצמו עדיין מסרב. בכל גיל, הדרכת הורים אינה מענה לכל דבר, ובמצבים של ריבוי קשיים כדאי שאיש מקצוע יבודד קודם את מקור הקושי." },
      { q: "האם צריך אבחון לפני הטיפול?", a: "לא בהכרח. הורים רבים מופנים לאבחון מהסוג המוכר או הזמין ביותר, לא בהכרח המדויק ביותר, ואבחונים הם יקרים וממושכים. פעמים רבות איש מקצוע שרואה את התמונה הרחבה יכול לזהות את מקור הקושי ולהפנות ישירות לטיפול, בלי אבחון בכלל. אבחון נחוץ כשיש שאלה שרק הוא עונה עליה: התאמות בלימודים, אבחנה מבדלת, או ועדה. שאלון הילדים והנוער שלנו ממפה את הקושי ואומר גם מתי אבחון באמת נדרש." },
      { q: "כמה זה עולה, ומה האפשרויות דרך קופת החולים ובית הספר?", a: "שלושה מסלולים שלא מתחרים זה בזה. השירות הפסיכולוגי החינוכי של הרשות נותן מענה לילדים ולנוער בגנים ובבתי הספר ללא תשלום, דרך הצוות החינוכי. קופות החולים מפעילות מרפאות בריאות הנפש לילדים ונוער וגם מטפלים בהסדר, בהשתתפות עצמית, לעיתים עם המתנה. במסלול הפרטי המחיר תלוי בהכשרה ובוותק, ואפשר לשאול עליו מראש. רוב המשפחות משלבות בין המסלולים לפי הדחיפות, סוג הקושי והתקציב." },
      { q: "איך בוחרים את המטפל הנכון לילד או למתבגר?", a: "לילד צעיר: הכשרה מתאימה לגיל, ניסיון עם ילדים דומים, ותחושת האמון שלכם בשיחת ההיכרות. למתבגר: כל אלה, ובנוסף לשתף אותו בבחירה, כי תחושת הבחירה שלו היא חלק מהטיפול. בשני המקרים מותר לתת לקשר שתיים או שלוש פגישות לפני שמחליטים. ואם אינכם בטוחים איזה סוג טיפול מתאים בכלל, שאלון הילדים והנוער שלנו נבנה בדיוק בשביל השלב הזה: הוא ממפה את הקושי, מתחשב בגיל, וממליץ על סוג הטיפול לפני שמתחילים לחפש מטפל." },
    ],
    filter: { ageGroupsAny: ["ילדים", "גיל הרך", "נוער"] },
    supplyNote: "מוצגים מטפלים שמטפלים בילדים ובבני נוער (כולל הגיל הרך)",
    related: [
      { href: "/kids", label: "✦ שאלון התאמה לילדים ונוער" },
      { href: "/research/therapy-for-child", label: "מתי ילד או נער צריך טיפול?" },
      { href: "/therapists/specialty/הדרכת-הורים", label: "מדריכי הורים" },
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
  "פסיכולוג-ילדים-ונוער",
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

/**
 * Which cities may carry a page for this topic.
 *
 * Five places used to read PILOT_CITIES directly (the route resolver, the
 * sister-city links, the sitemap, the national topic page, the city page).
 * Routing every one of them through here means widening one family - the
 * kids/youth audiences have real supply in ~20 cities and pages in 3 - is a
 * change to this function, not to five files that must agree. The supply
 * gate (MIN_CITY_TOPIC) stays where it is: this decides where a page MAY
 * exist, the count decides whether it is indexed.
 */
export function cityTopicCitiesFor(topic: Topic): readonly string[] {
  // Audience pages (kids / youth / both) may exist in any city that has a city
  // page at all: supply was measured on 9/9/26 at >=5 kids/youth therapists in
  // ~20 cities while pages existed in 3. MIN_CITY_TOPIC still decides which of
  // them is indexed, so a city with two child therapists renders noindex, not
  // a thin indexed page. Condition and approach topics stay on the pilot list
  // until GSC proves the pattern for them too.
  return topic.kind === "audience" ? CITY_SEO_LIST : PILOT_CITIES;
}

/** The topics that can have city pages, resolved - the sitemap's list, shared. */
export function cityTopicList(): Topic[] {
  const slugs = [...CITY_TOPIC_SLUGS, ...CITY_TOPIC_APPROACHES.map((a) => a.replace(/\s+/g, "-"))];
  return slugs.map((s) => slugToCityTopic(s)).filter((t): t is Topic => !!t && !t.adsOnly);
}

// ── Online×topic (phase 3 of the online cluster, 5/8/26) ─────────────────────
// Mirrors the city×topic pilot exactly - same allow-list, same supply gate,
// same expansion rule (GSC proves the pattern first). A 3-model SERP panel
// found competitors hold dedicated pages for these combos ("טיפול אונליין
// בחרדה", "טיפול זוגי אונליין") while our online hub is one generic page.
// Supply verified per combo on 5/8/26 (23-105 online therapists each); the
// gate below is what keeps a future supply dip from publishing a thin page.
export const ONLINE_TOPIC_SLUGS = [
  "טיפול-בחרדה",
  "טיפול-בדיכאון",
  "פסיכולוג-ילדים",
] as const;

export const ONLINE_TOPIC_APPROACHES = ["CBT", "טיפול זוגי"] as const;

export const MIN_ONLINE_TOPIC = MIN_CITY_TOPIC;

export function isOnlineTopicAllowed(topic: Topic): boolean {
  return (
    (ONLINE_TOPIC_SLUGS as readonly string[]).includes(topic.slug) ||
    (ONLINE_TOPIC_APPROACHES as readonly string[]).includes(topic.name)
  );
}

/** Every online×topic slug, for static params and the sitemap. */
export function onlineTopicSlugs(): string[] {
  return [
    ...ONLINE_TOPIC_SLUGS,
    ...ONLINE_TOPIC_APPROACHES.map((a) => a.replace(/\s+/g, "-")),
  ];
}

// Approach-based city pages ride the same route via a synthetic topic.
export function approachAsTopic(name: string): Topic | null {
  if (!(TRAINING_AREAS as readonly string[]).includes(name)) return null;
  return {
    slug: name.replace(/\s+/g, "-"),
    name,
    searchTitle: `${name} - מטפלים מוסמכים`,
    kind: "condition",
    // Reuse the specialty page's prose so an approach-based city page
    // ("CBT בירושלים") also carries real content below its listing.
    intro: specialtyIntro(name),
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
