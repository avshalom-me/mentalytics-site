import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// משתמשות פורטל השותפה (/partner), לאדמין בלבד (Basic Auth של /api/admin-*).
//
// GET   הרשימה.
// POST  {action: "create", name, email}: משתמשת Supabase Auth (או הקיימת עם
//       אותו מייל) + שורה ב-partner_users, וקישור חד-פעמי להגדרת סיסמה.
//       {action: "link", user_id}: קישור חדש להגדרת סיסמה (איפוס).
//       {action: "toggle", user_id, active}: השבתה או החזרה.
//
// המערכת לא שולחת מייל: הקישור חוזר לאדמין, והבעלים מעביר אותו בעצמו. הקישור
// הוא קישור שחזור של Supabase, ונפתח בעמוד האיפוס המשותף עם ctx=partner.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function setPasswordLink(email: string, origin: string): Promise<{ link: string; userId: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/therapists/reset-password?ctx=partner` },
  });
  if (error || !data?.properties?.action_link || !data.user) throw new Error(error?.message ?? "no link");
  return { link: data.properties.action_link, userId: data.user.id };
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("partner_users")
    .select("user_id, name, email, active, role, created_at")
    .order("created_at", { ascending: true });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true, partners: data ?? [] });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return fail("בקשה לא תקינה");
  // הקישור חוזר לאתר הקנוני: Supabase מכבד רק כתובות ברשימת ההפניות שלו, וכתובת
  // של פריסת preview הייתה מוחלפת בעמוד הבית (שם אין טופס סיסמה). בפיתוח מקומי
  // הכתובת המקומית נשמרת לבדיקה.
  const origin = process.env.NODE_ENV === "production" ? "https://www.mentalytics.co.il" : req.nextUrl.origin;
  try {
    switch (b.action) {
      case "create": {
        const name = String(b.name ?? "").trim().slice(0, 80);
        const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
        if (name.length < 2) return fail("כותבים שם");
        if (!EMAIL_RE.test(email)) return fail("כתובת המייל לא תקינה");
        // משתמשת חדשה בלי סיסמה, עם מייל מאושר (הבעלים מכיר אותה). אם כבר יש
        // משתמש עם המייל הזה (למשל חשבון מטפלת), הוא מקבל גם גישה לפורטל.
        const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
        if (created.error && !/already|exists|registered/i.test(created.error.message)) throw new Error(created.error.message);
        const { link, userId } = await setPasswordLink(email, origin);
        const { error } = await supabaseAdmin
          .from("partner_users")
          .upsert({ user_id: userId, name, email, active: true, branch: "schools", role: "partner" }, { onConflict: "user_id" });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, link, existing: !!created.error });
      }
      case "link": {
        if (!UUID_RE.test(String(b.user_id ?? ""))) return fail("חסר מזהה");
        const { data: row } = await supabaseAdmin.from("partner_users").select("email").eq("user_id", b.user_id).maybeSingle();
        if (!row) return fail("לא נמצא", 404);
        const { link } = await setPasswordLink(row.email as string, origin);
        return NextResponse.json({ ok: true, link });
      }
      case "toggle": {
        if (!UUID_RE.test(String(b.user_id ?? ""))) return fail("חסר מזהה");
        const { error } = await supabaseAdmin.from("partner_users").update({ active: b.active === true }).eq("user_id", b.user_id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
      }
      default:
        return fail("פעולה לא מוכרת");
    }
  } catch (e) {
    console.error("admin-schools/partners:", e instanceof Error ? e.message : e);
    return fail("הפעולה לא הושלמה. אפשר לנסות שוב.", 500);
  }
}
