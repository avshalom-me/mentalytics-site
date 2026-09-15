import { NextRequest, NextResponse } from "next/server";
import { patientInquiryRecipient } from "@/app/lib/therapist-recipient";
import { buildInquiryEmail, type InquiryAudience } from "@/app/lib/inquiry-email";
import { sendInquiryEmail, INQUIRY_SEND_FAILED_MESSAGE } from "@/app/lib/inquiry-send";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { sanitizeAttribution } from "@/app/lib/attribution";


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
      .select("id, full_name, email, status, accepting_new_patients, entity_type, center_account_id")
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

    // מי קורא את המייל קובע איך מנסחים אותו. ישות-מרכז = המרכז עצמו; תיבת
    // מרכז שמקבלת פנייה למטפל/ת מסוים/ת חייבת לדעת את מי הפונה בחר/ה.
    const isEntity = therapist.entity_type === "center";
    const audience: InquiryAudience = isEntity
      ? "center"
      : inquiryTarget.viaCenter
        ? "center_for_therapist"
        : "therapist";
    const email = buildInquiryEmail({
      audience,
      recipientName: (therapist.full_name as string | null) ?? inquiryTarget.viaCenter?.name ?? "",
      senderName: name,
      senderContact: contact,
      message: msg,
    });
    // תיבת המרכז שקיבלה את ההודעה - נרשמת עכשיו, ברגע השליחה. פורטל המרכז
    // מציג רק את זה; הודעה שהגיעה לתיבה פרטית של מטפל/ת לא נחשפת למרכז.
    const receivedByCenterId: string | null = isEntity
      ? ((therapist.center_account_id as string | null) ?? null)
      : (inquiryTarget.viaCenter?.id ?? null);

    // הפונה חייב/ת לדעת אם ההודעה לא יצאה, ולכן כישלון חוזר אליו/ה (למטה).
    // הלחיצה והליד נרשמים בכל מקרה כדי שהפנייה לא תאבד, ודוח הבוקר מצליב
    // אותם מול יומן המיילים ומציף פנייה שלא נמסרה.
    const sent = await sendInquiryEmail(
      { to: inquiryTarget.to, replyTo: isValidEmail(contact) ? contact : undefined, subject: email.subject, html: email.html },
      {
        template: "patient_inquiry",
        recipientType: isEntity ? "organization" : "therapist",
        entityId: isEntity ? receivedByCenterId : (therapist.id as string),
      },
    );

    const sessionId =
      typeof body?.session_id === "string" && body.session_id.length > 0 && body.session_id.length <= 128
        ? body.session_id
        : null;
    const { error: clickErr } = await supabaseAdmin
      .from("therapist_contact_clicks")
      .insert({ therapist_id, click_type: "site_message", source: safeSource, session_id: sessionId, ...sanitizeAttribution(body) });
    if (clickErr) console.error("therapist_contact_clicks (site_message) insert failed:", clickErr.message);

    // CRM lead capture - best-effort; a failure here must never surface to the
    // sender. The row is written even when the email was rejected: the lead
    // must not be lost, and the morning digest flags it against the email log.
    try {
      const { error: leadErr } = await supabaseAdmin.from("crm_leads").insert({
        lead_type: "patient",
        name,
        contact,
        message: msg,
        therapist_id,
        received_by_center_id: receivedByCenterId,
        source: "site_message",
        page_source: safeSource,
        ...sanitizeAttribution(body),
      });
      if (leadErr) console.error("crm_leads insert failed:", leadErr.message);
    } catch (e) {
      console.error("crm_leads insert threw:", e);
    }

    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: INQUIRY_SEND_FAILED_MESSAGE }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשליחה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
