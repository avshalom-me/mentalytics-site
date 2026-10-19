// שער הרישיון של שאלון היועצות (/school).
//
// בית ספר עם רישיון מקבל קוד גישה (school_licenses.access_code). היועצת מקלידה
// אותו פעם אחת, ומכאן הדפדפן מחזיק עוגיית HttpOnly חתומה עם מזהה הרישיון
// ותוקפו. הקוד עצמו לא נשמר בדפדפן ולא חוזר ללקוח. נתיב הניקוד בודק את העוגייה
// בכל חישוב, ומוודא מול המסד שהרישיון עדיין פעיל (ביטול או השבתת קוד תופסים
// מיד, לא רק בכניסה).
//
// מתג: SCHOOL_GATE_ON=1 סוגר את השאלון למי שאין לו עוגייה תקפה. כבוי = ההתנהגות
// הקודמת (פתוח לכולם, תקרה יומית ל-IP), ועוגייה תקפה רק מסירה את התקרה ומונה
// שימוש לבית הספר. כך הכול נפרס ונבדק לפני יום הסגירה.
//
// מצב הביקורת (_reviewToken) וטוקן הצוות (_staffToken) עוקפים את השער, כמו שעקפו
// את התקרה: בודק מקצועי ואנשי הצוות אינם בית ספר.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const SCHOOL_COOKIE = "mnt_school";

export function schoolGateOn(): boolean {
  return process.env.SCHOOL_GATE_ON === "1";
}

function secret(): string {
  const s = process.env.SCHOOL_GATE_SECRET ?? process.env.CRON_SECRET ?? "";
  if (!s) throw new Error("SCHOOL_GATE_SECRET / CRON_SECRET is not set");
  return s;
}

export type SchoolGrant = { license_id: string; school_id: string; exp: number };

function sign(payload: string, key = secret()): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** ערך העוגייה: license.school.exp.signature. התוקף: יום אחרי סוף הרישיון. */
export function encodeGrant(g: SchoolGrant, key?: string): string {
  const payload = `${g.license_id}.${g.school_id}.${g.exp}`;
  return `${payload}.${sign(payload, key)}`;
}

export function decodeGrant(value: string | null | undefined, now = Date.now(), key?: string): SchoolGrant | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [license_id, school_id, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!license_id || !school_id || !Number.isFinite(exp) || exp * 1000 < now) return null;
  const expected = sign(`${license_id}.${school_id}.${exp}`, key);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { license_id, school_id, exp };
}

/** תוקף העוגייה בשניות מאז 1970: סוף הרישיון (YYYY-MM-DD) ועוד יום, לפי שעון ישראל. */
export function grantExpiry(endDateIso: string): number {
  return Math.floor(Date.parse(endDateIso + "T23:59:59+03:00") / 1000) + 24 * 60 * 60;
}

export function setSchoolCookie(res: NextResponse, value: string, exp: number): NextResponse {
  res.cookies.set(SCHOOL_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, exp - Math.floor(Date.now() / 1000)),
  });
  return res;
}

export function clearSchoolCookie(res: NextResponse): NextResponse {
  res.cookies.set(SCHOOL_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export function cookieValue(req: { headers: { get(name: string): string | null } }, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** ההרשאה שבבקשה, אם העוגייה חתומה ובתוקף. לא בודק את המסד. */
export function grantFromRequest(req: { headers: { get(name: string): string | null } }): SchoolGrant | null {
  return decodeGrant(cookieValue(req, SCHOOL_COOKIE));
}
