import { NextResponse } from "next/server";

// "מצב צוות" בלחיצה אחת. הדפדפן שבו מפעילים אותו מקבל קוד צוות ב-localStorage,
// ושאלוני האתר (מבוגרים וילדים) לא מגבילים ולא סופרים אותו - ראו isStaffBypass
// ב-app/lib/usage.ts.
//
// עד 12/10/2026 אפשר היה להפעיל אותו רק אם מקלידים את STAFF_BYPASS_TOKEN
// ידנית (קישור עם ?staff=... או חלונית בכפתור באדמין), כלומר צריך היה לחפש
// את הקוד ב-.env.local או ב-Vercel בכל דפדפן חדש. כאן השרת נותן אותו
// למי שכבר מחובר לאדמין.
//
// מוגן ע"י ה-middleware של האדמין (/api/admin-*): Basic Auth, ו-POST גם נחסם
// אם ה-Origin זר, כך שדף של צד שלישי לא יכול לבקש את הקוד בשם האדמין
// המחובר. POST בלבד ולא GET, בשביל החסימה הזאת. התשובה לא נשמרת במטמון.
//
// הקוד עצמו אינו נכנס לשום קובץ של הלקוח: הוא יוצא מכאן רק בתשובה, ורק
// לבקשה שעברה את האימות.

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const token = process.env.STAFF_BYPASS_TOKEN;
  if (typeof token !== "string" || token.length === 0) {
    // בלי קוד בסביבה אין מצב צוות בכלל (isStaffBypass לא מאשר קוד ריק), ולכן
    // אין מה לתת.
    return NextResponse.json(
      { ok: false, error: "STAFF_BYPASS_TOKEN לא מוגדר בשרת" },
      { status: 503, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, token }, { headers: NO_STORE });
}
