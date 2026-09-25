// מה קרה עם כל הצעת קידום מתנה שנשלחה: לא לחץ, לחץ, או נרשם.
//
// אין כאן שום מעקב חדש. שני המקורות כבר נאספים בשרת:
//   - "נרשם": הקישור האישי נוצל (used_at). זה קורה רק אחרי ש-Sumit אישר
//     את הוראת הקבע במסלול המתנה (burnGiftCheckoutToken).
//   - "לחץ": עמוד ההצטרפות נטען מהקישור והשרת ספר פתיחה (view_count,
//     gift_token_mark_viewed). הספירה רצה אצלנו, ולכן חוסם פרסומות לא
//     מסתיר אותה.
//
// ספירת הפתיחות עלתה לאוויר ב-4/9/26 (ca6057a). הצעה שנשלחה לפני כן ולא
// נוצלה היא "לא נמדד" ולא "לא לחץ", כי אולי לחצו עליה לפני שספרנו.
// פתיחה של קישור ישן שנספרה אחרי 4/9 כן תקפה, ולכן ספירה חיובית נחשבת תמיד.
//
// הקובץ טהור (בלי מסד), כדי שגם הדפדפן וגם הבדיקות יוכלו לייבא אותו.

export const GIFT_VIEW_TRACKING_SINCE = "2026-09-04T16:22:14Z";

// ל-gift_offers אין עמודה של הטוקן. הטוקן נוצר רגע לפני שהמייל יוצא,
// והשורה ב-gift_offers נכתבת רק אחרי שהמייל יצא. שליחה שנכשלה משאירה
// טוקן יתום, וניסיון חוזר יוצר טוקן חדש. לכן הטוקן של הצעה הוא האחרון של
// אותו מטפל שנוצר בחלון הקצר שלפני רישום ההצעה.
export const TOKEN_WINDOW_BEFORE_MS = 30 * 60_000;
const TOKEN_WINDOW_AFTER_MS = 5_000;

export type GiftOfferOutcome = "registered" | "opened" | "not_opened" | "unknown";

export type GiftOfferRow = {
  id: string;
  therapist_id: string;
  region: string | null;
  treatment: string | null;
  sent_at: string;
};

export type GiftTokenRow = {
  therapist_id: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  view_count: number | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
};

export type GiftTherapistRow = {
  id: string;
  full_name: string | null;
  gender: string | null;
  status: string | null;
  promotion_source: string | null;
  promoted_until: string | null;
};

export type GiftOfferHistoryRow = {
  offerId: string;
  therapistId: string;
  name: string;
  gender: string | null;
  region: string;
  treatment: string;
  sentAt: string;
  outcome: GiftOfferOutcome;
  viewCount: number;
  lastViewedAt: string | null;
  usedAt: string | null;
  expiresAt: string | null;
  /** מצב המטפל היום - כדי לראות גם מי קיבל קידום בדרך אחרת. */
  status: string | null;
  promotionSource: string | null;
  promotedUntil: string | null;
};

export function giftOfferOutcome(
  sentAt: string,
  token: Pick<GiftTokenRow, "used_at" | "view_count"> | null,
  trackingSince: string = GIFT_VIEW_TRACKING_SINCE,
): GiftOfferOutcome {
  if (token?.used_at) return "registered";
  if ((token?.view_count ?? 0) > 0) return "opened";
  // בלי טוקן אין לנו מה לספור - עדיף "לא נמדד" מאשר "לא לחץ" שקרי.
  if (!token) return "unknown";
  return Date.parse(sentAt) >= Date.parse(trackingSince) ? "not_opened" : "unknown";
}

export function matchGiftToken(offer: GiftOfferRow, tokens: GiftTokenRow[]): GiftTokenRow | null {
  const sent = Date.parse(offer.sent_at);
  let best: GiftTokenRow | null = null;
  let bestAt = -Infinity;
  for (const t of tokens) {
    if (t.therapist_id !== offer.therapist_id) continue;
    const at = Date.parse(t.created_at);
    if (at < sent - TOKEN_WINDOW_BEFORE_MS || at > sent + TOKEN_WINDOW_AFTER_MS) continue;
    if (at > bestAt) {
      best = t;
      bestAt = at;
    }
  }
  return best;
}

export function buildGiftOfferHistory(
  offers: GiftOfferRow[],
  tokens: GiftTokenRow[],
  therapists: GiftTherapistRow[],
  trackingSince: string = GIFT_VIEW_TRACKING_SINCE,
): GiftOfferHistoryRow[] {
  const byId = new Map(therapists.map((t) => [t.id, t]));
  return offers.map((o) => {
    const token = matchGiftToken(o, tokens);
    const t = byId.get(o.therapist_id);
    return {
      offerId: o.id,
      therapistId: o.therapist_id,
      name: (t?.full_name ?? "").trim() || "(מטפל/ת שנמחק/ה)",
      gender: t?.gender || null,
      region: o.region ?? "",
      treatment: o.treatment ?? "",
      sentAt: o.sent_at,
      outcome: giftOfferOutcome(o.sent_at, token, trackingSince),
      viewCount: token?.view_count ?? 0,
      lastViewedAt: token?.last_viewed_at ?? null,
      usedAt: token?.used_at ?? null,
      expiresAt: token?.expires_at ?? null,
      status: t?.status ?? null,
      promotionSource: t?.promotion_source ?? null,
      promotedUntil: t?.promoted_until ?? null,
    };
  });
}

export function countGiftOutcomes(rows: Pick<GiftOfferHistoryRow, "outcome">[]): Record<GiftOfferOutcome, number> {
  const counts: Record<GiftOfferOutcome, number> = { registered: 0, opened: 0, not_opened: 0, unknown: 0 };
  for (const r of rows) counts[r.outcome] += 1;
  return counts;
}
