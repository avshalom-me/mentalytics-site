import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { name, email, phone, role, stage, description, link } = await req.json();

    if (!name || !email || !description) {
      return NextResponse.json({ ok: false, error: "שדות חובה חסרים" }, { status: 400 });
    }

    const safe = {
      name: escapeHtml(String(name)),
      email: escapeHtml(String(email)),
      phone: escapeHtml(String(phone || "")),
      role: escapeHtml(String(role || "")),
      stage: escapeHtml(String(stage || "")),
      description: escapeHtml(String(description)),
      link: escapeHtml(String(link || "")),
    };

    await resend.emails.send({
      from: "טיפול חכם — בית למפתחים <noreply@mentalytics.co.il>",
      to: "avshalom84@gmail.com",
      replyTo: email,
      subject: `פנייה חדשה לבית למפתחים: ${safe.name}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg,#5B3FE3 0%,#C13ABF 50%,#22D3EE 100%); padding: 24px; border-radius: 12px; color: white;">
            <h2 style="margin: 0; font-size: 22px;">פנייה חדשה — בית למפתחים</h2>
            <p style="margin: 6px 0 0; opacity: .9; font-size: 14px;">טופס הצטרפות מהאתר</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 140px;">שם:</td><td style="padding: 8px;">${safe.name}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">מייל:</td><td style="padding: 8px;"><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">טלפון:</td><td style="padding: 8px;">${safe.phone || "—"}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">תפקיד / רקע:</td><td style="padding: 8px;">${safe.role || "—"}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">שלב הרעיון:</td><td style="padding: 8px;">${safe.stage || "—"}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">קישור / אתר:</td><td style="padding: 8px;">${safe.link ? `<a href="${safe.link}">${safe.link}</a>` : "—"}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>תיאור הרעיון:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${safe.description}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">נשלח מ-mentalytics.co.il/developers</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "שגיאה" }, { status: 500 });
  }
}
