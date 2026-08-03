import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// קישור חשבון Supabase Auth למרכז ששילם — לפי הטוקן הסודי של ההצעה.
//
// למה זה בטוח (בניגוד ל-claim-by-email שנחסם ב-2/7): הטוקן הוא הסוד שגם
// מאפשר את התשלום עצמו — מי שמחזיק בו הוא מי שקיבל את ההצעה ושילם. המייל
// אינו מאומת בהרשמה ולכן אינו הוכחה; הטוקן כן. הקישור חד-פעמי: ברגע
// ש-user_id מוגדר, כל claim נוסף נדחה ושינוי בעלות נעשה ידנית בלבד.

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות — נסו שוב בעוד דקה" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ ok: false, error: "חסר טוקן" }, { status: 400 });

  // המשתמש המחובר — מזוהה מהטוקן של Supabase Auth (כמו resolveCenter).
  const accessToken = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!accessToken) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser(accessToken);
  if (authErr || !user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try {
    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("id, name, status, user_id")
      .eq("token", token)
      .maybeSingle();

    if (!center) {
      return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
    }
    if (center.status !== "active") {
      // הקישור נפתח רק אחרי תשלום — לפני כן אין מה לנהל בפורטל.
      return NextResponse.json({ ok: false, error: "המנוי עדיין לא הופעל — השלימו קודם את שמירת פרטי התשלום" }, { status: 400 });
    }
    if (center.user_id === user.id) {
      return NextResponse.json({ ok: true, already: true }); // אידמפוטנטי — רענון/לחיצה כפולה
    }
    if (center.user_id) {
      return NextResponse.json(
        { ok: false, error: "המרכז כבר מקושר לחשבון אחר. אם זו טעות — כתבו לנו: admin@getmentalytics.com" },
        { status: 409 },
      );
    }

    const { error: updErr } = await supabaseAdmin
      .from("therapy_center_accounts")
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", center.id)
      .is("user_id", null); // הגנת מרוץ — לא דורסים קישור שנוצר במקביל
    if (updErr) throw updErr;

    console.log(`centers/claim-account: center=${center.id} (${center.name}) linked to user=${user.id} (${user.email})`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("centers/claim-account error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
