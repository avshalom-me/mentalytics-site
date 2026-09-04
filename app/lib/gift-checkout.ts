import { randomBytes } from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

// מסלול ההצטרפות בהזמנה בלבד: חודשיים ראשונים ללא תשלום, ואחריהם המנוי
// הרגיל. זהו מסלול נפרד לחלוטין מהצ'ק-אאוט הרגיל, והשער אליו הוא טוקן
// אישי שנוצר ברגע שהסוכן שולח את ההצעה.
//
// למה טוקן ולא סתם עמוד: בלעדיו כל מטפל שישמע על ההצעה יוכל להיכנס
// למסלול המוזל, וההצעה תפסיק להיות כלי לסגירת פערי היצע ותהפוך למחירון
// חלופי. הטוקן קשור למטפל אחד, פוקע, ונשרף בשימוש.

export const GIFT_MONTHS = 2;
// כמה זמן ההצעה תקפה (החלטת המשתמש 27/8/26, היה 30 יום). המספר הזה מופיע
// גם בטיוטה שנשלחת וגם בעמוד ההצטרפות, ולכן הוא מיוצא ולא משוכפל: הבטחה
// שכתובה במייל וסף שנאכף בקוד חייבים להיות אותו מספר.
export const GIFT_OFFER_TTL_DAYS = 3;

export type GiftCheckoutToken = {
  token: string;
  therapistId: string;
  therapistName: string;
  email: string;
  region: string | null;
  treatment: string | null;
  giftMonths: number;
  expiresAt: string;
};

export type TokenValidation =
  | { ok: true; data: GiftCheckoutToken }
  | { ok: false; reason: "missing" | "unknown" | "expired" | "used" | "ineligible"; message: string };

// תאריך החיוב הראשון: בדיוק חודשיים מיום ההצטרפות (החלטת המשתמש
// 17/8/26 - פשוט יותר מ"1 לחודש הקרוב" ולא מבלבל את המטפל).
export function firstChargeDate(from: Date = new Date(), months = GIFT_MONTHS): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export async function issueGiftCheckoutToken(params: {
  therapistId: string;
  actionId?: string | null;
  region?: string | null;
  treatment?: string | null;
}): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(24).toString("base64url");
  const expires = new Date();
  expires.setDate(expires.getDate() + GIFT_OFFER_TTL_DAYS);

  const { error } = await supabaseAdmin.from("gift_checkout_tokens").insert({
    token,
    therapist_id: params.therapistId,
    action_id: params.actionId ?? null,
    region: params.region ?? null,
    treatment: params.treatment ?? null,
    gift_months: GIFT_MONTHS,
    expires_at: expires.toISOString(),
  });
  if (error) throw new Error(`יצירת קישור ההצטרפות נכשלה: ${error.message}`);
  return { token, expiresAt: expires.toISOString() };
}

/**
 * רישום פתיחה של קישור ההצעה. נקרא רק ממסלול ה-GET (טעינת העמוד), ולא
 * מהשליחה עצמה, כדי שהמספר יישאר "כמה פעמים נפתח" ולא יתערבב בהגשה.
 *
 * למה בכלל: 12 הצעות יצאו ב-3/9 ולא הניבו הרשמה, ולא היה אפשר לדעת אם איש
 * לא לחץ או שכולם לחצו ונרתעו. ה-page_view של העמוד ניתן לחסימה ע"י חוסם
 * פרסומות, ומעקב הפתיחות ב-Resend התברר ככבוי לגמרי. הרישום כאן רץ אצלנו
 * בשרת ולכן אינו ניתן לחסימה.
 *
 * best-effort: כישלון עדכון לא מונע מהמטפל להיכנס לעמוד.
 */
async function recordTokenView(token: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    await supabaseAdmin.rpc("gift_token_mark_viewed", { p_token: token, p_now: nowIso });
  } catch (e) {
    console.error("recordTokenView failed:", e instanceof Error ? e.message : e);
  }
}

// אימות בכל טעינה של עמוד ההצטרפות ושוב לפני החיוב עצמו. הזכאות נבדקת
// מחדש ולא נשענת על מה שהיה נכון ביום שליחת המייל: מטפל שבינתיים כבר
// שילם או קיבל קידום לא ייכנס למסלול הזה שוב.
export async function validateGiftCheckoutToken(
  token: string,
  // true רק מטעינת העמוד - כדי שספירת הפתיחות תמדוד קליקים במייל ולא הגשות.
  opts?: { recordView?: boolean },
): Promise<TokenValidation> {
  const clean = (token ?? "").trim();
  if (!clean) return { ok: false, reason: "missing", message: "חסר קישור הצטרפות" };

  const { data: row, error } = await supabaseAdmin
    .from("gift_checkout_tokens")
    .select("token, therapist_id, region, treatment, gift_months, expires_at, used_at")
    .eq("token", clean)
    .maybeSingle();

  if (error) throw new Error(`בדיקת הקישור נכשלה: ${error.message}`);
  if (!row) {
    return { ok: false, reason: "unknown", message: "הקישור אינו תקף" };
  }
  if (row.used_at) {
    return { ok: false, reason: "used", message: "הקישור כבר נוצל" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      reason: "expired",
      message: `תוקף הקישור פג. ההצעה תקפה ל-${GIFT_OFFER_TTL_DAYS} ימים מרגע שליחת המייל.`,
    };
  }

  // נרשם אחרי שהטוקן נמצא ולא פג - פתיחה של קישור מת אינה "קליק על ההצעה".
  if (opts?.recordView) await recordTokenView(clean);

  const { data: t } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status, promotion_source")
    .eq("id", row.therapist_id)
    .maybeSingle();

  if (!t?.email) {
    return { ok: false, reason: "ineligible", message: "לא נמצאו פרטי המטפל/ת" };
  }
  if (t.promotion_source) {
    return { ok: false, reason: "ineligible", message: "כבר קיים קידום פעיל" };
  }
  if (t.status !== "approved") {
    return { ok: false, reason: "ineligible", message: "הפרופיל אינו במצב שמאפשר הצטרפות" };
  }

  return {
    ok: true,
    data: {
      token: row.token,
      therapistId: row.therapist_id,
      therapistName: t.full_name ?? "",
      email: t.email,
      region: row.region,
      treatment: row.treatment,
      giftMonths: row.gift_months ?? GIFT_MONTHS,
      expiresAt: row.expires_at,
    },
  };
}

// שריפת הטוקן אחרי הצטרפות מוצלחת. נקרא רק אחרי ש-Sumit אישר את הוראת
// החיוב, כדי שניסיון שנכשל לא ינעל את המטפל מחוץ למסלול.
export async function burnGiftCheckoutToken(token: string): Promise<void> {
  await supabaseAdmin
    .from("gift_checkout_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null);
}

// הסמן שהטיוטה מכילה במקום הקישור. הקישור עצמו נוצר רק ברגע השליחה, כי
// הוא חייב להיות קשור לנמען שנבחר בפועל ולא למועמד שהיה ברשימה.
export const JOIN_LINK_PLACEHOLDER = "[קישור ההצטרפות יתווסף אוטומטית בשליחה]";
