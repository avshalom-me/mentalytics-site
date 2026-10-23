import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { checkoutQuote } from "@/app/lib/promo";

export const dynamic = "force-dynamic";

// דף התשלום של המטפל/ת: המחיר שיחויב בפועל (אותה checkoutQuote שמשמשת את
// /api/payments/create-subscription), ומילוי מוקדם של שם, מייל וטלפון.
// עד 23/10/26 הדף חישב את המחיר לבד ולא הכיר את הצעת סוף הניסיון, והמילוי
// קרא את טבלת המטפלים מהדפדפן - מה שנחסם ב-20/10/26.
// הרשאה: Bearer של המשתמש המחובר; מחזיר רק את השורה שלו.
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  }).auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data: therapist } = await supabaseAdmin
    .from("therapists")
    .select("full_name, email, phone, upgrade_offer_until")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    quote: checkoutQuote((therapist?.upgrade_offer_until as string | null) ?? null),
    therapist: therapist
      ? { full_name: therapist.full_name ?? null, email: therapist.email ?? null, phone: therapist.phone ?? null }
      : null,
  });
}
