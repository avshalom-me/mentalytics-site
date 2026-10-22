import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// משתמשות פורטל השותפה (/partner), לאדמין בלבד (Basic Auth של /api/admin-*).
//
// GET   הרשימה.
// POST  {action: "create", name, email}: משתמשת Supabase Auth (או הקיימת עם
//       אותו מייל, באישור מפורש) + שורה ב-partner_users, וסיסמה זמנית.
//       {action: "password", user_id}: סיסמה זמנית חדשה (שכחה או איפוס).
//       {action: "toggle", user_id, active}: השבתה או החזרה.
//       {action: "email", user_id, email}: החלפת מייל הכניסה (למשל למייל
//       הארגוני). הסיסמה, ההיסטוריה והשיוך נשארים.
//
// סיסמה זמנית ולא קישור חד-פעמי (22/10/2026): קישור הגדרת סיסמה שהודבק
// בוואטסאפ נוצל על ידי התצוגה המקדימה של וואטסאפ עוד לפני שהשותפה לחצה עליו,
// וכשלחצה הוא כבר היה "לא בתוקף". סיסמה זמנית לא מתבזבזת כך ולא פגה. החשבון
// מסומן must_change_password, והפורטל מבקש ממנה לקבוע סיסמה משלה בכניסה
// הראשונה (app/partner/PartnerShell.tsx). המערכת לא שולחת מייל: הבעלים מעביר.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

// בלי תווים שמתבלבלים בהקלדה מהטלפון (0/O, 1/l/I).
const PW_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function tempPassword(): string {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => PW_ALPHABET[b % PW_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

/** סיסמה זמנית למשתמשת קיימת, והסימון שמחייב אותה לקבוע סיסמה משלה בכניסה. */
async function setTempPassword(userId: string): Promise<string> {
  const { data: cur, error: gErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (gErr || !cur?.user) throw new Error(gErr?.message ?? "user not found");
  const password = tempPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    user_metadata: { ...(cur.user.user_metadata ?? {}), must_change_password: true },
  });
  if (error) throw new Error(error.message);
  return password;
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** איזה חשבון זה, כדי שהבעלים יזהה טעות לפני שהוא מאשר. */
async function describeAccount(userId: string): Promise<string> {
  const [t, c, p] = await Promise.all([
    supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("center_members").select("center_id", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("partner_users").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if ((p.count ?? 0) > 0) return "שותפה קיימת";
  if ((t.count ?? 0) > 0) return "חשבון מטפל/ת";
  if ((c.count ?? 0) > 0) return "חשבון של מרכז טיפולי";
  return "חשבון באתר בלי פרופיל";
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
  try {
    switch (b.action) {
      case "create": {
        const name = String(b.name ?? "").trim().slice(0, 80);
        const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
        if (name.length < 2) return fail("כותבים שם");
        if (!EMAIL_RE.test(email)) return fail("כתובת המייל לא תקינה");
        // משתמשת חדשה עם מייל מאושר (הבעלים מכיר אותה) וסיסמה זמנית.
        const password = tempPassword();
        const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, password, user_metadata: { must_change_password: true } });
        if (!created.error && created.data.user) {
          const { error } = await supabaseAdmin
            .from("partner_users")
            .upsert({ user_id: created.data.user.id, name, email, active: true, branch: "schools", role: "partner" }, { onConflict: "user_id" });
          if (error) throw new Error(error.message);
          return NextResponse.json({ ok: true, password });
        }
        if (!/already|exists|registered/i.test(created.error?.message ?? "")) throw new Error(created.error?.message ?? "createUser failed");
        // כבר יש חשבון באתר עם המייל הזה. לא מצרפים אותו בשקט: מייל שהוקלד
        // לא נכון היה פותח את הענף לחשבון של מישהו אחר, וקישור איפוס היה מחליף
        // את הסיסמה שלו. הבעלים רואה איזה חשבון זה ומאשר במפורש; אז היא
        // נכנסת עם הסיסמה שכבר יש לה, בלי סיסמה זמנית.
        const existing = await findAuthUserByEmail(email);
        if (!existing) throw new Error("existing user not found");
        if (b.confirm_existing !== true) {
          return NextResponse.json(
            { ok: false, existing: true, account: await describeAccount(existing), error: "כבר קיים חשבון באתר עם המייל הזה" },
            { status: 409 },
          );
        }
        const { error } = await supabaseAdmin
          .from("partner_users")
          .upsert({ user_id: existing, name, email, active: true, branch: "schools", role: "partner" }, { onConflict: "user_id" });
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, existing: true });
      }
      case "password": {
        if (!UUID_RE.test(String(b.user_id ?? ""))) return fail("חסר מזהה");
        const { data: row } = await supabaseAdmin.from("partner_users").select("user_id").eq("user_id", b.user_id).maybeSingle();
        if (!row) return fail("לא נמצא", 404);
        return NextResponse.json({ ok: true, password: await setTempPassword(b.user_id) });
      }
      case "email": {
        if (!UUID_RE.test(String(b.user_id ?? ""))) return fail("חסר מזהה");
        const email = String(b.email ?? "").trim().toLowerCase().slice(0, 200);
        if (!EMAIL_RE.test(email)) return fail("כתובת המייל לא תקינה");
        const { data: row } = await supabaseAdmin.from("partner_users").select("user_id").eq("user_id", b.user_id).maybeSingle();
        if (!row) return fail("לא נמצא", 404);
        // email_confirm: הבעלים מחליף את הכתובת בעצמו, ו-Supabase לא שולח מייל אישור.
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(b.user_id, { email, email_confirm: true });
        if (uErr) {
          if (/already|exists|registered/i.test(uErr.message)) return fail("המייל הזה כבר שייך לחשבון אחר באתר", 409);
          throw new Error(uErr.message);
        }
        const { error } = await supabaseAdmin.from("partner_users").update({ email }).eq("user_id", b.user_id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
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
