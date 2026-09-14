import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { patientInquiryRecipient } from "@/app/lib/therapist-recipient";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";

const resend = new Resend(process.env.RESEND_API_KEY);

const VALID_SOURCES = ["match", "directory", "profile"] as const;
type Source = (typeof VALID_SOURCES)[number];

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
    const { therapist_id, sender_name, sender_contact, message, source } = body ?? {};

    if (!therapist_id || typeof therapist_id !== "string") {
      return NextResponse.json({ ok: false, error: "מטפל לא נמצא" }, { status: 400 });
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

    const { data: therapist, error: therapistErr } = await supabaseAdmin
      .from("therapists")
      .select("id, full_name, email, status, accepting_new_patients")
      .eq("id", therapist_id)
      .in("status", ["approved", "paying"])
      .maybeSingle();

    if (therapistErr || !therapist) {
      return NextResponse.json({ ok: false, error: "מטפל לא זמין" }, { status: 404 });
    }
    // מטפל של מרכז שאין לו כתובת משלו - הפנייה עוברת למרכז במקום להיעלם.
    const inquiryTarget = await patientInquiryRecipient(therapist.id as string);
    if (!inquiryTarget.to) {
      return NextResponse.json({ ok: false, error: "מטפל לא זמין" }, { status: 404 });
    }

    // Server-side enforcement of the availability flag — the UI hides the
    // button, but a stale open tab (or a direct POST) must be rejected too.
    if (therapist.accepting_new_patients === false) {
      return NextResponse.json(
        { ok: false, error: "המטפל/ת אינו/ה מקבל/ת כרגע פניות חדשות. אפשר למצוא מטפלים אחרים במאגר או למלא שאלון התאמה." },
        { status: 409 }
      );
    }

    const safeSource: Source = VALID_SOURCES.includes(source as Source) ? source : "directory";

    const safeName = escapeHtml(name);
    const safeContact = escapeHtml(contact);
    const safeMessage = escapeHtml(msg);
    const replyHref = isValidEmail(contact) ? `mailto:${contact}` : `tel:${contact}`;

    await resend.emails.send({
      from: 'טיפול חכם <noreply@mentalytics.co.il>',
      to: inquiryTarget.to,
      replyTo: isValidEmail(contact) ? contact : undefined,
      subject: `פנייה חדשה ממטופל/ת דרך אתר טיפול חכם`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">פנייה חדשה אליך דרך אתר טיפול חכם</h2>
          <p style="color:#555;">קיבלת פנייה ממטופל/ת פוטנציאלי/ת. מומלץ להגיב מהר ככל האפשר.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top:16px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${safeName}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">פרטי קשר:</td><td style="padding: 8px;"><a href="${replyHref}">${safeContact}</a></td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>ההודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="margin-top: 24px; font-size: 13px; color: #555;">
            כדי להשיב — לחצ/י על פרטי הקשר למעלה, או השב/י ישירות למייל זה (אם נשלח ממייל).
          </p>
          <p style="margin-top: 8px; font-size: 12px; color: #999;">פנייה זו נשלחה דרך טיפול חכם — mentalytics.co.il</p>
        </div>
      `,
    });

    const sessionId =
      typeof body?.session_id === "string" && body.session_id.length > 0 && body.session_id.length <= 128
        ? body.session_id
        : null;
    const { error: clickErr } = await supabaseAdmin
      .from("therapist_contact_clicks")
      .insert({ therapist_id, click_type: "site_message", source: safeSource, session_id: sessionId, ...sanitizeAttribution(body) });
    if (clickErr) console.error("therapist_contact_clicks (site_message) insert failed:", clickErr.message);

    // CRM lead capture — best-effort. The patient's message already went out
    // above; a failure here must never surface to the sender.
    try {
      const { error: leadErr } = await supabaseAdmin.from("crm_leads").insert({
        lead_type: "patient",
        name,
        contact,
        message: msg,
        therapist_id,
        source: "site_message",
        page_source: safeSource,
        ...sanitizeAttribution(body),
      });
      if (leadErr) console.error("crm_leads insert failed:", leadErr.message);
    } catch (e) {
      console.error("crm_leads insert threw:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשליחה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
