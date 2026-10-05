// שני המיילים שיוצאים למרכז על שינוי במנוי שלו: עצירת הוראת הקבע, וקידום מתנה.
//
// הנוסח אושר ע"י הבעלים ב-5/10/2026, מילה במילה. לא "לשפר" אותו ולא להוסיף
// פסקאות: כל שינוי בטקסט שמרכז מקבל עובר קודם אישור. מה שנקבע באישור:
//   - מייל העצירה מדבר על הוראת הקבע ועל הכרטיס. הוא נשלח רק כשנעצר מנוי
//     בתשלום. לסיום של קידום מתנה אין נוסח מאושר, ולכן לא נשלח שם מייל.
//   - מייל המתנה מדבר על המתנה בלבד. הוא לא מזכיר הוראת קבע ולא כרטיס, גם
//     כשהמתנה ניתנת למרכז משלם ("זה כבר נאמר בביטול").
//
// שום מייל כאן לא יוצא לבד: האדמין מסמן אותו בחלון העצירה או בחלון המתנה,
// ורואה שם את הכתובת ואת המייל עצמו לפני הלחיצה.
//
// נקי מתלויות שרת (גם client), כדי שהחלון יציג בדיוק את מה שיישלח: אותו
// בילדר בונה את התצוגה המקדימה ואת המייל. השליחה והרישום ב-center-emails.ts.

const DEFAULT_SITE_URL = "https://www.mentalytics.co.il";

/** כתובת האתר בקישורים שבמייל. זהה בשרת ובדפדפן (NEXT_PUBLIC נצרב בבנייה). */
export const CENTER_NOTICE_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");

/** שמות התבניות ביומן המיילים (crm_email_log.template). */
export const CENTER_STOP_EMAIL_TEMPLATE = "center_subscription_stopped";
export const CENTER_GIFT_EMAIL_TEMPLATE = "center_gift_granted";

// ── למי שולחים ────────────────────────────────────────────────────────────

/**
 * הכתובות שמרכז יכול לקבל אליהן מייל: של איש הקשר (מההצעה), ושל החשבוניות
 * (מה שהוזן בדף התשלום). אצל חלק מהמרכזים אלה שתי כתובות שונות, ולכן החלון
 * מציג את שתיהן והאדמין בוחר. אותה כתובת בשני השדות מופיעה פעם אחת.
 */
export type CenterNoticeAddress = { address: string; role: "contact" | "billing" };

export const CENTER_NOTICE_ROLE_LABELS: Record<CenterNoticeAddress["role"], string> = {
  contact: "איש הקשר",
  billing: "כתובת החשבוניות",
};

export function centerNoticeAddresses(c: { email?: string | null; payer_email?: string | null }): CenterNoticeAddress[] {
  const out: CenterNoticeAddress[] = [];
  const add = (raw: string | null | undefined, role: CenterNoticeAddress["role"]) => {
    const address = (raw ?? "").trim();
    if (!address.includes("@")) return;
    if (out.some((a) => a.address.toLowerCase() === address.toLowerCase())) return;
    out.push({ address, role });
  };
  add(c.email, "contact");
  add(c.payer_email, "billing");
  return out;
}

/**
 * מאמת את הכתובות שהאדמין סימן מול הכתובות של המרכז. מחזיר אותן כפי שהן
 * שמורות אצלנו, או null אם אחת מהן אינה של המרכז - מייל על מנוי לא נשלח
 * לכתובת שלא רשומה על המרכז, גם לא בגלל לשונית ישנה או שגיאת הקלדה.
 */
export function pickCenterNoticeAddresses(
  c: { email?: string | null; payer_email?: string | null },
  requested: unknown,
): string[] | null {
  if (!Array.isArray(requested) || requested.length === 0) return null;
  const known = centerNoticeAddresses(c);
  const picked: string[] = [];
  for (const r of requested) {
    if (typeof r !== "string") return null;
    const match = known.find((a) => a.address.toLowerCase() === r.trim().toLowerCase());
    if (!match) return null;
    if (!picked.includes(match.address)) picked.push(match.address);
  }
  return picked;
}

// ── בניית המייל ───────────────────────────────────────────────────────────

type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "button"; label: string; url: string };

export type CenterNoticeEmail = { subject: string; html: string; text: string };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** תאריך כפי שהמרכז רואה אותו באתר: לפי שעון ישראל, לא לפי שעון השרת. */
export function centerNoticeDate(when: Date | string): string {
  const d = typeof when === "string" ? new Date(when) : when;
  return d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
}

// "לשם" צמוד בעברית, ומקף כשהשם מתחיל באות לועזית או בספרה ("ל-ABC").
function toName(name: string): string {
  return /^[א-ת]/.test(name) ? `ל${name}` : `ל-${name}`;
}

function centerName(raw: string | null | undefined): string {
  return (raw ?? "").trim() || "המרכז";
}

function render(greetName: string, blocks: Block[], siteUrl: string): { html: string; text: string } {
  const body = blocks
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 14px;font-size:15px;">${escapeHtml(b.text)}</p>`;
      if (b.kind === "list") {
        // טבלה ולא <ul>: ריווח של רשימה ב-RTL נשבר ב-Outlook, ותא לכל תבליט
        // נראה אותו דבר בכל תוכנת דואר בלי שום מאפיין של צד.
        const cell = "vertical-align:top;padding:0 0 8px;text-align:right;";
        const rows = b.items
          .map((i) => `<tr><td style="${cell}width:18px;">•</td><td style="${cell}">${escapeHtml(i)}</td></tr>`)
          .join("");
        return `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px;font-family:'Heebo',Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a4a5c;">${rows}</table>`;
      }
      return `<p style="margin:0 0 16px;"><a href="${escapeHtml(b.url)}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:50px;">${escapeHtml(b.label)}</a></p>`;
    })
    .join("\n      ");

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${siteUrl}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>
      <p style="margin:0 0 14px;font-size:15px;">שלום ${escapeHtml(greetName)},</p>
      ${body}
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:13px;color:#3E5250;">
        לכל שאלה: admin@getmentalytics.com<br/>
        צוות טיפול חכם
      </p>
    </div>
  </body>
</html>`;

  const text = [
    `שלום ${greetName},`,
    ...blocks.map((b) =>
      b.kind === "p" ? b.text : b.kind === "list" ? b.items.map((i) => `- ${i}`).join("\n") : `${b.label}: ${b.url}`,
    ),
    "לכל שאלה: admin@getmentalytics.com\nצוות טיפול חכם",
  ].join("\n\n");

  return { html, text };
}

/**
 * מייל 1: המנוי בתשלום נעצר - הוראת הקבע בוטלה, המרכז ירד מהאתר, והכול שמור.
 * רק למרכז שהיה במנוי בתשלום: הטקסט מדבר על הוראת קבע ועל כרטיס שמור.
 */
export function buildCenterStopEmail(opts: {
  centerName: string;
  contactName?: string | null;
  billingTrack?: string | null;
  /** מרכז שמעולם לא הקים חשבון ניהול אינו "ממשיך להיכנס לפורטל". */
  hasPortalAccount: boolean;
  stoppedAt?: Date | string;
  siteUrl?: string;
}): CenterNoticeEmail {
  const name = centerName(opts.centerName);
  const isEntity = opts.billingTrack === "center_entity";
  const saved = isEntity ? "עמוד המרכז והנתונים שמורים" : "הפרופילים, עמוד המרכז והנתונים שמורים";
  const blocks: Block[] = [
    { kind: "p", text: `המנוי של ${name} בטיפול חכם נעצר היום, ${centerNoticeDate(opts.stoppedAt ?? new Date())}.` },
    {
      kind: "list",
      items: [
        "הוראת הקבע בוטלה, וכרטיס האשראי לא יחויב.",
        isEntity
          ? "המרכז והעמוד שלו אינם מוצגים עכשיו באתר."
          : "המרכז והפרופילים של המטפלים שלו אינם מוצגים עכשיו באתר.",
        opts.hasPortalAccount
          ? `שום דבר לא נמחק. ${saved}, ואפשר להמשיך להיכנס לפורטל ולראות אותם.`
          : `שום דבר לא נמחק. ${saved}.`,
      ],
    },
    {
      kind: "p",
      text: "אם תרצו לחזור, כתבו לנו ונחדש את המנוי. אין צורך להזין את הכרטיס שוב: פרטי הכרטיס שמורים אצל חברת הסליקה Sumit (לא אצלנו), והם לא יחויבו בלי בקשה מכם. עם החידוש המרכז חוזר להופיע באתר כמו שהיה.",
    },
    { kind: "p", text: "אם אתם מעדיפים שפרטי הכרטיס יוסרו, כתבו לנו ונסיר אותם." },
  ];
  return {
    // נושא = טקסט רגיל, בלי HTML entities.
    subject: `המנוי של ${name} בטיפול חכם נעצר`,
    ...render((opts.contactName ?? "").trim() || name, blocks, (opts.siteUrl ?? CENTER_NOTICE_SITE_URL).replace(/\/$/, "")),
  };
}

/**
 * מייל 2: המרכז קיבל קידום מתנה. מדבר על המתנה בלבד (ראו בראש הקובץ).
 * giftUntil ריק = מתנה בלי תאריך סיום, ואז אין פסקה על סוף התקופה.
 */
export function buildCenterGiftEmail(opts: {
  centerName: string;
  contactName?: string | null;
  giftUntil: string | null;
  /** בלי חשבון ניהול המייל נושא את קישור ההקמה (קישור ההצטרפות של המרכז). */
  hasPortalAccount: boolean;
  token: string;
  siteUrl?: string;
}): CenterNoticeEmail {
  const name = centerName(opts.centerName);
  const siteUrl = (opts.siteUrl ?? CENTER_NOTICE_SITE_URL).replace(/\/$/, "");
  const until = opts.giftUntil ? centerNoticeDate(opts.giftUntil) : null;
  const blocks: Block[] = [
    {
      kind: "p",
      text: `נתנו ${toName(name)} קידום במתנה בטיפול חכם: המרכז מוצג באתר בלי תשלום, ${until ? `עד ${until}` : "ללא הגבלת זמן"}.`,
    },
    {
      kind: "p",
      text: "בתקופה הזו המרכז מופיע בתוצאות ההתאמה של מטופלים, יש לו עמוד באתר, והפורטל פתוח לכם לעריכה ולצפייה בנתונים, בדיוק כמו במנוי.",
    },
  ];
  if (until) {
    blocks.push({
      kind: "p",
      text: `בתום התקופה, ב-${until}, המרכז יפסיק להיות מוצג באתר, וכל הפרטים שלו יישמרו. החיוב לא מתחדש מעצמו. לקראת סיום התקופה ניצור איתכם קשר, ואם תרצו להמשיך במנוי נסדר את זה.`,
    });
  }
  if (!opts.hasPortalAccount) {
    blocks.push(
      { kind: "p", text: "כדי להיכנס לפורטל מקימים חשבון ניהול, בדקה, עם מייל וסיסמה. אין צורך בפרטי תשלום." },
      { kind: "button", label: "הקמת חשבון הניהול", url: `${siteUrl}/centers/join/${opts.token}` },
    );
  }
  return {
    subject: `קידום במתנה ${toName(name)} בטיפול חכם`,
    ...render((opts.contactName ?? "").trim() || name, blocks, siteUrl),
  };
}
