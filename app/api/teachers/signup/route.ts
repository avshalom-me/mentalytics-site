import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { isBotRequest } from "@/app/lib/bot-detect";
import { sanitizeAttribution } from "@/app/lib/attribution";
import { REGION_CITIES } from "@/app/lib/regions";
import { phoneNationalDigits, foreignPhoneDigits } from "@/app/lib/phone";
import { sendOpsEmail, escapeHtml } from "@/app/lib/ops-email";
import { sendTeacherSignupReceivedEmail } from "@/app/lib/teacher-emails";
import { resendPersonalLink } from "@/app/lib/teacher-link.server";
import {
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_KEYS,
  TEACHER_QUALIFICATION_KEYS,
  qualificationAllowsRemedial,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
} from "@/app/lib/teacher-options";
import { newEditToken, uniqueTeacherSlug, setTeacherCookie, teacherLinkUrl, crossSiteWrite } from "@/app/lib/teachers.server";

// הרשמת מורה למענה הלימודי. בלי חשבון: הטופס יוצר שורה במצב pending, והדפדפן
// מקבל עוגייה שמזהה את המורה (ראו teachers.server.ts). הקישור האישי נשלח
// במייל ומוצג פעם אחת על המסך. האישור הוא ידני באדמין, מול התעודה שמועלית
// מיד אחרי השמירה.

export const dynamic = "force-dynamic";

const ALL_CITIES = new Set(Object.values(REGION_CITIES).flat());

/** מעל המספר הזה ביממה ההרשמות כנראה אינן של בני אדם: מפסיקים לשלוח מיילים
 *  (מכסת Resend היומית משותפת לכל האתר) ומתריעים פעם אחת. */
const DAILY_SIGNUP_EMAIL_CAP = 25;

const Body = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z.string().trim().min(7).max(25),
  gender: z.enum(["זכר", "נקבה"]).nullable().optional(),
  subjects: z.array(z.enum(TEACHER_SUBJECT_KEYS as [string, ...string[]])).min(1).max(5),
  remedial: z.boolean(),
  grade_groups: z.array(z.enum(TEACHER_GRADE_KEYS as [string, ...string[]])).min(1).max(4),
  regions: z.array(z.string()).max(6),
  online: z.boolean(),
  languages: z.array(z.string().max(20)).max(7).optional(),
  price_text: z.string().trim().max(60).optional().nullable(),
  bio: z.string().trim().max(1200).optional().nullable(),
  qualification: z.enum(TEACHER_QUALIFICATION_KEYS as [string, ...string[]]),
  institution: z.string().trim().max(120).optional().nullable(),
  qualification_year: z.number().int().min(1970).max(2030).optional().nullable(),
  teaching_certificate: z.boolean().optional(),
  experience_years: z.number().int().min(0).max(60).optional().nullable(),
  declared_no_record: z.literal(true),
  accepted_terms: z.literal(true),
});

const FIELD_LABELS: Record<string, string> = {
  full_name: "שם מלא",
  email: "מייל",
  phone: "טלפון",
  subjects: "תחומי הוראה",
  grade_groups: "שכבות גיל",
  qualification: "הכשרה",
  qualification_year: "שנת סיום",
  experience_years: "שנות ניסיון",
  declared_no_record: "ההצהרה",
  accepted_terms: "אישור התנאים",
};

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-signup", ip, 5, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי ניסיונות - נסו שוב בעוד שעה");
  if (crossSiteWrite(req)) return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 403 });
  if (isBotRequest(req)) return NextResponse.json({ ok: false, error: "bot" }, { status: 400 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  // מלכודת: שדה שאדם לא רואה. מי שמילא אותו מקבל "הצלחה" ושום דבר לא נשמר.
  if (typeof raw.website === "string" && raw.website.trim()) return NextResponse.json({ ok: true, existing: true });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const key = String(parsed.error.issues[0]?.path[0] ?? "");
    return NextResponse.json({ ok: false, error: `יש לבדוק את השדה: ${FIELD_LABELS[key] ?? key}` }, { status: 400 });
  }
  const b = parsed.data;

  if (!phoneNationalDigits(b.phone) && !foreignPhoneDigits(b.phone)) {
    return NextResponse.json({ ok: false, error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }
  if (!b.online && b.regions.length === 0) {
    return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת, או לסמן הוראה אונליין" }, { status: 400 });
  }
  const regions = b.regions.filter((c) => ALL_CITIES.has(c)).slice(0, 6);
  if (!b.online && regions.length === 0) {
    return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת, או לסמן הוראה אונליין" }, { status: 400 });
  }
  // הוראה מתקנת רק עם הכשרה שמתאימה לה. הסימון עצמו נבדק שוב באישור באדמין.
  const remedial = b.remedial && qualificationAllowsRemedial(b.qualification);

  // המייל כבר רשום: לא מחזירים טוקן ולא עוגייה (אחרת כל מי שיודע מייל של
  // מורה היה מקבל שליטה בפרופיל שלו/ה). הקישור נשלח לכתובת הרשומה בלבד.
  const { data: existing } = await supabaseAdmin
    .from("teachers")
    .select("id, email, full_name, edit_token, link_sent_at")
    .eq("email", b.email)
    .maybeSingle();
  if (existing) {
    await resendPersonalLink(existing as { id: string; email: string; full_name: string; edit_token: string; link_sent_at: string | null });
    return NextResponse.json({ ok: true, existing: true });
  }

  const att = sanitizeAttribution(raw);
  const token = newEditToken();
  const insertRow = async (slug: string) =>
    supabaseAdmin
      .from("teachers")
      .insert({
        full_name: b.full_name,
        email: b.email,
        phone: b.phone,
        gender: b.gender ?? null,
        slug,
        edit_token: token,
        subjects: b.subjects,
        remedial,
        grade_groups: b.grade_groups,
        regions,
        online: b.online,
        languages: b.languages?.length ? b.languages : ["עברית"],
        price_text: b.price_text || null,
        bio: b.bio || null,
        qualification: b.qualification,
        institution: b.institution || null,
        qualification_year: b.qualification_year ?? null,
        teaching_certificate: !!b.teaching_certificate,
        experience_years: b.experience_years ?? null,
        declared_no_record: true,
        accepted_terms_at: new Date().toISOString(),
        listing_state: "pending",
        link_sent_at: new Date().toISOString(),
        signup_channel: att.channel ?? null,
        signup_utm_source: att.utm_source ?? null,
        signup_utm_medium: att.utm_medium ?? null,
        signup_utm_campaign: att.utm_campaign ?? null,
        signup_referrer: att.referrer_host ?? null,
        signup_source: "self",
      })
      .select("id")
      .single();

  let { data: created, error } = await insertRow(await uniqueTeacherSlug(b.full_name));
  if (error?.code === "23505") {
    // התנגשות ייחודיות: אותו מייל בבקשה מקבילה, או אותו slug באותו רגע.
    const { data: raced } = await supabaseAdmin.from("teachers").select("id").eq("email", b.email).maybeSingle();
    if (raced) return NextResponse.json({ ok: true, existing: true });
    ({ data: created, error } = await insertRow(await uniqueTeacherSlug(`${b.full_name} ${Date.now().toString(36).slice(-4)}`)));
  }
  if (error || !created) {
    console.error("teacher signup insert failed:", error?.message);
    return NextResponse.json({ ok: false, error: "השמירה נכשלה - נסו שוב" }, { status: 500 });
  }

  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { count: recent } = await supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).gte("created_at", since);
  const flooded = (recent ?? 0) > DAILY_SIGNUP_EMAIL_CAP;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";

  if (!flooded) {
    // אלינו: מורה חדש/ה ממתין/ה לאימות (נמען פנימי - מותר תמיד).
    void sendOpsEmail({
      template: "teacher_signup_admin",
      subject: `מורה חדש/ה נרשם/ה למענה הלימודי: ${b.full_name}`,
      html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;line-height:1.7">
        <p><strong>${escapeHtml(b.full_name)}</strong> (${escapeHtml(b.email)}, ${escapeHtml(b.phone)})</p>
        <p>תחומים: ${b.subjects.map(subjectLabel).join(", ")}${remedial ? " · הוראה מתקנת" : ""}<br/>
        שכבות: ${b.grade_groups.map(gradeGroupLabel).join(", ")}<br/>
        ערים: ${escapeHtml(regions.join(", ") || "-")}${b.online ? " · אונליין" : ""}<br/>
        הכשרה: ${escapeHtml(qualificationLabel(b.qualification))}${b.institution ? ` (${escapeHtml(b.institution)})` : ""}</p>
        <p><a href="${site}/admin/teachers">לאישור באדמין ←</a></p>
      </div>`,
    });
    void sendTeacherSignupReceivedEmail({ id: created.id, email: b.email, full_name: b.full_name, edit_token: token });
  } else if ((recent ?? 0) === DAILY_SIGNUP_EMAIL_CAP + 1) {
    void sendOpsEmail({
      template: "teacher_signup_flood",
      subject: `מענה לימודי: יותר מ-${DAILY_SIGNUP_EMAIL_CAP} הרשמות מורים ביממה - המיילים הושהו`,
      html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;line-height:1.7"><p>ההרשמות ממשיכות להישמר וממתינות באדמין, אבל מיילי הקליטה וההתראות הושהו עד שהקצב ירד. כדאי לבדוק אם אלה הרשמות אמיתיות.</p><p><a href="${site}/admin/teachers">לעמוד המורים ←</a></p></div>`,
    });
  }

  // הקישור האישי מוצג פעם אחת במסך הסיום (גיבוי למייל שנחת בספאם).
  const res = NextResponse.json({ ok: true, id: created.id, link: teacherLinkUrl(token) });
  return setTeacherCookie(res, token);
}
