import "server-only";
import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// אימות פורטל המרכז — משותף לכל נתיבי /api/center-portal/*.
// מזהים את המרכז אך ורק לפי user_id של חשבון ה-Supabase Auth. אין
// claim-by-email: המייל אינו מאומת בהרשמה (auto-confirm), ולכן "יש לי אימייל
// תואם" אינו הוכחת בעלות — קישור חשבון למרכז נעשה ידנית ע"י אדמין בלבד
// (ההסבר המלא ב-resolveCenter למטה). זהו אותו עיקרון שאוכף therapist-claim.ts
// עבור פרופילי מטפלים חיים.

export type PortalCenter = {
  id: string;
  name: string;
  status: string;
  user_id: string | null;
  email: string | null;
  payer_email: string | null;
  billing_track: string | null;
  price_per_therapist: number | null;
  therapist_count: number | null;
  fixed_monthly_price: number | null;
  num_locations: number | null;
  billing_starts_at: string | null;
  slug: string | null;
  public_page_enabled: boolean | null;
  public_description: string | null;
  public_managers: string | null;
  public_city: string | null;
  public_website: string | null;
  public_phone: string | null;
  logo_path: string | null;
  team_members: unknown;
};

const COLS =
  "id, name, status, user_id, email, payer_email, billing_track, price_per_therapist, therapist_count, fixed_monthly_price, num_locations, billing_starts_at, slug, public_page_enabled, public_description, public_managers, public_city, public_website, public_phone, logo_path, team_members";

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

  // ── אין fallback ל-claim-by-email (סגירת פרצת השתלטות) ──────────────────
  // בעבר, אם לא נמצא מרכז לפי user_id, קושר כאן אוטומטית מרכז פעיל שכתובת
  // המייל שלו תואמת למי שנרשם. המייל אינו מאומת בהרשמה (auto-confirm), ולכן
  // מי שנרשם ראשון עם המייל של מרכז פעיל היה משתלט עליו: עריכת פרטי הקשר של
  // מטפלי המרכז (הסטת לידים), הוספת פרופילים למנוי המרכז, ונעילת הבעלים
  // האמיתי בחוץ. זו בדיוק הפרצה שנסגרה למטפלים ב-therapist-claim.ts, שם
  // פרופיל חי/משלם לעולם לא נתפס אוטומטית אלא מקושר ע"י אדמין.
  //
  // ── קישור מרכז לחשבון: תהליך ידני, פעם אחת לכל מרכז ─────────────────────
  // כשמרכז שילם (status='active') ורוצה גישה לפורטל, המנהל מבצע פעם אחת:
  //   1. Supabase → Authentication → Users → לאתר את המשתמש לפי המייל שאיתו
  //      נרשם המרכז → להעתיק את ה-UUID שלו (ודאו שזה באמת מי שביקש גישה —
  //      זהו שלב האימות היחיד שמחליף אימות-מייל).
  //   2. Supabase → SQL Editor → להריץ:
  //        update public.therapy_center_accounts
  //           set user_id = '<AUTH_USER_UUID>', updated_at = now()
  //         where id = '<CENTER_ID>' and user_id is null;
  // מרגע זה הכניסה לפורטל מזוהה אוטומטית דרך ה-lookup לפי user_id שלמעלה.
  // עד הקישור, הדשבורד מציג למרכז "החשבון עדיין לא מקושר — פנו אלינו".
  return null;
}
