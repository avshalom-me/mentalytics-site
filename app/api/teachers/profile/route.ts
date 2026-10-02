import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { REGION_CITIES } from "@/app/lib/regions";
import { phoneNationalDigits, foreignPhoneDigits } from "@/app/lib/phone";
import { loadTeacherFromRequest, teacherStats, teacherPhotoUrl, crossSiteWrite, emptyTeacherStats } from "@/app/lib/teachers.server";
import { trialPhase } from "@/app/lib/teacher-trial";
import {
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_KEYS,
  TEACHER_QUALIFICATION_KEYS,
  TEACHER_PRICE_GROSS,
  qualificationAllowsRemedial,
} from "@/app/lib/teacher-options";

// הפרופיל של המורה המחובר/ת (לפי העוגייה): GET לקריאה, כולל נתוני הופעות
// ופניות, ו-PATCH לעריכת השדות שמותר למורה לשנות. מצב הרישום, תאריכי הניסיון
// והחיוב נקראים כאן ולעולם לא נכתבים מהטופס - רק מהאדמין ומהקרון.

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
  languages: z.array(z.string().max(20)).max(7).optional(),
  price_text: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(1200).nullable().optional(),
  qualification: z.enum(TEACHER_QUALIFICATION_KEYS as [string, ...string[]]).optional(),
  institution: z.string().trim().max(120).nullable().optional(),
  qualification_year: z.number().int().min(1970).max(2030).nullable().optional(),
  teaching_certificate: z.boolean().optional(),
  experience_years: z.number().int().min(0).max(60).nullable().optional(),
});

const FIELD_LABELS: Record<string, string> = {
  full_name: "שם מלא",
  phone: "טלפון",
  subjects: "תחומי הוראה",
  grade_groups: "שכבות גיל",
  qualification: "הכשרה",
  qualification_year: "שנת סיום",
  experience_years: "שנות ניסיון",
};

function view(t: Record<string, unknown>) {
  const state = String(t.listing_state);
  const trialEndsAt = (t.trial_ends_at as string | null) ?? null;
  const subscribed = !!t.sumit_recurring_id && !t.sumit_cancelled_at;
  const phase = state === "trial" ? trialPhase(trialEndsAt) : null;
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
    listing_state: state,
    /** אחרי האישור ההכשרה נעולה לעריכה - שינוי שלה עובר דרכנו. */
    qualification_locked: !!t.approved_at,
    trial_ends_at: trialEndsAt,
    trial_phase: phase,
    paused_until: t.paused_until,
    subscribed,
    first_charge_on: t.sumit_first_charge_on,
    // ההרשמה לתשלום נפתחת מיום 85 (או בארכיון). לפני כן לא מבקשים כלום.
    can_subscribe: !subscribed && (state === "archived" || (state === "trial" && phase !== "free" && phase !== null)),
    price_gross: TEACHER_PRICE_GROSS,
  };
}

export async function GET(req: NextRequest) {
  const teacher = await loadTeacherFromRequest(req);
  if (!teacher) return NextResponse.json({ ok: false, error: "לא מחובר/ת" }, { status: 401 });
  const id = String(teacher.id);
  const stats = (await teacherStats([id]))[id] ?? emptyTeacherStats();
  return NextResponse.json({ ok: true, teacher: view(teacher), stats }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const rl = rateLimit("teacher-profile", clientIp(req), 40, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי שמירות - נסו שוב מאוחר יותר");
  if (crossSiteWrite(req)) return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 403 });
  const teacher = await loadTeacherFromRequest(req);
  if (!teacher) return NextResponse.json({ ok: false, error: "לא מחובר/ת" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const parsed = Patch.safeParse(raw);
  if (!parsed.success) {
    const key = String(parsed.error.issues[0]?.path[0] ?? "");
    return NextResponse.json({ ok: false, error: `יש לבדוק את השדה: ${FIELD_LABELS[key] ?? key}` }, { status: 400 });
  }
  const fields: Record<string, unknown> = { ...parsed.data };

  if (typeof fields.phone === "string" && !phoneNationalDigits(fields.phone) && !foreignPhoneDigits(fields.phone)) {
    return NextResponse.json({ ok: false, error: "מספר הטלפון אינו תקין" }, { status: 400 });
  }
  if (Array.isArray(fields.regions)) fields.regions = (fields.regions as string[]).filter((c) => ALL_CITIES.has(c)).slice(0, 6);
  if (Array.isArray(fields.languages) && (fields.languages as string[]).length === 0) fields.languages = ["עברית"];

  // ההכשרה היא מה שאומת מול התעודה. לפני האישור המורה חופשי/ה לתקן אותה;
  // אחרי האישור היא נעולה, ואת "הוראה מתקנת" אפשר רק להסיר - אחרת מורה
  // שאושר/ה לתגבור היה/הייתה מסמן/ת את עצמו/ה להוראה מתקנת בלי שאיש בדק.
  if (teacher.approved_at) {
    delete fields.qualification;
    delete fields.institution;
    delete fields.qualification_year;
    delete fields.teaching_certificate;
    if (fields.remedial === true && !teacher.remedial) delete fields.remedial;
  } else {
    const qualification = (fields.qualification as string | undefined) ?? (teacher.qualification as string | null);
    const wantsRemedial = typeof fields.remedial === "boolean" ? fields.remedial : !!teacher.remedial;
    fields.remedial = wantsRemedial && qualificationAllowsRemedial(qualification);
  }

  const online = typeof fields.online === "boolean" ? fields.online : !!teacher.online;
  const regions = Array.isArray(fields.regions) ? (fields.regions as string[]) : ((teacher.regions as string[] | null) ?? []);
  if (!online && regions.length === 0) {
    return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת, או לסמן הוראה אונליין" }, { status: 400 });
  }
  fields.updated_at = new Date().toISOString();

  const { data: fresh, error } = await supabaseAdmin.from("teachers").update(fields).eq("id", String(teacher.id)).select("*").single();
  if (error || !fresh) return NextResponse.json({ ok: false, error: "השמירה נכשלה" }, { status: 500 });
  return NextResponse.json({ ok: true, teacher: view(fresh as Record<string, unknown>) });
}
