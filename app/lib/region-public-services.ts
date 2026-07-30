// Region-level public data for the city/region landing pages: typical private
// price ranges and major PUBLIC mental-health services (psychiatric hospitals /
// psychiatric departments in general hospitals) with their operator.
//
// Price ranges are deliberately coarse ("לרוב"), anchored to the hebpsy.net
// tariff surveys (national average ~395-400₪/session in 2025, Tel-Aviv area
// averaging ~50₪ above the north) - center is higher, periphery lower.
//
// The services list is curated to major, stable, well-known institutions only
// (YMYL: accuracy over completeness). Kupot clinics are covered by a generic
// line in the UI rather than per-clinic listings that would rot.

export type RegionPriceRange = { min: number; max: number };

export const REGION_PRICE_RANGE: Record<string, RegionPriceRange> = {
  "גוש דן": { min: 350, max: 600 },
  "דרום השרון": { min: 350, max: 600 },
  "צפון השרון": { min: 320, max: 550 },
  "ירושלים והסביבה": { min: 320, max: 550 },
  "השפלה והמרכז": { min: 320, max: 550 },
  "חיפה והקריות": { min: 280, max: 500 },
  "גליל וצפון": { min: 260, max: 480 },
  "עמק יזרעאל ונצרת": { min: 260, max: 480 },
  "דרום": { min: 280, max: 500 },
  "נגב ואילת": { min: 260, max: 480 },
  "יהודה ושומרון": { min: 300, max: 520 },
};

export type PublicService = {
  name: string;
  city: string;
  /** "מרכז לבריאות הנפש" = dedicated psychiatric hospital; "מחלקה" = psychiatric dept in a general hospital */
  kind: "מרכז לבריאות הנפש" | "מחלקה פסיכיאטרית בבית חולים כללי";
  operator: "ממשלתי" | "כללית" | "ציבורי (מלכ״ר)";
};

export const REGION_PUBLIC_SERVICES: Record<string, PublicService[]> = {
  "גוש דן": [
    { name: "גהה", city: "פתח תקווה", kind: "מרכז לבריאות הנפש", operator: "כללית" },
    { name: "אברבנאל", city: "בת ים", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "שיבא (תל השומר) - חטיבת בריאות הנפש", city: "רמת גן", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "ממשלתי" },
  ],
  "דרום השרון": [
    { name: "שלוותה", city: "הוד השרון", kind: "מרכז לבריאות הנפש", operator: "כללית" },
    { name: "גהה", city: "פתח תקווה", kind: "מרכז לבריאות הנפש", operator: "כללית" },
    // Serves the northern edge of this region (כפר יונה, תל מונד), which the
    // city intros name - without this the FAQ below the intro contradicted it.
    { name: "לב השרון", city: "בין צור משה לפרדסיה", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
  ],
  "צפון השרון": [
    { name: "לב השרון", city: "בין צור משה לפרדסיה", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "שער מנשה", city: "ליד פרדס חנה-כרכור", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
  ],
  "ירושלים והסביבה": [
    { name: "המרכז הירושלמי לבריאות הנפש (כפר שאול–איתנים)", city: "ירושלים", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "הרצוג", city: "ירושלים", kind: "מרכז לבריאות הנפש", operator: "ציבורי (מלכ״ר)" },
    { name: "הדסה עין כרם - המערך הפסיכיאטרי", city: "ירושלים", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "ציבורי (מלכ״ר)" },
  ],
  "השפלה והמרכז": [
    { name: "המרכז לבריאות הנפש באר יעקב–נס ציונה", city: "באר יעקב", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
  ],
  "חיפה והקריות": [
    { name: "מעלה הכרמל", city: "טירת כרמל", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "רמב״ם - המערך הפסיכיאטרי", city: "חיפה", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "ממשלתי" },
  ],
  "גליל וצפון": [
    { name: "מזור (לשעבר מזרע)", city: "עכו", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "זיו - המערך הפסיכיאטרי", city: "צפת", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "ממשלתי" },
  ],
  "עמק יזרעאל ונצרת": [
    { name: "העמק - המערך הפסיכיאטרי", city: "עפולה", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "כללית" },
  ],
  "דרום": [
    { name: "המרכז לבריאות הנפש באר שבע", city: "באר שבע", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
    { name: "סורוקה - המערך הפסיכיאטרי", city: "באר שבע", kind: "מחלקה פסיכיאטרית בבית חולים כללי", operator: "כללית" },
  ],
  "נגב ואילת": [
    { name: "המרכז לבריאות הנפש באר שבע", city: "באר שבע", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
  ],
  "יהודה ושומרון": [
    { name: "המרכז הירושלמי לבריאות הנפש (כפר שאול–איתנים)", city: "ירושלים", kind: "מרכז לבריאות הנפש", operator: "ממשלתי" },
  ],
};
