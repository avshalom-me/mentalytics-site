// Builder for the admin-triggered "here's our proposal for your center" email.
// Dependency-light (no server-only / Resend / Supabase) so it can be rendered
// and previewed in isolation. center-emails.ts wraps this with the actual send
// + CRM logging.
//
// המודל: מחיר-למטפל × מספר-מטפלים = סה"כ חודשי. אין "מסלולים" — המחיר וההיקף
// נקבעים בשיחת ההתאמה, ומצוין זאת במפורש.
import { centerMonthlyPricing, ilCurrency } from "./center-pricing";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function giftLabel(n: number): string {
  if (n === 1) return "החודש הראשון";
  if (n === 2) return "החודשיים הראשונים";
  return `${n} החודשים הראשונים`;
}

export function buildCenterProposalEmail(opts: {
  centerName: string;
  contactName: string | null;
  billingTrack?: string | null;
  pricePerTherapist: number;
  therapistCount: number;
  fixedMonthlyPrice?: number | null;
  giftMonths: number;
  token: string;
  siteUrl: string;
}): { subject: string; html: string } {
  const siteUrl = opts.siteUrl.replace(/\/$/, "");
  const rawName = (opts.centerName || "המרכז").trim();
  const name = escapeHtml(rawName);
  const greetName = escapeHtml(opts.contactName?.trim() || rawName);
  const joinUrl = `${siteUrl}/centers/join/${opts.token}`;
  // הנושא הוא טקסט רגיל (כותרת מייל) — בלי escape של HTML, אחרת "A & B"
  // יוצג כ-"A &amp; B" בתיבת הדואר.
  const subject = `הצעה לשיתוף פעולה — טיפול חכם ל${rawName}`;

  const isEntity = opts.billingTrack === "center_entity";
  const p = centerMonthlyPricing({
    billing_track: opts.billingTrack,
    price_per_therapist: opts.pricePerTherapist,
    therapist_count: opts.therapistCount,
    fixed_monthly_price: opts.fixedMonthlyPrice,
  });

  const giftBadge =
    opts.giftMonths > 0
      ? `<div style="background:#FDF6E3;border:1px solid #E9D6A6;border-radius:10px;padding:14px 16px;margin:0 0 18px;text-align:center;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:900;color:#A87010;">🎁 ${giftLabel(opts.giftMonths)} במתנה</p>
        <p style="margin:0;font-size:13px;color:#7a5a10;">פרטי התשלום נשמרים עכשיו, אך <strong>החיוב הראשון יתבצע רק בתום ${
          opts.giftMonths === 1 ? "חודש המתנה" : "חודשי המתנה"
        }</strong> — ולא לפני כן.</p>
      </div>`
      : "";

  // תיבת התמחור — לפי מסלול המרכז. מסלול 2 (מרכז כישות) = סכום חודשי קבוע.
  const pricingBox = isEntity
    ? `
      <div style="border:1px solid #DDE9E8;border-radius:12px;overflow:hidden;margin:0 0 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#1a4a5c;">
          <tr style="background:#F0F7FA;">
            <td style="padding:14px 16px;font-weight:900;color:#0F5468;">מנוי חודשי — מרכז טיפולי</td>
            <td style="padding:14px 16px;text-align:left;font-weight:900;color:#0F5468;font-size:17px;">₪${ilCurrency(p.monthlyTotal)} <span style="font-size:12px;font-weight:normal;color:#6B807E;">+ מע&quot;מ</span></td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 18px;font-size:12px;color:#6B807E;">₪${ilCurrency(p.monthlyTotalWithVat)} לחודש כולל מע&quot;מ (${p.vatPct}%). המרכז מוצג כרובריקה אחת במערכת ההתאמות.</p>`
    : `
      <div style="border:1px solid #DDE9E8;border-radius:12px;overflow:hidden;margin:0 0 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#1a4a5c;">
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #EAF0EE;">מחיר לכל מטפל</td>
            <td style="padding:12px 16px;border-bottom:1px solid #EAF0EE;text-align:left;font-weight:bold;">₪${ilCurrency(p.pricePerTherapist)} <span style="font-weight:normal;color:#6B807E;">+ מע&quot;מ / חודש</span></td>
          </tr>
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #EAF0EE;">מספר מטפלים</td>
            <td style="padding:12px 16px;border-bottom:1px solid #EAF0EE;text-align:left;font-weight:bold;">${p.therapistCount}</td>
          </tr>
          <tr style="background:#F0F7FA;">
            <td style="padding:14px 16px;font-weight:900;color:#0F5468;">סה&quot;כ חודשי</td>
            <td style="padding:14px 16px;text-align:left;font-weight:900;color:#0F5468;font-size:17px;">₪${ilCurrency(p.monthlyTotal)} <span style="font-size:12px;font-weight:normal;color:#6B807E;">+ מע&quot;מ</span></td>
          </tr>
        </table>
      </div>
      <p style="margin:0 0 18px;font-size:12px;color:#6B807E;">₪${ilCurrency(p.monthlyTotalWithVat)} לחודש כולל מע&quot;מ (${p.vatPct}%). ${p.therapistCount} מטפלים × ₪${ilCurrency(p.pricePerTherapist)}.</p>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${siteUrl}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:21px;margin:0 0 16px;">שלום ${greetName},</h1>
      <p style="margin:0 0 14px;font-size:15px;">שמחים להציע ל<strong>${name}</strong> שיתוף פעולה עם טיפול חכם. המטפלים של המרכז ייכנסו למערכת ההתאמות החכמה שלנו, ומטופלים יופנו אליהם לפי סוג הטיפול, אזור, גיל, שפה והעדפות — עם דף פרופיל לכל מטפל, פורטל ניהול מרכזי, ודוח סטטיסטיקות חודשי.</p>

      ${giftBadge}

      <p style="margin:0 0 10px;font-weight:bold;color:#0F5468;">פרטי ההצעה</p>
      ${pricingBox}

      <p style="margin:0 0 20px;font-size:13.5px;color:#3E5250;background:#F7FAF9;border:1px solid #E8E0D8;border-radius:10px;padding:12px 16px;">
        המחיר והיקף ההתקשרות נקבעו יחד איתך בשיחת ההתאמה, בהתאם לצרכי המרכז. ניתן לעדכן את מספר המטפלים בהמשך.
      </p>

      <div style="text-align:center;margin:22px 0 8px;">
        <a href="${joinUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:50px;">לצפייה בהצעה ולהצטרפות ←</a>
      </div>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-align:center;">הקישור אישי למרכז שלכם. אפשר לעיין בפרטים המלאים ולהשלים את ההצטרפות בכל עת.</p>

      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com | 055-993-1403<br/>
        בברכה,<br/>
        צוות טיפול חכם — Mentalytics
      </p>
    </div>
  </body>
</html>`;

  return { subject, html };
}
