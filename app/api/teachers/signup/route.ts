import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { isBotRequest } from "@/app/lib/bot-detect";
import { sanitizeAttribution } from "@/app/lib/attribution";
import { REGION_CITIES } from "@/app/lib/regions";
import { sendOpsEmail, escapeHtml } from "@/app/lib/ops-email";
import { sendTeacherSignupReceivedEmail } from "@/app/lib/teacher-emails";
import {
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_KEYS,
  TEACHER_QUALIFICATION_KEYS,
  qualificationAllowsRemedial,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
} from "@/app/lib/teacher-options";
import { newEditToken, uniqueTeacherSlug } from "@/app/lib/teachers.server";

// הרשמת מורה למענה הלימודי. בלי חשבון: הטופס יוצר שורה במצב pending ומחזיר
// טוקן אישי שמשמש לעריכה ולתשלום (אותה גישה כמו מילוי פרופיל מהזמנת מרכז).
// האישור הוא ידני באדמין, מול התעודה שהועלתה אחרי השמירה.

export const dynamic = "force-dynamic";

const ALL_CITIES = new Set(Object.values(REGION_CITIES).flat());

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
  languages: z.array(z.string().max(20)).max(6).optional(),
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

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-signup", ip, 5, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי ניסיונות - נסו שוב בעוד שעה");
  if (isBotRequest(req)) return NextResponse.json({ ok: false, error: "bot" }, { status: 400 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: `שדה לא תקין: ${first?.path.join(".") || "?"}` }, { status: 400 });
  }
  const b = parsed.data;

  if (!b.online && b.regions.length === 0) {
    return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת, או לסמן הוראה אונליין" }, { status: 400 });
  }
  const regions = b.regions.filter((c) => ALL_CITIES.has(c)).slice(0, 6);
  // הוראה מתקנת רק עם הכשרה שמתאימה לה. הסימון עצמו נבדק שוב באישור באדמין.
  const remedial = b.remedial && qualificationAllowsRemedial(b.qualification);

  // אותו מייל פעמיים = אותו אדם שמילא שוב; מחזירים את הטוקן הקיים במקום
  // שורה כפולה (הטופס אומר לו שהפרופיל כבר קיים).
  const { data: existing } = await supabaseAdmin
    .from("teachers")
    .select("id, edit_token, listing_state")
    .eq("email", b.email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, existing: true, token: existing.edit_token, state: existing.listing_state });
  }

  const att = sanitizeAttribution(raw);
  const token = newEditToken();
  const slug = await uniqueTeacherSlug(b.full_name);
  const { data: created, error } = await supabaseAdmin
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
      signup_channel: att.channel ?? null,
      signup_utm_source: att.utm_source ?? null,
      signup_utm_medium: att.utm_medium ?? null,
      signup_utm_campaign: att.utm_campaign ?? null,
      signup_referrer: att.referrer_host ?? null,
      signup_source: "self",
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("teacher signup insert failed:", error?.message);
    return NextResponse.json({ ok: false, error: "השמירה נכשלה - נסו שוב" }, { status: 500 });
  }

  // אלינו: מורה חדש/ה ממתין/ה לאימות (נמען פנימי - מותר תמיד).
  void sendOpsEmail({
    template: "teacher_signup_admin",
    subject: `מורה חדש/ה נרשם/ה למענה הלימודי: ${b.full_name}`,
    html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;line-height:1.7">
      <p><strong>${escapeHtml(b.full_name)}</strong> (${escapeHtml(b.email)}, ${escapeHtml(b.phone)})</p>
      <p>תחומים: ${b.subjects.map(subjectLabel).join(", ")}${remedial ? " · הוראה מתקנת" : ""}<br/>
      שכבות: ${b.grade_groups.map(gradeGroupLabel).join(", ")}<br/>
      ערים: ${regions.join(", ") || "-"}${b.online ? " · אונליין" : ""}<br/>
      הכשרה: ${escapeHtml(qualificationLabel(b.qualification))}${b.institution ? ` (${escapeHtml(b.institution)})` : ""}</p>
      <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il"}/admin/teachers">לאישור באדמין ←</a></p>
    </div>`,
  });
  // למורה: נחסם עד שהתבנית תאושר (ראו teacher-emails.ts); המסך מציג את הקישור.
  void sendTeacherSignupReceivedEmail({ id: created.id, email: b.email, full_name: b.full_name, edit_token: token });

  return NextResponse.json({ ok: true, id: created.id, token });
}
