import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { licenseStillUsable, verifyAccessCode } from "@/app/lib/schools-crm.server";
import { licenseFeatureFlags } from "@/app/lib/school-features.server";
import { ALL_FEATURES_ON } from "@/app/lib/schools-crm";
import { clearSchoolCookie, encodeGrant, grantExpiry, grantFromRequest, schoolGateOn, setSchoolCookie } from "@/app/lib/school-gate.server";
import { getIp } from "@/app/lib/usage";
import { dailyCapHasRoom, underDailyCap } from "@/app/lib/daily-cap";

// קוד הגישה של בית הספר לשאלון היועצות (app/lib/school-gate.server.ts).
//
// GET   מצב: האם השער דולק, והאם לדפדפן הזה יש הרשאה בתוקף (ומה שם בית הספר),
//       ואילו יכולות פתוחות לרישיון (features: הסבר AI, חיפוש מטפלים). הממשק
//       מסתיר לפי זה; השרת חוסם בנפרד (app/lib/school-features.server.ts), כך
//       שהסתרה בממשק אינה ההגנה.
// POST  {code}: מאמת את הקוד, שם עוגייה חתומה. תשובה אחידה בכישלון, בלי לומר
//       אם הקוד לא קיים, פג או הושבת. מוגבל ל-20 ניסיונות שנכשלו ביום לכתובת
//       IP, כדי שקוד בן 8 תווים (32^8) לא יינחש; כניסה מוצלחת אינה נספרת
//       בתקרה הזו. מעליה, תקרה כוללת אטומית של 200 ניסיונות ביום לכתובת.
// DELETE  יציאה: מוחק את העוגייה.

export const dynamic = "force-dynamic";

const CODE_FAILURES_PER_DAY = 20;
const CODE_ATTEMPTS_PER_DAY = 200;

async function schoolName(schoolId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("schools").select("name").eq("id", schoolId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

export async function GET(req: NextRequest) {
  const gate = schoolGateOn();
  const grant = grantFromRequest(req);
  if (!grant) return NextResponse.json({ ok: true, gate, licensed: false, features: ALL_FEATURES_ON });
  const usable = await licenseStillUsable(grant.license_id);
  if (!usable) return clearSchoolCookie(NextResponse.json({ ok: true, gate, licensed: false, features: ALL_FEATURES_ON }));
  const endDate = new Date(grant.exp * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // לא נקרא = מציגים הכול. הממשק רק מסתיר, והחסימה האמיתית בשרת.
  const [school, flags] = await Promise.all([schoolName(grant.school_id), licenseFeatureFlags(grant.license_id)]);
  return NextResponse.json({ ok: true, gate, licensed: true, school, end_date: endDate, features: flags ?? ALL_FEATURES_ON });
}

export async function POST(req: NextRequest) {
  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (!code.trim()) return NextResponse.json({ ok: false, error: "צריך להקליד קוד" }, { status: 400 });

  // שתי תקרות. הראשונה, 20 כישלונות ביום לכתובת, היא ההגנה מניחוש: משרד של רשות
  // מקומית יושב מאחורי כתובת אחת, ושלושים יועצות שמקלידות קוד נכון אינן ניחוש,
  // ולכן רק כישלון נספר. המונה נבדק לפני האימות, כך שגם קוד נכון נדחה מכתובת
  // שכבר ניחשה 20 פעמים. אבל בדיקה ואחריה עדכון אינם אטומיים: מי ששולח מאות
  // ניחושים במקביל עובר את הבדיקה לפני שאחד מהם נספר. לכן הקדמה לה תקרה כוללת
  // אטומית (200 ניסיונות ביום, נכונים או לא), שנספרת לפני האימות ואינה ניתנת לעקיפה
  // במקביל, ועדיין רחבה מספיק למשרד שלם.
  const ip = getIp(req);
  if (!(await underDailyCap(`school_code:${ip}`, CODE_ATTEMPTS_PER_DAY))) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות היום. אפשר לנסות שוב מחר, או לפנות אלינו." }, { status: 429 });
  }
  const failKey = `school_code_fail:${ip}`;
  if (!(await dailyCapHasRoom(failKey, CODE_FAILURES_PER_DAY))) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות שנכשלו היום. אפשר לנסות שוב מחר, או לפנות אלינו." }, { status: 429 });
  }

  const grant = await verifyAccessCode(code);
  if (!grant) {
    await underDailyCap(failKey, CODE_FAILURES_PER_DAY);
    return NextResponse.json({ ok: false, error: "הקוד לא נמצא, או שהרישיון של בית הספר אינו פעיל." }, { status: 403 });
  }
  const exp = grantExpiry(grant.end_date);
  const res = NextResponse.json({ ok: true, school: await schoolName(grant.school_id), end_date: grant.end_date });
  return setSchoolCookie(res, encodeGrant({ license_id: grant.license_id, school_id: grant.school_id, exp }), exp);
}

export async function DELETE() {
  return clearSchoolCookie(NextResponse.json({ ok: true }));
}
