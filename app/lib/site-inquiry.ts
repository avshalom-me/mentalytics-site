// פנייה שהגיעה אלינו דרך טופס באתר, ולא במייל ישיר.
//
// טופס "צור קשר" וטופס "בית למפתחים" שולחים אלינו מייל מהכתובת של האתר עצמו,
// עם Reply-To של הגולש. סוכן השירות מדלג על כל מייל מהדומיינים שלנו (התראות
// מערכת, והתשובות של עצמנו שחוזרות בשרשור), ולכן עד 5/10/2026 הפניות האלה לא
// הגיעו אליו בכלל: לא סווגו ולא נוסחה להן טיוטה. המקרה שחשף את זה: פנייה של
// מטפלת משלמת דרך "צור קשר" שחיכתה שבע שעות בלי שהופיעה בתור.
//
// הזיהוי נשען על שלושה דברים שהאתר עצמו קובע, ולכן הוא לא ניחוש: כתובת השולח
// שלנו, Reply-To של אדם מבחוץ, ותחילית הנושא של הטופס. התחיליות מוגדרות כאן
// ומשמשות גם את הטפסים עצמם, כך ששינוי בנושא המייל לא מנתק את הסוכן בשקט.
// כל מייל אחר מהכתובות שלנו (התראה, דוח, העתק של פנייה למטפל) נשאר בחוץ.
//
// נקי מתלויות שרת, כדי שהכללים ייבדקו ישירות (site-inquiry.test.ts).

export type SiteForm = "contact" | "developers";

/** תחילית הנושא של המייל שכל טופס שולח אלינו. */
export const SITE_FORM_SUBJECT_PREFIX: Record<SiteForm, string> = {
  contact: "פנייה חדשה מ-טיפול חכם:",
  developers: "פנייה חדשה לבית למפתחים:",
};

export const SITE_FORM_LABELS: Record<SiteForm, string> = {
  contact: 'טופס "צור קשר" באתר',
  developers: 'טופס "בית למפתחים" באתר',
};

/** הדומיינים שלנו: מייל מכתובת כזו אינו פנייה נכנסת, אלא אם הוא נושא פנייה של גולש. */
export const OUR_EMAIL_DOMAINS = ["getmentalytics.com", "mentalytics.co.il"];

export function isOurEmailAddress(email: string): boolean {
  const e = email.trim().toLowerCase();
  return OUR_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d}`));
}

const NO_SUBJECT = "ללא נושא";
// שורת הסיום של שני הטפסים ("נשלח מ-mentalytics..."). רק היא נחתכת: גולש
// שכתב "נשלח מ-iPhone" בסוף ההודעה שלו לא מאבד אותה.
const FOOTER = /\s*נשלח מ-mentalytics\S*\s*$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** נושא מייל הוא טקסט ולא HTML: בלי escape, ובלי שורות חדשות (הן חלק מתחביר הכותרת). */
function headerText(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

/**
 * המייל שטופס "צור קשר" שולח אלינו. חלק הטקסט נבנה כאן במפורש (ולא נגזר
 * אוטומטית מה-HTML) כדי שההודעה של הגולש תגיע לסוכן בדיוק כפי שנכתבה, עם
 * שבירות השורה שלה.
 */
export function buildContactFormEmail(p: { name: string; email: string; subject?: string | null; message: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = headerText(p.subject ?? "");
  const safeName = escapeHtml(p.name);
  const safeEmail = escapeHtml(p.email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(p.message);
  return {
    subject: `${SITE_FORM_SUBJECT_PREFIX.contact} ${subject || NO_SUBJECT}`,
    html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">פנייה חדשה מהאתר</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${safeName}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">מייל:</td><td style="padding: 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">נושא:</td><td style="padding: 8px;">${safeSubject || NO_SUBJECT}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>הודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">נשלח מ-mentalytics-site.vercel.app</p>
        </div>
      `,
    text: [
      "פנייה חדשה מהאתר",
      "",
      `שם: ${headerText(p.name)}`,
      `מייל: ${headerText(p.email)}`,
      `נושא: ${subject || NO_SUBJECT}`,
      "",
      "הודעה:",
      p.message.trim(),
      "",
      "נשלח מ-mentalytics-site.vercel.app",
    ].join("\n"),
  };
}

export type SiteInquiry = {
  form: SiteForm;
  /** הכתובת של הגולש (ה-Reply-To): לשם נשלחת התשובה. */
  email: string;
  name: string | null;
  /** הנושא שהגולש כתב, בלי התחילית שלנו. ריק אם לא כתב. */
  subject: string;
  message: string;
};

// הודעות ישנות נשלחו עם נושא שעבר escape של HTML, וגוף שחולץ מ-HTML משאיר
// &#39; במקום גרש. & אחרון, אחרת "&amp;lt;" היה נפתח פעמיים.
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (raw, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return raw;
      }
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tidy(s: string): string {
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validEmail(s: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);
}

/**
 * מפרק מייל שהאתר שלח אלינו בשם גולש. null = זו לא פנייה מטופס (ואז מייל
 * מהכתובות שלנו נשאר מחוץ לתור, כמו תמיד).
 *
 * bodyText הוא מה שחולץ מהמייל: חלק הטקסט שלו, או ה-HTML אחרי הסרת תגיות. שני
 * המבנים נראים שונה (שורה לכל שדה, או תא בשורה נפרדת), ולכן החילוץ נשען על
 * התוויות עצמן ולא על מספרי שורות.
 */
export function parseSiteInquiry(msg: {
  fromEmail: string;
  replyTo: string | null;
  subject: string;
  bodyText: string;
}): SiteInquiry | null {
  if (!isOurEmailAddress(msg.fromEmail)) return null;
  const email = (msg.replyTo ?? "").trim().toLowerCase();
  // Reply-To חיצוני הוא מה שמבדיל "גולש כתב לנו" מהתראה שהמערכת שלחה לעצמה.
  if (!validEmail(email) || isOurEmailAddress(email)) return null;

  const subjectLine = msg.subject.trim();
  const form = (Object.keys(SITE_FORM_SUBJECT_PREFIX) as SiteForm[]).find((f) =>
    subjectLine.startsWith(SITE_FORM_SUBJECT_PREFIX[f]),
  );
  if (!form) return null;
  const afterPrefix = decodeEntities(subjectLine.slice(SITE_FORM_SUBJECT_PREFIX[form].length)).trim();
  const body = decodeEntities(msg.bodyText.replace(/\r\n?/g, "\n")).replace(FOOTER, "");

  if (form === "developers") {
    // הטופס כולו רלוונטי (תפקיד, שלב הרעיון, קישור, תיאור), ולכן הוא נשאר
    // שלם, מהשדה הראשון. השם שבנושא הוא השם שהגולש מילא.
    const from = body.indexOf("שם:");
    const message = tidy(from >= 0 ? body.slice(from) : body);
    if (!message) return null;
    return { form, email, name: afterPrefix || null, subject: "", message };
  }

  const subject = afterPrefix === NO_SUBJECT ? "" : afterPrefix;
  // התווית "הודעה:" מחופשת אחרי שדה הנושא, ואחרי הנושא עצמו: נושא שמכיל את
  // המילים "הודעה:" לא חותך את ההודעה במקום הלא נכון.
  let searchFrom = 0;
  const subjectLabel = body.indexOf("נושא:");
  if (subjectLabel >= 0) {
    searchFrom = subjectLabel + "נושא:".length;
    const shown = subject || NO_SUBJECT;
    const at = body.indexOf(shown, searchFrom);
    if (at >= 0 && at - searchFrom < 40) searchFrom = at + shown.length;
  }
  const label = body.indexOf("הודעה:", searchFrom);
  const message = tidy(label >= 0 ? body.slice(label + "הודעה:".length) : body);
  if (!message) return null;

  const header = label >= 0 ? body.slice(0, label) : "";
  const nameMatch = header.match(/שם:\s*([\s\S]*?)\s*מייל:/);
  const name = nameMatch ? nameMatch[1].replace(/\s+/g, " ").trim().slice(0, 120) : "";
  return { form, email, name: name || null, subject, message };
}
