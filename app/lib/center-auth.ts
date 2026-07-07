import "server-only";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// אימות פורטל המרכז — משותף לכל נתיבי /api/center-portal/*.
// מזהים את המרכז לפי user_id של חשבון ה-Supabase Auth. אם עדיין לא מקושר —
// מקשרים חשבון פעיל שכתובת המייל שלו (contact או payer) תואמת למי שנרשם
// (claim-by-email).
//
// אבטחה: המייל אינו מאומת בהרשמה (auto-confirm), ולכן ה-claim מוגבל למרכז
// שכבר שילם (status='active') בלבד. החשיפה מוגבלת ממילא — פרופילים ציבוריים
// של מטפלי המרכז וסטטיסטיקה אנונימית מצטברת; אין כאן פרטי מטופלים.

export type PortalCenter = {
  id: string;
  name: string;
  status: string;
  user_id: string | null;
  email: string | null;
  payer_email: string | null;
  price_per_therapist: number | null;
  therapist_count: number | null;
  billing_starts_at: string | null;
};

const COLS =
  "id, name, status, user_id, email, payer_email, price_per_therapist, therapist_count, billing_starts_at";

export async function resolveCenter(req: NextRequest): Promise<PortalCenter | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return null;

  const { data: byUser } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(COLS)
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUser) return byUser as PortalCenter;

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return null;

  // claim: מושכים את המרכזים הפעילים שטרם קושרו ומשווים מייל בדיוק ב-JS.
  // חשוב לא להזרים את המייל (שבשליטת המשתמש) ל-ilike/or של PostgREST: ILIKE
  // מפרש _ ו-% כ-wildcards (offic_@clinic יתפוס office@clinic ⇒ השתלטות),
  // ו-.or() עם מחרוזת גולמית פותח הזרקת-filter. מספר המרכזים הפעילים זעום,
  // אז השוואה מדויקת ב-JS בטוחה לגמרי.
  const { data: candidates } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(COLS)
    .is("user_id", null)
    .eq("status", "active")
    .order("created_at", { ascending: true }); // התאמה דטרמיניסטית אם יש כמה
  const claimable = (candidates ?? []).find((c) => {
    const e = (c.email ?? "").trim().toLowerCase();
    const p = (c.payer_email ?? "").trim().toLowerCase();
    return e === email || p === email;
  }) as PortalCenter | undefined;
  if (!claimable) return null;

  await supabaseAdmin
    .from("therapy_center_accounts")
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .eq("id", claimable.id)
    .is("user_id", null); // מרוץ: לא לדרוס קישור שנוצר בו-זמנית
  return { ...claimable, user_id: user.id };
}
