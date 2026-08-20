import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// לאן שולחים מייל *תפעולי* על מטפל: בקשה להשלמת פרופיל, הודעת אדמין, הזמנה
// לכתוב מאמר, הצעת מתנה, סיום תקופה.
//
// מטפל שמשויך למרכז טיפולי הוא לא בעל החשבון - המרכז הוא. הפרופיל נוצר
// מהזמנה של המרכז, נשמר בכוונה בלי user_id ("הפרופיל שייך למרכז"), והמרכז
// הוא היחיד שיכול לערוך אותו. לכן פנייה שמבקשת *לתקן משהו בפרופיל* חייבת
// להגיע למי שיכול לתקן. עד 20/8/2026 היא נשלחה ל-therapists.email, ושם יושבת
// הכתובת שהמרכז הקליד בהזמנה - לפעמים תיבת המרכז עצמה, ואצל לי חזן (מרכז
// שדות) מחרוזת ריקה, כלומר המייל פשוט לא יצא.
//
// הערה על השדה: therapists.email מתויג בפורטל כ"אימייל לפניות מטופלים" - הוא
// פרט קשר ציבורי, לא כתובת החשבון. זו בדיוק הסיבה שאסור להסיק ממנו לאן
// שולחים מייל תפעולי.

export type TherapistMailTarget = {
  /** null = אין לאן לשלוח; הקורא חייב לדלג ולדווח, לא לשלוח למחרוזת ריקה. */
  to: string | null;
  /** מולא כשהנמען הוא המרכז ולא המטפל - להצגה באדמין ולתיעוד. */
  viaCenter: { id: string; name: string } | null;
};

function clean(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

type CenterRow = { id: string; name: string; email: string | null; payer_email: string | null };

/**
 * גרסת אצווה - שאילתה אחת לכל הקבוצה, לשימוש בקרונים ובלולאות.
 * מחזיר מפה מ-therapist_id ליעד.
 */
export async function operationalMailTargets(
  therapistIds: string[],
): Promise<Map<string, TherapistMailTarget>> {
  const out = new Map<string, TherapistMailTarget>();
  const ids = [...new Set(therapistIds.filter(Boolean))];
  if (ids.length === 0) return out;

  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, email, center_account_id")
    .in("id", ids);

  const centerIds = [
    ...new Set((therapists ?? []).map((t) => t.center_account_id).filter(Boolean) as string[]),
  ];
  const centers = new Map<string, CenterRow>();
  if (centerIds.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("id, name, email, payer_email")
      .in("id", centerIds);
    for (const c of (rows ?? []) as CenterRow[]) centers.set(c.id, c);
  }

  for (const t of therapists ?? []) {
    const center = t.center_account_id ? centers.get(t.center_account_id as string) : undefined;
    if (center) {
      // כתובת הקשר של המרכז לפני כתובת החיוב: השנייה היא הנהלת חשבונות
      // ולא בהכרח מי שנכנס לפורטל לערוך. נפילה למייל המטפל רק אם לשתיהן ריק.
      const to = clean(center.email) ?? clean(center.payer_email) ?? clean(t.email);
      out.set(t.id as string, { to, viaCenter: { id: center.id, name: center.name } });
    } else {
      out.set(t.id as string, { to: clean(t.email), viaCenter: null });
    }
  }
  return out;
}

/** גרסת יחיד. */
export async function operationalMailTarget(therapistId: string): Promise<TherapistMailTarget> {
  const map = await operationalMailTargets([therapistId]);
  return map.get(therapistId) ?? { to: null, viaCenter: null };
}

/**
 * יעד ל*פניית מטופל* - סדר הפוך: קודם המטפל, והמרכז רק כרשת ביטחון.
 *
 * ההבחנה מכוונת. פנייה תפעולית שייכת למי שיכול לפעול (המרכז), אבל פנייה של
 * מטופל שייכת למי שיטפל בו, והיא גם פרטית יותר - אין להסיט אותה למרכז כשיש
 * למטפל כתובת משלו. הנפילה קיימת כי החלופה גרועה יותר: לי חזן (מרכז שדות)
 * מקודמת ומשולמת, שדה המייל שלה ריק, וכל פנייה אליה נדחתה ב-404
 * "מטפל לא זמין" - המרכז שילם ולא ידע שהוא מפסיד פניות.
 */
export async function patientInquiryRecipient(
  therapistId: string,
): Promise<TherapistMailTarget> {
  const { data: t } = await supabaseAdmin
    .from("therapists")
    .select("id, email, center_account_id")
    .eq("id", therapistId)
    .maybeSingle();
  if (!t) return { to: null, viaCenter: null };

  const own = clean(t.email);
  if (own) return { to: own, viaCenter: null };
  if (!t.center_account_id) return { to: null, viaCenter: null };

  const { data: c } = await supabaseAdmin
    .from("therapy_center_accounts")
    .select("id, name, email, payer_email")
    .eq("id", t.center_account_id as string)
    .maybeSingle();
  if (!c) return { to: null, viaCenter: null };
  const to = clean(c.email) ?? clean(c.payer_email);
  return { to, viaCenter: to ? { id: c.id as string, name: c.name as string } : null };
}
