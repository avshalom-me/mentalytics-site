import type { CenterReadiness } from "./center-readiness";

// בונה המייל של נדנוד ההשלמה למרכז - מודול נקי בלי שליחה, כדי שאפשר יהיה
// להציג תצוגה מקדימה באדמין ולבדוק אותו בלי לשלוח כלום.
//
// שלושה כללים שנגזרים מהתקלה של 16/8:
//   1. המייל מוביל במה שהם שילמו עליו, לא באחוז. "שילמתם על 10 מקומות ואף
//      אחד לא מאויש" הוא מידע; "הפרופיל שלכם מלא ב-0%" הוא עלבון.
//   2. אחוז מוצג רק כשהוא מעל אפס ומתחת למאה. אחוז אפס לא מוסיף כלום.
//   3. פריט שהחסם שלו אצלנו לעולם לא מופיע כאן - הוא נשאר פנימי.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type CenterNudgeEmail = { subject: string; html: string };

export function buildCenterNudgeEmail(opts: {
  centerName: string;
  readiness: CenterReadiness;
  token: string | null;
  hasAccount: boolean;
}): CenterNudgeEmail {
  const { readiness: r } = opts;
  const name = esc((opts.centerName || "המרכז").trim());
  const isEntity = r.track === "center_entity";

  // בלי חשבון מקושר - קישור ההקמה; אחרת ישירות לאזור הרלוונטי בפורטל.
  const url = !opts.hasAccount && opts.token
    ? `${SITE_URL}/centers/join/${opts.token}`
    : isEntity
      ? `${SITE_URL}/centers/dashboard/profile`
      : `${SITE_URL}/centers/dashboard/therapists`;

  const critical = r.missingForCenter.filter((i) => i.critical);
  const rest = r.missingForCenter.filter((i) => !i.critical);

  // הנושא מוביל בפעולה, לא במדד. שם המרכז נשאר בו כדי שהאכיפה החד-פעמית
  // תדע להבחין בין שני מרכזים של אותו בעלים.
  const subject = r.headline
    ? `${opts.centerName.trim()} - ${r.headline}`
    : `${opts.centerName.trim()} - נשארו כמה פרטים להשלמה`;

  const headlineBlock = r.headline
    ? `<div style="background:#FDF6E3;border:1px solid #E9D6A6;border-radius:10px;padding:16px 18px;margin:0 0 20px;">
        <p style="margin:0;font-size:16px;font-weight:bold;color:#A87010;">${esc(r.headline)}</p>
      </div>`
    : "";

  const intro = isEntity
    ? `המרכז שלכם מופיע במערכת ההתאמות כרובריקה אחת, ומטופלים מתאימים מופנים אליכם לפי מה שסימנתם. ככל שההגדרות והעמוד הציבורי מלאים יותר, כך המרכז נתפס ביותר שאלונים ומתקבלות יותר פניות.`
    : `מטפלי המרכז נכנסים למערכת ההתאמות, וכל מטפל/ת שמאויש/ת ומאושר/ת מתחיל/ה לקבל פניות. הרשימה למטה היא מה שנשאר כדי שתקבלו את מלוא מה שהמנוי כולל.`;

  const listItem = (label: string, hint?: string) =>
    `<li style="margin-bottom:8px;">${esc(label)}${
      hint ? `<span style="display:block;font-size:13px;color:#6B807E;">${esc(hint)}</span>` : ""
    }</li>`;

  const criticalBlock = critical.length
    ? `<p style="margin:0 0 8px;font-weight:bold;color:#0F5468;">מה שחוסם אתכם עכשיו</p>
       <ul style="margin:0 0 18px;padding-inline-start:20px;font-size:14.5px;">
         ${critical.map((i) => listItem(i.label, i.hint)).join("")}
       </ul>`
    : "";

  const restBlock = rest.length
    ? `<p style="margin:0 0 8px;font-weight:bold;color:#3E5250;">${
        critical.length ? "ומה שישפר עוד" : "מה שנשאר להשלים"
      }</p>
       <ul style="margin:0 0 18px;padding-inline-start:20px;font-size:14px;color:#3E5250;">
         ${rest.map((i) => listItem(i.label, i.hint)).join("")}
       </ul>`
    : "";

  // האחוז מוצג רק כשהוא אומר משהו - לא כשהוא אפס, ולא כשהכול מלא.
  const pctLine =
    r.pct > 0 && r.pct < 100
      ? `<p style="margin:0 0 18px;font-size:13px;color:#6B807E;">הפרופיל שלכם מלא ב-${r.pct}%.</p>`
      : "";

  const cta = !opts.hasAccount && opts.token
    ? "הקמת חשבון הניהול והשלמת הפרטים"
    : isEntity
      ? "להשלמת פרופיל המרכז"
      : "לניהול מטפלי המרכז";

  const html = `<!doctype html>
<html dir="rtl" lang="he">
  <body dir="rtl" style="font-family:'Heebo',Arial,sans-serif;background:#F7F4EF;margin:0;padding:24px;direction:rtl;">
    <div dir="rtl" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E8E0D8;border-radius:14px;padding:28px;line-height:1.7;color:#1a4a5c;direction:rtl;text-align:right;">
      <div style="text-align:center;padding:4px 0 20px;border-bottom:1px solid #EAF0EE;margin:0 0 22px;">
        <img src="${SITE_URL}/logo.png" width="150" alt="טיפול חכם" style="display:inline-block;width:150px;max-width:60%;height:auto;border:0;" />
      </div>

      <h1 style="color:#0F5468;font-size:20px;margin:0 0 14px;">שלום ${name},</h1>
      ${headlineBlock}
      <p style="margin:0 0 18px;font-size:15px;">${intro}</p>
      ${criticalBlock}
      ${restBlock}
      ${pctLine}

      <p style="margin:0 0 16px;">
        <a href="${url}" style="display:inline-block;background-color:#0F5468;background-image:linear-gradient(135deg,#0F5468,#1A7A96);color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:10px;">${cta}</a>
      </p>

      <p style="margin:0;font-size:13px;color:#3E5250;">
        רוצים שנעשה את זה יחד? השיבו למייל הזה ונתאם שיחה קצרה - אנחנו גם יכולים למלא עבורכם.
      </p>
      <hr style="border:0;border-top:1px solid #E8E0D8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#888;">
        לכל שאלה: admin@getmentalytics.com | 055-993-1403<br/>
        צוות טיפול חכם - Mentalytics
      </p>
    </div>
  </body>
</html>`;

  return { subject, html };
}
