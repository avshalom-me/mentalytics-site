import "server-only";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import type { Viewer } from "@/app/lib/schools-crm.server";

// אימות פורטל השותפה (/partner), משותף לכל נתיבי /api/partner-schools/*.
//
// כניסה במייל וסיסמה דרך Supabase Auth, כמו פורטל המרכזים. הגישה נקבעת רק לפי
// partner_users: שורה פעילה עם ה-user_id של הסשן. אין הצטרפות לפי מייל ואין
// הרשמה עצמית; משתמשת חדשה נוצרת רק מהאדמין (/admin/schools/partners), שמפיק
// קישור חד-פעמי להגדרת סיסמה. השבתת השורה סוגרת את הגישה בבקשה הבאה.
//
// הטוקן מגיע בכותרת Authorization ולא בעוגייה, ולכן אין צורך בשומר CSRF.

export type PartnerViewer = Viewer & { role: "partner"; user_id: string; email: string };

export async function resolvePartner(req: NextRequest): Promise<PartnerViewer | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return null;
  const { data: row } = await supabaseAdmin
    .from("partner_users")
    .select("name, email, active, branch")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row || !row.active || row.branch !== "schools") return null;
  return { role: "partner", name: row.name as string, user_id: user.id, email: (row.email as string) ?? user.email ?? "" };
}
