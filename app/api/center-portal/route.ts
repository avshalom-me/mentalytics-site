import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { therapistPath } from "@/app/lib/therapist-url";
import { resolveCenter } from "@/app/lib/center-auth";
import { buildCenterPortalPayload } from "@/app/lib/center-portal-data";
import { signCenterAssets, type CenterTeamMember, type CenterGalleryPhoto, type CenterDirector, type CenterFaqItem } from "@/app/lib/center-public";

// פורטל המרכז הטיפולי - API מאומת שמחזיר את מטפלי המרכז + סטטיסטיקות
// מצטברות לכל המרכז. הכניסה היא בחשבון Supabase Auth של המרכז (מקביל למטפל).

export const dynamic = "force-dynamic";

// הגבלת קצב לפי IP - הנתיב מאומת בטוקן, אבל זה חוסם ניסיונות claim חוזרים
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

// אימות משותף לכל נתיבי הפורטל - resolveCenter ב-app/lib/center-auth.ts.


export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }

  const center = await resolveCenter(req);
  if (!center) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await buildCenterPortalPayload(center));
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
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
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
  // נתיב תמונת-מרכז חוקי: רק קבצים שהמרכז הזה עצמו העלה (ההעלאה שומרת תמיד
  // בפורמט center-assets/<center.id>-...). חוסם גם שתילת נתיב שרירותי מה-bucket
  // (תעודה של מטפל) וגם הפניה לתמונות של מרכז אחר. בדיקת ה-.. נשארת בנפרד -
  // "center-assets/<id>-x/../../certificates/y" עובר את בדיקת הקידומת לבדה.
  const assetPath = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith(`center-assets/${center.id}-`) && v.length <= 300 && !v.split("/").includes("..")
      ? v
      : null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.public_description !== undefined) update.public_description = str(body.public_description, 5000) || null;
  if (body.public_managers !== undefined) update.public_managers = str(body.public_managers, 500) || null;
  if (body.public_city !== undefined) update.public_city = str(body.public_city, 80) || null;
  if (body.public_website !== undefined) update.public_website = str(body.public_website, 300) || null;
  if (body.public_phone !== undefined) update.public_phone = str(body.public_phone, 40) || null;
  if (body.public_page_enabled !== undefined) update.public_page_enabled = !!body.public_page_enabled;
  // פרופיל ויזואלי: לוגו + צוות/ראשי-המרכז + גלריית המרכז - self-serve מהפורטל.
  if (body.logo_path !== undefined) update.logo_path = assetPath(body.logo_path);
  if (body.team_members !== undefined) {
    const raw = Array.isArray(body.team_members) ? body.team_members : [];
    update.team_members = raw.slice(0, 12).map((m) => {
      const mm = (m ?? {}) as Record<string, unknown>;
      return {
        name: str(mm.name, 80),
        role: str(mm.role, 80),
        photo_path: assetPath(mm.photo_path),
      };
    }).filter((m) => m.name);
  }
  if (body.gallery !== undefined) {
    const raw = Array.isArray(body.gallery) ? body.gallery : [];
    update.gallery = raw.slice(0, 8).map((g) => {
      const gg = (g ?? {}) as Record<string, unknown>;
      return { path: assetPath(gg.path), caption: str(gg.caption, 120) || null };
    }).filter((g): g is { path: string; caption: string | null } => !!g.path);
  }
  // עובדות-אמון: שנת ייסוד + גודל צוות (מוצגים רק כשמולאו).
  const intOrNull = (v: unknown, min: number, max: number): number | null => {
    // null/"" → null (ולא 0: Number(null)===0 היה הופך שדה שנוקה ל-0, ומד
    // השלמות בשרת היה סופר אותו כ"מולא" בעוד הפורטל מציג אותו כחסר).
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  if (body.founded_year !== undefined) update.public_founded_year = intOrNull(body.founded_year, 1900, 2100);
  if (body.team_size !== undefined) update.public_team_size = intOrNull(body.team_size, 0, 10000);
  // מידע פרקטי: כתובת, שעות פעילות, נגישות.
  if (body.address !== undefined) update.public_address = str(body.address, 200) || null;
  if (body.hours !== undefined) update.public_hours = str(body.hours, 500) || null;
  if (body.accessibility !== undefined) update.public_accessibility = str(body.accessibility, 500) || null;
  // דבר המנהל/ת: {name, role, note, photo_path}.
  if (body.director !== undefined) {
    const d = (body.director ?? {}) as Record<string, unknown>;
    const name = str(d.name, 80);
    update.public_director = name
      ? { name, role: str(d.role, 120), note: str(d.note, 600), photo_path: assetPath(d.photo_path) }
      : {};
  }
  // שאלות נפוצות: עד 6 זוגות {q, a} - נשמרות רק שורות מלאות.
  if (body.faq !== undefined) {
    const raw = Array.isArray(body.faq) ? body.faq : [];
    update.public_faq = raw.slice(0, 6).map((f) => {
      const ff = (f ?? {}) as Record<string, unknown>;
      return { q: str(ff.q, 200), a: str(ff.a, 1000) };
    }).filter((f) => f.q && f.a);
  }

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
