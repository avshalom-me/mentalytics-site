import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { isBotRequest } from "@/app/lib/bot-detect";
import { CITY_TO_REGION, ALL_REGIONS } from "@/app/lib/regions";
import { matchTeachers, teacherSupplyForKeys, type TeacherRow } from "@/app/lib/teacher-match";
import {
  TEACHER_GRADE_KEYS,
  TEACHER_SUBJECT_KEYS,
  TEACHER_LISTED_STATES,
  TEACHER_LANGUAGES,
  TEACHER_REFERRAL_KEYS,
  teacherSearchFromKey,
  subjectLabel,
  gradeGroupLabel,
  qualificationLabel,
  expertiseLabel,
  lessonSettingsText,
  teacherSearchLabel,
  type TeacherGradeGroup,
  type TeacherSubject,
} from "@/app/lib/teacher-options";
import { sanitizeNeeds } from "@/app/lib/teacher-needs";
import { TEACHER_PUBLIC_COLUMNS, teacherPhotoUrl } from "@/app/lib/teachers.server";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";

// חיפוש מורים: מתוך תוצאות שאלון הילדים (לפי מפתח ההמלצה), ומהדלת הציבורית
// "לימוד חכם" (direct: ההורה בוחר תחום וסוג מורה בעצמו). נפרד לגמרי מ-
// /api/match: קורא את teachers בלבד ומחזיר כרטיסים בלבד.
//
// הטקסט החופשי שהורה כותב בדלת לא מגיע לכאן: הוא מפוענח בדפדפן
// (teacher-query-parse.ts), ומה שנשלח הוא הבחירות בלבד.
//
// הדבר היחיד שנכתב כאן הוא שורת ביקוש ב-teacher_searches (מה חופש, איפה,
// וכמה חזרו) - הנתון שלפיו מגייסים מורים. הוא לא נכתב ל-analytics_events:
// match_search ו-match_results מזינים את מדדי ההיצע של המטפלים, וחיפוש מורה
// שחוזר ריק היה נספר שם כמחסור במטפלים. מכשיר של הצוות (noTrack) ובוטים
// אינם נרשמים. ההופעות והלחיצות נרשמות מהלקוח, ב-/api/teacher-event.

export const dynamic = "force-dynamic";

/**
 * כל המורים המוצגים. fetchAllRows: מעבר ל-1000 שורות, select רגיל היה מחזיר
 * תת-קבוצה שרירותית בלי שגיאה, ומורים היו נעלמים מהחיפוש.
 */
function loadListedTeachers(): Promise<TeacherRow[]> {
  return fetchAllRows<TeacherRow>(
    () =>
      supabaseAdmin
        .from("teachers")
        .select(TEACHER_PUBLIC_COLUMNS)
        .in("listing_state", [...TEACHER_LISTED_STATES])
        .order("id") as unknown as { range: (from: number, to: number) => PromiseLike<{ data: TeacherRow[] | null; error: { message: string } | null }> },
  );
}

const KNOWN_KEYS = new Set<string>(Object.values(TEACHER_REFERRAL_KEYS));

/**
 * שער ההיצע (ראו teacherSupplyForKeys): לכל מפתח המלצה שבדוח - האם יש מורה
 * להציע. מסך התוצאות של שאלון הילדים שואל פעם אחת, ומציג את כפתור "חיפוש
 * מורה" רק למפתחות שחזרו true. לא נרשם כביקוש: זו לא פעולה של ההורה.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit("match-teachers-supply", clientIp(req), 120, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "Too many requests");
  const sp = req.nextUrl.searchParams;
  const keys = Array.from(new Set((sp.get("keys") ?? "").split("|").map((k) => k.trim()).filter((k) => KNOWN_KEYS.has(k)))).slice(0, 5);
  const gradeRaw = sp.get("gradeGroup");
  const gradeGroup = (TEACHER_GRADE_KEYS as string[]).includes(gradeRaw ?? "") ? (gradeRaw as TeacherGradeGroup) : null;
  if (keys.length === 0) return NextResponse.json({ ok: true, available: {} });
  try {
    const available = teacherSupplyForKeys(await loadListedTeachers(), keys, gradeGroup);
    // בלי מטמון: מורה שאושר/ה עכשיו פותח/ת את הכפתור בדוח הבא, לא בעוד דקה.
    return NextResponse.json({ ok: true, available }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("match-teachers supply read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit("match-teachers", clientIp(req), 60, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי חיפושים - נסו שוב בעוד רגע");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  // מהשאלון: המפתח של ההמלצה (למשל "הוראה מתקנת - חשבון") קובע תחום וסוג מורה.
  // מהדלת הציבורית (direct): התחום וסוג המורה הם מה שההורה בחר.
  const direct = body.direct === true;
  const referralKey = !direct && typeof body.key === "string" ? body.key.slice(0, 80) : "";
  const fromKey = teacherSearchFromKey(referralKey);
  const asked = direct ? body.subject : fromKey.subject;
  const subject: TeacherSubject | null = (TEACHER_SUBJECT_KEYS as string[]).includes(String(asked ?? "")) ? (asked as TeacherSubject) : null;
  const remedial = direct ? body.remedial === true : fromKey.remedial;
  // הקשיים שברקע: מה שסומן בדלת, או מה שהשאלון כבר זיהה. העדפה, לא סינון.
  const needs = sanitizeNeeds(body.needs);
  const gradeRaw = typeof body.gradeGroup === "string" ? body.gradeGroup : null;
  const gradeGroup = (TEACHER_GRADE_KEYS as string[]).includes(gradeRaw ?? "") ? (gradeRaw as TeacherGradeGroup) : null;
  const city = typeof body.city === "string" && CITY_TO_REGION[body.city] ? body.city : null;
  const regionRaw = typeof body.region === "string" ? body.region : null;
  const region = city ? (CITY_TO_REGION[city] ?? null) : regionRaw && ALL_REGIONS.includes(regionRaw) ? regionRaw : null;
  const onlineRequired = body.onlineRequired === true;
  const language = (TEACHER_LANGUAGES as readonly string[]).includes(String(body.language)) ? String(body.language) : "עברית";
  const genderPreference = body.genderPreference === "זכר" || body.genderPreference === "נקבה" ? body.genderPreference : null;
  const limit = Math.max(1, Math.min(Number(body.limit) || 10, 20));

  let rows: TeacherRow[];
  try {
    rows = await loadListedTeachers();
  } catch (e) {
    console.error("match-teachers read failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה בחיפוש" }, { status: 500 });
  }
  const matches = matchTeachers(rows, { subject, remedial, gradeGroup, city, region, onlineRequired, language, genderPreference, limit, needs });

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
      quiz_type: direct ? "direct" : body.quizType === "school" ? "school" : "kids",
      session_id: typeof body.sessionId === "string" && body.sessionId.length <= 128 ? body.sessionId : null,
      needs,
      // האם ההורה נעזר בשדה הכתיבה החופשית. הטקסט עצמו לא מגיע לשרת.
      used_text: direct && body.usedText === true,
    });
    if (logError) console.error("teacher_searches insert failed:", logError.message);
  }

  return NextResponse.json({
    ok: true,
    search: { subject, remedial, gradeGroup, city, region, onlineRequired, needs, label: direct ? teacherSearchLabel(subject, remedial) : fromKey.label },
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
      // ניסיון מוצהר (לא מאומת) ומקום השיעור - מוצגים בכרטיס. need_labels הם
      // מתוכו: מה שמתאים לקשיים שצוינו בחיפוש, ולכן קידם את המורה בסדר.
      expertise_labels: (m.teacher.expertise ?? []).map((k) => expertiseLabel(k, true)),
      need_labels: m.needsMatched.map((k) => expertiseLabel(k, true)),
      lesson_text: lessonSettingsText(m.teacher),
      experience_years: m.teacher.experience_years,
      price_text: m.teacher.price_text,
      match_score: m.score,
      in_requested_area: m.inRequestedArea,
      match_reasons: m.reasons,
    })),
  });
}
