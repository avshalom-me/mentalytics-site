// Builder for the admin-triggered "write an article, get 2 months promoted for
// free" invitation email. Kept as a pure, dependency-light module (only the
// promo price constants) so it can be rendered/previewed in isolation without
// pulling in Resend, Supabase or the AI feedback stack. therapist-emails.ts
// wraps this with the actual send + CRM logging.
import {
  SUBSCRIPTION_REGULAR_PRICE,
  SUBSCRIPTION_PROMO_PRICE,
  SUBSCRIPTION_PROMO_MONTHS,
  isPromoActive,
} from "@/app/lib/promo";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// One green ✓ / muted ✗ cell for the comparison table.
function yes(): string {
  return `<td style="text-align:center;padding:11px 8px;border-bottom:1px solid #EAF0EE;color:#2A8C6A;font-weight:800;font-size:16px;">✓</td>`;
}
function no(): string {
  return `<td style="text-align:center;padding:11px 8px;border-bottom:1px solid #EAF0EE;color:#C9D4D2;font-weight:800;font-size:16px;">✗</td>`;
}

export function buildArticleInviteEmail(opts: {
  name: string;
  siteUrl: string;
}): { subject: string; html: string } {
  const safeName = escapeHtml(opts.name?.trim() || "מטפל/ת יקר/ה");
  const siteUrl = opts.siteUrl.replace(/\/$/, "");
  const writeUrl = `${siteUrl}/therapists/articles`;
  const helpMailto = `mailto:admin@getmentalytics.com?subject=${encodeURIComponent(
    "התייעצות לגבי כתיבת מאמר לאתר טיפול חכם",
  )}`;

  const regularPriceNote = isPromoActive()
    ? `בדרך כלל ₪${SUBSCRIPTION_PROMO_PRICE}–₪${SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ לחודש`
    : `בדרך כלל ₪${SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ לחודש`;

  const logoHeader = `<div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${siteUrl}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>`;

  const subject = "הזמנה אישית: כתבו מאמר וקבלו חודשיים קידום במתנה 🎁";

  // Free vs. promoted comparison - mirrors the /therapists/join pricing table.
  const comparisonTable = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;font-size:13.5px;color:#1a4a5c;">
        <thead>
          <tr>
            <th style="text-align:right;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#0F5468;">מה מקבלים</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#6B807E;width:78px;">חינמי</th>
            <th style="text-align:center;padding:10px 8px;border-bottom:2px solid #DDE9E8;font-weight:800;color:#0F5468;width:110px;">מקודם 🎁</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">דף פרופיל אישי - תמונה, ביוגרפיה ותחומי התמחות</td>
            ${yes()}${yes()}
          </tr>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">הופעה בחיפוש לפי אזור או עיר</td>
            ${yes()}${yes()}
          </tr>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">הופעה ראשונה בתוצאות החיפוש</td>
            ${no()}${yes()}
          </tr>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">מערכת ההתאמה החכמה - פניות לפי גיל, אזור, שפה וסגנון טיפולי</td>
            ${no()}${yes()}
          </tr>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">דו&quot;ח צפיות, לחיצות ואחוזי המרה</td>
            ${no()}${yes()}
          </tr>
          <tr>
            <td style="padding:11px 8px;border-bottom:1px solid #EAF0EE;">פילוח הפונים + השוואה לממוצע + סוכן AI אישי</td>
            ${no()}${yes()}
          </tr>
        </tbody>
      </table>
      <p style="margin:0 0 4px;font-size:12px;color:#6B807E;">המסלול המקודם ${regularPriceNote} - ואצלך הוא במתנה מלאה לחודשיים, ללא כרטיס אשראי וללא התחייבות.</p>`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      ${logoHeader}
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">שלום ${safeName}, 👋</h1>

      <p style="margin:0 0 16px;font-size:15px;">
        אנו פונים אלייך ואל עוד מספר מצומצם של מטפלים נבחרים.
      </p>

      <p style="margin:0 0 16px;font-size:15px;">
        כדי לעודד אותך לשתף מהידע שלך, אנחנו מציעים <strong>חודשיים קידום במתנה</strong> למי שישלח/תשלח מאמר לאתר.
        המאמר יתפרסם <strong>תחת שמך בפרופיל</strong> ויסייע למטופלים פוטנציאליים להכיר אותך - את הגישה, הניסיון והקול המקצועי שלך.
      </p>

      <!-- Gift highlight -->
      <div style="background:#FDF6E3;border:1px solid #E9D6A6;border-radius:12px;padding:18px 20px;margin:0 0 22px;text-align:center;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#A87010;">🎁 חודשיים קידום במתנה</p>
        <p style="margin:0;font-size:14px;color:#7a5a10;">על מאמר אחד שיתפרסם בשמך - בלי עלות, בלי כרטיס אשראי ובלי התחייבות</p>
      </div>

      <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#0F5468;">כמה זה פשוט:</p>
      <ul style="margin:0 0 20px;padding-inline-start:20px;font-size:14.5px;line-height:1.75;color:#3E5250;">
        <li>המאמר יכול להיות <strong>קצר או ארוך</strong> - כמה שנוח לך. אין דרישת אורך.</li>
        <li>אפשר בגוון <strong>מקצועי</strong> (לעמיתים ולמתעניינים בתחום) או <strong>אינפורמטיבי לציבור הרחב</strong> - מה שמתאים לך.</li>
        <li>אפשר לשלוח <strong>יותר ממאמר אחד</strong> - המתנה ניתנת על המאמר הראשון, ואת/ה מוזמן/ת להמשיך ולפרסם עוד.</li>
        <li>כותבים ושולחים ישירות מהאזור האישי שלך באתר, וצוות טיפול חכם עובר על המאמר לפני הפרסום.</li>
      </ul>

      <div style="text-align:center;margin:0 0 26px;">
        <a href="${writeUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 34px;border-radius:50px;">לכתיבת מאמר באזור האישי שלי ←</a>
        <p style="margin:10px 0 0;font-size:12px;color:#6b7280;">הקישור מוביל לאזור האישי. ייתכן שתתבקש/י להתחבר תחילה - עם חשבון Google או עם המייל והסיסמה שאיתם נרשמת.</p>
      </div>

      <p style="margin:0 0 10px;font-size:15px;font-weight:bold;color:#0F5468;">מה כולל הקידום שתקבל/י - לעומת המסלול החינמי</p>
      ${comparisonTable}

      <div style="border:1px solid #E8E0D8;border-radius:12px;padding:16px 20px;margin:22px 0;background:#F7FAF9;">
        <p style="margin:0 0 6px;font-weight:bold;color:#0F5468;font-size:14.5px;">למה זה שווה את הזמן שלך</p>
        <ul style="margin:0;padding-inline-start:20px;font-size:14px;line-height:1.75;color:#3E5250;">
          <li><strong>נוכחות בגוגל:</strong> מאמר בשמך מופיע בחיפושים ומביא אליך אנשים שמחפשים בדיוק את התחום שלך.</li>
          <li><strong>אמון לפני הפגישה הראשונה:</strong> מטופל שקורא אותך מגיע כבר עם היכרות ותחושת ביטחון.</li>
          <li><strong>מיצוב מקצועי:</strong> הכתיבה ממצבת אותך כבעל/ת ידע ועומק בתחום.</li>
        </ul>
      </div>

      <p style="margin:0 0 6px;font-size:14.5px;">
        רוצה לכתוב אבל מתלבט/ת בנושא, או צריך/ה עזרה בניסוח? נשמח לעזור -
        <a href="${helpMailto}" style="color:#D49018;font-weight:bold;text-decoration:none;">כתבו לנו ונחזור אליך להתייעצות</a>.
      </p>

      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com | 055-993-1403<br/>
        בברכה,<br/>
        צוות טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;

  return { subject, html };
}
