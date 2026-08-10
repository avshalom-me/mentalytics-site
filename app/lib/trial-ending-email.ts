import "server-only";
import { Resend } from "resend";
import {
  TRIAL_UPGRADE_PRICE, TRIAL_UPGRADE_MONTHS, TRIAL_UPGRADE_TOTAL,
  SUBSCRIPTION_REGULAR_PRICE, SUBSCRIPTION_REGULAR_TOTAL,
} from "./promo";

// מייל סיום תקופת המתנה: סיכום *כל התקופה* (לא 30 יום), השוואה לממוצע
// החינמי, והצעת שדרוג אישית.
//
// שלוש גרסאות לפי הביצועים בפועל - הסיבה: 9 מתוך 25 המקודמים במתנה קיבלו
// אפס פניות בכל התקופה. מייל "תראה כמה הרווחת, בוא תשלם" למי שקיבל אפס
// מזכיר לו בדיוק ברגע ההחלטה שהמוצר לא עבד עבורו. לכן:
//   strong (>=3 פניות) - דחיפה למכירה עם המספרים במרכז
//   soft   (1-2 פניות) - דגש על צפיות ועל מה שכבר קורה, מכירה רכה
//   zero   (0 פניות)   - *לא נשלח למטפל/ת כלל*; במקומו התראה לאדמין
//                        (ראו runTrialEndingNotices ב-cron)

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "טיפול חכם <noreply@mentalytics.co.il>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

export type TrialEndingVariant = "strong" | "soft" | "zero";

export type TrialStats = {
  days: number;          // אורך תקופת המתנה עד היום
  views: number;         // צפיות בפרופיל בכל התקופה
  contacts: number;      // פניות בכל התקופה (כולל הודעות מהאתר)
  freeAvgViews: number;  // ממוצע צפיות למטפל חינמי, מנורמל לאותה תקופה
  freeAvgContacts: number;
};

export function trialEndingVariant(contacts: number): TrialEndingVariant {
  if (contacts >= 3) return "strong";
  if (contacts >= 1) return "soft";
  return "zero";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "פי 3.2" / "יותר מ" - ניסוח זהיר שלא ממציא כפולות כשהמכנה אפס. */
function multiplierText(mine: number, theirs: number): string | null {
  if (mine <= 0) return null;
  if (theirs <= 0) return null;
  const x = mine / theirs;
  if (x < 1.3) return null; // לא מספיק מרשים כדי להתהדר בו
  return `פי ${x >= 10 ? Math.round(x) : x.toFixed(1)}`;
}

function statsTable(s: TrialStats): string {
  const cell = "padding:12px 16px;border:1px solid #e8e0d8;text-align:center;";
  const label = "padding:8px 16px;border:1px solid #e8e0d8;text-align:center;font-size:12px;color:#888;";
  return `
    <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
      <tr style="background:white;">
        <td style="${cell}font-weight:bold;font-size:20px;color:#0F5468;">${s.views}</td>
        <td style="${cell}font-weight:bold;font-size:20px;color:#0F5468;">${s.contacts}</td>
        <td style="${cell}font-weight:bold;font-size:20px;color:#888;">${s.freeAvgViews}</td>
        <td style="${cell}font-weight:bold;font-size:20px;color:#888;">${s.freeAvgContacts}</td>
      </tr>
      <tr>
        <td style="${label}">הצפיות שלך</td>
        <td style="${label}">הפניות שלך</td>
        <td style="${label}">ממוצע מטפל חינמי</td>
        <td style="${label}">ממוצע פניות חינמי</td>
      </tr>
    </table>
    <p style="margin:0 0 20px;font-size:12px;color:#888;">
      הנתונים לכל תקופת הקידום (${s.days} ימים). הממוצע החינמי מחושב לאותו פרק זמן.
    </p>`;
}

function offerBox(): string {
  return `
    <div style="background:#FDF6E3;border:1px solid #E9D6A6;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
      <p style="margin:0 0 8px;font-size:16px;font-weight:900;color:#A87010;">
        להמשיך? ${TRIAL_UPGRADE_MONTHS} החודשים הראשונים ב-₪${TRIAL_UPGRADE_PRICE} + מע&quot;מ
      </p>
      <p style="margin:0;font-size:13.5px;line-height:1.7;color:#7a5a10;">
        ₪${TRIAL_UPGRADE_TOTAL} לחודש כולל מע&quot;מ, ואחריהם המחיר הרגיל -
        ₪${SUBSCRIPTION_REGULAR_PRICE} + מע&quot;מ (₪${SUBSCRIPTION_REGULAR_TOTAL}).
        <strong>אפשר לצאת בכל שלב, בלי התחייבות.</strong>
      </p>
    </div>`;
}

function shell(name: string, inner: string): string {
  const checkoutUrl = `${SITE_URL}/therapists/checkout`;
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${escapeHtml(name || "מטפל/ת יקר/ה")},</h1>
      ${inner}
      <p style="margin:0 0 8px;text-align:center;">
        <a href="${checkoutUrl}" style="display:inline-block;background-image:linear-gradient(135deg,#0F5468,#1A7A96);background-color:#0F5468;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 32px;border-radius:50px;">
          המשך הקידום ←
        </a>
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;
}

export function buildTrialEndingEmail(opts: {
  name: string;
  stats: TrialStats;
  daysLeft: number;
  isReminder: boolean;
}): { subject: string; html: string } | null {
  const { name, stats, daysLeft, isReminder } = opts;
  const variant = trialEndingVariant(stats.contacts);
  if (variant === "zero") return null; // לא שולחים מייל מכירה למי שלא קיבל כלום

  const endsText = daysLeft <= 1 ? "מסתיימת מחר" : `מסתיימת בעוד ${daysLeft} ימים`;
  const viewsX = multiplierText(stats.views, stats.freeAvgViews);
  const contactsX = multiplierText(stats.contacts, stats.freeAvgContacts);

  let opening: string;
  let subject: string;

  if (variant === "strong") {
    subject = isReminder
      ? `תזכורת: תקופת הקידום שלך מסתיימת מחר`
      : `${stats.contacts} פניות הגיעו אליך בתקופת הקידום`;
    opening = `
      <p style="margin:0 0 16px;">
        תקופת הקידום שלך באתר <strong>${endsText}</strong>, וזה סיכום כל התקופה:
      </p>
      ${statsTable(stats)}
      <p style="margin:0 0 20px;">
        ${contactsX
          ? `זה <strong>${contactsX}</strong> יותר פניות מהממוצע של מטפל/ת ללא קידום.`
          : `הפרופיל שלך קיבל חשיפה משמעותית מעל מטפל/ת ללא קידום.`}
        ${viewsX ? ` בצפיות - <strong>${viewsX}</strong> יותר.` : ""}
        בלי הקידום, הפרופיל יורד למאגר הכללי ולא יופיע בתוצאות ההתאמה.
      </p>`;
  } else {
    subject = isReminder
      ? `תזכורת: תקופת הקידום שלך מסתיימת מחר`
      : `סיכום תקופת הקידום שלך - ${stats.views} צפיות בפרופיל`;
    opening = `
      <p style="margin:0 0 16px;">
        תקופת הקידום שלך באתר <strong>${endsText}</strong>, וזה סיכום כל התקופה:
      </p>
      ${statsTable(stats)}
      <p style="margin:0 0 20px;">
        ${viewsX
          ? `הפרופיל שלך נצפה <strong>${viewsX}</strong> יותר ממטפל/ת ללא קידום`
          : `הפרופיל שלך נצפה יותר ממטפל/ת ללא קידום`},
        והתחילו להגיע פניות. מטופלים לרוב משווים כמה פרופילים לפני שפונים, ולכן
        רוב הפניות מגיעות דווקא בהמשך התקופה. בלי הקידום הפרופיל יורד למאגר
        הכללי ולא יופיע בתוצאות ההתאמה.
      </p>`;
  }

  return { subject, html: shell(name, opening + offerBox()) };
}

export async function sendTrialEndingEmail(opts: {
  to: string;
  name: string;
  stats: TrialStats;
  daysLeft: number;
  isReminder: boolean;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const built = buildTrialEndingEmail(opts);
  if (!built) return { ok: false, skipped: true }; // גרסת zero - לא נשלח
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "resend not configured" };
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: built.subject,
      html: built.html,
    });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
