import { Resend } from "resend";
import { buildProfileFeedbackHtml, type ProfileForFeedback } from "./profile-feedback";

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";

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
      " הוראת הקבע אצל Sumit הופסקה ולא ייגבו ממך תשלומים נוספים." +
      " תודה שהיית חלק מהמערכת — אם בעתיד תרצה/י לחזור, ניתן להירשם מחדש מהאתר.",
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

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      <p style="margin:0 0 16px;">${safeBody}</p>
      <p style="margin:0 0 24px;">לתחילת מסלול בתשלום:</p>
      <p style="margin:0 0 16px;">
        <a href="${checkoutUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          הרשמה למסלול המקודם
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#666;">
        תוכל/י לראות את הסטטוס הנוכחי שלך
        <a href="${dashboardUrl}" style="color:#0F5468;">בדשבורד</a>.
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
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

  const durationLine =
    opts.source === "manual" || !opts.promotedUntilIso
      ? "ההטבה אינה מוגבלת בזמן ותימשך עד הודעה חדשה."
      : `ההטבה תקפה עד ${new Date(opts.promotedUntilIso).toLocaleDateString("he-IL")}. לקראת סיום התקופה תקבל/י תזכורת.`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
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
           style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          לדשבורד שלי
        </a>
      </p>

      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
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
    ? "ברוך/ה הבא/ה למסלול המקודם של טיפול חכם 🎉"
    : "הפרופיל שלך אושר — ברוך/ה הבא/ה לטיפול חכם 🎉";

  const confirmationHtml = isPaid
    ? `<p style="margin:0 0 12px;">תודה שהצטרפת ל<strong>מסלול המקודם</strong> של טיפול חכם! מהרגע הזה הפרופיל שלך משתתף במערכת ההתאמה החכמה ומקבל חשיפה מועדפת.</p>
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
      <div style="background:linear-gradient(135deg,#0F5468,#1A7A96);border-radius:10px;padding:18px 20px;margin:0 0 22px;color:#fff;">
        <p style="margin:0 0 6px;font-weight:bold;font-size:15px;">רוצה להגיע ליותר מטופלים? שדרג/י למסלול המקודם</p>
        <p style="margin:0 0 12px;font-size:13px;color:rgba(255,255,255,.85);">₪140 + מע"מ לחודש · ניתן לבטל בכל עת</p>
        <ul style="margin:0 0 14px;padding-inline-start:18px;font-size:13.5px;line-height:1.7;color:rgba(255,255,255,.95);">
          <li>שילוב במערכת ההתאמה החכמה — הפניות מדויקות יותר לפי גיל, אזור, שפה, סוג הטיפול שבו את/ה מתמחה וסגנון טיפולי</li>
          <li>סטטיסטיקות על הפונים — אילו סוגי מטופלים צופים בפרופיל שלך, אזורים ואחוזי המרה</li>
          <li>אחריות: לא קיבלת מטופל שהגיע דרכנו תוך חודשיים? אפשר לקבל החזר כספי מלא</li>
        </ul>
        <a href="${checkoutUrl}" style="display:inline-block;background:#D49018;color:#fff;text-decoration:none;font-weight:bold;padding:10px 22px;border-radius:10px;font-size:14px;">לשדרוג למסלול המקודם</a>
      </div>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">שלום ${safeName} 👋</h1>
      ${confirmationHtml}
      ${feedbackHtml}
      ${upsellHtml}
      ${articleCtaHtml}
      <p style="margin:0 0 16px;">לעדכון הפרטים ולצפייה בלוח הבקרה שלך:</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">
          ללוח הבקרה שלי
        </a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
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
         <a href="${articleUrl}" style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">צפייה במאמר</a>
       </p>
       <p style="margin:0;font-size:13px;color:#666;">מוזמן/ת לכתוב מאמרים נוספים מ<a href="${articlesUrl}" style="color:#0F5468;">אזור המאמרים שלך</a>.</p>`
    : `<p style="margin:0 0 16px;">תודה ששלחת את המאמר "<strong>${safeTitle}</strong>". לאחר בדיקה, הוא לא אושר לפרסום במתכונתו הנוכחית.</p>
       ${opts.reason ? `<p style="margin:0 0 16px;">סיבה: ${escapeHtml(opts.reason)}</p>` : ""}
       <p style="margin:0;font-size:13px;color:#666;">אפשר לערוך ולשלוח גרסה מעודכנת מ<a href="${articlesUrl}" style="color:#0F5468;">אזור המאמרים שלך</a>.</p>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      ${bodyHtml}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
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
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const subject = "עדכון לגבי הרשמתך לטיפול חכם";

  const reasonBlock = opts.reason
    ? `<div style="background:#FFF4F4;border:1px solid #F3C9C9;border-radius:10px;padding:14px 18px;margin:0 0 18px;">
         <p style="margin:0;font-size:14px;color:#8A2A2A;"><strong>הסיבה:</strong> ${escapeHtml(opts.reason)}</p>
       </div>`
    : "";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      <p style="margin:0 0 16px;">תודה שנרשמת לטיפול חכם. לאחר בדיקת הפרטים, הפרופיל שלך עדיין לא אושר לפרסום.</p>
      ${reasonBlock}
      <p style="margin:0 0 16px;">קל לתקן: היכנס/י ללוח הבקרה, עדכן/י את הפרטים הנדרשים והעלה/י תעודת רישיון או אישור מקצועי ברורים וקריאים. לאחר השמירה, הפרופיל יישלח שוב לבדיקה אוטומטית.</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">לעדכון הפרטים</a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
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
  missing: string[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendTherapistCompletionRequestEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const safeName = escapeHtml(opts.name || "מטפל/ת יקר/ה");
  const dashboardUrl = `${SITE_URL}/therapists/dashboard`;
  const subject = "נשאר צעד קטן להשלמת הפרופיל שלך בטיפול חכם";

  const items = (opts.missing.length ? opts.missing : ["השלמת הפרטים החסרים"])
    .map((m) => `<li style="margin:4px 0;">${escapeHtml(m)}</li>`)
    .join("");

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${safeName},</h1>
      <p style="margin:0 0 16px;">תודה שנרשמת לטיפול חכם! כדי שנוכל לאשר את הפרופיל ולהציג אותו במערכת ההתאמה, נשאר רק להשלים:</p>
      <ul style="margin:0 0 18px;padding-inline-start:22px;font-size:14px;color:#0F5468;">${items}</ul>
      <p style="margin:0 0 16px;">היכנס/י ללוח הבקרה, השלם/י את הפרטים, ולאחר השמירה הפרופיל יישלח אוטומטית לבדיקה.</p>
      <p style="margin:0 0 16px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">להשלמת הפרופיל</a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 052-790-6335<br/>
        טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject, html });
    if (error) {
      console.error("sendTherapistCompletionRequestEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendTherapistCompletionRequestEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}
