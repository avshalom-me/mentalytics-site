import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ ok: false, error: "שדות חסרים" }, { status: 400 });
    }

    await resend.emails.send({
      from: "Mentalytics <onboarding@resend.dev>",
      to: "avshalom84@gmail.com",
      replyTo: email,
      subject: `פנייה חדשה מ-Mentalytics: ${subject || "ללא נושא"}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0F5468;">פנייה חדשה מהאתר</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold; width: 120px;">שם:</td><td style="padding: 8px;">${name}</td></tr>
            <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">מייל:</td><td style="padding: 8px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">נושא:</td><td style="padding: 8px;">${subject || "—"}</td></tr>
          </table>
          <div style="margin-top: 16px; padding: 16px; background: #f5f5f5; border-radius: 8px;">
            <strong>הודעה:</strong>
            <p style="margin-top: 8px; white-space: pre-wrap;">${message}</p>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #999;">נשלח מ-mentalytics-site.vercel.app</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "שגיאה" }, { status: 500 });
  }
}
