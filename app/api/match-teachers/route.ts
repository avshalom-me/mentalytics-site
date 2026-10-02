import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { CITY_TO_REGION, ALL_REGIONS } from "@/app/lib/regions";
import { matchTeachers, type TeacherRow } from "@/app/lib/teacher-match";
import {
  TEACHER_EXPIRED_FALLBACK,
  TEACHER_GRADE_KEYS,
  TEACHER_SUBJECT_KEYS,
  teacherSearchFromKey,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
  type TeacherGradeGroup,
  type TeacherSubject,
} from "@/app/lib/teacher-options";
import { TEACHER_PUBLIC_COLUMNS, teacherPhotoUrl } from "@/app/lib/teachers.server";

// חיפוש מורים מתוך תוצאות שאלון הילדים. נפרד לגמרי מ-/api/match: קורא את
// teachers בלבד, מחזיר כרטיסים בלבד, ולא כותב כלום (ההופעות נרשמות מהלקוח
// דרך /api/teacher-event, כך שהסכמת המעקב של הדפדפן נשמרת).

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("match-teachers", ip, 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי חיפושים - נסו שוב בעוד רגע");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  // המפתח של ההמלצה (למשל "הוראה מתקנת - חשבון") קובע תחום וסוג מורה;
  // אפשר גם לשלוח subject/remedial ישירות.
  const fromKey = typeof body.key === "string" ? teacherSearchFromKey(body.key) : null;
  const subjectRaw = (typeof body.subject === "string" ? body.subject : fromKey?.subject) ?? null;
  const subject = (TEACHER_SUBJECT_KEYS as string[]).includes(subjectRaw ?? "") ? (subjectRaw as TeacherSubject) : null;
  const remedial = typeof body.remedial === "boolean" ? body.remedial : (fromKey?.remedial ?? false);
  const gradeRaw = typeof body.gradeGroup === "string" ? body.gradeGroup : null;
  const gradeGroup = (TEACHER_GRADE_KEYS as string[]).includes(gradeRaw ?? "") ? (gradeRaw as TeacherGradeGroup) : null;
  const city = typeof body.city === "string" && CITY_TO_REGION[body.city] ? body.city : null;
  const regionRaw = typeof body.region === "string" ? body.region : null;
  const region = city ? (CITY_TO_REGION[city] ?? null) : ALL_REGIONS.includes(regionRaw ?? "") ? regionRaw : null;
  const onlineRequired = body.onlineRequired === true;
  const language = typeof body.language === "string" && body.language ? body.language.slice(0, 20) : "עברית";
  const genderPreference = body.genderPreference === "זכר" || body.genderPreference === "נקבה" ? (body.genderPreference as string) : null;
  const limit = Math.max(1, Math.min(Number(body.limit) || 10, 20));

  const states = TEACHER_EXPIRED_FALLBACK ? ["trial", "paying", "expired"] : ["trial", "paying"];
  const { data, error } = await supabaseAdmin.from("teachers").select(TEACHER_PUBLIC_COLUMNS).in("listing_state", states).limit(2000);
  if (error) return NextResponse.json({ ok: false, error: "שגיאה בחיפוש" }, { status: 500 });
  const rows = (data ?? []) as unknown as TeacherRow[];

  const input = { subject, remedial, gradeGroup, city, region, onlineRequired, language, genderPreference, limit };
  let matches = matchTeachers(rows, input);
  if (matches.length === 0 && TEACHER_EXPIRED_FALLBACK) {
    // הגיבוי: מורים שהניסיון שלהם נגמר, רק כשאין אף מורה רשום/ה שמתאים/ה.
    matches = matchTeachers(
      rows.map((r) => (r.listing_state === "expired" ? { ...r, listing_state: "trial" } : r)),
      input,
    ).filter((m) => rows.find((r) => r.id === m.teacher.id)?.listing_state === "expired");
  }

  return NextResponse.json({
    ok: true,
    search: { subject, remedial, gradeGroup, city, region, onlineRequired, label: fromKey?.label ?? null },
    matches: matches.map((m) => ({
      id: m.teacher.id,
      full_name: m.teacher.full_name,
      gender: m.teacher.gender,
      slug: m.teacher.slug,
      photo_url: teacherPhotoUrl(m.teacher),
      bio: m.teacher.bio,
      phone: m.teacher.phone,
      regions: m.teacher.regions,
      online: m.teacher.online,
      remedial: m.teacher.remedial,
      subjects: m.teacher.subjects,
      subject_labels: m.teacher.subjects.map(subjectLabel),
      grade_labels: m.teacher.grade_groups.map(gradeGroupLabel),
      qualification_label: qualificationLabel(m.teacher.qualification),
      experience_years: m.teacher.experience_years,
      price_text: m.teacher.price_text,
      listing_state: m.teacher.listing_state,
      match_score: m.score,
      in_requested_area: m.inRequestedArea,
      match_reasons: m.reasons,
    })),
  });
}
