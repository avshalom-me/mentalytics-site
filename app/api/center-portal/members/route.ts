import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { resolveCenter } from "@/app/lib/center-auth";
import { findAuthUserByEmail } from "@/app/lib/auth-users";

// צוות הניהול של המרכז: מי רשאי להיכנס לפורטל. כל חבר מחזיק את מלוא ההרשאות
// (החלטת הבעלים, 9/9/2026) - עריכת פרופילים, הוספה למנוי, פרטי הקשר.
//
// שני מעקות בטיחות שלא סותרים את זה:
//   * החשבון הראשי (therapy_center_accounts.user_id) אינו ניתן להסרה מכאן.
//     אחרת אדם שהוסף אתמול יכול לנעול את מי שהקים את המרכז - השתלטות
//     מבפנים. שינוי החשבון הראשי נעשה על ידי אדמין בלבד.
//   * אי אפשר להסיר את החבר האחרון. מרכז בלי אף חשבון הוא מרכז שאיש לא יכול
//     להיכנס אליו, ורק אדמין יכול להוציא ממצב כזה.
//
// אין הזמנה במייל ואין claim: המצטרף נרשם קודם ב-/centers/login, ואז חבר
// קיים מוסיף אותו לפי הכתובת. כך מי שמעניק גישה הוא תמיד חבר מאומת, והמייל
// הלא-מאומת של ההרשמה לעולם לא מהווה בעצמו הוכחת בעלות.

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

function ipOf(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

type MemberRow = { user_id: string; email: string | null; added_by: string | null; created_at: string };

async function listMembers(centerId: string, primaryUserId: string | null, meUserId: string | undefined) {
  const { data, error } = await supabaseAdmin
    .from("center_members")
    .select("user_id, email, added_by, created_at")
    .eq("center_id", centerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MemberRow[]).map((m) => ({
    user_id: m.user_id,
    email: m.email,
    created_at: m.created_at,
    is_primary: m.user_id === primaryUserId,
    is_me: m.user_id === meUserId,
  }));
}

export async function GET(req: NextRequest) {
  if (!checkRateLimit(ipOf(req))) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, members: await listMembers(center.id, center.user_id, center.acting_user_id) });
  } catch (e) {
    console.error(`center-portal/members GET (center=${center.id}):`, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה בטעינת הצוות" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(ipOf(req))) {
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
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ ok: false, error: "כתובת מייל לא תקינה" }, { status: 400 });
  }

  try {
    const target = await findAuthUserByEmail(email);
    if (!target) {
      // בכוונה לא יוצרים חשבון כאן: יצירת חשבון עם סיסמה בשם אדם אחר היא
      // בדיוק מה שלא רוצים. הוא נרשם בעצמו, ואז מוסיפים אותו.
      return NextResponse.json(
        { ok: false, error: `אין עדיין חשבון עם הכתובת ${email}. בקשו מהאדם להירשם קודם ב-/centers/login (כניסה / הרשמה למרכזים), ואז הוסיפו אותו שוב.` },
        { status: 404 },
      );
    }
    if (target.id === center.acting_user_id) {
      return NextResponse.json({ ok: false, error: "זה החשבון שאתם מחוברים איתו כרגע" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("center_members").insert({
      center_id: center.id,
      user_id: target.id,
      email: target.email,
      added_by: center.acting_user_id ?? null,
    });
    if (error) {
      // 23505 = כבר חבר (כאן או במרכז אחר). מבדילים, כי התיקון שונה.
      if ((error as { code?: string }).code === "23505") {
        const { data: existing } = await supabaseAdmin
          .from("center_members").select("center_id").eq("user_id", target.id).maybeSingle();
        return NextResponse.json(
          existing?.center_id === center.id
            ? { ok: false, error: "החשבון הזה כבר בצוות המרכז" }
            : { ok: false, error: "החשבון הזה כבר מנהל מרכז אחר. חשבון אחד יכול לנהל מרכז אחד בלבד - יש להירשם עם כתובת אחרת." },
          { status: 409 },
        );
      }
      throw error;
    }

    console.log(`center-portal/members: center=${center.id} (${center.name}) added user=${target.id} (${target.email}) by ${center.acting_email ?? center.acting_user_id}`);
    return NextResponse.json({ ok: true, members: await listMembers(center.id, center.user_id, center.acting_user_id) });
  } catch (e) {
    console.error(`center-portal/members POST (center=${center.id}):`, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "ההוספה נכשלה" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkRateLimit(ipOf(req))) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות - נסו שוב בעוד רגע" }, { status: 429 });
  }
  const center = await resolveCenter(req);
  if (!center) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!userId) return NextResponse.json({ ok: false, error: "חסר מזהה" }, { status: 400 });

  if (userId === center.user_id) {
    return NextResponse.json(
      { ok: false, error: "זהו החשבון הראשי של המרכז ואי אפשר להסיר אותו מכאן. לשינוי החשבון הראשי כתבו לנו." },
      { status: 403 },
    );
  }

  try {
    const { count } = await supabaseAdmin
      .from("center_members").select("user_id", { count: "exact", head: true }).eq("center_id", center.id);
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ ok: false, error: "אי אפשר להסיר את החבר האחרון - למרכז לא תישאר כניסה" }, { status: 400 });
    }

    const { data: removed, error } = await supabaseAdmin
      .from("center_members")
      .delete()
      .eq("center_id", center.id)   // חבר של מרכז אחר לעולם לא נמחק מכאן
      .eq("user_id", userId)
      .select("user_id, email")
      .maybeSingle();
    if (error) throw error;
    if (!removed) return NextResponse.json({ ok: false, error: "החבר לא נמצא בצוות" }, { status: 404 });

    console.log(`center-portal/members: center=${center.id} (${center.name}) removed user=${userId} (${removed.email}) by ${center.acting_email ?? center.acting_user_id}`);
    return NextResponse.json({ ok: true, members: await listMembers(center.id, center.user_id, center.acting_user_id) });
  } catch (e) {
    console.error(`center-portal/members DELETE (center=${center.id}):`, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "ההסרה נכשלה" }, { status: 500 });
  }
}
