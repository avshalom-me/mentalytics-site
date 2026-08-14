import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";

// פנייה דרך האתר אל מרכז טיפולי במסלול 1 (מטפלים בנפרד).
//
// למרכז כזה אין שורת ישות ב-therapists, ולכן /api/contact-therapist - שכל
// כולו בנוי סביב therapist_id - לא יכול לשרת אותו: גם המייל וגם רישום הפנייה
// נשענים שם על שורת מטפל קיימת. מסלול 2 ממשיך לעבור ב-contact-therapist דרך
// שורת הישות, כך שהפנייה נספרת גם בסטטיסטיקות הפורטל.
//
// כתובת היעד נבחרת בצד השרת בלבד ולעולם אינה מגיעה לדפדפן: הלקוח שולח מזהה
// מרכז, לא כתובת מייל.

const resend = new Resend(process.env.RESEND_API_KEY);

const VALID_SOURCES = ["match", "directory", "profile"] as const;
type Source = (typeof VALID_SOURCES)[number];

// חמש פניות לשעה לכל IP - אותה מדיניות כמו בפנייה למטפל.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidPhone(s: string): boolean {
  return /^0\d{8,9}$/.test(s.replace(/[-\s]/g, ""));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי בקשות, נסה/י שוב מאוחר יותר" }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { center_id, sender_name, sender_contact, message, source } = body ?? {};

    if (!center_id || typeof center_id !== "string") {
      return NextResponse.json({ ok: false, error: "מרכז לא נמצא" }, { status: 400 });
    }
    const name = String(sender_name ?? "").trim();
    const contact = String(sender_contact ?? "").trim();
    const msg = String(message ?? "").trim();

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ ok: false, error: "נא להזין שם תקין" }, { status: 400 });
    }
    if (!isValidEmail(contact) && !isValidPhone(contact)) {
      return NextResponse.json({ ok: false, error: "נא להזין מייל או טלפון תקין" }, { status: 400 });
    }
    if (msg.length < 10 || msg.length > 2000) {
      return NextResponse.json({ ok: false, error: "ההודעה חייבת להיות בין 10 ל-2000 תווים" }, { status: 400 });
    }

    // אותם תנאי גלוי שאוכף getPublicCenterBySlug: אם העמוד אינו ציבורי, גם
    // הכפתור אינו קיים - ו-POST ישיר לא אמור לעקוף את זה.
    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("id, name, email, payer_email, billing_track, public_page_enabled, status")
      .eq("id", center_id)
      .eq("status", "active")
      .maybeSingle();
    if (!center || !(center.public_page_enabled === true || center.billing_track === "center_entity")) {
      return NextResponse.json({ ok: false, error: "המרכז אינו זמין לפניות" }, { status: 404 });
    }

    // מייל הקשר של המרכז, ובהיעדרו מייל בעל החשבון - זו הכתובת היחידה שיש
    // למרכז אצלנו, והיא זו שמקבלת ממילא את ההתראות מהמערכת.
    const to = (center.email as string | null)?.trim() || (center.payer_email as string | null)?.trim() || null;
    if (!to) {
      return NextResponse.json({ ok: false, error: "המרכז אינו זמין לפניות" }, { status: 404 });
    }

    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";
    const safeName = escapeHtml(name);
    const safeContact = escapeHtml(contact);
    const safeMessage = escapeHtml(msg);
    const centerName = escapeHtml((center.name as string) ?? "המרכז");
    const replyHref = isValidEmail(contact) ? `mailto:${contact}` : `tel:${contact}`;

    await resend.emails.send({
      from: "טיפול חכם <noreply@mentalytics.co.il>",
      to,
      replyTo: isValidEmail(contact) ? contact : undefined,
      subject: "פנייה חדשה ממטופל/ת דרך אתר טיפול חכם",
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">פנייה חדשה ל${centerName} דרך אתר טיפול חכם</h2>
          <p style="color:#555;">קיבלתם פנייה ממטופל/ת פוטנציאלי/ת דרך עמוד המרכז באתר. מומלץ להגיב מהר ככל האפשר.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top:16px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${safeName}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">פרטי קשר:</td><td style="padding: 8px;"><a href="${replyHref}">${safeContact}</a></td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>ההודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="margin-top: 24px; font-size: 13px; color: #555;">
            כדי להשיב - לחצו על פרטי הקשר למעלה, או השיבו ישירות למייל זה (אם נשלח ממייל).
          </p>
          <p style="margin-top: 8px; font-size: 12px; color: #999;">פנייה זו נשלחה דרך טיפול חכם - mentalytics.co.il</p>
        </div>
      `,
    });

    // רישום הליד ב-CRM - best-effort. ההודעה כבר יצאה, וכשל כאן לעולם לא
    // ייראה לפונה. therapist_id נשאר ריק: הפנייה אל המרכז, לא אל אדם מסוים.
    try {
      const { error: leadErr } = await supabaseAdmin.from("crm_leads").insert({
        lead_type: "patient",
        name,
        contact,
        message: msg,
        center_account_id: center.id,
        source: "site_message",
        page_source: safeSource,
        ...sanitizeAttribution(body),
      });
      if (leadErr) console.error("crm_leads (center) insert failed:", leadErr.message);
    } catch (e) {
      console.error("crm_leads (center) insert threw:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשליחה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
