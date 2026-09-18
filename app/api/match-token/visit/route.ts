import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// רישום ביקור אמיתי ברשימת התאמות שמורה, עם מזהה הסשן - ראו המיגרציה
// 20260918_match_token_visits.sql. נקרא מ-MatchReturnTracker בדפדפן, רק
// כשהמדידה לא בוטלה. כשל כאן לעולם לא מפריע למטופל: הדף כבר נטען.

const TOKEN_RE = /^[A-Za-z0-9_-]{6,32}$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token : "";
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    if (!TOKEN_RE.test(token) || sessionId.length === 0 || sessionId.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // רק טוקן קיים ובתוקף - אחרת אי אפשר למלא את הטבלה בזבל עם טוקנים מומצאים.
    const { data: row } = await supabaseAdmin
      .from("match_tokens")
      .select("token, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // אותו סשן שרענן את הדף לא נספר שוב.
    const { count } = await supabaseAdmin
      .from("match_token_visits")
      .select("id", { count: "exact", head: true })
      .eq("token", token)
      .eq("session_id", sessionId);
    if ((count ?? 0) === 0) {
      const { error } = await supabaseAdmin.from("match_token_visits").insert({ token, session_id: sessionId });
      if (error) console.error("match_token_visits insert failed:", error.message);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
