import { Resend } from "resend";
import { sendBulkEmail } from "./email-quota";
import { logEmail } from "./email-log";
import { buildProfileFeedbackHtml, type ProfileForFeedback } from "./profile-feedback";
import { buildArticleInviteEmail } from "./article-invite-email";
import {
  isPromoActive,
  SUBSCRIPTION_PROMO_PRICE,
  SUBSCRIPTION_PROMO_MONTHS,
  SUBSCRIPTION_REGULAR_PRICE,
} from "@/app/lib/promo";

const resendClient = new Resend(process.env.RESEND_API_KEY);

// Every email in this file flows through this one wrapper, so each outbound
// send lands in crm_email_log (the CRM timeline reads it) without touching
// the individual sender functions. Keyed by recipient address — the timeline
// resolves therapist ↔ email by address, so no entity id is needed here.
// Logging is fire-and-forget: it must never delay or fail a send.
const resend = {
  emails: {
    send: async (payload: { from: string; to: string | string[]; subject: string; html: string }) => {
      const result = await resendClient.emails.send(payload);
      const recipient = Array.isArray(payload.to) ? payload.to[0] : payload.to;
      void logEmail({
        recipient,
        recipientType: recipient.endsWith("@getmentalytics.com") ? "other" : "therapist",
        subject: payload.subject,
        sentBy: "system",
        status: result.error ? "failed" : "sent",
        error: result.error ? String(result.error.message ?? result.error) : undefined,
      });
      return result;
    },
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const ADMIN_RECIPIENTS = (
  process.env.WEEKLY_REPORT_TO ??
  "admin@getmentalytics.com,avshalom@getmentalytics.com,omer@getmentalytics.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Centered brand logo header for the top of the email card. Uses the hosted
// PNG wordmark (email clients strip SVG). Kept as a plain string so any email
// can drop it in right after the card's opening <div>.
const EMAIL_LOGO_HEADER = `<div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>`;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Reasons a therapist's promoted-tier access ends:
//   - 'admin_demote'         — admin demoted a free (manual/trial) promotion
//   - 'customer_cancellation'— paying customer asked us to cancel their sub
//   - 'trial_expired'        — time-limited promotion reached its expiry
//   - 'payment_failed'       — Sumit cancelled the standing order after retries
export type PromotionEndedReason =
  | "admin_demote"
  | "customer_cancellation"
  | "trial_expired"
  | "payment_failed";

// Source of a new gift promotion (admin granted, no money changed hands):
//   - 'manual' — no expiry, runs until admin demotes
//   - 'trial'  — time-limited, expires at promoted_until
export type PromotionGrantedSource = "manual" | "trial";

const REASON_TEXTS: Record<PromotionEndedReason, { subject: string; body: string }> = {
  admin_demote: {
    subject: "ההטבה שלך באתר טיפול חכם הסתיימה",
    body:
      "ההטבה של הקידום החינמי שניתנה לך הסתיימה." +
      ' כדי להמשיך להופיע כמטפל/ת מקודם/ת באתר, ניתן להירשם למסלול בתשלום של ₪140 + מע"מ לחודש.',
  },
  customer_cancellation: {
    subject: "המנוי שלך באתר טיפול חכם בוטל",
    body:
      "המנוי החודשי שלך באתר טיפול חכם בוטל בעקבות בקשתך." +
      " הוראת הקבע הופסקה ולא ייגבו ממך תשלומים נוספים." +
      " אנחנו מצטערים לראות אותך עוזב/ת, ותודה שהיית חלק מטיפול חכם 🙏" +
      " כל שאלה, הערה או תלונה — אנחנו כאן וזה חשוב לנו. ואם בעתיד תרצה/י לחזור, ניתן להירשם מחדש מהאתר בכל עת.",
  },
  trial_expired: {
    subject: "תקופת הניסיון שלך באתר טיפול חכם הסתיימה",
    body:
      "תקופת הניסיון החינמית שהוענקה לך הסתיימה." +
      ' להמשך הופעה כמטפל/ת מקודם/ת באתר, ניתן להירשם למסלול בתשלום של ₪140 + מע"מ לחודש.',
  },
  payment_failed: {
    subject: "החיוב החודשי באתר טיפול חכם נכשל",
    body:
      "ניסיון החיוב החודשי על כרטיס האשראי שלך נכשל מספר פעמים, ועקב כך הוראת הקבע בוטלה." +
      " ייתכן שהכרטיס פג תוקף או שיש בעיה אחרת. ניתן להירשם מחדש עם פרטי כרטיס מעודכנים.",
  },
};

export async function sendPromotionEndedEmail(opts: {
  to: string;
  name: string;
  reason: PromotionEndedReason;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendPromotionEndedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const { subject, body } = REASON_TEXTS[opts.reason];
  const safeBody = escapeHtml(body);
  const checkoutUrl = `${SITE_URL}/therapists/checkout`;
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const feedbackUrl = `${SITE_URL}/therapists/feedback?email=${encodeURIComponent(opts.to)}&name=${encodeURIComponent(opts.name || "")}`;

  // For a deliberate cancellation, invite quick exit feedback (reasons + free
  // text) via a short on-site form. Not shown for payment-failure / gift-end.
  const feedbackHtml =
    opts.reason === "customer_cancellation"
      ? `<p style="margin:0 0 12px;">אם יש דקה — נשמח מאוד לדעת מה גרם לך לעזוב, זה עוזר לנו להשתפר:</p>
      <p style="margin:0 0 24px;">
        <a href="${feedbackUrl}" style="display:inline-block;background:#D49018;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">שיתוף הסיבה לביטול</a>
      </p>`
      : "";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      <p style="margin:0 0 16px;">${safeBody}</p>
      ${feedbackHtml}
      <p style="margin:0 0 24px;">לתחילת מסלול בתשלום:</p>
      <p style="margin:0 0 16px;">
        <a href="${checkoutUrl}"
           style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          הרשמה למסלול המקודם
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#666;">
        תוכל/י לראות את הסטטוס הנוכחי שלך
        <a href="${dashboardUrl}" style="color:#0F5468;">בדשבורד</a>.
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject,
      html,
    });
    if (error) {
      console.error("sendPromotionEndedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendPromotionEndedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Internal: a therapist's exit feedback after they cancel (reasons + free
// text), submitted from the on-site /therapists/feedback form. Goes to the
// admin team, not to the therapist.
export async function sendCancellationFeedbackEmail(opts: {
  name?: string;
  email?: string;
  reasons: string[];
  message?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendCancellationFeedbackEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }
  const safeName = escapeHtml(opts.name?.trim() || "—");
  const safeEmail = escapeHtml(opts.email?.trim() || "—");
  const reasonsHtml =
    opts.reasons.length > 0
      ? `<ul style="margin:0 0 12px;padding-inline-start:18px;">${opts.reasons
          .map((r) => `<li>${escapeHtml(r)}</li>`)
          .join("")}</ul>`
      : `<p style="margin:0 0 12px;color:#888;">לא נבחרו סיבות.</p>`;
  const messageHtml = opts.message?.trim()
    ? `<p style="margin:0 0 6px;font-weight:bold;">הערות חופשיות:</p><p style="margin:0 0 12px;white-space:pre-line;">${escapeHtml(opts.message.trim())}</p>`
    : "";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:18px;margin:0 0 16px;">משוב ביטול ממטפל/ת</h1>
      <p style="margin:0 0 6px;"><strong>שם:</strong> ${safeName}</p>
      <p style="margin:0 0 16px;"><strong>מייל:</strong> ${safeEmail}</p>
      <p style="margin:0 0 6px;font-weight:bold;">סיבות שנבחרו:</p>
      ${reasonsHtml}
      ${messageHtml}
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: ADMIN_RECIPIENTS,
      subject: `משוב ביטול ממטפל/ת — ${opts.name?.trim() || opts.email?.trim() || "ללא שם"}`,
      html,
    });
    if (error) {
      console.error("sendCancellationFeedbackEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendCancellationFeedbackEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Sent when an admin grants a free promoted-tier gift (manual or trial).
// promotedUntilIso = null → indefinite manual gift; otherwise it's a trial.
// wasPreviouslyPaying = true → therapist was previously on a Sumit
// subscription that we just cancelled; mention this so they don't think
// the missing charge is a bug.
export async function sendPromotionGrantedEmail(opts: {
  to: string;
  name: string;
  source: PromotionGrantedSource;
  promotedUntilIso: string | null;
  wasPreviouslyPaying?: boolean;
  giftMonths?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendPromotionGrantedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;

  const subject = opts.wasPreviouslyPaying
    ? "המנוי שלך הוסב למסלול הטבה ללא עלות 🎁"
    : "🎁 קיבלת קידום מתנה באתר טיפול חכם!";

  const openingLine = opts.wasPreviouslyPaying
    ? `המנוי בתשלום שלך באתר טיפול חכם הוסב <strong>למסלול הטבה ללא עלות</strong>. הוראת הקבע אצל Sumit בוטלה ולא ייגבו ממך תשלומים נוספים.`
    : `קיבלת <strong>קידום מתנה</strong> למסלול המקודם באתר טיפול חכם, ללא תשלום מצדך.`;

  const monthsText = opts.giftMonths
    ? opts.giftMonths === 1
      ? "חודש קידום אחד במתנה"
      : `${opts.giftMonths} חודשי קידום במתנה`
    : null;

  const durationLine =
    opts.source === "manual" || !opts.promotedUntilIso
      ? "ההטבה אינה מוגבלת בזמן ותימשך עד הודעה חדשה."
      : monthsText
      ? `קיבלת ${monthsText}. ההטבה תקפה עד ${new Date(opts.promotedUntilIso).toLocaleDateString("he-IL")}, ולקראת סיום התקופה תקבל/י תזכורת.`
      : `ההטבה תקפה עד ${new Date(opts.promotedUntilIso).toLocaleDateString("he-IL")}. לקראת סיום התקופה תקבל/י תזכורת.`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">מזל טוב ${safeName} 🎉</h1>
      <p style="margin:0 0 12px;">${openingLine}</p>
      <p style="margin:0 0 20px;">${escapeHtml(durationLine)}</p>

      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 18px;margin:0 0 22px;">
        <p style="margin:0 0 8px;font-weight:bold;color:#0F5468;">המסלול המקודם כולל:</p>
        <ul style="margin:0;padding-right:18px;font-size:14px;">
          <li>חשיפה מועדפת בתוצאות החיפוש</li>
          <li>מערכת התאמה חכמה — פניות לפי גיל, אזור, שפה, סגנון טיפולי ועוד</li>
          <li>דו"ח צפיות, לחיצות ואחוזי המרה</li>
          <li>פילוח הפונים: אזור, קושי, גיל ומגדר</li>
          <li>השוואה לממוצע המטפלים באתר</li>
        </ul>
      </div>

      <p style="margin:0 0 16px;">לצפייה בפרטים מלאים ובסטטיסטיקות שלך:</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          לדשבורד שלי
        </a>
      </p>

      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        בהצלחה,<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject,
      html,
    });
    if (error) {
      console.error("sendPromotionGrantedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendPromotionGrantedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Onboarding email sent once a therapist becomes active:
//   tier 'paid' — they just subscribed (create-subscription)
//   tier 'free' — admin approved their pending profile (admin-therapists)
// Includes a personalized profile-quality nudge (hybrid rules + AI) and an
// invitation to write a short article. Best-effort: the caller must not let a
// failure here block the underlying action (payment / approval).
export async function sendTherapistWelcomeEmail(opts: {
  to: string;
  tier: "paid" | "free";
  therapist: ProfileForFeedback;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistWelcomeEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.therapist.full_name?.trim() || "מטפל/ת יקר/ה");
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const writeUrl = `${SITE_URL}/therapists/articles`;
  const checkoutUrl = `${SITE_URL}/therapists/checkout`;
  const isPaid = opts.tier === "paid";

  // Profile-quality feedback (hybrid rules + AI). Best-effort; "" if no gaps.
  let feedbackHtml = "";
  try {
    feedbackHtml = (await buildProfileFeedbackHtml(opts.therapist)) ?? "";
  } catch (err) {
    console.error(
      "sendTherapistWelcomeEmail: feedback build failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const subject = isPaid
    ? "תודה על השדרוג למסלול המקודם של טיפול חכם 🎉"
    : "הפרופיל שלך אושר — ברוך/ה הבא/ה לטיפול חכם 🎉";

  const confirmationHtml = isPaid
    ? `<p style="margin:0 0 12px;">תודה ששדרגת ל<strong>מסלול המקודם</strong> של טיפול חכם! הפרופיל שלך יעלה למערכת ההתאמה החכמה ויקבל חשיפה מועדפת <strong>מיד לאחר שצוות טיפול חכם יאשר אותו</strong> — נעדכן אותך במייל ברגע שזה קורה.</p>
      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 18px;margin:14px 0 18px;">
        <p style="margin:0 0 8px;font-weight:bold;color:#0F5468;">מה כולל המסלול שלך:</p>
        <ul style="margin:0;padding-inline-start:18px;font-size:14px;line-height:1.6;">
          <li>חשיפה מועדפת בתוצאות החיפוש</li>
          <li>מערכת התאמה חכמה — פניות לפי גיל, אזור, שפה, סגנון טיפולי ועוד</li>
          <li>דו"ח צפיות, לחיצות ואחוזי המרה</li>
          <li>פילוח הפונים: אזור, קושי, גיל ומגדר</li>
          <li>השוואה לממוצע המטפלים באתר</li>
        </ul>
      </div>
      <p style="margin:0 0 20px;font-size:13px;color:#666;">קבלה/חשבונית על התשלום תישלח אליך ישירות ממערכת הסליקה.</p>`
    : `<p style="margin:0 0 20px;">הפרופיל שלך <strong>אושר ומקבל הופעה ראשונה במערכת המטפלים</strong> של טיפול חכם — כל מי שמחפש מטפל/ת באזור ובתחום שלך יכול/ה למצוא אותך.</p>`;

  const articleCtaHtml = `
      <div style="border:1px solid #E8E0D8;border-radius:10px;padding:16px 20px;margin:0 0 22px;">
        <p style="margin:0 0 8px;font-weight:bold;color:#0F5468;">כתיבה מקצועית = יותר פניות</p>
        <p style="margin:0 0 12px;font-size:14px;color:#3E5250;line-height:1.6;">
          כתיבת מידע מקצועי קצר על תחום שקרוב לליבך מגבירה מאוד את הפנייה אליך. זה לא חייב להיות מאמר מדעי או מקצועי מדי —
          מספיק מידע פשוט וברור שיעזור למטופלים פוטנציאליים להכיר אותך דרך הכתיבה שלך. נשמח לפרסם אותו במאגר המאמרים של האתר,
          עם שמך וקישור לפרופיל שלך.
        </p>
        <a href="${writeUrl}" style="display:inline-block;background:#D49018;color:#fff;text-decoration:none;font-weight:bold;padding:10px 22px;border-radius:10px;font-size:14px;">לכתיבת מאמר קצר</a>
      </div>`;

  // Paid-tier upsell — shown only to free therapists.
  const upsellHtml = isPaid
    ? ""
    : `
      <div style="background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);border-radius:10px;padding:18px 20px;margin:0 0 22px;color:#fff;">
        <p style="margin:0 0 6px;font-weight:bold;font-size:15px;">רוצה להגיע ליותר מטופלים? שדרג/י למסלול המקודם</p>
        <p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,.85);">${
          isPromoActive()
            ? `מבצע פתיחה — ₪${SUBSCRIPTION_PROMO_PRICE} + מע"מ לחודש ל-${SUBSCRIPTION_PROMO_MONTHS} החודשים הראשונים, אח"כ ₪${SUBSCRIPTION_REGULAR_PRICE} + מע"מ`
            : `₪${SUBSCRIPTION_REGULAR_PRICE} + מע"מ לחודש`
        } · ניתן לבטל בכל עת</p>
        <ul style="margin:0 0 14px;padding-inline-start:18px;font-size:13.5px;line-height:1.7;color:rgba(255,255,255,.95);">
          <li>שילוב במערכת ההתאמה החכמה — הפניות מדויקות יותר לפי גיל, אזור, שפה, סוג הטיפול שבו את/ה מתמחה וסגנון טיפולי</li>
          <li>סטטיסטיקות על הפונים — אילו סוגי מטופלים צופים בפרופיל שלך, אזורים ואחוזי המרה</li>
          <li>אחריות: לא קיבלת מטופל שהגיע דרכנו תוך חודשיים? אפשר לקבל החזר כספי מלא</li>
        </ul>
        <a href="${checkoutUrl}" style="display:inline-block;background:#D49018;color:#fff;text-decoration:none;font-weight:bold;padding:10px 22px;border-radius:10px;font-size:14px;">לשדרוג למסלול המקודם</a>
      </div>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">שלום ${safeName} 👋</h1>
      ${confirmationHtml}
      ${feedbackHtml}
      ${upsellHtml}
      ${articleCtaHtml}
      <p style="margin:0 0 16px;">לעדכון הפרטים ולצפייה בלוח הבקרה שלך:</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          ללוח הבקרה שלי
        </a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        בהצלחה,<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject,
      html,
    });
    if (error) {
      console.error("sendTherapistWelcomeEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendTherapistWelcomeEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Sent right after a therapist first submits their profile (status pending) —
// confirms we received it and that the team will review it before publishing.
export async function sendTherapistRegistrationReceivedEmail(opts: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistRegistrationReceivedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }
  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const subject = "תודה על ההצטרפות לטיפול חכם — הפרופיל בבדיקה 🎉";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">שלום ${safeName} 👋</h1>
      <p style="margin:0 0 14px;">תודה שהצטרפת לטיפול חכם! 🎉</p>
      <p style="margin:0 0 14px;">קלטנו את הפרטים שלך, וצוות טיפול חכם בודק כעת את הפרופיל והתעודות שהעלית לפני הפרסום. הבדיקה נועדה לשמור על אמינות ואיכות המאגר — לטובת המטופלים וגם לטובתך.</p>
      <p style="margin:0 0 18px;">נעדכן אותך במייל ברגע שהפרופיל יאושר. בינתיים אפשר להיכנס ללוח הבקרה לעדכן או להשלים פרטים.</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">ללוח הבקרה שלי</a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com · 055-993-1403<br/>
        בברכה,<br/>
        צוות טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html });
    if (error) {
      console.error("sendTherapistRegistrationReceivedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendTherapistRegistrationReceivedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Sent when an admin approves a PAYING therapist's listing (admin_approved
// false→true) — the joyful "you're live in the matching system" congrats.
export async function sendPromotedApprovedEmail(opts: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendPromotedApprovedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }
  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const subject = "הפרופיל המקודם שלך אושר ועלה לאוויר 🎉";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">שלום ${safeName} 🎉</h1>
      <p style="margin:0 0 14px;">שמחים לבשר — הפרופיל שלך אושר וכעת הוא חי במערכת ההתאמה החכמה של טיפול חכם!</p>
      <p style="margin:0 0 18px;">מהרגע הזה מטופלים שמחפשים מטפל/ת שמתאים/ה בדיוק לפרופיל שלך (לפי תחום, גיל, אזור, שפה וסגנון טיפולי) יופנו אליך — ותוכל/י לעקוב אחרי הצפיות, הפניות ואחוזי ההמרה בלוח הבקרה.</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">ללוח הבקרה שלי</a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com · 055-993-1403<br/>
        בהצלחה,<br/>
        צוות טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html });
    if (error) {
      console.error("sendPromotedApprovedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendPromotedApprovedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Sent when an admin approves or rejects a therapist's submitted article.
export async function sendArticleReviewedEmail(opts: {
  to: string;
  name: string;
  approved: boolean;
  title: string;
  slug?: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendArticleReviewedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const safeTitle = escapeHtml(opts.title);
  const articlesUrl = `${SITE_URL}/therapists/articles`;
  const articleUrl = opts.slug ? `${SITE_URL}/research/community/${opts.slug}` : `${SITE_URL}/research`;

  const subject = opts.approved
    ? "המאמר שלך פורסם באתר טיפול חכם 🎉"
    : "עדכון על המאמר ששלחת לטיפול חכם";

  const bodyHtml = opts.approved
    ? `<p style="margin:0 0 16px;">המאמר שלך "<strong>${safeTitle}</strong>" אושר ופורסם במאגר המאמרים של טיפול חכם — עם שמך וקישור לפרופיל שלך. כתיבה כזו עוזרת למטופלים פוטנציאליים להכיר אותך.</p>
       <p style="margin:0 0 16px;">
         <a href="${articleUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">צפייה במאמר</a>
       </p>
       <p style="margin:0;font-size:13px;color:#666;">מוזמן/ת לכתוב מאמרים נוספים מ<a href="${articlesUrl}" style="color:#0F5468;">אזור המאמרים שלך</a>.</p>`
    : `<p style="margin:0 0 16px;">תודה ששלחת את המאמר "<strong>${safeTitle}</strong>". לאחר בדיקה, הוא לא אושר לפרסום במתכונתו הנוכחית.</p>
       ${opts.reason ? `<p style="margin:0 0 16px;">סיבה: ${escapeHtml(opts.reason)}</p>` : ""}
       <p style="margin:0;font-size:13px;color:#666;">אפשר לערוך ולשלוח גרסה מעודכנת מ<a href="${articlesUrl}" style="color:#0F5468;">אזור המאמרים שלך</a>.</p>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      ${bodyHtml}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html });
    if (error) {
      console.error("sendArticleReviewedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendArticleReviewedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Sent when an admin rejects a therapist's registration (e.g. the uploaded
// license certificate is unreadable or unacceptable). Explains the reason and
// how to fix it — re-uploading a clear certificate and saving re-submits the
// profile for review automatically.
export async function sendTherapistRejectedEmail(opts: {
  to: string;
  name: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistRejectedEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const editUrl = `${SITE_URL}/therapists/dashboard/edit`;
  const subject = "עדכון לגבי הרשמתך לטיפול חכם";

  const reasonBlock = opts.reason
    ? `<div style="background:#FFF4F4;border:1px solid #F3C9C9;border-radius:10px;padding:14px 18px;margin:0 0 18px;">
         <p style="margin:0;font-size:14px;color:#8A2A2A;"><strong>הסיבה:</strong> ${escapeHtml(opts.reason)}</p>
       </div>`
    : "";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      <p style="margin:0 0 16px;">תודה שנרשמת לטיפול חכם. לאחר בדיקת הפרטים, הפרופיל שלך עדיין לא אושר לפרסום.</p>
      ${reasonBlock}
      <p style="margin:0 0 16px;">קל לתקן: היכנס/י לעריכת הפרופיל, עדכן/י את הפרטים הנדרשים והעלה/י תעודת רישיון או אישור מקצועי ברורים וקריאים. לאחר השמירה, הפרופיל יישלח שוב לבדיקה אוטומטית.</p>
      <p style="margin:0 0 16px;">
        <a href="${editUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">לעריכת הפרופיל שלי</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">הקישור מוביל ישירות לעריכת הפרופיל. תתבקש/י להתחבר תחילה — עם חשבון Google או עם המייל והסיסמה שאיתם נרשמת.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html });
    if (error) {
      console.error("sendTherapistRejectedEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendTherapistRejectedEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

// Admin-triggered nudge for an incomplete (but not rejected) registration —
// lists exactly what's missing and links to the dashboard. A gentle "one step
// left" framing; it does NOT change the profile's status.
export async function sendTherapistCompletionRequestEmail(opts: {
  to: string;
  name: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistCompletionRequestEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const editUrl = `${SITE_URL}/therapists/dashboard/edit`;
  const subject = "נשאר צעד קטן להשלמת הפרופיל שלך בטיפול חכם";

  const safeMessage = escapeHtml(
    opts.message || "נשמח שתשלים/י את הפרטים החסרים בפרופיל כדי שנוכל לאשר ולהציג אותו."
  );

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      ${EMAIL_LOGO_HEADER}
      <h1 style="color:#0F5468;font-size:21px;margin:0 0 16px;">שלום ${safeName},</h1>
      <div style="white-space:pre-line;margin:0 0 18px;font-size:15px;color:#1a4a5c;">${safeMessage}</div>
      <p style="margin:0 0 22px;font-size:15px;">היכנס/י לעריכת הפרופיל, השלם/י את הפרטים, ולאחר השמירה הפרופיל יישלח אוטומטית לבדיקה.</p>
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${editUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:50px;">לעריכת הפרופיל שלי ←</a>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;text-align:center;">הקישור מוביל ישירות לעריכת הפרופיל. תתבקש/י להתחבר תחילה — עם חשבון Google או עם המייל והסיסמה שאיתם נרשמת.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  // Completion reminders are the classic bulk burst — route them through the
  // daily bulk gate so a mass send can't blow Resend's daily quota (and starve
  // transactional mail). A deferred send returns ok:false with a clear message.
  const r = await sendBulkEmail({ from: FROM, to: opts.to, subject, html });
  if (!r.ok && !r.skipped) console.error("sendTherapistCompletionRequestEmail: send error:", r.error);
  return { ok: r.ok, error: r.error };
}

// Admin-triggered personal invitation to write an article for the site in
// exchange for two months of promoted-tier exposure, free. Explains the offer,
// links to the article composer in the therapist's personal area, and includes
// a free-vs-promoted comparison table. Routed through the daily bulk gate since
// an admin may invite many "selected" therapists in one sitting — a deferred
// send returns ok:false with a clear message. The HTML itself lives in the
// dependency-light builder module so it can be previewed in isolation.
export async function sendArticleInviteEmail(opts: {
  to: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendArticleInviteEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const { subject, html } = buildArticleInviteEmail({ name: opts.name, siteUrl: SITE_URL });

  const r = await sendBulkEmail({ from: FROM, to: opts.to, subject, html });
  if (!r.ok && !r.skipped) console.error("sendArticleInviteEmail: send error:", r.error);
  return { ok: r.ok, error: r.error };
}

// General admin → therapist message with a custom subject + free-text body and
// a direct "edit profile" button. Unlike the completion request it makes no
// claim about missing fields or review, so it fits any nudge — e.g. "you
// uploaded a certificate into the photo slot, here's the link to fix it". Does
// NOT change the profile's status.
export async function sendTherapistAdminMessageEmail(opts: {
  to: string;
  name: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistAdminMessageEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }
  if (!opts.message?.trim()) {
    return { ok: false, error: "empty message" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const editUrl = `${SITE_URL}/therapists/dashboard/edit`;
  const subject = opts.subject?.trim() || "הודעה מצוות טיפול חכם";
  const safeMessage = escapeHtml(opts.message);

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      ${EMAIL_LOGO_HEADER}
      <h1 style="color:#0F5468;font-size:21px;margin:0 0 16px;">שלום ${safeName},</h1>
      <div style="white-space:pre-line;margin:0 0 22px;font-size:15px;color:#1a4a5c;">${safeMessage}</div>
      <div style="text-align:center;margin:0 0 20px;">
        <a href="${editUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:50px;">לעריכת הפרופיל שלי ←</a>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;text-align:center;">הקישור מוביל ישירות לעריכת הפרופיל. תתבקש/י להתחבר תחילה — עם חשבון Google או עם המייל והסיסמה שאיתם נרשמת.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  // Route through the shared bulk gate so it's daily-capped and recorded in the
  // CRM email history like every other admin→therapist mail (a raw send here
  // would skip both). A single message barely touches the cap.
  const r = await sendBulkEmail({ from: FROM, to: opts.to, subject, html });
  if (!r.ok && !r.skipped) console.error("sendTherapistAdminMessageEmail: send error:", r.error);
  return { ok: r.ok, error: r.error };
}
