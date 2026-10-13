import { monthsLabel } from "./retention-gift-rules";

// שני המיילים של "הארכה במתנה - שימור". טהור ואיזומורפי: אותו בילדר מייצר את
// המייל בשרת ואת התצוגה המקדימה בחלון האדמין, כך שמה שהאדמין רואה לפני
// השליחה הוא מה שהלקוח מקבל.
//
// הטון עובדתי (החלטת הבעלים: בלי ניסוחים שיווקיים למטפלים, ובלי נתוני
// ביצועים): מה קיבלת, מתי החיוב חוזר, כמה, ואיך מפסיקים. שני המיילים מבטיחים
// דברים שהקוד מקיים - מייל המתנה מבטיח את מייל התזכורת, ומייל התזכורת נוקב
// בתאריך ובסכום שההוראה ב-Sumit באמת תחייב - ולכן שינוי בנוסח הוא שינוי
// בהבטחה, ועובר קודם אישור של הבעלים. הנוסח נעול ב-retention-gift-emails.test.ts.

export const RETENTION_GIFT_GRANTED_TEMPLATE = "retention_gift_granted";
export const RETENTION_GIFT_ENDING_TEMPLATE = "retention_gift_ending";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

export type RetentionGiftMail = { subject: string; html: string; text: string };

export type RetentionGiftMailInput = {
  name: string;
  months: number;
  /** היום שבו החיוב חוזר, YYYY-MM-DD. */
  chargeDate: string;
  /** המחיר החודשי לפני מע"מ, כפי שמופיע בכל מקום אחר מול המטפל. */
  amount: number;
};

export function hebDay(day: string): string {
  // צהריים ב-UTC: התאריך לא זז יום אחורה או קדימה בשום אזור זמן.
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(name: string, bodyHtml: string): string {
  return `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 16px;">שלום ${escapeHtml(name)},</h1>
      ${bodyHtml}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;
}

const p = (text: string) => `<p style="margin:0 0 16px;font-size:15px;">${text}</p>`;
const box = (lines: string[]) =>
  `<div style="background:#EAF4F3;border:1px solid #C2DFDE;border-radius:12px;padding:18px 20px;margin:0 0 22px;">${lines
    .map((l, i) => `<p style="margin:0${i < lines.length - 1 ? " 0 6px" : ""};font-size:15px;">${l}</p>`)
    .join("")}</div>`;

/** מייל 1: נשלח ברגע שהמתנה ניתנת (מהאדמין, בלחיצה). */
export function buildRetentionGiftGrantedEmail(input: RetentionGiftMailInput): RetentionGiftMail {
  const name = input.name.trim() || "מטפל/ת יקר/ה";
  const span = monthsLabel(input.months);
  const when = hebDay(input.chargeDate);
  const price = `${input.amount} ש"ח + מע"מ לחודש`;

  const lines = {
    open: `קיבלת מאיתנו ${span} של קידום במתנה.`,
    promo: "הקידום שלך באתר ממשיך כרגיל, בלי שום שינוי.",
    noCharge: `בתקופת המתנה הכרטיס שלך לא יחויב.`,
    resume: `החיוב הבא: ${when}`,
    amount: `הסכום: ${price}, כמו קודם.`,
    reminder: "שבוע לפני סיום המתנה נשלח אליך מייל תזכורת.",
    noAction: "אין צורך לעשות דבר.",
    sign: "צוות טיפול חכם",
  };

  const html = shell(
    name,
    [
      p(`<strong>${lines.open}</strong>`),
      p(`${lines.promo} ${lines.noCharge}`),
      box([`<strong>${lines.resume}</strong>`, lines.amount]),
      p(lines.reminder),
      p(lines.noAction),
      p(lines.sign),
    ].join("\n      ")
  );
  const text = [
    `שלום ${name},`,
    "",
    lines.open,
    "",
    `${lines.promo} ${lines.noCharge}`,
    "",
    lines.resume,
    lines.amount,
    "",
    lines.reminder,
    lines.noAction,
    "",
    lines.sign,
  ].join("\n");

  return { subject: `קיבלת ${span} של קידום במתנה - טיפול חכם`, html, text };
}

/** מייל 2: יוצא לבד, כשבוע לפני שהחיוב חוזר (קרון). */
export function buildRetentionGiftEndingEmail(input: RetentionGiftMailInput): RetentionGiftMail {
  const name = input.name.trim() || "מטפל/ת יקר/ה";
  const span = monthsLabel(input.months);
  const when = hebDay(input.chargeDate);
  const price = `${input.amount} ש"ח + מע"מ לחודש, כל חודש.`;

  const lines = {
    open: `קיבלת מאיתנו ${span} של קידום במתנה, והתחייבנו לעדכן אותך שבוע לפני שהמתנה מסתיימת. זה המייל הזה.`,
    resume: `החיוב חוזר: ${when}`,
    amount: `הסכום: ${price}`,
    stay: "אם תרצה/י להמשיך - אין צורך לעשות דבר, והקידום פשוט ממשיך.",
    stopLead: "אם תרצה/י להפסיק",
    stopRest: ` - מספיק להשיב למייל הזה עד ${when} ונבטל מיד, בלי חיוב.`,
    sign: "צוות טיפול חכם",
  };

  const html = shell(
    name,
    [
      p(lines.open),
      box([`<strong>${lines.resume}</strong>`, lines.amount]),
      p(lines.stay),
      p(`<strong>${lines.stopLead}</strong>${lines.stopRest}`),
      p(lines.sign),
    ].join("\n      ")
  );
  const text = [
    `שלום ${name},`,
    "",
    lines.open,
    "",
    lines.resume,
    lines.amount,
    "",
    lines.stay,
    `${lines.stopLead}${lines.stopRest}`,
    "",
    lines.sign,
  ].join("\n");

  return { subject: `המתנה שלך מסתיימת ב-${when} - טיפול חכם`, html, text };
}
