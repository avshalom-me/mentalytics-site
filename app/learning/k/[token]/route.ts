import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/app/lib/rate-limit";
import { loadTeacherByToken, setTeacherCookie } from "@/app/lib/teachers.server";

// הקישור האישי של מורה: /learning/k/<token>. זו הכתובת שנשלחת במייל ומועתקת
// מהאדמין, והיא לעולם לא מציגה עמוד: היא שמה את הטוקן בעוגיית HttpOnly
// ומפנה ל-/learning/me (או לעמוד ההרשמה לתשלום, עם ?to=pay).
//
// למה לא עמוד עם הטוקן בכתובת, כמו בקישורי המרכזים: שם הטוקן חד-פעמי. כאן
// הוא קבוע ונותן שליטה מלאה בפרופיל, וה-layout טוען GA4, Google Ads, טאבולה
// ו-Vercel Analytics - שכולם רושמים את כתובת העמוד. ההפניה קורית בשרת, לפני
// שנטען סקריפט כלשהו, ולכן הטוקן לא מגיע לאף אחד מהם.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rl = rateLimit("teacher-link", clientIp(req), 60, 60_000);
  const teacher = rl.ok ? await loadTeacherByToken(token) : null;
  const wantsPay = req.nextUrl.searchParams.get("to") === "pay";
  const target = teacher ? (wantsPay ? "/learning/pay" : "/learning/me") : "/learning/me?invalid=1";
  const res = NextResponse.redirect(new URL(target, req.nextUrl.origin), 303);
  if (teacher) setTeacherCookie(res, token);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
