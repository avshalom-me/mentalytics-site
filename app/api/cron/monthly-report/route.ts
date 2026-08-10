import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { buildUnsubscribeUrl } from "@/app/lib/unsubscribe-token";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import { cronAuthorized } from "@/app/lib/cron-auth";
import { sendBulkEmail } from "@/app/lib/email-quota";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mentalytics.co.il";

type Therapist = {
  id: string;
  full_name: string | null;
  email: string | null;
  gender: string | null;
  bio: string | null;
  profile_photo_path: string | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  status: string;
  match_paused_until: string | null;
};

type EmailCategory = "engaged" | "viewed_only" | "incomplete_profile" | "skip";

const SHORT_BIO_THRESHOLD = 80;

function categorize(t: Therapist, stats: { views: number; clicks: number }): EmailCategory {
  if (stats.clicks > 0) return "engaged";
  if (stats.views > 0) return "viewed_only";
  // 0 views, 0 clicks — only nudge if profile has clear gaps
  const bioShort = !t.bio || t.bio.length < SHORT_BIO_THRESHOLD;
  const noPhoto = !t.profile_photo_path;
  if (bioShort || noPhoto) return "incomplete_profile";
  return "skip";
}

type ClickRow = { therapist_id: string; click_type: string; source: string };
type ViewRow = { therapist_id: string; source: string };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTips(t: Therapist, stats: { views: number; clicks: number; wa: number; phone: number; email: number; message: number }, avgClicks: number): string[] {
  const tips: string[] = [];

  if (!t.bio || t.bio.length < 80) {
    tips.push("הביוגרפיה שלך קצרה. פרופילים עם תיאור אישי מפורט מקבלים יותר פניות — נסה/י להוסיף 2-3 משפטים על הגישה הטיפולית שלך.");
  }

  if ((t.training_areas?.length ?? 0) <= 2) {
    tips.push("יש לך מעט תחומי טיפול מוצגים. הוספת תחומים נוספים שאתה מתמחה בהם תגדיל את הסיכוי להופיע בהתאמות.");
  }

  if (stats.views > 0 && stats.clicks === 0) {
    tips.push("הפרופיל שלך נצפה אבל עדיין לא נוצר קשר. שקול/י לעדכן את התמונה או להרחיב את הביוגרפיה כדי לעודד פנייה.");
  }

  if (stats.clicks < avgClicks && stats.clicks > 0) {
    tips.push("מספר הלחיצות ליצירת קשר אצלך נמוך מהממוצע. ייתכן שהוספת הסדרי ביטוח או הרחבת אזורי הפעילות יעזרו.");
  }

  if (stats.clicks >= avgClicks && avgClicks > 0) {
    tips.push("אתה מעל הממוצע בלחיצות ליצירת קשר — כל הכבוד! המשך/י לעדכן את הפרופיל כדי לשמור על החשיפה.");
  }

  if (stats.clicks === 0 && stats.views > 0) {
    tips.push("אף אחד עדיין לא לחץ על כפתורי יצירת הקשר. ודא/י שפרטי הטלפון והמייל מעודכנים ונכונים.");
  }

  return tips;
}

function buildEmailHtml(t: Therapist, stats: { views: number; clicks: number; wa: number; phone: number; email: number; message: number; matchClicks: number; directoryClicks: number }, tips: string[]): string {
  const name = escapeHtml(t.full_name ?? "מטפל/ת");
  const tipsHtml = tips.length > 0
    ? tips.map(tip => `<li style="margin-bottom: 8px;">${escapeHtml(tip)}</li>`).join("")
    : `<li>הכל נראה מעולה! המשך/י כך.</li>`;

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0F5468, #2e7d8c); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">הדו"ח החודשי שלך</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px;">טיפול חכם — ${name}</p>
      </div>

      <div style="background: #f9f8f6; padding: 24px 32px; border: 1px solid #e8e0d8; border-top: 0;">
        <h2 style="font-size: 16px; color: #0F5468; margin: 0 0 16px;">סטטיסטיקות החודש האחרון</h2>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: white;">
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center;">${stats.views}</td>
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center;">${stats.wa}</td>
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center;">${stats.phone}</td>
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center;">${stats.email}</td>
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center;">${stats.message}</td>
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center; background: #0F5468; color: white;">${stats.clicks}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">צפיות בפרופיל</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">וואטסאפ</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">טלפון</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">מייל</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">הודעות מהאתר</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">סה"כ פניות</td>
          </tr>
        </table>

        <div style="margin-bottom: 16px; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e8e0d8;">
          <span style="font-size: 13px; color: #666;">
            מתוכן: <strong>${stats.matchClicks}</strong> ממערכת ההתאמות | <strong>${stats.directoryClicks}</strong> ממאגר המטפלים
          </span>
        </div>

        <div style="margin-bottom: 16px; padding: 14px 16px; background: #EAF4F3; border-radius: 8px; border: 1px solid #C2DFDE;">
          <div style="font-size: 14px; font-weight: bold; color: #2A6462; margin-bottom: 6px;">ⓘ מה נספר כאן, ולמה לא שמעת מכולם?</div>
          <div style="font-size: 13px; line-height: 1.7; color: #3E5250;">
            המספרים סופרים כל פעם שמטופל <strong>לחץ</strong> על הוואטסאפ, הטלפון או המייל שלך בפרופיל, כלומר ביקש ליצור איתך קשר.
            חלק מהלוחצים לא משלימים את השליחה או את השיחה, ולכן ייתכן שלא כל לחיצה הגיעה אליך בפועל.
            הודעות שנשלחו דרך טופס האתר הן היחידות שמגיעות אליך תמיד, ישירות למייל.
          </div>
        </div>

        <h2 style="font-size: 16px; color: #0F5468; margin: 24px 0 12px;">המלצות לשיפור</h2>
        <ul style="padding-right: 20px; font-size: 14px; line-height: 1.8; color: #555;">
          ${tipsHtml}
        </ul>
      </div>

      <div style="padding: 16px 32px; text-align: center; font-size: 12px; color: #999; border: 1px solid #e8e0d8; border-top: 0; border-radius: 0 0 12px 12px;">
        <p>דו"ח זה נשלח אוטומטית למטפלים מקודמים ב&quot;טיפול חכם&quot;</p>
        <a href="${SITE_BASE_URL}/therapists/dashboard" style="color: #0F5468;">כניסה ללוח הבקרה</a>
        <p style="margin-top:10px;font-size:11px;color:#bbb;">
          <a href="${buildUnsubscribeUrl(SITE_BASE_URL, t.id)}" style="color:#999;text-decoration:underline;">הסרה מקבלת דוחות חודשיים</a>
        </p>
      </div>
    </div>
  `;
}

function buildViewedOnlyEmailHtml(t: Therapist, views: number): string {
  const name = escapeHtml(t.full_name ?? "מטפל/ת");
  const tips: string[] = [];

  if (!t.bio || t.bio.length < SHORT_BIO_THRESHOLD) {
    tips.push("הביוגרפיה שלך קצרה. מטופלים שראו את הפרופיל הססו לפנות — תיאור מפורט יותר על הגישה הטיפולית והניסיון שלך מגדיל משמעותית את הסיכוי לפנייה.");
  }
  if (!t.profile_photo_path) {
    tips.push("אין לך תמונת פרופיל. תמונה מקצועית ומחייכת היא אחד הגורמים החזקים ביותר ליצירת אמון ראשוני.");
  }
  if ((t.training_areas?.length ?? 0) <= 2) {
    tips.push("הוספת תחומי הכשרה נוספים שאתה מתמחה בהם תעזור למטופלים לזהות שאתה מתאים לצרכים שלהם.");
  }
  tips.push("בדוק/י שמספר הטלפון והוואטסאפ בפרופיל מעודכנים — מטופלים שראו את הפרופיל ולא לחצו, ייתכן שהיססו בגלל פרטים לא ברורים.");

  const tipsHtml = tips.map(tip => `<li style="margin-bottom: 10px;">${escapeHtml(tip)}</li>`).join("");

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0F5468, #2e7d8c); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">הזדמנות לשיפור הפרופיל שלך</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">טיפול חכם — ${name}</p>
      </div>

      <div style="background: #f9f8f6; padding: 24px 32px; border: 1px solid #e8e0d8; border-top: 0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          <strong>${views}</strong> מטופלים פוטנציאליים צפו בפרופיל שלך החודש, אבל אף אחד מהם לא לחץ על כפתור יצירת הקשר.
        </p>
        <p style="font-size: 14px; line-height: 1.7; color: #555; margin: 0 0 20px;">
          זה אומר שהפרופיל שלך מופיע בתוצאות החיפוש — וזה שלב מצוין. עכשיו הקטנה האחרונה היא לגרום למטופל ללחוץ ולפנות. הנה כמה שינויים שעשויים להזיז את המחט:
        </p>

        <ul style="padding-right: 20px; font-size: 14px; line-height: 1.7; color: #444;">
          ${tipsHtml}
        </ul>

        <div style="margin-top: 24px; padding: 14px 16px; background: #fff8e1; border-radius: 8px; border: 1px solid #f5d975;">
          <p style="margin: 0; font-size: 13px; color: #6b4f00;">
            💡 לפי המחקר שלנו, פרופילים עם ביו של 150+ תווים ותמונה מקצועית מקבלים פי 2-3 יותר פניות ממטופלים שצפו.
          </p>
        </div>
      </div>

      <div style="padding: 16px 32px; text-align: center; font-size: 12px; color: #999; border: 1px solid #e8e0d8; border-top: 0; border-radius: 0 0 12px 12px;">
        <a href="${SITE_BASE_URL}/therapists/dashboard" style="color: #0F5468; font-weight: bold;">לעריכת הפרופיל →</a>
        <p style="margin-top:10px;font-size:11px;color:#bbb;">
          <a href="${buildUnsubscribeUrl(SITE_BASE_URL, t.id)}" style="color:#999;text-decoration:underline;">הסרה מקבלת דוחות חודשיים</a>
        </p>
      </div>
    </div>
  `;
}

function buildIncompleteProfileEmailHtml(t: Therapist): string {
  const name = escapeHtml(t.full_name ?? "מטפל/ת");
  const missing: string[] = [];

  if (!t.profile_photo_path) missing.push("תמונת פרופיל מקצועית");
  if (!t.bio || t.bio.length < SHORT_BIO_THRESHOLD) missing.push("ביוגרפיה מפורטת (150+ תווים על הגישה הטיפולית והניסיון שלך)");

  const missingHtml = missing.map(m => `<li style="margin-bottom: 10px;">${escapeHtml(m)}</li>`).join("");

  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #0F5468, #2e7d8c); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">הפרופיל שלך עדיין לא מוצג בעצמתו המלאה</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">טיפול חכם — ${name}</p>
      </div>

      <div style="background: #f9f8f6; padding: 24px 32px; border: 1px solid #e8e0d8; border-top: 0;">
        <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
          הפרופיל שלך פעיל באתר, אבל יש בו פרטים חיוניים שחסרים — וזה משפיע על מספר ההצגות שלו במערכת ההתאמות ובדירקטוריה.
        </p>
        <p style="font-size: 14px; color: #555; margin: 0 0 12px;"><strong>מה חסר כרגע:</strong></p>
        <ul style="padding-right: 20px; font-size: 14px; line-height: 1.7; color: #444;">
          ${missingHtml}
        </ul>

        <div style="margin-top: 20px; padding: 14px 16px; background: #fff8e1; border-radius: 8px; border: 1px solid #f5d975;">
          <p style="margin: 0; font-size: 13px; color: #6b4f00;">
            💡 פרופילים מלאים מקבלים פי 3-5 יותר חשיפות מפרופילים חלקיים. ההשלמה לוקחת 5 דקות.
          </p>
        </div>
      </div>

      <div style="padding: 16px 32px; text-align: center; font-size: 12px; color: #999; border: 1px solid #e8e0d8; border-top: 0; border-radius: 0 0 12px 12px;">
        <a href="${SITE_BASE_URL}/therapists/dashboard" style="color: #0F5468; font-weight: bold;">להשלמת הפרופיל →</a>
        <p style="margin-top:10px;font-size:11px;color:#bbb;">
          <a href="${buildUnsubscribeUrl(SITE_BASE_URL, t.id)}" style="color:#999;text-decoration:underline;">הסרה מקבלת דוחות חודשיים</a>
        </p>
      </div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Server misconfigured: CRON_SECRET not set" }, { status: 500 });
  }
  if (!cronAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ⚠️ מדיניות: דוחות למטפלים לא נשלחים אוטומטית. המסלול הזה אינו רשום
  // ב-vercel.json ולכן אינו רץ מעצמו - אבל קריאה ידנית אליו שלחה בעבר 42
  // מיילים אמיתיים בטעות, וזו פעולה בלתי הפיכה. לכן ברירת המחדל היא
  // *תצוגה מקדימה בלבד*: מחזירה למי היה נשלח ומה, בלי לשלוח דבר.
  // שליחה בפועל מחייבת ?send=confirm במפורש.
  const sendForReal = req.nextUrl.searchParams.get("send") === "confirm";

  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, gender, bio, profile_photo_path, therapist_types, training_areas, regions, status, match_paused_until")
    .eq("status", "paying")
    .neq("entity_type", "center") // הישות אינה מטפל — לא לשלוח לה דוח ביצועים חודשי
    .eq("unsubscribed_from_stats", false);

  if (!therapists || therapists.length === 0) {
    return NextResponse.json({ ok: true, message: "No paying therapists", sent: 0 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Page past the 1000-row cap — profile_views over 30 days already exceeds it,
  // so a plain select would undercount each therapist's monthly view count.
  const clicks = await fetchAllRows<ClickRow>(() =>
    supabaseAdmin
      .from("therapist_contact_clicks")
      .select("therapist_id, click_type, source")
      .gte("clicked_at", since),
  );

  const views = await fetchAllRows<ViewRow>(() =>
    supabaseAdmin
      .from("therapist_profile_views")
      .select("therapist_id, source")
      .gte("viewed_at", since),
  );

  // Aggregate clicks per therapist
  // site_message נספר ככל פנייה אחרת. עד 10/8/26 הוא נשמט מכאן לגמרי, ולכן
  // מטפל שקיבל *הודעה אמיתית* דרך טופס האתר - סוג הפנייה הוודאי היחיד -
  // נספר כ"אפס פניות" וקיבל מייל שמסביר לו איך להשיג פניות. קרה בפועל
  // לאמיר ירצקי (הודעה ב-26/7 שלא נספרה).
  const clickMap: Record<string, { wa: number; phone: number; email: number; message: number; match: number; directory: number }> = {};
  for (const row of clicks) {
    if (!clickMap[row.therapist_id]) clickMap[row.therapist_id] = { wa: 0, phone: 0, email: 0, message: 0, match: 0, directory: 0 };
    const c = clickMap[row.therapist_id];
    if (row.click_type === "whatsapp") c.wa++;
    else if (row.click_type === "phone") c.phone++;
    else if (row.click_type === "email") c.email++;
    else if (row.click_type === "site_message") c.message++;
    if (row.source === "match") c.match++;
    else c.directory++;
  }

  // Aggregate views per therapist
  const viewMap: Record<string, number> = {};
  for (const row of views) {
    viewMap[row.therapist_id] = (viewMap[row.therapist_id] ?? 0) + 1;
  }

  // Calculate average clicks across all paying therapists
  const allTotals = therapists.map(t => {
    const c = clickMap[t.id];
    return c ? c.wa + c.phone + c.email + c.message : 0;
  });
  const avgClicks = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;

  let sent = 0;
  let skipped = 0;
  const byCategory: Record<EmailCategory, number> = { engaged: 0, viewed_only: 0, incomplete_profile: 0, skip: 0 };
  const errors: string[] = [];
  // תצוגה מקדימה: מי היה מקבל ומה, כשלא ביקשו שליחה בפועל.
  const preview: { to: string; subject: string }[] = [];

  for (const t of therapists as Therapist[]) {
    if (!t.email) continue;

    // מוקפא/ת מההתאמות: המספרים שלו/ה ירדו *בגללנו*. הדוח הזה מסביר ירידה
    // בתור בעיה של המטפל/ת ("הפרופיל שלך לא משדר במלוא הכוח", "איך הופכים
    // צפייה לפנייה") - כלומר לא רק שהוא מפר את השקט שההקפאה אמורה לשמור,
    // הוא גם מאשים אותם במשהו שאנחנו עשינו. מדלגים לגמרי.
    if (t.match_paused_until && new Date(t.match_paused_until).getTime() > Date.now()) {
      skipped++;
      continue;
    }

    const c = clickMap[t.id] ?? { wa: 0, phone: 0, email: 0, message: 0, match: 0, directory: 0 };
    const totalClicks = c.wa + c.phone + c.email + c.message;
    const stats = {
      views: viewMap[t.id] ?? 0,
      clicks: totalClicks,
      wa: c.wa,
      phone: c.phone,
      email: c.email,
      message: c.message,
      matchClicks: c.match,
      directoryClicks: c.directory,
    };

    const category = categorize(t, stats);
    byCategory[category]++;

    if (category === "skip") {
      skipped++;
      continue;
    }

    let html: string;
    let subject: string;

    if (category === "engaged") {
      const tips = buildTips(t, stats, avgClicks);
      html = buildEmailHtml(t, stats, tips);
      subject = `הדו"ח החודשי שלך — טיפול חכם`;
    } else if (category === "viewed_only") {
      html = buildViewedOnlyEmailHtml(t, stats.views);
      subject = `${stats.views} מטופלים ראו את הפרופיל שלך — איך הופכים את זה לפנייה`;
    } else {
      html = buildIncompleteProfileEmailHtml(t);
      subject = `הפרופיל שלך לא משדר במלוא הכוח — 5 דקות לתקן`;
    }

    // ברירת מחדל - תצוגה מקדימה בלבד. שום מייל לא יוצא בלי ?send=confirm.
    if (!sendForReal) {
      preview.push({ to: t.email, subject });
      continue;
    }

    // Monthly reports go to every paying therapist at once — route through the
    // daily bulk gate so the report run can't blow the Resend daily quota.
    const r = await sendBulkEmail({
      from: "טיפול חכם <noreply@mentalytics.co.il>",
      to: t.email,
      subject,
      html,
    });
    if (r.ok) {
      sent++;
    } else if (r.skipped) {
      skipped++;
      errors.push(`${t.email}: deferred — daily bulk cap reached`);
    } else {
      errors.push(`${t.email}: ${r.error ?? "unknown error"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    mode: sendForReal ? "SENT" : "preview_only",
    ...(sendForReal
      ? { sent }
      : {
          would_send: preview.length,
          note: "לא נשלח דבר. להוספת שליחה בפועל: ?send=confirm",
          preview,
        }),
    skipped,
    total: therapists.length,
    byCategory,
    errors: errors.length > 0 ? errors : undefined,
  });
}
