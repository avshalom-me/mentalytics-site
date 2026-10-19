import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { licenseStillUsable, verifyAccessCode } from "@/app/lib/schools-crm.server";
import { clearSchoolCookie, encodeGrant, grantExpiry, grantFromRequest, schoolGateOn, setSchoolCookie } from "@/app/lib/school-gate.server";
import { getIp } from "@/app/lib/usage";
import { underDailyCap } from "@/app/lib/daily-cap";

// קוד הגישה של בית הספר לשאלון היועצות (app/lib/school-gate.server.ts).
//
// GET   מצב: האם השער דולק, והאם לדפדפן הזה יש הרשאה בתוקף (ומה שם בית הספר).
// POST  {code}: מאמת את הקוד, שם עוגייה חתומה. תשובה אחידה בכישלון, בלי לומר
//       אם הקוד לא קיים, פג או הושבת. מוגבל ל-20 ניסיונות ביום לכתובת IP, כדי
//       שקוד בן 8 תווים (32^8) לא יינחש.
// DELETE  יציאה: מוחק את העוגייה.

export const dynamic = "force-dynamic";

async function schoolName(schoolId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("schools").select("name").eq("id", schoolId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

export async function GET(req: NextRequest) {
  const gate = schoolGateOn();
  const grant = grantFromRequest(req);
  if (!grant) return NextResponse.json({ ok: true, gate, licensed: false });
  const usable = await licenseStillUsable(grant.license_id);
  if (!usable) return clearSchoolCookie(NextResponse.json({ ok: true, gate, licensed: false }));
  const endDate = new Date(grant.exp * 1000 - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return NextResponse.json({ ok: true, gate, licensed: true, school: await schoolName(grant.school_id), end_date: endDate });
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

  const ip = getIp(req);
  if (!(await underDailyCap(`school_code:${ip}`, 20))) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות היום. אפשר לנסות שוב מחר, או לפנות אלינו." }, { status: 429 });
  }

  const grant = await verifyAccessCode(code);
  if (!grant) {
    return NextResponse.json({ ok: false, error: "הקוד לא נמצא, או שהרישיון של בית הספר אינו פעיל." }, { status: 403 });
  }
  const exp = grantExpiry(grant.end_date);
  const res = NextResponse.json({ ok: true, school: await schoolName(grant.school_id), end_date: grant.end_date });
  return setSchoolCookie(res, encodeGrant({ license_id: grant.license_id, school_id: grant.school_id, exp }), exp);
}

export async function DELETE() {
  return clearSchoolCookie(NextResponse.json({ ok: true }));
}
