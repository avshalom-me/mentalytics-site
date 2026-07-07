import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { therapistPath } from "@/app/lib/therapist-url";

// פורטל המרכז הטיפולי — API מאומת שמחזיר את מטפלי המרכז + סטטיסטיקות
// מצטברות לכל המרכז. הכניסה היא בחשבון Supabase Auth של המרכז (מקביל למטפל).

export const dynamic = "force-dynamic";

// הגבלת קצב לפי IP — הנתיב מאומת בטוקן, אבל זה חוסם ניסיונות claim חוזרים
// וקריאות מוגזמות. in-memory, מתאפס ב-cold start.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

type Center = {
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

// אימות: מזהים את המרכז לפי user_id. אם עדיין לא מקושר — מקשרים חשבון פעיל
// שכתובת המייל שלו (contact או payer) תואמת למי שנרשם (claim-by-email).
//
// אבטחה: המייל אינו מאומת בהרשמה (auto-confirm), ולכן ה-claim מוגבל למרכז
// שכבר שילם (status='active') בלבד. החשיפה מוגבלת ממילא — פרופילים ציבוריים
// של מטפלי המרכז וסטטיסטיקה אנונימית מצטברת; אין כאן פרטי מטופלים.
async function resolveCenter(req: NextRequest): Promise<Center | null> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) return null;

  const cols = "id, name, status, user_id, email, payer_email, price_per_therapist, therapist_count, billing_starts_at";

  const { data: byUser } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(cols)
    .eq("user_id", user.id)
    .maybeSingle();
  if (byUser) return byUser as Center;

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) return null;

  // claim: מושכים את המרכזים הפעילים שטרם קושרו ומשווים מייל בדיוק ב-JS.
  // חשוב לא להזרים את המייל (שבשליטת המשתמש) ל-ilike/or של PostgREST: ILIKE
  // מפרש _ ו-% כ-wildcards (offic_@clinic יתפוס office@clinic ⇒ השתלטות),
  // ו-.or() עם מחרוזת גולמית פותח הזרקת-filter. מספר המרכזים הפעילים זעום,
  // אז השוואה מדויקת ב-JS בטוחה לגמרי.
  const { data: candidates } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select(cols)
    .is("user_id", null)
    .eq("status", "active")
    .order("created_at", { ascending: true }); // התאמה דטרמיניסטית אם יש כמה
  const claimable = (candidates ?? []).find((c) => {
    const e = (c.email ?? "").trim().toLowerCase();
    const p = (c.payer_email ?? "").trim().toLowerCase();
    return e === email || p === email;
  }) as Center | undefined;
  if (!claimable) return null;

  await supabaseAdmin
    .from("therapy_center_accounts")
    .update({ user_id: user.id, updated_at: new Date().toISOString() })
    .eq("id", claimable.id)
    .is("user_id", null); // מרוץ: לא לדרוס קישור שנוצר בו-זמנית
  return { ...claimable, user_id: user.id };
}

type TherapistRow = {
  id: string;
  full_name: string | null;
  status: string;
  admin_approved: boolean | null;
  profile_photo_path: string | null;
  regions: string[] | null;
  online: boolean | null;
};

const monthAgo = () => new Date(Date.now() - 30 * 86_400_000);
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000);

function tallyBy<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const v = key(r);
    if (v) counts[v] = (counts[v] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות — נסו שוב בעוד רגע" }, { status: 429 });
  }

  const center = await resolveCenter(req);
  if (!center) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const { data: therapistsData } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, status, admin_approved, profile_photo_path, regions, online")
      .eq("center_account_id", center.id)
      .order("full_name", { ascending: true });
    const therapists = (therapistsData ?? []) as TherapistRow[];
    const ids = therapists.map((t) => t.id);

    // חתימות תמונה (batch אחד) לתצוגת רשימת המטפלים.
    const photoById = new Map<string, string>();
    const photoPaths = therapists.filter((t) => t.profile_photo_path).map((t) => t.profile_photo_path!) as string[];
    if (photoPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from("therapist-certificates")
        .createSignedUrls(photoPaths, 60 * 60 * 24);
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) photoById.set(photoPaths[i], s.signedUrl);
      });
    }

    // תווית המנוי במודל החדש: מספר מטפלים (התמחור המלא מוצג רק באדמין).
    const planTitle =
      Number(center.therapist_count) > 0 ? `מנוי ל-${center.therapist_count} מטפלים` : null;

    // אין מטפלים עדיין — מחזירים שלד ריק (המרכז חדש / טרם שויכו מטפלים).
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        center: { name: center.name, status: center.status, plan_title: planTitle, billing_starts_at: center.billing_starts_at },
        therapists: [],
        stats: null,
        generated_at: new Date().toISOString(),
      });
    }

    const mAgo = monthAgo().toISOString();
    const wAgo = weekAgo().toISOString();
    const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString();

    // קליקים ליצירת קשר (6 חודשים — למגמה), וצפיות בפרופיל (חודש — לפילוח).
    const [clicks, views] = await Promise.all([
      fetchAllRows<{ therapist_id: string; click_type: string; clicked_at: string }>(() =>
        supabaseAdmin
          .from("therapist_contact_clicks")
          .select("therapist_id, click_type, clicked_at")
          .in("therapist_id", ids)
          .gte("clicked_at", sixMonthsAgo),
      ),
      fetchAllRows<{ therapist_id: string; viewed_at: string; source: string | null; viewer_region: string | null; viewer_issue: string | null; viewer_age_band: string | null; viewer_gender: string | null }>(() =>
        supabaseAdmin
          .from("therapist_profile_views")
          .select("therapist_id, viewed_at, source, viewer_region, viewer_issue, viewer_age_band, viewer_gender")
          .in("therapist_id", ids)
          .gte("viewed_at", mAgo),
      ),
    ]);

    const clicksMonth = clicks.filter((c) => c.clicked_at >= mAgo);
    const clicksWeek = clicks.filter((c) => c.clicked_at >= wAgo);
    // צפיות אמיתיות בפרופיל (לא חשיפת כרטיס במאטצ'ינג).
    const realViews = views.filter((v) => v.source !== "match_card");

    const clicksByType = (rows: { click_type: string }[]) => ({
      whatsapp: rows.filter((r) => r.click_type === "whatsapp").length,
      phone: rows.filter((r) => r.click_type === "phone").length,
      email: rows.filter((r) => r.click_type === "email").length,
      total: rows.length,
    });

    // מגמה חודשית (6 חודשים) של פניות.
    const now = new Date();
    const trend: { label: string; clicks: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
      const n = clicks.filter((c) => {
        const t = new Date(c.clicked_at);
        return t >= start && t < end;
      }).length;
      trend.push({ label, clicks: n });
    }

    // פניות פר-מטפל (חודש) — לטבלת המטפלים.
    const clicksPerTherapist = new Map<string, number>();
    for (const c of clicksMonth) clicksPerTherapist.set(c.therapist_id, (clicksPerTherapist.get(c.therapist_id) ?? 0) + 1);
    const viewsPerTherapist = new Map<string, number>();
    for (const v of realViews) viewsPerTherapist.set(v.therapist_id, (viewsPerTherapist.get(v.therapist_id) ?? 0) + 1);

    const therapistList = therapists.map((t) => ({
      id: t.id,
      name: t.full_name || "—",
      status: t.status,
      approved: Boolean(t.admin_approved),
      online: Boolean(t.online),
      photo_url: t.profile_photo_path ? (photoById.get(t.profile_photo_path) ?? null) : null,
      profile_path: therapistPath(t.id, t.full_name),
      month_views: viewsPerTherapist.get(t.id) ?? 0,
      month_clicks: clicksPerTherapist.get(t.id) ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      center: { name: center.name, status: center.status, plan_title: planTitle, billing_starts_at: center.billing_starts_at },
      therapists: therapistList,
      stats: {
        listed_count: therapists.filter((t) => t.admin_approved).length,
        views_month: realViews.length,
        clicks_week: clicksByType(clicksWeek),
        clicks_month: clicksByType(clicksMonth),
        by_region: tallyBy(realViews, (v) => v.viewer_region),
        by_issue: tallyBy(realViews, (v) => v.viewer_issue),
        by_age: tallyBy(realViews, (v) => v.viewer_age_band),
        by_gender: tallyBy(realViews, (v) => v.viewer_gender),
        trend,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
