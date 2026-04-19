import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);
const CRON_SECRET = process.env.CRON_SECRET;

type Therapist = {
  id: string;
  full_name: string | null;
  email: string | null;
  gender: string | null;
  bio: string | null;
  therapist_types: string[] | null;
  training_areas: string[] | null;
  regions: string[] | null;
  status: string;
};

type ClickRow = { therapist_id: string; click_type: string; source: string };
type ViewRow = { therapist_id: string; source: string };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTips(t: Therapist, stats: { views: number; clicks: number; wa: number; phone: number; email: number }, avgClicks: number): string[] {
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
    tips.push("מספר הפניות אליך נמוך מהממוצע. ייתכן שהוספת הסדרי ביטוח או הרחבת אזורי הפעילות יעזרו.");
  }

  if (stats.clicks >= avgClicks && avgClicks > 0) {
    tips.push("אתה מעל הממוצע בפניות — כל הכבוד! המשך/י לעדכן את הפרופיל כדי לשמור על החשיפה.");
  }

  if (stats.wa === 0 && stats.phone === 0 && stats.email === 0 && stats.views > 0) {
    tips.push("אף אחד עדיין לא לחץ על כפתורי יצירת הקשר. ודא/י שפרטי הטלפון והמייל מעודכנים ונכונים.");
  }

  return tips;
}

function buildEmailHtml(t: Therapist, stats: { views: number; clicks: number; wa: number; phone: number; email: number; matchClicks: number; directoryClicks: number }, tips: string[]): string {
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
            <td style="padding: 12px 16px; border: 1px solid #e8e0d8; font-weight: bold; text-align: center; background: #0F5468; color: white;">${stats.clicks}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">צפיות בפרופיל</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">וואטסאפ</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">טלפון</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">מייל</td>
            <td style="padding: 8px 16px; border: 1px solid #e8e0d8; text-align: center; font-size: 12px; color: #888;">סה"כ פניות</td>
          </tr>
        </table>

        <div style="margin-bottom: 16px; padding: 12px 16px; background: white; border-radius: 8px; border: 1px solid #e8e0d8;">
          <span style="font-size: 13px; color: #666;">
            מתוכן: <strong>${stats.matchClicks}</strong> ממערכת ההתאמות | <strong>${stats.directoryClicks}</strong> ממאגר המטפלים
          </span>
        </div>

        <h2 style="font-size: 16px; color: #0F5468; margin: 24px 0 12px;">המלצות לשיפור</h2>
        <ul style="padding-right: 20px; font-size: 14px; line-height: 1.8; color: #555;">
          ${tipsHtml}
        </ul>
      </div>

      <div style="padding: 16px 32px; text-align: center; font-size: 12px; color: #999; border: 1px solid #e8e0d8; border-top: 0; border-radius: 0 0 12px 12px;">
        <p>דו"ח זה נשלח אוטומטית למטפלים מקודמים ב&quot;טיפול חכם&quot;</p>
        <a href="https://www.tipolchacham.co.il/therapists/dashboard" style="color: #0F5468;">כניסה ללוח הבקרה</a>
      </div>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  if (CRON_SECRET && req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: therapists } = await supabaseAdmin
    .from("therapists")
    .select("id, full_name, email, gender, bio, therapist_types, training_areas, regions, status")
    .eq("status", "paying");

  if (!therapists || therapists.length === 0) {
    return NextResponse.json({ ok: true, message: "No paying therapists", sent: 0 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: clicks } = await supabaseAdmin
    .from("therapist_contact_clicks")
    .select("therapist_id, click_type, source")
    .gte("clicked_at", since);

  const { data: views } = await supabaseAdmin
    .from("therapist_profile_views")
    .select("therapist_id, source")
    .gte("viewed_at", since);

  // Aggregate clicks per therapist
  const clickMap: Record<string, { wa: number; phone: number; email: number; match: number; directory: number }> = {};
  for (const row of (clicks ?? []) as ClickRow[]) {
    if (!clickMap[row.therapist_id]) clickMap[row.therapist_id] = { wa: 0, phone: 0, email: 0, match: 0, directory: 0 };
    const c = clickMap[row.therapist_id];
    if (row.click_type === "whatsapp") c.wa++;
    else if (row.click_type === "phone") c.phone++;
    else if (row.click_type === "email") c.email++;
    if (row.source === "match") c.match++;
    else c.directory++;
  }

  // Aggregate views per therapist
  const viewMap: Record<string, number> = {};
  for (const row of (views ?? []) as ViewRow[]) {
    viewMap[row.therapist_id] = (viewMap[row.therapist_id] ?? 0) + 1;
  }

  // Calculate average clicks across all paying therapists
  const allTotals = therapists.map(t => {
    const c = clickMap[t.id];
    return c ? c.wa + c.phone + c.email : 0;
  });
  const avgClicks = allTotals.length > 0 ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;

  let sent = 0;
  const errors: string[] = [];

  for (const t of therapists as Therapist[]) {
    if (!t.email) continue;

    const c = clickMap[t.id] ?? { wa: 0, phone: 0, email: 0, match: 0, directory: 0 };
    const totalClicks = c.wa + c.phone + c.email;
    const stats = {
      views: viewMap[t.id] ?? 0,
      clicks: totalClicks,
      wa: c.wa,
      phone: c.phone,
      email: c.email,
      matchClicks: c.match,
      directoryClicks: c.directory,
    };

    const tips = buildTips(t, stats, avgClicks);
    const html = buildEmailHtml(t, stats, tips);

    try {
      await resend.emails.send({
        from: "טיפול חכם <onboarding@resend.dev>",
        to: t.email,
        subject: `הדו"ח החודשי שלך — טיפול חכם`,
        html,
      });
      sent++;
    } catch (e: unknown) {
      errors.push(`${t.email}: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }

  return NextResponse.json({ ok: true, sent, total: therapists.length, errors: errors.length > 0 ? errors : undefined });
}
