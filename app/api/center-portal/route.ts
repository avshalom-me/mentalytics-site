import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { therapistPath } from "@/app/lib/therapist-url";
import { resolveCenter } from "@/app/lib/center-auth";

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

// אימות משותף לכל נתיבי הפורטל — resolveCenter ב-app/lib/center-auth.ts.

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

    // מידע העמוד הציבורי — משותף לשני מסלולי המענה (עם/בלי מטפלים).
    const publicPage = {
      slug: center.slug,
      enabled: !!center.public_page_enabled,
      description: center.public_description,
      managers: center.public_managers,
      city: center.public_city,
      website: center.public_website,
      phone: center.public_phone,
    };

    // אין מטפלים עדיין — מחזירים שלד ריק (המרכז חדש / טרם שויכו מטפלים).
    if (ids.length === 0) {
      return NextResponse.json({
        ok: true,
        center: {
          name: center.name,
          status: center.status,
          plan_title: planTitle,
          billing_starts_at: center.billing_starts_at,
          therapist_quota: Math.floor(Number(center.therapist_count) || 0),
          linked_count: 0,
          public_page: publicPage,
        },
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
      center: {
        name: center.name,
        status: center.status,
        plan_title: planTitle,
        billing_starts_at: center.billing_starts_at,
        therapist_quota: Math.floor(Number(center.therapist_count) || 0),
        linked_count: therapists.length,
        public_page: publicPage,
      },
      therapists: therapistList,
      stats: {
        // "בהתאמות" = מקודם בפועל (מנוי המרכז) ואושר על-ידי אדמין.
        listed_count: therapists.filter((t) => t.status === "paying" && t.admin_approved).length,
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

// עריכת העמוד הציבורי של המרכז ע"י מנהלי המרכז (action: "update_public_page").
// המרכז שולט בתוכן שלו; slug נוצר אוטומטית מהשם אם עדיין אין.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות — נסו שוב בעוד רגע" }, { status: 429 });
  }
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (center.status !== "active") {
    return NextResponse.json({ ok: false, error: "המנוי של המרכז אינו פעיל" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  if (body.action !== "update_public_page") {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.public_description !== undefined) update.public_description = str(body.public_description, 5000) || null;
  if (body.public_managers !== undefined) update.public_managers = str(body.public_managers, 500) || null;
  if (body.public_city !== undefined) update.public_city = str(body.public_city, 80) || null;
  if (body.public_website !== undefined) update.public_website = str(body.public_website, 300) || null;
  if (body.public_phone !== undefined) update.public_phone = str(body.public_phone, 40) || null;
  if (body.public_page_enabled !== undefined) update.public_page_enabled = !!body.public_page_enabled;

  // ודא slug (מרכזים שנוצרו לפני פיצ'ר העמוד הציבורי).
  const { ensureUniqueCenterSlug } = await import("@/app/lib/center-public");
  const slug = center.slug ?? (await ensureUniqueCenterSlug(center.name, center.id));
  if (!center.slug) update.slug = slug;

  const { error } = await supabaseAdmin
    .from("therapy_center_accounts")
    .update(update)
    .eq("id", center.id);
  if (error) {
    console.error(`center-portal update_public_page failed (center=${center.id}):`, error.message);
    return NextResponse.json({ ok: false, error: "העדכון נכשל" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, slug });
}
