import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

// Every submission sends a real email, and Resend's free tier gives the whole
// site 100 a day. 5/hour is far above what a genuine visitor needs (the busiest
// real day in the last three weeks saw 15 transactional sends across ALL
// sources) and far below what it takes to drain the allowance.
const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 60 * 60_000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  try {
    const gate = rateLimit("contact", clientIp(req), CONTACT_LIMIT, CONTACT_WINDOW_MS);
    if (!gate.ok) {
      return tooManyRequests(gate.retryAfterSeconds, "נשלחו יותר מדי פניות. נסו שוב בעוד שעה.");
    }

    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: "שדות חסרים" }, { status: 400 });
    }
    // A malformed address makes Resend reject the send anyway; catching it here
    // also keeps it out of the replyTo header.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
      return NextResponse.json({ ok: false, error: "כתובת מייל לא תקינה" }, { status: 400 });
    }

    const safeName    = escapeHtml(String(name));
    const safeEmail   = escapeHtml(String(email));
    const safeSubject = escapeHtml(String(subject || ""));
    const safeMessage = escapeHtml(String(message));

    await resend.emails.send({
      from: "טיפול חכם <noreply@mentalytics.co.il>",
      to: "admin@getmentalytics.com",
      replyTo: email,
      subject: `פנייה חדשה מ-טיפול חכם: ${safeSubject || "ללא נושא"}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">פנייה חדשה מהאתר</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${safeName}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">מייל:</td><td style="padding: 8px;"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">נושא:</td><td style="padding: 8px;">${safeSubject || "ללא נושא"}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>הודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${safeMessage}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">נשלח מ-mentalytics-site.vercel.app</p>
        </div>
      `,
    });

    // CRM lead capture — best-effort. The email to admin@ already went out;
    // the DB row is what makes the inquiry visible (and workable) in the CRM.
    try {
      const { error: leadErr } = await supabaseAdmin.from("crm_leads").insert({
        lead_type: "general",
        name: String(name),
        contact: String(email),
        message: subject ? `[${String(subject)}] ${String(message)}` : String(message),
        source: "contact_form",
      });
      if (leadErr) console.error("crm_leads insert failed:", leadErr.message);
    } catch (err) {
      console.error("crm_leads insert threw:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "שגיאה" }, { status: 500 });
  }
}
