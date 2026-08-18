import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendGiftOfferEmail } from "./therapist-emails";
import { writeAudit } from "./audit";
import { issueGiftCheckoutToken, JOIN_LINK_PLACEHOLDER } from "./gift-checkout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

// מסלול השליחה של הצעות קידום מתנה.
//
// סוכן פערי ההיצע (supply-gaps.ts) רק מנסח ומציע; כאן נמצאת הפעולה עצמה,
// והיא נקראת אך ורק מקליק מפורש של האדמין בעמוד הסוכנים. אין קרון, אין
// מסלול אוטומטי, ואין דרך שנייה לשלוח - כדי שלא יהיו שני מסלולי שליחה.
//
// שלוש הגנות בזמן השליחה (ולא רק בזמן הניתוח):
//   1. המטפל חייב להיות אחד המועמדים של אותה הצעה - לא שולחים למי שלא נבדק.
//   2. זכאות נבדקת מחדש מול המאגר ברגע השליחה - מטפל שקודם/שילם מאז הריצה
//      לא יקבל הצעת מתנה (המקודם לעולם לא מקבל מתנה).
//   3. צינון: לא שולחים למטפל שכבר קיבל הצעת מתנה לאחרונה.

// כמה זמן מטפל שקיבל הצעה נשאר מחוץ לבריכת המועמדים.
export const GIFT_OFFER_COOLDOWN_DAYS = Number(process.env.GIFT_OFFER_COOLDOWN_DAYS ?? 90);
// כמה זמן פער שכבר יצאה בו הצעה נשאר מושתק, בהמתנה לתשובה.
export const GIFT_OFFER_WAIT_DAYS = Number(process.env.GIFT_OFFER_WAIT_DAYS ?? 21);
export const GIFT_OFFER_MONTHS = 2;

export type GiftEligibility = {
  status: string;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  promotion_source: string | null;
  promoted_until: string | null;
};

// מקור אמת יחיד לשאלה "מי בכלל יכול לקבל הצעת מתנה" - גם הסוכן שבונה את
// בריכת המועמדים וגם מסלול השליחה עוברים דרך הפונקציה הזו, כדי שהתנאים לא
// ייפרדו בין שני המקומות. מחזירה נימוק בעברית, או null כשהמטפל זכאי.
export function giftEligibilityError(t: GiftEligibility, nowIso: string): string | null {
  if (t.status !== "approved") {
    return t.status === "paying"
      ? "המטפל כבר מקודם או משלם - אין מה להציע לו מתנה"
      : `סטטוס המטפל (${t.status}) לא מאפשר הצעת מתנה`;
  }
  if (!t.admin_approved) return "הפרופיל טרם אושר לתצוגה";
  if (t.accepting_new_patients === false) return "המטפל סימן שאינו מקבל מטופלים חדשים";
  if (t.promotion_source) return "למטפל כבר יש קידום פעיל";
  if (t.promoted_until && t.promoted_until > nowIso) return "למטפל כבר יש חלון קידום פעיל";
  return null;
}

export type SentGiftOffer = {
  therapist_id: string;
  region: string;
  treatment: string;
  sent_at: string;
};

// כל ההצעות שנשלחו בחלון הצינון - הסוכן משתמש בזה כדי לא להציע שוב את מה
// שכבר בדרך.
export async function recentGiftOffers(days = GIFT_OFFER_COOLDOWN_DAYS): Promise<SentGiftOffer[]> {
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("gift_offers")
    .select("therapist_id, region, treatment, sent_at")
    .gte("sent_at", sinceIso)
    .order("sent_at", { ascending: false });
  if (error) {
    // כישלון קריאה כאן היה מרחיב בשקט את בריכת המועמדים ומאפשר הצעה כפולה,
    // ולכן הוא נזרק ולא נבלע - עדיף שהריצה תיכשל בגלוי.
    throw new Error(`קריאת הצעות המתנה שנשלחו נכשלה: ${error.message}`);
  }
  return (data ?? []) as SentGiftOffer[];
}

export type GiftOfferSendResult = {
  ok: boolean;
  error?: string;
  therapistName?: string;
  email?: string;
};

export async function sendGiftOffer(opts: {
  actionId: string;
  therapistId: string;
  subject: string;
  body: string;
}): Promise<GiftOfferSendResult> {
  const subject = opts.subject.trim().slice(0, 200);
  const body = opts.body.trim().slice(0, 8000);
  if (!body) return { ok: false, error: "גוף המייל ריק" };

  // 1. ההצעה עצמה: חייבת להיות קיימת, מסוג הצעת מתנה, וממתינה. הצעה שכבר
  //    נשלחה או נדחתה לא תישלח שוב מקליק כפול או מכפתור ישן בדפדפן פתוח.
  const { data: action, error: actionErr } = await supabaseAdmin
    .from("agent_actions")
    .select("id, action_type, status, payload, title")
    .eq("id", opts.actionId)
    .single();
  if (actionErr || !action) return { ok: false, error: "ההצעה לא נמצאה" };
  if (action.action_type !== "gift_offer") return { ok: false, error: "ההצעה הזו אינה הצעת קידום מתנה" };
  if (action.status !== "pending") {
    return { ok: false, error: "ההצעה כבר טופלה - רענן/י את העמוד" };
  }

  const payload = (action.payload ?? {}) as {
    region?: string;
    treatment?: string;
    gift_months?: number;
    gap_key?: string;
    candidates?: { therapist_id: string; full_name?: string }[];
  };
  const candidates = payload.candidates ?? [];
  if (!candidates.some((c) => c.therapist_id === opts.therapistId)) {
    return { ok: false, error: "המטפל שנבחר אינו אחד המועמדים של ההצעה הזו" };
  }

  // 2. זכאות טרייה מהמאגר, לא מהתמונה שהסוכן צילם בריצה.
  const { data: t, error: tErr } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, status, admin_approved, accepting_new_patients, promotion_source, promoted_until")
    .eq("id", opts.therapistId)
    .single();
  if (tErr || !t) return { ok: false, error: "המטפל לא נמצא" };
  if (!t.email) return { ok: false, error: "למטפל אין כתובת מייל" };
  const ineligible = giftEligibilityError(t as GiftEligibility, new Date().toISOString());
  if (ineligible) return { ok: false, error: `לא נשלח: ${ineligible}` };

  // 3. צינון - הצעה אחת למטפל בחלון הצינון, גם אם עלה בכמה פערים שונים.
  const cooldownIso = new Date(Date.now() - GIFT_OFFER_COOLDOWN_DAYS * 86_400_000).toISOString();
  const { data: prior, error: priorErr } = await supabaseAdmin
    .from("gift_offers")
    .select("sent_at, region, treatment")
    .eq("therapist_id", opts.therapistId)
    .gte("sent_at", cooldownIso)
    .order("sent_at", { ascending: false })
    .limit(1);
  if (priorErr) return { ok: false, error: `בדיקת הצעות קודמות נכשלה: ${priorErr.message}` };
  if (prior && prior.length > 0) {
    const when = new Date(prior[0].sent_at as string).toLocaleDateString("he-IL");
    return {
      ok: false,
      error: `כבר נשלחה למטפל הזה הצעת מתנה ב-${when} (${prior[0].treatment} · ${prior[0].region}). הצינון הוא ${GIFT_OFFER_COOLDOWN_DAYS} ימים.`,
    };
  }

  const name = (t.full_name as string) ?? "";

  // הקישור האישי נוצר כאן ולא בזמן ניסוח הטיוטה: הוא חייב להיות קשור
  // לנמען שנבחר בפועל, ולא למועמד שהיה ברשימה כשהסוכן רץ. אם האדמין מחק
  // את הסמן מהטיוטה, הקישור מתווסף בסופה - מייל בלי קישור הוא הצעה
  // שאי אפשר לממש.
  const joinToken = await issueGiftCheckoutToken({
    therapistId: opts.therapistId,
    actionId: opts.actionId,
    region: payload.region ?? null,
    treatment: payload.treatment ?? null,
  });
  const joinUrl = `${SITE_URL}/therapists/gift-checkout?token=${joinToken}`;
  const bodyWithLink = body.includes(JOIN_LINK_PLACEHOLDER)
    ? body.replace(JOIN_LINK_PLACEHOLDER, joinUrl)
    : `${body}\n\n${joinUrl}`;

  const sent = await sendGiftOfferEmail({ to: t.email as string, name, subject, message: bodyWithLink });
  if (!sent.ok) {
    // המייל לא יצא - ההצעה נשארת ממתינה בתור כדי שאפשר יהיה לנסות שוב.
    return { ok: false, error: sent.error || "שליחת המייל נכשלה" };
  }

  // מכאן והלאה המייל כבר בחוץ: כל כישלון נרשם ללוג אבל לא הופך את התוצאה
  // ל"נכשל", אחרת האדמין ישלח שוב מייל שכבר נשלח.
  const { error: offerErr } = await supabaseAdmin.from("gift_offers").insert({
    therapist_id: opts.therapistId,
    region: payload.region ?? "",
    treatment: payload.treatment ?? "",
    gap_key: payload.gap_key ?? null,
    agent_action_id: opts.actionId,
    months: payload.gift_months ?? GIFT_OFFER_MONTHS,
    subject,
    body,
    sent_by: "admin",
  });
  if (offerErr) console.error("gift_offers insert failed:", offerErr.message);

  const { error: updErr } = await supabaseAdmin
    .from("agent_actions")
    .update({
      status: "executed",
      status_changed_at: new Date().toISOString(),
      resolved_by: "admin",
      resolution_note: `נשלחה הצעת מתנה ל${name || "מטפל"} (${t.email})`,
    })
    .eq("id", opts.actionId);
  if (updErr) console.error("agent_actions gift_offer update failed:", updErr.message);

  await writeAudit(supabaseAdmin, {
    therapistId: opts.therapistId,
    actorType: "admin",
    action: "gift_offer_sent",
    before: {},
    // הטקסט המלא נשמר גם כאן: זו פנייה אנושית שנערכה ידנית, ובלי הגוף אי
    // אפשר לשחזר מה בדיוק הובטח למטפל.
    after: {
      region: payload.region ?? "",
      treatment: payload.treatment ?? "",
      months: payload.gift_months ?? GIFT_OFFER_MONTHS,
      subject,
      body,
    },
    reason: "admin sent a gift-promotion offer from the supply-gap queue",
  });

  return { ok: true, therapistName: name, email: t.email as string };
}
