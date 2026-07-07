import "server-only";
import { Resend } from "resend";
import { logEmail } from "./email-log";
import { buildCenterProposalEmail } from "./center-proposal-email";
import { centerPricing, ilCurrency } from "./center-pricing";

// מיילים למרכזים טיפוליים. נפרד מ-therapist-emails כי הנמען והתוכן שונים
// (מרכז, לא מטפל בודד). כל שליחה נרשמת ל-crm_email_log (fire-and-forget).

const resendClient = new Resend(process.env.RESEND_API_KEY);
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

function giftLine(giftMonths: number, billingStartsAt: string | null): string {
  if (giftMonths <= 0) return "החיוב החודשי הראשון בוצע, וקבלה נשלחה לכתובת זו.";
  const when = billingStartsAt
    ? new Date(billingStartsAt.includes("T") ? billingStartsAt : billingStartsAt + "T00:00:00").toLocaleDateString("he-IL")
    : null;
  const label = giftMonths === 1 ? "החודש הראשון" : giftMonths === 2 ? "החודשיים הראשונים" : `${giftMonths} החודשים הראשונים`;
  return `${label} על חשבוננו — פרטי התשלום נשמרו והחיוב הראשון יתבצע רק ב-${when ?? "תום תקופת המתנה"}.`;
}

/**
 * מייל הצעה למרכז — נשלח מהאדמין ("שלח הצעה במייל"). מפרט את המסלולים,
 * המחיר החודשי, חודשי המתנה, וכפתור בולט לקישור ההצטרפות/תשלום. ה-HTML נבנה
 * במודול הבילדר הנקי (ניתן לתצוגה מקדימה), וכאן רק שולחים ורושמים ל-CRM.
 */
export async function sendCenterProposalEmail(opts: {
  to: string;
  centerName: string;
  contactName: string | null;
  pricePerTherapist: number;
  therapistCount: number;
  giftMonths: number;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendCenterProposalEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const { subject, html } = buildCenterProposalEmail({
    centerName: opts.centerName,
    contactName: opts.contactName,
    pricePerTherapist: opts.pricePerTherapist,
    therapistCount: opts.therapistCount,
    giftMonths: opts.giftMonths,
    token: opts.token,
    siteUrl: SITE_URL,
  });

  try {
    const { error } = await resendClient.emails.send({ from: FROM, to: opts.to, subject, html });
    void logEmail({
      recipient: opts.to,
      recipientType: "organization",
      subject,
      template: "center_proposal",
      sentBy: "admin",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    if (error) {
      console.error("sendCenterProposalEmail: resend error:", error);
      return { ok: false, error: String(error.message ?? error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendCenterProposalEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * מייל ברוכים-הבאים למרכז אחרי קליטת התשלום. כולל קישור לפורטל הניהול
 * (המרכז נרשם עם אותה כתובת מייל כדי להתחבר).
 */
export async function sendCenterWelcomeEmail(opts: {
  to: string;
  centerName: string;
  pricePerTherapist: number;
  therapistCount: number;
  giftMonths: number;
  billingStartsAt: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendCenterWelcomeEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const rawName = (opts.centerName || "המרכז").trim();
  const name = escapeHtml(rawName);
  const pr = centerPricing(opts.pricePerTherapist, opts.therapistCount);
  const priceLine = `${pr.therapistCount} מטפלים × ₪${ilCurrency(pr.pricePerTherapist)} = ₪${ilCurrency(pr.monthlyTotal)} + מע"מ לחודש`;
  const portalUrl = `${SITE_URL}/centers/login?mode=register`;
  const to = escapeHtml(opts.to);
  // נושא = טקסט רגיל, בלי HTML entities.
  const subject = `ברוכים הבאים לטיפול חכם — ${rawName} 🎉`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">ברוכים הבאים, ${name} 🎉</h1>
      <p style="margin:0 0 14px;">המנוי של המרכז לטיפול חכם פעיל. מטפלי המרכז ייכנסו למערכת ההתאמות החכמה, ומטופלים יופנו אליהם לפי סוג הטיפול, אזור, גיל, שפה והעדפות.</p>
      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
        <p style="margin:0 0 6px;font-weight:bold;">${priceLine}</p>
        <p style="margin:0;font-size:13px;color:#3E5250;">${giftLine(opts.giftMonths, opts.billingStartsAt)}</p>
      </div>
      <p style="margin:0 0 10px;font-weight:bold;">פורטל ניהול המרכז</p>
      <p style="margin:0 0 16px;">בפורטל תראו את כל פרופילי המטפלים של המרכז במקום אחד, וסטטיסטיקות מרוכזות — כמה אנשים ראו אתכם, מאיפה הם מגיעים ועם אילו קשיים. להתחברות, הירשמו עם כתובת המייל הזו (${to}):</p>
      <p style="margin:0 0 16px;">
        <a href="${portalUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">כניסה לפורטל המרכז</a>
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#3E5250;">נציג שלנו ייצור אתכם קשר להשלמת קליטת המטפלים של המרכז.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com<br/>
        צוות טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resendClient.emails.send({ from: FROM, to: opts.to, subject, html });
    void logEmail({
      recipient: opts.to,
      recipientType: "organization",
      subject,
      template: "center_welcome",
      sentBy: "system",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    if (error) {
      console.error("sendCenterWelcomeEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendCenterWelcomeEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}
