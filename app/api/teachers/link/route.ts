import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { isBotRequest } from "@/app/lib/bot-detect";
import { crossSiteWrite } from "@/app/lib/teachers.server";
import { resendPersonalLink } from "@/app/lib/teacher-link.server";

// "איבדתי את הקישור": המורה מזין/ה מייל, והקישור האישי נשלח לכתובת הרשומה.
// התשובה זהה תמיד - בין אם המייל רשום ובין אם לא - כדי שאי אפשר יהיה לבדוק
// מכאן מי רשום במאגר. לכל מורה נשלח לכל היותר מייל אחד ב-24 שעות.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = rateLimit("teacher-link-request", clientIp(req), 5, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי בקשות - נסו שוב בעוד שעה");
  if (crossSiteWrite(req) || isBotRequest(req)) return NextResponse.json({ ok: true });

  let email = "";
  try {
    const body = (await req.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return NextResponse.json({ ok: false, error: "כתובת המייל אינה תקינה" }, { status: 400 });
  }

  const { data: teacher } = await supabaseAdmin
    .from("teachers")
    .select("id, email, full_name, edit_token, link_sent_at")
    .eq("email", email)
    .maybeSingle();
  if (teacher) {
    await resendPersonalLink(teacher as { id: string; email: string; full_name: string; edit_token: string; link_sent_at: string | null });
  }
  return NextResponse.json({ ok: true });
}
