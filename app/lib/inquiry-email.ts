// תבנית המייל של פניית מטופל שנשלחה דרך האתר. פונקציה טהורה (בלי Resend
// ובלי מסד נתונים), כדי שאפשר יהיה לבדוק את הנוסח בלי לשלוח מייל אמיתי.
//
// שלושה קוראים שונים, ולכל אחד נוסח משלו:
//   therapist            - התיבה הפרטית של המטפל/ת. "פנייה אליך".
//   center_for_therapist - תיבת המרכז, והפונה בחר/ה מטפל/ת מסוים/ת מהצוות.
//                          עד 15/9/26 המייל הזה אמר "פנייה חדשה אליך" ולא נקב
//                          בשם, כך שמרכז עם 8 מטפלים (אף אחד בלי מייל משלו)
//                          לא יכול היה לדעת את מי הפונה בחר/ה.
//   center               - ישות-מרכז (מסלול 2): הפנייה היא למרכז עצמו.

export type InquiryAudience = "therapist" | "center_for_therapist" | "center";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function buildInquiryEmail(p: {
  audience: InquiryAudience;
  /** המטפל/ת שהפונה בחר/ה, או שם המרכז כשהנמען הוא הישות. */
  recipientName: string;
  senderName: string;
  senderContact: string;
  message: string;
}): { subject: string; html: string } {
  // שורת הנושא היא טקסט ולא HTML: בלי escape (אחרת "&amp;" מופיע כפשוטו),
  // אבל בלי שורות חדשות, שבכותרת מייל הן חלק מהתחביר.
  const plainName = p.recipientName.replace(/[\r\n]+/g, " ").trim();
  const name = escapeHtml(plainName);
  const sender = escapeHtml(p.senderName);
  const contact = escapeHtml(p.senderContact);
  const message = escapeHtml(p.message);
  // גם בתוך href עוברים דרך escape: בדיקת המייל מתירה גרשיים, ובלי זה כתובת
  // כמו a"x@b.co הייתה שוברת את התכונה.
  const replyHref = isEmail(p.senderContact) ? `mailto:${contact}` : `tel:${contact}`;

  const copy = {
    therapist: {
      subject: "פנייה חדשה ממטופל/ת דרך אתר טיפול חכם",
      heading: "פנייה חדשה אליך דרך אתר טיפול חכם",
      intro: "קיבלת פנייה ממטופל/ת פוטנציאלי/ת. מומלץ להגיב מהר ככל האפשר.",
    },
    center_for_therapist: {
      subject: `פנייה חדשה ל${plainName} דרך אתר טיפול חכם`,
      heading: "פנייה חדשה למטפל/ת מהצוות שלכם",
      intro: `הפונה בחר/ה ב${name} מתוך הצוות שלכם באתר. כדאי להעביר את הפנייה אליו/אליה, או לחזור לפונה ישירות.`,
    },
    center: {
      subject: "פנייה חדשה למרכז דרך אתר טיפול חכם",
      heading: "פנייה חדשה אליכם דרך אתר טיפול חכם",
      intro: "קיבלתם פנייה ממטופל/ת פוטנציאלי/ת. מומלץ להגיב מהר ככל האפשר.",
    },
  }[p.audience];

  // שם המטפל/ת בראש המייל, לפני כל פרט אחר - זה מה שהמרכז צריך כדי לנתב.
  const forTherapist = p.audience === "center_for_therapist"
    ? `<div style="margin-top: 14px; padding: 14px 16px; background: #EAF4F3; border: 1px solid #C2DFDE; border-radius: 8px; font-size: 16px;">
            הפנייה מיועדת ל: <strong style="color: #2A6462;">${name}</strong>
          </div>`
    : "";

  const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">${copy.heading}</h2>
          ${forTherapist}
          <p style="color:#555;">${copy.intro}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top:16px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${sender}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">פרטי קשר:</td><td style="padding: 8px;"><a href="${replyHref}">${contact}</a></td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>ההודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 24px; font-size: 13px; color: #555;">
            כדי להשיב - לחצו על פרטי הקשר למעלה, או השיבו ישירות למייל זה (אם נשלח ממייל).
          </p>
          <p style="margin-top: 8px; font-size: 12px; color: #999;">פנייה זו נשלחה דרך טיפול חכם - mentalytics.co.il</p>
        </div>
      `;

  return { subject: copy.subject, html };
}
