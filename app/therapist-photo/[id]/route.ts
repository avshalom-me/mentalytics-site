import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { extractTherapistId } from "@/app/lib/therapist-url";

// כתובת תמונה ציבורית ויציבה למטפל: /therapist-photo/<id>. הבאקט פרטי והתמונות
// הוגשו עד כה דרך signed URLs עם תפוגה של 24ש' + query token - לא ניתנים
// לאינדוקס (גוגל תמונות / og:image / זחלני AI). כאן מגישים את הבייטים דרך URL
// יציב שנשמר ב-CDN, בלי לחשוף את הבאקט (רק profile_photo_path של מטפל מאושר,
// לעולם לא תעודות). לא תחת /api - כי robots.txt חוסם /api/.
//
// חשוב: לא כאן ה-canonical של הפרופיל - זו רק כתובת התמונה.
//
// הדפים מפנים לכאן עם ?v=<גרסת הקובץ> (app/lib/therapist-photo-url.ts), והמטמון
// למטה נשמר לפי הכתובת המלאה כולל ה-query. בלי הגרסה, מטפל שהחליף תמונה ראה
// בפרופיל את הישנה עד שעה בדפדפן ועד יום ב-CDN (21/9/26). הפרמטר לא נקרא כאן:
// התמונה היא תמיד הנוכחית, והגרסה רק מבטיחה שתמונה חדשה היא כתובת חדשה.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BUCKET = process.env.SUPABASE_THERAPIST_FILES_BUCKET || "therapist-certificates";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// תקלה זמנית אצלנו - לא נשמרת בשום מטמון, ומבקשת לנסות שוב בעוד דקה.
function unavailable(): NextResponse {
  return new NextResponse("temporarily unavailable", {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "60" },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = extractTherapistId(raw) ?? raw;
  if (!UUID_RE.test(id)) return new NextResponse("not found", { status: 404 });

  // רק מטפל שמוצג בפומבי (מאושר), ורק שדה התמונה - לעולם לא תעודות.
  const { data, error } = await supabaseAdmin
    .from("therapists")
    .select("profile_photo_path")
    .eq("id", id)
    .in("status", ["approved", "paying"])
    .eq("admin_approved", true)
    .maybeSingle();
  // בסיס נתונים שלא ענה אינו "אין תמונה": 503 בלי מטמון, כדי שאף דפדפן
  // ואף CDN לא ישמרו "לא נמצא" לתמונה של מטפל קיים (29/9/2026).
  if (error) return unavailable();
  if (!data?.profile_photo_path) return new NextResponse("not found", { status: 404 });

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(data.profile_photo_path, 60);
  if (signError || !signed?.signedUrl) return unavailable();

  const upstream = await fetch(signed.signedUrl);
  if (upstream.status === 404) return new NextResponse("not found", { status: 404 });
  if (!upstream.ok || !upstream.body) return unavailable();

  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
      // נשמר ב-CDN יום, ומוגש stale עד שבוע בזמן רענון - כמעט אף פעם לא פוגע ב-origin.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
