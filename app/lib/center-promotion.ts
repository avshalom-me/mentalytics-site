import "server-only";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { writeAudit } from "@/app/lib/audit";
import { THERAPIST_ARCHIVED_STATUS, type CenterStopReason } from "@/app/lib/center-gift";

// קידום/הורדה אוטומטיים של מטפלי מרכז - החוליה שמחברת את התשלום של המרכז
// למאגר ההתאמות:
//
//   מטפל משויך למרכז פעיל ⇒ status='paying', promotion_source='center'
//   ⇒ נכנס למערכת ההתאמות (בכפוף ל-admin_approved, כמו כל מטפל).
//
// "מרכז פעיל" = שילם, או שהאדמין נתן לו קידום מתנה (center-gift.ts). כאן אין
// הבדל בין השניים: שניהם status='active'.
//
// promotion_source='center' הוא ערך רביעי לצד 'paid'/'manual'/'trial', ובכוונה
// אינו מטופל על-ידי ה-cron של Sumit (שמסנן על 'paid' ועל trial/manual עם
// promoted_until) - מחזור החיים שלו מנוהל כולו כאן:
//   קידום:  שיוך מטפל למרכז פעיל · תשלום מרכז · קידום מתנה למרכז · אישור
//           אדמין למטפל משויך
//   הורדה:  ניתוק מטפל ממרכז פעיל (חוזר ל-'approved', מטפל חינמי עצמאי)
//   ארכיון: עצירת המרכז (אדמין / סנכרון Sumit / סוף המתנה). כל הפרופילים של
//           המרכז עוברים ל-'archived' ומוסתרים מכל משטח ציבורי, וחוזרים
//           ל-'approved' (ומשם לקידום) כשהמרכז חוזר להיות פעיל, או כשמנתקים
//           אותם ממנו. ראו THERAPIST_ARCHIVED_STATUS ב-center-gift.ts.
//
// מטפל עם מנוי אישי (promotion_source='paid') לעולם לא נגרר לכאן - המנוי
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
// חל גם על שורת ישות-המרכז (מסלול 2) - היא center-linked כמו כל מטפל.
// מרכז שחוזר מהארכיון: הפרופילים שהוסתרו איתו מוחזרים קודם ל-'approved',
// ואז מקודמים כמו כל מטפל מאושר.
export async function promoteCenterTherapists(centerId: string): Promise<number> {
  const { data: center } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, status")
    .eq("id", centerId)
    .maybeSingle();
  if (!center || center.status !== "active") return 0;

  await restoreArchivedTherapists({ centerId }, `center active again (center=${centerId})`);

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
//   { centerId }     - כל מטפלי המרכז (ביטול מנוי המרכז)
//   { therapistIds } - מטפלים ספציפיים (נותקו מהמרכז)
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

// מעביר לארכיון את הפרופילים של מרכז שנעצר: כל שורה שמשויכת למרכז ומוצגת
// בזכותו - מי שקודם דרך המרכז ('paying' עם promotion_source='center', כולל
// שורת הישות של מסלול 2), ומי שמאושר ואינו מקודם ('approved' בלי מקור קידום),
// שהיה נשאר במאגר החינמי. הפרופיל יוצא מכל משטח ציבורי ונשמר כמו שהוא.
//
// מי שלא נוגעים בו: מטפל עם קידום משלו (מנוי אישי, מתנה או ניסיון) ממשיך
// להופיע - הוא לא מוצג בזכות המרכז; ושורות 'pending' ו-'rejected' ממילא אינן
// ציבוריות ונשארות בתור שלהן.
export async function archiveCenterTherapists(centerId: string, reason: string): Promise<number> {
  const { data: rows } = await supabaseAdmin
    .from("therapists")
    .select("id, status, promotion_source")
    .eq("center_account_id", centerId)
    .in("status", ["paying", "approved"]);
  const targets = (rows ?? []).filter((t) =>
    t.status === "paying" ? t.promotion_source === "center" : !t.promotion_source,
  );

  let archived = 0;
  for (const t of targets) {
    let update = supabaseAdmin
      .from("therapists")
      .update({
        status: THERAPIST_ARCHIVED_STATUS,
        promotion_source: null,
        promoted_since: null,
        promoted_until: null,
        manually_promoted: false,
      })
      .eq("id", t.id)
      .eq("status", t.status as string); // מרוץ: לא לדרוס שינוי מקביל
    update = t.promotion_source ? update.eq("promotion_source", "center") : update.is("promotion_source", null);
    const { data: done, error } = await update.select("id");
    if (error) {
      console.error(`archiveCenterTherapists: update failed for ${t.id}:`, error.message);
      continue;
    }
    if (!done || done.length === 0) continue;
    await writeAudit(supabaseAdmin, {
      therapistId: t.id as string,
      actorType: "system",
      action: `status_change:${t.status}->${THERAPIST_ARCHIVED_STATUS}`,
      before: { status: t.status, promotion_source: t.promotion_source ?? null },
      after: { status: THERAPIST_ARCHIVED_STATUS, promotion_source: null },
      reason,
    });
    archived++;
  }
  return archived;
}

// מחזיר פרופילים מהארכיון ל-'approved' (או ל-'pending', אם מעולם לא אושרו):
//   { centerId }     - כל הפרופילים של המרכז (המרכז חזר להיות פעיל, או נמחק)
//   { therapistIds } - מטפלים ספציפיים (נותקו מהמרכז, ולכן עומדים בפני עצמם)
// נוגע אך ורק בשורות שהסטטוס שלהן 'archived'.
export async function restoreArchivedTherapists(
  opts: { centerId: string; therapistIds?: never } | { therapistIds: string[]; centerId?: never },
  reason: string,
): Promise<number> {
  let query = supabaseAdmin
    .from("therapists")
    .select("id, admin_approved")
    .eq("status", THERAPIST_ARCHIVED_STATUS);
  if ("centerId" in opts && opts.centerId) {
    query = query.eq("center_account_id", opts.centerId);
  } else if ("therapistIds" in opts && opts.therapistIds) {
    if (opts.therapistIds.length === 0) return 0;
    query = query.in("id", opts.therapistIds);
  }
  const { data: targets } = await query;
  if (!targets || targets.length === 0) return 0;

  let restored = 0;
  for (const t of targets) {
    const status = t.admin_approved ? "approved" : "pending";
    const { data: done, error } = await supabaseAdmin
      .from("therapists")
      .update({ status })
      .eq("id", t.id)
      .eq("status", THERAPIST_ARCHIVED_STATUS) // מרוץ: לא לדרוס שינוי מקביל
      .select("id");
    if (error) {
      console.error(`restoreArchivedTherapists: update failed for ${t.id}:`, error.message);
      continue;
    }
    if (!done || done.length === 0) continue;
    await writeAudit(supabaseAdmin, {
      therapistId: t.id as string,
      actorType: "system",
      action: `status_change:${THERAPIST_ARCHIVED_STATUS}->${status}`,
      before: { status: THERAPIST_ARCHIVED_STATUS },
      after: { status },
      reason,
    });
    restored++;
  }
  return restored;
}

// מיישר את הפרופילים של מרכז למצב שלו, אחרי שינוי בשיוך או אישור של פרופיל:
// מרכז פעיל - המאושרים מקודמים; מרכז בארכיון - המאושרים מוסתרים איתו (אחרת
// פרופיל שאושר בזמן שהמרכז בארכיון היה מופיע במאגר החינמי); כל מצב אחר (הצעה
// שטרם שולמה) - לא נוגעים.
export async function syncCenterTherapists(centerId: string): Promise<{ promoted: number; archived: number }> {
  const { data: center } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, status")
    .eq("id", centerId)
    .maybeSingle();
  if (!center) return { promoted: 0, archived: 0 };
  if (center.status === "active") return { promoted: await promoteCenterTherapists(centerId), archived: 0 };
  if (center.status === "cancelled") {
    return { promoted: 0, archived: await archiveCenterTherapists(centerId, `center is archived (center=${centerId})`) };
  }
  return { promoted: 0, archived: 0 };
}

// עוצר מרכז פעיל, משלם או בקידום מתנה, ומעביר אותו לארכיון: מסמן אותו
// cancelled עם הסיבה, מנקה את שדות המתנה ומסתיר את הפרופילים שלו. שום פרט של
// המרכז לא נמחק - הפרופילים, העמוד הציבורי, חשבון הפורטל והתמחור נשארים,
// ואפשר להחזיר אותו (קידום מתנה, חידוש החיוב מהכרטיס השמור, או פתיחת ההצעה
// מחדש לתשלום).
//
// לא נוגע ב-Sumit: מי שקורא אחראי לבטל את הוראת הקבע ולאמת את הביטול *לפני*
// הקריאה לכאן, אחרת מרכז שסומן כעצור ממשיך להיות מחויב.
//
// giftEndedBy - לקרון שעוצר מתנה שנגמרה: העצירה תקפה רק אם המרכז עדיין
// בקידום מתנה שתאריך הסיום שלה עבר. בלי התנאי הזה, מתנה שהאדמין האריך שנייה
// אחרי שהקרון קרא את הרשימה הייתה נעצרת בכל זאת.
//
// מחזיר כמה פרופילים עברו לארכיון, או null אם העצירה לא חלה - המרכז כבר לא
// פעיל, או שהמתנה שלו הוארכה בינתיים (מרוץ מול פעולה מקבילה). במקרה כזה לא
// נעשה דבר.
export async function stopActiveCenter(
  centerId: string,
  reason: CenterStopReason,
  auditReason: string,
  opts: { giftEndedBy?: string } = {},
): Promise<number | null> {
  const now = new Date().toISOString();
  let update = supabaseAdmin
    .from("therapy_center_accounts")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancel_reason: reason,
      gift_granted_at: null,
      gift_until: null,
      updated_at: now,
    })
    .eq("id", centerId)
    .eq("status", "active");
  if (opts.giftEndedBy) {
    update = update.not("gift_granted_at", "is", null).lte("gift_until", opts.giftEndedBy);
  }
  const { data, error } = await update.select("id");
  if (error) throw new Error(`stopActiveCenter(${centerId}): ${error.message}`);
  if (!data || data.length === 0) return null;
  return archiveCenterTherapists(centerId, auditReason);
}
