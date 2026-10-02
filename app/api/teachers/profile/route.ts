import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { REGION_CITIES } from "@/app/lib/regions";
import { loadTeacherByToken, teacherStats, teacherPhotoUrl } from "@/app/lib/teachers.server";
import {
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_KEYS,
  TEACHER_QUALIFICATION_KEYS,
  TEACHER_PRICE_GROSS,
  qualificationAllowsRemedial,
} from "@/app/lib/teacher-options";

// הפרופיל של מורה, לפי הטוקן האישי: GET לקריאה (כולל נתוני הופעות ופניות),
// PATCH לעריכת השדות שמותר למורה לשנות. מצב הרישום, תאריכי הניסיון והחיוב
// נקראים כאן ולעולם לא נכתבים מהטופס - רק מהאדמין ומהקרון.

export const dynamic = "force-dynamic";

const ALL_CITIES = new Set(Object.values(REGION_CITIES).flat());

const Patch = z.object({
  full_name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  gender: z.enum(["זכר", "נקבה"]).nullable().optional(),
  subjects: z.array(z.enum(TEACHER_SUBJECT_KEYS as [string, ...string[]])).min(1).max(5).optional(),
  remedial: z.boolean().optional(),
  grade_groups: z.array(z.enum(TEACHER_GRADE_KEYS as [string, ...string[]])).min(1).max(4).optional(),
  regions: z.array(z.string()).max(6).optional(),
  online: z.boolean().optional(),
  languages: z.array(z.string().max(20)).max(6).optional(),
  price_text: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(1200).nullable().optional(),
  qualification: z.enum(TEACHER_QUALIFICATION_KEYS as [string, ...string[]]).optional(),
  institution: z.string().trim().max(120).nullable().optional(),
  qualification_year: z.number().int().min(1970).max(2030).nullable().optional(),
  teaching_certificate: z.boolean().optional(),
  experience_years: z.number().int().min(0).max(60).nullable().optional(),
});

function publicView(t: Record<string, unknown>) {
  return {
    id: t.id,
    full_name: t.full_name,
    email: t.email,
    phone: t.phone,
    gender: t.gender,
    slug: t.slug,
    subjects: t.subjects,
    remedial: t.remedial,
    grade_groups: t.grade_groups,
    regions: t.regions,
    online: t.online,
    languages: t.languages,
    price_text: t.price_text,
    bio: t.bio,
    qualification: t.qualification,
    institution: t.institution,
    qualification_year: t.qualification_year,
    teaching_certificate: t.teaching_certificate,
    experience_years: t.experience_years,
    has_certificate: !!t.certificate_path,
    photo_url: teacherPhotoUrl({ id: String(t.id), photo_path: (t.photo_path as string | null) ?? null }),
    listing_state: t.listing_state,
    approved_at: t.approved_at,
    trial_ends_at: t.trial_ends_at,
    paying_since: t.paying_since,
    paused_until: t.paused_until,
    sumit_recurring_id: t.sumit_recurring_id ? true : false,
    sumit_first_charge_on: t.sumit_first_charge_on,
    price_gross: TEACHER_PRICE_GROSS,
    created_at: t.created_at,
  };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const teacher = await loadTeacherByToken(token);
  if (!teacher) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
  const stats = (await teacherStats([String(teacher.id)]))[String(teacher.id)];
  return NextResponse.json({ ok: true, teacher: publicView(teacher), stats });
}

export async function PATCH(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-profile", ip, 40, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי שמירות - נסו שוב מאוחר יותר");
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const token = typeof raw.token === "string" ? raw.token : "";
  const teacher = await loadTeacherByToken(token);
  if (!teacher) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });

  const parsed = Patch.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ ok: false, error: `שדה לא תקין: ${first?.path.join(".") || "?"}` }, { status: 400 });
  }
  const fields: Record<string, unknown> = { ...parsed.data };
  if (Array.isArray(fields.regions)) fields.regions = (fields.regions as string[]).filter((c) => ALL_CITIES.has(c)).slice(0, 6);
  const qualification = (fields.qualification as string | undefined) ?? (teacher.qualification as string | null);
  if (typeof fields.remedial === "boolean") fields.remedial = fields.remedial && qualificationAllowsRemedial(qualification);
  else if (fields.qualification && !qualificationAllowsRemedial(qualification)) fields.remedial = false;
  if (Array.isArray(fields.languages) && (fields.languages as string[]).length === 0) fields.languages = ["עברית"];
  const online = typeof fields.online === "boolean" ? fields.online : !!teacher.online;
  const regions = Array.isArray(fields.regions) ? (fields.regions as string[]) : ((teacher.regions as string[] | null) ?? []);
  if (!online && regions.length === 0) {
    return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת, או לסמן הוראה אונליין" }, { status: 400 });
  }
  fields.updated_at = new Date().toISOString();

  const { error } = await supabaseAdmin.from("teachers").update(fields).eq("id", String(teacher.id));
  if (error) return NextResponse.json({ ok: false, error: "השמירה נכשלה" }, { status: 500 });
  const fresh = await loadTeacherByToken(token);
  return NextResponse.json({ ok: true, teacher: fresh ? publicView(fresh) : null });
}
