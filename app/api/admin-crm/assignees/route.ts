import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

// מי אפשר להטיל עליו משימה. נגזר מ-staff_members ולא מרשימה קשיחה בקוד, כדי
// שהוספת אדם במסך שעות העבודה תהפוך אותו לבחירה כאן מעצמה - בלי פריסה. זו
// בדיוק הדרישה "בהמשך אם יצטרפו עוד".
//
// רק active: מי שהושבת יורד מהרשימה לבחירה חדשה, אבל משימות שכבר משויכות לו
// שומרות את השם (העמודה היא טקסט חופשי ולא מפתח זר), כך שהיסטוריה לא נמחקת
// כשעובד/ת עוזב/ת.

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("staff_members")
    .select("full_name")
    .eq("active", true)
    .order("full_name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const assignees = (data ?? [])
    .map((r) => String(r.full_name ?? "").trim())
    .filter(Boolean);

  return NextResponse.json({ ok: true, assignees });
}
