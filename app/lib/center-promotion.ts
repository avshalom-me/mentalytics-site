import "server-only";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { writeAudit } from "@/app/lib/audit";

// קידום/הורדה אוטומטיים של מטפלי מרכז — החוליה שמחברת את התשלום של המרכז
// למאגר ההתאמות:
//
//   מטפל משויך למרכז פעיל (ששילם) ⇒ status='paying', promotion_source='center'
//   ⇒ נכנס למערכת ההתאמות (בכפוף ל-admin_approved, כמו כל מטפל).
//
// promotion_source='center' הוא ערך רביעי לצד 'paid'/'manual'/'trial', ובכוונה
// אינו מטופל על-ידי ה-cron של Sumit (שמסנן על 'paid' ועל trial/manual עם
// promoted_until) — מחזור החיים שלו מנוהל כולו כאן:
//   קידום:  שיוך מטפל למרכז פעיל · תשלום מרכז · אישור אדמין למטפל משויך
//   הורדה:  ניתוק מהמרכז · ביטול מנוי המרכז (אדמין/סנכרון Sumit)
//
// מטפל עם מנוי אישי (promotion_source='paid') לעולם לא נגרר לכאן — המנוי
// האישי שלו גובר, וה-cron של Sumit ממשיך לנהל אותו.

// ── מסלול 2: שורת ישות-המרכז ───────────────────────────────────────────────
// מסלול "מרכז כישות אחת" מיוצג ע"י שורת therapists אחת עם entity_type='center'
// (center_account_id → המרכז, user_id ריק, שדות סגנון/אישיות ריקים כדי שהניקוד
// יהיה מקצועי בלבד). היא center-linked כמו כל מטפל מרכז, ולכן נכנסת/יוצאת
// מההתאמות דרך אותם promoteCenterTherapists/demoteCenterTherapists.

// מבטיח קיום שורת ישות-מרכז אחת (יוצר אם חסרה). מחזיר את ה-id, או null בכשל.
export async function ensureCenterEntityRow(centerId: string): Promise<string | null> {
  const { data: center } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, email, phone")
    .eq("id", centerId)
    .maybeSingle();
  if (!center) return null;

  const { data: existing } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("center_account_id", centerId)
    .eq("entity_type", "center")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin
    .from("therapists")
    .insert({
      entity_type: "center",
      center_account_id: centerId,
      full_name: (center.name as string | null) ?? "מרכז טיפולי",
      gender: "", // NOT NULL בסכימה; לא רלוונטי למרכז
      email: (center.email as string | null) ?? null,
      phone: (center.phone as string | null) ?? null,
      user_id: null,
      status: "pending", // תור האישורים הרגיל; נכנס להתאמות רק אחרי אישור+תשלום
      tier: "free",
      profile_updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error(`ensureCenterEntityRow(${centerId}) failed:`, error?.message);
    return null;
  }
  return created.id as string;
}

// מסירה את שורת ישות-המרכז (כשמרכז מוחזר בטיוטה ממסלול 2 למסלול 1). בטוח רק
// כשהשורה עדיין אינה חיה בהתאמות (status!='paying').
export async function removeCenterEntityRow(centerId: string): Promise<void> {
  await supabaseAdmin
    .from("therapists")
    .delete()
    .eq("center_account_id", centerId)
    .eq("entity_type", "center")
    .neq("status", "paying");
}

// מקדם את כל המטפלים המשויכים למרכז שראויים לכך: סטטוס 'approved' (אושרו
// על-ידי אדמין) שאינם כבר במסלול בתשלום/מתנה אחר. שקט אם המרכז אינו פעיל.
// חל גם על שורת ישות-המרכז (מסלול 2) — היא center-linked כמו כל מטפל.
export async function promoteCenterTherapists(centerId: string): Promise<number> {
  const { data: center } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, status")
    .eq("id", centerId)
    .maybeSingle();
  if (!center || center.status !== "active") return 0;

  const { data: eligible } = await supabaseAdmin
    .from("therapists")
    .select("id, status, promotion_source")
    .eq("center_account_id", centerId)
    .eq("status", "approved");
  const targets = (eligible ?? []).filter((t) => !t.promotion_source);
  if (targets.length === 0) return 0;

  const now = new Date().toISOString();
  const ids = targets.map((t) => t.id);
  const { error } = await supabaseAdmin
    .from("therapists")
    .update({
      status: "paying",
      promotion_source: "center",
      promoted_since: now,
      promoted_until: null,
      manually_promoted: false,
    })
    .in("id", ids);
  if (error) {
    console.error(`promoteCenterTherapists(${centerId}): update failed:`, error.message);
    return 0;
  }

  for (const id of ids) {
    await writeAudit(supabaseAdmin, {
      therapistId: id,
      actorType: "system",
      action: "status_change:approved->paying",
      before: { status: "approved", promotion_source: null },
      after: { status: "paying", promotion_source: "center" },
      reason: `center subscription active (center=${centerId})`,
    });
  }
  return ids.length;
}

// מוריד מטפלים שקודמו דרך מרכז. שני מצבים:
//   { centerId }     — כל מטפלי המרכז (ביטול מנוי המרכז)
//   { therapistIds } — מטפלים ספציפיים (נותקו מהמרכז)
// נוגע אך ורק ב-promotion_source='center'.
export async function demoteCenterTherapists(
  opts: { centerId: string; therapistIds?: never } | { therapistIds: string[]; centerId?: never },
  reason: string,
): Promise<number> {
  let query = supabaseAdmin
    .from("therapists")
    .select("id, admin_approved")
    .eq("promotion_source", "center");
  if ("centerId" in opts && opts.centerId) {
    query = query.eq("center_account_id", opts.centerId);
  } else if ("therapistIds" in opts && opts.therapistIds) {
    if (opts.therapistIds.length === 0) return 0;
    query = query.in("id", opts.therapistIds);
  }
  const { data: targets } = await query;
  if (!targets || targets.length === 0) return 0;

  let demoted = 0;
  for (const t of targets) {
    const demotedStatus = t.admin_approved ? "approved" : "pending";
    const { error } = await supabaseAdmin
      .from("therapists")
      .update({
        status: demotedStatus,
        promotion_source: null,
        promoted_since: null,
        promoted_until: null,
        manually_promoted: false,
      })
      .eq("id", t.id)
      .eq("promotion_source", "center"); // מרוץ: לא לדרוס שינוי מקביל
    if (error) {
      console.error(`demoteCenterTherapists: update failed for ${t.id}:`, error.message);
      continue;
    }
    await writeAudit(supabaseAdmin, {
      therapistId: t.id,
      actorType: "system",
      action: `status_change:paying->${demotedStatus}`,
      before: { status: "paying", promotion_source: "center" },
      after: { status: demotedStatus, promotion_source: null },
      reason,
    });
    demoted++;
  }
  return demoted;
}
