import { ARRANGEMENTS } from "@/app/lib/therapist-options";

/**
 * Funding-route landing pages: who pays, and which therapists accept that route.
 *
 * This is the layer the roadmap flagged as cheap and under-served. The real
 * volumes from our own Keyword Planner pull make the case: "פסיכולוג ילדים מכבי"
 * is 390/month at LOW competition and "טיפול זוגי מכבי" 140 with a +89% trend.
 * People do not search "psychotherapy" when money is the constraint - they
 * search their funder's name.
 *
 * Supply is real and larger than the health funds alone: משרד הביטחון 45,
 * ביטוחים פרטיים 41, ביטוח לאומי 38, קופות החולים 11.
 *
 * Deliberately NOT a price index. Only 3 of 158 listed therapists have a price
 * on record (the field is not even in the therapist editor), so any "national
 * average" here would be three numbers wearing a lab coat. See the note at the
 * bottom of this file.
 *
 * Entitlement rules and sums change, so the copy stays at the level of "what
 * this route is and what to ask", and sends people to the body itself for the
 * current terms rather than quoting figures that will silently go stale.
 */

export type Arrangement = (typeof ARRANGEMENTS)[number];

export type ArrangementMeta = {
  value: Arrangement;
  slug: string;
  name: string;
  searchTitle: string;
  intro: string;
  /** Who this route is actually open to. */
  whoFor: string;
  /** What to check before booking - the practical part. */
  whatToAsk: string[];
  related: { href: string; label: string }[];
};

export const ARRANGEMENT_PAGES: ArrangementMeta[] = [
  {
    value: "קופות החולים",
    slug: "קופות-חולים",
    name: "קופות החולים",
    searchTitle: "פסיכולוגים בהסדר עם קופות החולים",
    intro:
      "מאז רפורמת בריאות הנפש, האחריות על הטיפול הנפשי עברה לקופות החולים. בפועל יש שני מסלולים שונים לגמרי: טיפול במרפאה של הקופה או אצל מטפל בהסדר, שעולה השתתפות עצמית נמוכה אך לרוב כרוך בהמתנה ובמספר מפגשים מוגבל; והחזר חלקי דרך הביטוח המשלים עבור טיפול פרטי, שבו אתם בוחרים את המטפל ומשלמים את ההפרש. ההבדל בין השניים הוא בדרך כלל בין זמינות למחיר, ושווה להבין אותו לפני שמתחילים.",
    whoFor:
      "כל מבוטח בקופת חולים. תנאי ההחזר בביטוח המשלים משתנים בין הקופות ובין רמות התוכנית, ולעיתים גם לפי גיל.",
    whatToAsk: [
      "האם המטפל/ת נמצא/ת בהסדר עם הקופה שלי, או שמדובר בהחזר בדיעבד?",
      "כמה מפגשים מכוסים, ומה גובה ההשתתפות העצמית לכל מפגש?",
      "מה זמן ההמתנה בפועל למרפאה, ומה למטפל בהסדר?",
      "האם נדרשת הפניה מרופא המשפחה או התחייבות מראש?",
    ],
    related: [
      { href: "/research/kupa-guide", label: "המדריך לטיפול דרך הקופה" },
      { href: "/research/faq", label: "כמה עולה טיפול פסיכולוגי" },
    ],
  },
  {
    value: "משרד הביטחון",
    slug: "משרד-הביטחון",
    name: "משרד הביטחון",
    searchTitle: "פסיכולוגים ומטפלים בהסדר עם משרד הביטחון",
    intro:
      "אגף השיקום במשרד הביטחון מממן טיפול נפשי למי שהוכרו כנפגעי פעולות איבה או כנכי צה\"ל, ובכלל זה משרתי מילואים שנפגעו נפשית בשירות. הטיפול ניתן אצל מטפלים שנמצאים בהסדר עם האגף, ולרוב בלי השתתפות עצמית. הצעד הראשון הוא ההכרה עצמה, וזה החלק שלוקח הכי הרבה זמן - כדאי להתחיל בו במקביל ולא אחריו.",
    whoFor:
      "נכי צה\"ל, נפגעי פעולות איבה, ומשרתי מילואים עם פגיעה נפשית שהוכרה. בשנים האחרונות נפתחו גם מסלולים מקוצרים למשרתי מילואים.",
    whatToAsk: [
      "האם המטפל/ת בהסדר פעיל עם אגף השיקום, ומה מספר הספק?",
      "האם אפשר להתחיל טיפול לפני שההכרה הושלמה, ומה קורה אם היא לא תאושר?",
      "כמה מפגשים אושרו, ומה התהליך להארכה?",
      "האם יש השתתפות עצמית כלשהי?",
    ],
    related: [
      {
        href: "/research/community/החזר-טיפול-נפשי-מילואים-מדריך-זכאות",
        label: "מילואימניק/ית? מדריך הזכאות להחזר",
      },
      { href: "/therapists/topic/טיפול-בטראומה", label: "מטפלים בטראומה" },
    ],
  },
  {
    value: "ביטוח לאומי",
    slug: "ביטוח-לאומי",
    name: "ביטוח לאומי",
    searchTitle: "פסיכולוגים ומטפלים בהסדר עם ביטוח לאומי",
    intro:
      "ביטוח לאומי מממן טיפול נפשי בכמה מסלולים נפרדים שקל להתבלבל ביניהם: שיקום מקצועי לבעלי נכות, נפגעי עבודה שהפגיעה השאירה אצלם השלכה נפשית, ונפגעי פעולות איבה. לכל מסלול יש ועדה משלו, קריטריונים משלו, וטופסי הפניה משלו. חשוב לדעת מראש באיזה מסלול אתם נמצאים, מפני שהוא קובע גם מי מוסמך לטפל וגם מה מכוסה.",
    whoFor:
      "בעלי נכות מוכרת בשיקום מקצועי, נפגעי עבודה, ונפגעי פעולות איבה. הזכאות נקבעת בוועדה ולא על ידי המטפל.",
    whatToAsk: [
      "באיזה מסלול אני נמצא/ת, ומי הגורם המאשר?",
      "האם המטפל/ת מוכר/ת לאותו מסלול ספציפית?",
      "מה נדרש כדי לפתוח תיק, וכמה זמן זה לוקח בפועל?",
      "מה קורה כשמספר המפגשים שאושרו נגמר?",
    ],
    related: [
      { href: "/research/kupa-guide", label: "מסלולי מימון לטיפול נפשי" },
      { href: "/therapists/topic/טיפול-בטראומה", label: "מטפלים בטראומה" },
    ],
  },
  {
    value: "ביטוחים פרטיים",
    slug: "ביטוח-פרטי",
    name: "ביטוחים פרטיים",
    searchTitle: "פסיכולוגים ומטפלים המקבלים ביטוח פרטי",
    intro:
      "פוליסות בריאות פרטיות כוללות לעיתים כיסוי לטיפול נפשי, לרוב כהחזר בדיעבד ולא כתשלום ישיר למטפל. הכיסוי משתנה מאוד בין פוליסות, ולעיתים קרובות אנשים מגלים שהוא קיים רק אחרי שנים של תשלום מהכיס. שווה לבדוק בפוליסה עצמה לפני שמניחים שאין - ובמיוחד בפוליסות שנרכשו דרך מקום העבודה, שרבים לא מודעים לתנאיהן.",
    whoFor: "מבוטחים בפוליסת בריאות פרטית הכוללת פרק בריאות הנפש, לרבות פוליסות קולקטיביות דרך מעסיק.",
    whatToAsk: [
      "האם הפוליסה שלי כוללת פרק בריאות הנפש, ומה תקרת ההחזר השנתית?",
      "האם ההחזר מותנה בסוג המטפל (פסיכולוג מומחה, עו\"ס קליני, פסיכיאטר)?",
      "האם נדרשת הפניה או אישור מראש?",
      "האם המטפל/ת מנפיק/ה קבלה בפורמט שחברת הביטוח מקבלת?",
    ],
    related: [
      { href: "/research/kupa-guide", label: "מסלולי מימון לטיפול נפשי" },
      { href: "/research/faq", label: "שאלות נפוצות על עלות טיפול" },
    ],
  },
];

export function arrangementBySlug(slug: string): ArrangementMeta | null {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  return ARRANGEMENT_PAGES.find((a) => a.slug === decoded) ?? null;
}

/**
 * The price-index page this file was meant to accompany is blocked on data, not
 * on effort: `therapists.price` is absent from THERAPIST_EDIT_FIELDS and from
 * the dashboard editor, so only 3 of 158 listed therapists have one. Once the
 * field is collected and a few dozen therapists have filled it in, an aggregate
 * page becomes both honest and genuinely differentiating - no competitor can
 * publish real Israeli therapy prices, because none of them holds the data.
 */
export const PRICE_INDEX_MIN_SAMPLE = 40;
