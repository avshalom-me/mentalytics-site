import "server-only";
import { Resend } from "resend";
import { logEmail } from "./email-log";
import { buildCenterProposalEmail } from "./center-proposal-email";
import { centerMonthlyPricing, ilCurrency } from "./center-pricing";

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
  return `${label} על חשבוננו - פרטי התשלום נשמרו והחיוב הראשון יתבצע רק ב-${when ?? "תום תקופת המתנה"}.`;
}

/**
 * מייל הצעה למרכז - נשלח מהאדמין ("שלח הצעה במייל"). מפרט את המסלולים,
 * המחיר החודשי, חודשי המתנה, וכפתור בולט לקישור ההצטרפות/תשלום. ה-HTML נבנה
 * במודול הבילדר הנקי (ניתן לתצוגה מקדימה), וכאן רק שולחים ורושמים ל-CRM.
 */
export async function sendCenterProposalEmail(opts: {
  to: string;
  centerName: string;
  contactName: string | null;
  billingTrack?: string | null;
  pricePerTherapist: number;
  therapistCount: number;
  fixedMonthlyPrice?: number | null;
  discountAmount?: number | null;
  numLocations?: number | null;
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
    billingTrack: opts.billingTrack,
    pricePerTherapist: opts.pricePerTherapist,
    therapistCount: opts.therapistCount,
    fixedMonthlyPrice: opts.fixedMonthlyPrice,
    discountAmount: opts.discountAmount,
    numLocations: opts.numLocations,
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
  billingTrack?: string | null;
  pricePerTherapist: number;
  therapistCount: number;
  fixedMonthlyPrice?: number | null;
  discountAmount?: number | null;
  numLocations?: number | null;
  giftMonths: number;
  billingStartsAt: string | null;
  token?: string | null; // קישור הקמה עצמית של חשבון הניהול (claim-by-token)
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendCenterWelcomeEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }

  const rawName = (opts.centerName || "המרכז").trim();
  const name = escapeHtml(rawName);
  const pr = centerMonthlyPricing({
    billing_track: opts.billingTrack,
    price_per_therapist: opts.pricePerTherapist,
    therapist_count: opts.therapistCount,
    fixed_monthly_price: opts.fixedMonthlyPrice,
    num_locations: opts.numLocations,
    discount_amount: opts.discountAmount,
  });
  const extra = [
    pr.numLocations > 1 ? `${pr.numLocations} מיקומים` : "",
    pr.discountAmount > 0 ? `כולל הנחה ₪${ilCurrency(pr.discountAmount)}` : "",
  ].filter(Boolean).join(" · ");
  const priceLine = opts.billingTrack === "center_entity"
    ? `מנוי חודשי - מרכז טיפולי · ₪${ilCurrency(pr.monthlyTotal)} + מע"מ לחודש${extra ? ` (${extra})` : ""}`
    : `${pr.therapistCount} מטפלים · ₪${ilCurrency(pr.monthlyTotal)} + מע"מ לחודש${extra ? ` (${extra})` : ""}`;
  // עם טוקן - קישור ההקמה העצמית (נרשמים ומקושרים למרכז אוטומטית);
  // בלעדיו - עמוד ההרשמה הרגיל (מרכזים ותיקים שקושרו ידנית).
  const portalUrl = opts.token
    ? `${SITE_URL}/centers/join/${opts.token}`
    : `${SITE_URL}/centers/login?mode=register`;
  const to = escapeHtml(opts.to);
  // נושא = טקסט רגיל, בלי HTML entities.
  const subject = `ברוכים הבאים לטיפול חכם - ${rawName} 🎉`;

  // התוכן חייב לתאום את המסלול שנרכש: במסלול 2 אין פרופיל לכל מטפל, והצעד
  // הראשון הוא סימון סוגי הטיפול (בלעדיו המרכז לא ייתפס באף שאלון).
  const isEntityWelcome = opts.billingTrack === "center_entity";
  const welcomeIntro = isEntityWelcome
    ? "המנוי של המרכז לטיפול חכם פעיל. המרכז ייכנס למערכת ההתאמות כרובריקה אחת - \"מרכז טיפולי\" - ומטופלים מתאימים יופנו אליכם לפי סוגי הטיפול, האזורים, הגילאים והשפות שתסמנו. האינטייק והשיבוץ למטפל/ת המתאים/ה נעשים אצלכם."
    : "המנוי של המרכז לטיפול חכם פעיל. מטפלי המרכז ייכנסו למערכת ההתאמות החכמה, ומטופלים יופנו אליהם לפי סוג הטיפול, אזור, גיל, שפה והעדפות.";
  const nextStepParagraph = isEntityWelcome
    ? `בקישור למטה תקימו את חשבון הניהול בדקה (מייל + סיסמה, מומלץ עם ${to}). <strong>הצעד החשוב ביותר: סימון סוגי הטיפול של המרכז</strong> - בלעדיו המרכז לא יופיע בהתאמות. אחר כך אפשר למלא לוגו, צוות ותמונות לעמוד הציבורי, ולראות סטטיסטיקות: כמה ראו אתכם, מאיפה הם מגיעים ועם אילו קשיים.`
    : `בקישור למטה תקימו את חשבון הניהול בדקה (מייל + סיסמה, מומלץ עם ${to}). משם תוכלו להזמין את מטפלי המרכז במייל - כל אחד/ת ממלא/ת פרופיל בעצמו/ה - למלא את עמוד המרכז הציבורי (לוגו, צוות, תמונות), ולראות סטטיסטיקות מרוכזות: כמה אנשים ראו אתכם, מאיפה הם מגיעים ועם אילו קשיים.`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:22px;margin:0 0 16px;">ברוכים הבאים, ${name} 🎉</h1>
      <p style="margin:0 0 14px;">${welcomeIntro}</p>
      <div style="background:#F0F7FA;border:1px solid #D8E4E8;border-radius:10px;padding:14px 16px;margin:0 0 18px;">
        <p style="margin:0 0 6px;font-weight:bold;">${priceLine}</p>
        <p style="margin:0;font-size:13px;color:#3E5250;">${giftLine(opts.giftMonths, opts.billingStartsAt)}</p>
      </div>
      <p style="margin:0 0 10px;font-weight:bold;">${isEntityWelcome ? "הצעד הראשון - פרופיל המרכז" : "פורטל ניהול המרכז"}</p>
      <p style="margin:0 0 16px;">${nextStepParagraph}</p>
      <p style="margin:0 0 16px;">
        <a href="${portalUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">הקמת חשבון הניהול ומילוי הפרופיל</a>
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#3E5250;">צריכים עזרה במילוי? אנחנו כאן - admin@getmentalytics.com</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה אנחנו כאן: admin@getmentalytics.com<br/>
        צוות טיפול חכם - Mentalytics
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

/**
 * מייל הזמנה למטפל/ת של מרכז (מסלול 1) - קישור אישי למילוי הפרופיל.
 * הפרופיל שנוצר שייך למרכז; למטפל אין חשבון, רק הקישור החד-פעמי.
 */
export async function sendCenterTherapistInviteEmail(opts: {
  to: string;
  centerName: string;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("sendCenterTherapistInviteEmail: RESEND_API_KEY not configured, skipping");
    return { ok: false, error: "resend not configured" };
  }
  const name = escapeHtml((opts.centerName || "המרכז").trim());
  const fillUrl = `${SITE_URL}/centers/fill/${opts.token}`;
  const subject = `${(opts.centerName || "המרכז").trim()} מזמין אותך למלא פרופיל בטיפול חכם`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 14px;">שלום! ${name} הצטרף לטיפול חכם 🎉</h1>
      <p style="margin:0 0 12px;">המרכז שבו את/ה עובד/ת הצטרף לפלטפורמת ההתאמות של טיפול חכם, ומזמין אותך למלא פרופיל מקצועי. מטופלים מתאימים יופנו אליך דרך המרכז לפי תחומי הטיפול, האזור, הגיל והשפה.</p>
      <p style="margin:0 0 16px;">המילוי אורך כ-5 דקות - תחומי טיפול, אזורים, כמה מילים עליך ותמונה:</p>
      <p style="margin:0 0 16px;">
        <a href="${fillUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">מילוי הפרופיל שלי</a>
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#3E5250;">הקישור אישי - אין להעביר אותו הלאה. הפרופיל יעלה לאוויר אחרי אישור קצר של צוות טיפול חכם.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        שאלות? admin@getmentalytics.com<br/>
        צוות טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resendClient.emails.send({ from: FROM, to: opts.to, subject, html });
    void logEmail({
      recipient: opts.to,
      recipientType: "therapist",
      subject,
      template: "center_therapist_invite",
      sentBy: "system",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    if (error) {
      console.error("sendCenterTherapistInviteEmail: resend error:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("sendCenterTherapistInviteEmail: throw:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * תזכורת שלמות פרופיל - נשלחת פעם אחת למרכז פעיל שבוע+ אחרי התשלום כשהפרופיל
 * הציבורי עדיין חסר. מפרטת בדיוק מה חסר ומקשרת להקמה/עריכה.
 */
/**
 * שולח את טיוטת הנדנוד שהסוכן ניסח ושאישרת באדמין. הטיוטה היא טקסט
 * רגיל, ונעטפת כאן בתבנית הבית - בדיוק כמו הצעת המתנה למטפלים.
 */
export async function sendCenterNudgeEmail(opts: {
  to: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "resend not configured" };
  if (!opts.message?.trim()) return { ok: false, error: "גוף המייל ריק" };

  // הטיוטה כוללת פנייה וחתימה, ולכן היא נכנסת כגוש אחד ולא נעטפת שוב.
  const safeMessage = escapeHtml(opts.message.trim());
  const subject = opts.subject?.trim() || "השלמת פרטי המרכז - טיפול חכם";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <div style="white-space:pre-line;font-size:15px;color:#1a4a5c;">${safeMessage}</div>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;text-align:center;">
        אפשר להשיב ישירות למייל הזה | admin@getmentalytics.com | 055-993-1403<br/>
        טיפול חכם - Mentalytics
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
      template: "center_readiness_nudge",
      sentBy: "admin",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    return error ? { ok: false, error: String(error) } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/** @deprecated הוחלף בטיוטה שהסוכן מנסח + sendCenterNudgeEmail. */
export async function sendCenterCompletenessNudgeEmail(opts: {
  to: string;
  centerName: string;
  pct: number;
  missing: string[];
  token?: string | null;   // בלי חשבון מקושר - קישור ההקמה; אחרת הפורטל
  hasAccount: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "resend not configured" };
  const name = escapeHtml((opts.centerName || "המרכז").trim());
  const url = opts.hasAccount || !opts.token
    ? `${SITE_URL}/centers/dashboard/profile`
    : `${SITE_URL}/centers/join/${opts.token}`;
  const subject = `הפרופיל של ${(opts.centerName || "המרכז").trim()} מלא ב-${opts.pct}% - הנה מה שחסר`;
  const missingHtml = opts.missing.slice(0, 10).map((m) => `<li style="margin-bottom:6px;">${escapeHtml(m)}</li>`).join("");

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 14px;">הפרופיל של ${name} כמעט מוכן</h1>
      <p style="margin:0 0 14px;">העמוד הציבורי שלכם הוא מה שמטופלים רואים רגע לפני שהם פונים - פרופיל מלא מעורר אמון ומקבל יותר פניות. כרגע הוא מלא ב-<strong>${opts.pct}%</strong>. מה שחסר:</p>
      <ul style="margin:0 0 18px;padding-right:20px;font-size:14px;">
        ${missingHtml}
      </ul>
      <p style="margin:0 0 16px;">
        <a href="${url}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">השלמת הפרופיל (כ-10 דקות)</a>
      </p>
      <p style="margin:0;font-size:13px;color:#3E5250;">צריכים עזרה? השיבו למייל הזה או כתבו ל-admin@getmentalytics.com</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">צוות טיפול חכם - Mentalytics</p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resendClient.emails.send({ from: FROM, to: opts.to, subject, html });
    void logEmail({
      recipient: opts.to, recipientType: "organization", subject,
      template: "center_completeness_nudge", sentBy: "system",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    return error ? { ok: false, error: String(error) } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * תזכורת למטפל/ת שקיבל/ה הזמנת-מילוי מהמרכז ולא השלים/ה - נשלחת פעם אחת.
 */
export async function sendCenterInviteReminderEmail(opts: {
  to: string;
  centerName: string;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "resend not configured" };
  const name = escapeHtml((opts.centerName || "המרכז").trim());
  const fillUrl = `${SITE_URL}/centers/fill/${opts.token}`;
  const subject = `תזכורת: הפרופיל שלך ב${(opts.centerName || "המרכז").trim()} מחכה למילוי`;

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:12px;padding:28px;line-height:1.6;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <h1 style="color:#0F5468;font-size:20px;margin:0 0 14px;">תזכורת קטנה 👋</h1>
      <p style="margin:0 0 14px;">${name} הזמין אותך למלא פרופיל מקצועי בטיפול חכם, ועדיין לא השלמת אותו. ברגע שתמלא/י - מטופלים מתאימים יוכלו להגיע אליך דרך מערכת ההתאמות.</p>
      <p style="margin:0 0 16px;">זה לוקח כ-5 דקות:</p>
      <p style="margin:0 0 16px;">
        <a href="${fillUrl}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">מילוי הפרופיל שלי</a>
      </p>
      <p style="margin:0;font-size:13px;color:#3E5250;">אם זו טעות או שאינך חלק מהמרכז - אפשר להתעלם מהמייל.</p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">צוות טיפול חכם - Mentalytics</p>
    </div>
  </body>
</html>`;

  try {
    const { error } = await resendClient.emails.send({ from: FROM, to: opts.to, subject, html });
    void logEmail({
      recipient: opts.to, recipientType: "therapist", subject,
      template: "center_invite_reminder", sentBy: "system",
      status: error ? "failed" : "sent",
      error: error ? String(error.message ?? error) : undefined,
    });
    return error ? { ok: false, error: String(error) } : { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
