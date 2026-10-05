import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { sendInquiryEmail, INQUIRY_SEND_FAILED_MESSAGE } from "@/app/lib/inquiry-send";
import { buildContactFormEmail } from "@/app/lib/site-inquiry";


// Every submission sends a real email, and Resend's free tier gives the whole
// site 100 a day. 5/hour is far above what a genuine visitor needs (the busiest
// real day in the last three weeks saw 15 transactional sends across ALL
// sources) and far below what it takes to drain the allowance.
const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 60 * 60_000;

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

    // המייל נבנה ב-site-inquiry.ts, יחד עם הכלל שלפיו סוכן השירות מזהה אותו
    // כפנייה של גולש (שולח שלנו + Reply-To של הגולש + תחילית הנושא). שינוי
    // בנושא או במבנה נעשה שם, כדי שהפנייה לא תיעלם מהתור של הסוכן.
    const mail = buildContactFormEmail({
      name: String(name),
      email: String(email).trim(),
      subject: subject ? String(subject) : "",
      message: String(message),
    });
    const sent = await sendInquiryEmail({
      to: "admin@getmentalytics.com",
      replyTo: String(email).trim(),
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }, { template: "contact_form", recipientType: "other" });

    // CRM lead capture - best-effort. The DB row is what makes the inquiry
    // visible (and workable) in the CRM, so it is written even if the email
    // to admin@ was rejected; the morning digest flags that case.
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

    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: INQUIRY_SEND_FAILED_MESSAGE }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "שגיאה" }, { status: 500 });
  }
}
