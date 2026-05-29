import { Resend } from "resend";

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
        לכל שאלה: tpool406@gmail.com | 052-790-6335<br/>
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
        לכל שאלה: tpool406@gmail.com | 052-790-6335<br/>
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
