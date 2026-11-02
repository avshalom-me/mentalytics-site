// שומר היכולות של רישיון בית ספר (מצב "גפ״ן", app/lib/schools-crm.ts).
//
// השער (app/lib/school-gate.server.ts) יודע מי בית הספר: עוגייה חתומה עם מזהה
// הרישיון. כאן נבדק מה הרישיון הזה רשאי להשתמש בו. הנתיבים שמעבדים מידע
// במודל שפה או מציגים רשימת מטפלים שואלים כאן לפני שהם עושים משהו.
//
// הכלל שקובע את ההתנהגות:
//   - בלי עוגיית רישיון (כל מי שאינו בית ספר ברישיון): אין שאלה, אין קריאה
//     למסד, שום שינוי. כך האתר הציבורי והשאלון הפתוח נשארים כמו שהם.
//   - עם עוגייה ובלי דגל כבוי: אותה תשובה כמו בלי עוגייה.
//   - עם עוגייה ודגל כבוי: 403. החסימה קשורה לעוגייה ולא לשדה בגוף הבקשה,
//     כדי שלקוח שמשנה את questionnaire_type לא יעקוף אותה.
//   - עמודת הדגלים עוד לא קיימת במסד (המיגרציה לא הורצה): הכול דלוק. פריסת
//     הקוד לא תלויה בסדר שבו מריצים את המיגרציה.
//   - כשל אחר בקריאה: חוסמים. רישיון גפ״ן שהבטיח "בלי AI" לא ייפתח ל-AI
//     בגלל תקלה רגעית במסד, וההסבר ורשימת המטפלים הם תוספות, לא הליבה.
import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { grantFromRequest } from "@/app/lib/school-gate.server";
import { ALL_FEATURES_ON, featureFlagsFrom, SCHOOL_FEATURE_LABELS, type SchoolFeature, type SchoolFeatureFlags } from "@/app/lib/schools-crm";

// קוד השגיאה של Postgres לעמודה שלא קיימת (42703); PostgREST מחזיר גם PGRST204
// כשהיא חסרה במטמון הסכמה.
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

/**
 * היכולות הזמינות לרישיון. null = לא הצלחנו לקרוא (לא "הכול דלוק"), והקורא
 * מחליט; חסרה העמודה = הכול דלוק.
 */
export async function licenseFeatureFlags(licenseId: string): Promise<SchoolFeatureFlags | null> {
  const { data, error } = await supabaseAdmin.from("school_licenses").select("disabled_features").eq("id", licenseId).maybeSingle();
  if (error) {
    if (error.code && MISSING_COLUMN.has(error.code)) return ALL_FEATURES_ON;
    console.error("licenseFeatureFlags failed:", error.message);
    return null;
  }
  return featureFlagsFrom((data as { disabled_features?: unknown } | null)?.disabled_features);
}

/**
 * null = להמשיך כרגיל. אחרת תשובה לשלוח ללקוח במקום לבצע את הפעולה.
 * לקרוא לפני כל עבודה בנתיב ציבורי שמפעיל יכולת מהרשימה.
 */
export async function featureRefusal(
  req: { headers: { get(name: string): string | null } },
  feature: SchoolFeature,
): Promise<NextResponse | null> {
  // כל כשל כאן, גם הוצאת העוגייה (חסר סוד חתימה) וגם קריאה שנזרקה, נחשב "לא
  // הצלחנו לבדוק": 503 ולא 500 גולמי בנתיב ההתאמות.
  let flags: SchoolFeatureFlags | null;
  try {
    const grant = grantFromRequest(req);
    if (!grant) return null;
    flags = await licenseFeatureFlags(grant.license_id);
  } catch (e) {
    console.error("featureRefusal failed:", e instanceof Error ? e.message : e);
    flags = null;
  }
  if (flags === null) {
    return NextResponse.json({ ok: false, featureDisabled: feature, error: "לא הצלחנו לבדוק את הרישיון עכשיו. אפשר לנסות שוב בעוד רגע." }, { status: 503 });
  }
  if (flags[feature]) return null;
  return NextResponse.json(
    { ok: false, featureDisabled: feature, error: `${SCHOOL_FEATURE_LABELS[feature]} אינו זמין ברישיון של בית הספר הזה.` },
    { status: 403 },
  );
}
