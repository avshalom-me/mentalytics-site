import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { isBotRequest } from "@/app/lib/bot-detect";
import { CITY_TO_REGION, ALL_REGIONS } from "@/app/lib/regions";
import { matchTeachers, type TeacherRow } from "@/app/lib/teacher-match";
import {
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
// teachers בלבד ומחזיר כרטיסים בלבד.
//
// הדבר היחיד שנכתב כאן הוא שורת ביקוש ב-teacher_searches (מה חופש, איפה,
// וכמה חזרו) - הנתון שלפיו מגייסים מורים. הוא לא נכתב ל-analytics_events:
// match_search ו-match_results מזינים את מדדי ההיצע של המטפלים, וחיפוש מורה
// שחוזר ריק היה נספר שם כמחסור במטפלים. מכשיר של הצוות (noTrack) ובוטים
// אינם נרשמים. ההופעות והלחיצות נרשמות מהלקוח, ב-/api/teacher-event.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = rateLimit("match-teachers", clientIp(req), 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי חיפושים - נסו שוב בעוד רגע");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  // המפתח של ההמלצה (למשל "הוראה מתקנת - חשבון") קובע תחום וסוג מורה.
  const referralKey = typeof body.key === "string" ? body.key.slice(0, 80) : "";
  const fromKey = teacherSearchFromKey(referralKey);
  const subject: TeacherSubject | null = (TEACHER_SUBJECT_KEYS as string[]).includes(fromKey.subject ?? "") ? fromKey.subject : null;
  const remedial = fromKey.remedial;
  const gradeRaw = typeof body.gradeGroup === "string" ? body.gradeGroup : null;
  const gradeGroup = (TEACHER_GRADE_KEYS as string[]).includes(gradeRaw ?? "") ? (gradeRaw as TeacherGradeGroup) : null;
  const city = typeof body.city === "string" && CITY_TO_REGION[body.city] ? body.city : null;
  const regionRaw = typeof body.region === "string" ? body.region : null;
  const region = city ? (CITY_TO_REGION[city] ?? null) : regionRaw && ALL_REGIONS.includes(regionRaw) ? regionRaw : null;
  const onlineRequired = body.onlineRequired === true;
  const language = typeof body.language === "string" && body.language ? body.language.slice(0, 20) : "עברית";
  const genderPreference = body.genderPreference === "זכר" || body.genderPreference === "נקבה" ? body.genderPreference : null;
  const limit = Math.max(1, Math.min(Number(body.limit) || 10, 20));

  const { data, error } = await supabaseAdmin.from("teachers").select(TEACHER_PUBLIC_COLUMNS).in("listing_state", ["trial", "paying"]).limit(1000);
  if (error) return NextResponse.json({ ok: false, error: "שגיאה בחיפוש" }, { status: 500 });
  const rows = (data ?? []) as unknown as TeacherRow[];
  const matches = matchTeachers(rows, { subject, remedial, gradeGroup, city, region, onlineRequired, language, genderPreference, limit });

  if (body.noTrack !== true && !isBotRequest(req)) {
    const locationAsked = !!(city || region);
    const { error: logError } = await supabaseAdmin.from("teacher_searches").insert({
      referral_key: referralKey || null,
      subject,
      remedial,
      grade_group: gradeGroup,
      region,
      city,
      online: onlineRequired,
      returned: matches.length,
      local_count: locationAsked ? matches.filter((m) => m.inRequestedArea).length : null,
      quiz_type: body.quizType === "school" ? "school" : "kids",
      session_id: typeof body.sessionId === "string" && body.sessionId.length <= 128 ? body.sessionId : null,
    });
    if (logError) console.error("teacher_searches insert failed:", logError.message);
  }

  return NextResponse.json({
    ok: true,
    search: { subject, remedial, gradeGroup, city, region, onlineRequired, label: fromKey.label },
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
      subject_labels: m.teacher.subjects.map(subjectLabel),
      grade_labels: m.teacher.grade_groups.map(gradeGroupLabel),
      qualification_label: qualificationLabel(m.teacher.qualification),
      experience_years: m.teacher.experience_years,
      price_text: m.teacher.price_text,
      match_score: m.score,
      in_requested_area: m.inRequestedArea,
      match_reasons: m.reasons,
    })),
  });
}
