import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cancelSubscription } from "@/app/lib/sumit";
import { teacherStats, emptyTeacherStats, TEACHER_FILES_BUCKET, teacherPhotoUrl, teacherLinkUrl, teacherNote } from "@/app/lib/teachers.server";
import { sendTeacherApprovedEmail, sendTeacherRejectedEmail, sendTeacherCareEmail, type TeacherEmailResult, type TeacherEmailTemplate } from "@/app/lib/teacher-emails";
import { trialEndFor, extendedTrialEnd, israelDate } from "@/app/lib/teacher-trial";
import { teacherEmailPreview, ADMIN_MESSAGE_TEMPLATE } from "@/app/lib/teacher-email-templates";
import { profileCompleteness, remedialHint, type CareTeacher } from "@/app/lib/teacher-care";
import { loadPendingCareDrafts, TEACHER_CARE_AGENT, type CareDraftRow } from "@/app/lib/teacher-care.server";
import { REGION_CITIES } from "@/app/lib/regions";
import { phoneNationalDigits, foreignPhoneDigits } from "@/app/lib/phone";
import { z } from "zod";
import { fetchAllRows } from "@/app/lib/fetch-all-rows";
import {
  qualificationAllowsRemedial,
  qualificationNeedsCertificate,
  qualificationLabel,
  hasActiveStandingOrder,
  TEACHER_FREE_LISTING,
  TEACHER_QUALIFICATION_KEYS,
  TEACHER_LISTED_STATES,
  TEACHER_SUBJECT_KEYS,
  TEACHER_GRADE_KEYS,
  TEACHER_EXPERTISE_MAX,
  sanitizeTeacherExtras,
  teachesInPerson,
} from "@/app/lib/teacher-options";

// ניהול המורים באדמין. Basic Auth + שומר CSRF של ה-middleware מכסים את כל
// /api/admin-*. כל פעולה שמשנה מצב נרשמת בהיסטוריה של המורה (crm_notes עם
// entity_type 'teacher'), שמוצגת בעמוד עצמו.

export const dynamic = "force-dynamic";

const activeSubscription = hasActiveStandingOrder;

const ALL_CITIES = new Set(Object.values(REGION_CITIES).flat());

/** עריכה מהאדמין: אותם שדות כמו בטופס של המורה, וגם מייל והכשרה (שהמורה לא משנה אחרי האישור). */
const AdminPatch = z.object({
  full_name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  phone: z.string().trim().min(7).max(25).optional(),
  gender: z.enum(["זכר", "נקבה"]).nullable().optional(),
  subjects: z.array(z.enum(TEACHER_SUBJECT_KEYS as [string, ...string[]])).min(1).max(5).optional(),
  remedial: z.boolean().optional(),
  grade_groups: z.array(z.enum(TEACHER_GRADE_KEYS as [string, ...string[]])).min(1).max(4).optional(),
  regions: z.array(z.string()).max(6).optional(),
  expertise: z.array(z.string().max(40)).max(TEACHER_EXPERTISE_MAX).optional(),
  focuses: z.array(z.string().max(40)).max(40).optional(),
  lesson_settings: z.array(z.string().max(40)).max(3).optional(),
  languages: z.array(z.string().max(20)).max(7).optional(),
  price_text: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(1200).nullable().optional(),
  qualification: z.enum(TEACHER_QUALIFICATION_KEYS as [string, ...string[]]).optional(),
  institution: z.string().trim().max(120).nullable().optional(),
  qualification_year: z.number().int().min(1970).max(2030).nullable().optional(),
  teaching_certificate: z.boolean().optional(),
  experience_years: z.number().int().min(0).max(60).nullable().optional(),
});

/** שם התבנית בציר הזמן של המורה. */
const EMAIL_LABELS: Record<string, string> = {
  teacher_signup_received: "מייל קליטת ההרשמה",
  teacher_personal_link: "הקישור האישי נשלח",
  teacher_approved: "מייל אישור הפרופיל",
  teacher_rejected: "מייל דחייה",
  teacher_trial_ending: "מייל סוף הניסיון",
  teacher_trial_last_day: "מייל היום האחרון",
  teacher_payment_confirmed: "מייל אישור תשלום",
  teacher_certificate_request: "בקשת תעודה",
  teacher_photo_request: "בקשת תמונה",
  teacher_profile_completion: "בקשת השלמת פרופיל",
  teacher_founding_note: "מייל למורים הראשונים",
  teacher_admin_message: "הודעה מהאדמין",
};

function careView(r: Record<string, unknown>) {
  const t: CareTeacher = {
    id: String(r.id),
    full_name: String(r.full_name ?? ""),
    listing_state: String(r.listing_state),
    created_at: String(r.created_at),
    approved_at: (r.approved_at as string | null) ?? null,
    remedial: !!r.remedial,
    qualification: (r.qualification as string | null) ?? null,
    institution: (r.institution as string | null) ?? null,
    bio: (r.bio as string | null) ?? null,
    price_text: (r.price_text as string | null) ?? null,
    focuses: (r.focuses as string[] | null) ?? null,
    expertise: (r.expertise as string[] | null) ?? null,
    has_certificate: !!r.certificate_path,
    has_photo: !!r.photo_path,
  };
  const c = profileCompleteness(t);
  return { missing: c.missing, done: c.done, total: c.total, hint: remedialHint(t) };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const certFor = sp.get("cert_for");
  if (certFor) {
    const { data } = await supabaseAdmin.from("teachers").select("certificate_path").eq("id", certFor).maybeSingle();
    if (!data?.certificate_path) return NextResponse.json({ ok: false, error: "אין תעודה" }, { status: 404 });
    const { data: signed, error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).createSignedUrl(data.certificate_path, 120);
    if (error || !signed?.signedUrl) return NextResponse.json({ ok: false, error: "לא ניתן לפתוח את התעודה" }, { status: 500 });
    return NextResponse.json({ ok: true, url: signed.signedUrl });
  }

  // ציר הזמן של המורה: מיילים שנשלחו (crm_email_log), ההיסטוריה (crm_notes)
  // ופניות וצפיות (teacher_events), ממוזגים לפי זמן. כמו ציר הזמן של מטפל.
  const timelineFor = sp.get("timeline_for");
  if (timelineFor) {
    const [emails, notes, events] = await Promise.all([
      supabaseAdmin.from("crm_email_log").select("subject, template, status, sent_by, error, created_at").eq("entity_id", timelineFor).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("crm_notes").select("id, body, author, created_at").eq("entity_type", "teacher").eq("entity_id", timelineFor).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("teacher_events").select("event_type, source, quiz_type, created_at").eq("teacher_id", timelineFor).in("event_type", ["whatsapp", "phone", "profile_view"]).order("created_at", { ascending: false }).limit(100),
    ]);
    const err = emails.error ?? notes.error ?? events.error;
    if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    const items = [
      ...(emails.data ?? []).map((e) => ({
        kind: "email" as const,
        ts: String(e.created_at),
        title: `${EMAIL_LABELS[String(e.template)] ?? String(e.template)}${e.status === "sent" ? "" : ` (${e.status})`}`,
        detail: [e.subject, e.sent_by === "admin" ? "נשלח מהאדמין" : "אוטומטי", e.error].filter(Boolean).join(" · "),
      })),
      ...(notes.data ?? []).map((n) => ({ kind: n.author === "admin" ? ("note" as const) : ("system" as const), ts: String(n.created_at), title: String(n.body), detail: "" })),
      ...(events.data ?? []).map((e) => ({
        kind: e.event_type === "profile_view" ? ("view" as const) : ("contact" as const),
        ts: String(e.created_at),
        title: e.event_type === "profile_view" ? "צפייה בפרופיל" : e.event_type === "whatsapp" ? "לחיצה על וואטסאפ" : "לחיצה על טלפון",
        detail: `${e.source === "match" ? "מתוצאות השאלון" : e.source === "direct" ? "מהמאגר" : "מהפרופיל"}${e.quiz_type ? ` · שאלון ${e.quiz_type === "school" ? "יועצות" : "ילדים"}` : ""}`,
      })),
    ].sort((a, b) => (a.ts < b.ts ? 1 : -1));
    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  }

  const notesFor = sp.get("notes_for");
  if (notesFor) {
    const { data, error } = await supabaseAdmin
      .from("crm_notes")
      .select("id, body, author, created_at")
      .eq("entity_type", "teacher")
      .eq("entity_id", notesFor)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, notes: data ?? [] });
  }

  // המיילים כפי שהם נשלחים, עם מורה לדוגמה - לבדיקת הנוסח בלי לשלוח כלום.
  const preview = sp.get("preview");
  if (preview) {
    const built = teacherEmailPreview(preview, trialEndFor().toISOString());
    if (!built) return NextResponse.json({ ok: false, error: "תבנית לא מוכרת" }, { status: 404 });
    return new NextResponse(built.html.replace("<body", `<body data-subject="${built.subject.replace(/"/g, "&quot;")}"`), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  }

  if (sp.get("demand")) {
    const days = Math.max(1, Math.min(Number(sp.get("days")) || 30, 365));
    const { data, error } = await supabaseAdmin.rpc("teacher_search_demand", { p_days: days });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    // כמה דוחות של השאלון כללו המלצה למורה. זה הביקוש שקיים גם לפני שיש חיפושים
    // (כפתור החיפוש מופיע רק כשיש מורה להציע), ולכן זה המספר שמגייסים לפיו בהתחלה.
    // נספר מהרשומה המחקרית (quiz_treatments), בלי ריצות בדיקה של הצוות.
    const recommended: Record<string, number> = {};
    try {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const events = await fetchAllRows<{ metadata: { teachers?: unknown; staff?: unknown } | null }>(() =>
        supabaseAdmin
          .from("analytics_events")
          .select("metadata")
          .eq("event_type", "quiz_treatments")
          .gte("created_at", since)
          .not("metadata->teachers", "is", null)
          .order("created_at"),
      );
      for (const e of events) {
        if (e.metadata?.staff) continue;
        const keys = Array.isArray(e.metadata?.teachers) ? e.metadata.teachers : [];
        for (const k of keys) if (typeof k === "string") recommended[k] = (recommended[k] ?? 0) + 1;
      }
    } catch (e) {
      console.error("teacher recommendation counts failed:", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({
      ok: true,
      days,
      demand: data ?? [],
      recommended: Object.entries(recommended)
        .map(([key, reports]) => ({ key, reports }))
        .sort((a, b) => b.reports - a.reports),
    });
  }

  const { data, error } = await supabaseAdmin.from("teachers").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Record<string, unknown>[];
  const [stats, drafts] = await Promise.all([teacherStats(rows.map((r) => String(r.id))), loadPendingCareDrafts().catch((): Record<string, CareDraftRow[]> => ({}))]);
  const teachers = rows.map((r) => {
    // הטוקן והנתיבים בבאקט לא יוצאים לדפדפן - רק מה שהעמוד מציג.
    const { edit_token, certificate_path, photo_path, subscribe_lock_at, ...rest } = r;
    void subscribe_lock_at;
    return {
      ...rest,
      has_certificate: !!certificate_path,
      has_photo: !!photo_path,
      care: careView(r),
      drafts: drafts[String(r.id)] ?? [],
      photo_url: r.listing_state === "rejected" ? null : teacherPhotoUrl({ id: String(r.id), photo_path: (photo_path as string | null) ?? null }),
      edit_url: teacherLinkUrl(String(edit_token)),
      pay_url: teacherLinkUrl(String(edit_token), "pay"),
      stats: stats[String(r.id)] ?? emptyTeacherStats(),
    };
  });
  return NextResponse.json({ ok: true, teachers }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
  const { data: t } = await supabaseAdmin.from("teachers").select("*").eq("id", id).maybeSingle();
  if (!t) return NextResponse.json({ ok: false, error: "מורה לא נמצא/ה" }, { status: 404 });
  const now = new Date();
  const nowIso = now.toISOString();
  const update: Record<string, unknown> = { updated_at: nowIso };
  const emailTo = { id, email: String(t.email), full_name: String(t.full_name), edit_token: String(t.edit_token) };
  let mail: TeacherEmailResult | null = null;
  // המייל למורה יוצא רק אחרי שהשורה עודכנה: מייל "הפרופיל אושר" על שורה
  // שהעדכון שלה נכשל הוא הבטחה שאף אחד לא מקיים.
  let sendMail: (() => Promise<TeacherEmailResult>) | null = null;
  let note = "";

  switch (action) {
    case "approve": {
      // תעודה נדרשת רק ממי שמצהיר/ה על הכשרה בהוראה מתקנת או בחינוך מיוחד
      // (החלטת הבעלים, 13/10/2026). אין רישוי ממלכתי, ולכן שם התעודה היא
      // האימות, ואישור ראשון בלעדיה דורש אישור מפורש. מורה פרטי/ת מאושר/ת
      // בלי תעודה. מי שכבר אושר/ה בעבר חוזר/ת מהארכיון בלי בדיקה חוזרת.
      const needsCert = qualificationNeedsCertificate(t.qualification as string | null);
      if (needsCert && !t.certificate_path && !t.approved_at && body.without_certificate !== true) {
        return NextResponse.json({ ok: false, error: "ההכשרה המוצהרת מחייבת תעודה, ואין תעודה בפרופיל." }, { status: 409 });
      }
      // כשהמאגר חינם (TEACHER_FREE_LISTING) אין תקופת ניסיון: המורה מוצג/ת בלי
      // תאריך סיום, והקרון לא ישלח לו/ה דבר. אחרת אישור = תחילת 90 ימי הניסיון.
      // מורה שתקופת הניסיון שלו/ה עוד רצה (אישור מחדש אחרי דחייה) שומר/ת את
      // תאריך הסיום; אחרת מתחילה תקופה חדשה, ושני המיילים של סופה יישלחו שוב
      // בבוא הזמן. חזרה מהארכיון היא תמיד תקופה חדשה - זה מה שהכפתור "החזרה
      // למאגר (ניסיון חדש)" אומר, גם כשהארכיון היה ידני והתאריך הישן עוד לא עבר.
      const keep = !TEACHER_FREE_LISTING && t.listing_state !== "archived" && !!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      const trialEndsAt = TEACHER_FREE_LISTING ? null : keep ? String(t.trial_ends_at) : trialEndFor(now).toISOString();
      Object.assign(update, {
        listing_state: activeSubscription(t) ? "paying" : "trial",
        approved_at: (t.approved_at as string | null) ?? nowIso,
        trial_ends_at: trialEndsAt,
        archived_at: null,
        paused_until: null,
        reject_reason: null,
        remedial: !!t.remedial && qualificationAllowsRemedial(t.qualification as string | null),
        ...(keep ? {} : { trial_ending_notified_at: null, trial_last_day_notified_at: null }),
      });
      note = trialEndsAt ? `אושר/ה להצגה. ניסיון עד ${israelDate(new Date(trialEndsAt))}.` : "אושר/ה להצגה, ללא תשלום.";
      if (body.send_email === true) {
        sendMail = () => sendTeacherApprovedEmail({ ...emailTo, trial_ends_at: trialEndsAt, certificate_checked: needsCert && !!t.certificate_path });
      }
      break;
    }
    case "reject": {
      if (activeSubscription(t)) return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      Object.assign(update, { listing_state: "rejected", reject_reason: reason || null });
      note = `נדחה/תה.${reason ? ` סיבה: ${reason}` : ""}`;
      if (body.send_email === true) sendMail = () => sendTeacherRejectedEmail(emailTo, reason || null);
      break;
    }
    case "archive": {
      if (activeSubscription(t)) return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      Object.assign(update, { listing_state: "archived", archived_at: nowIso, paying_since: null });
      note = "הועבר/ה לארכיון ידנית.";
      break;
    }
    case "pause": {
      const days = Math.max(1, Math.min(Number(body.days) || 14, 365));
      const until = new Date(now.getTime() + days * 86_400_000).toISOString();
      update.paused_until = until;
      note = `הוקפא/ה ל-${days} ימים (עד ${israelDate(new Date(until))}).`;
      break;
    }
    case "unpause": {
      update.paused_until = null;
      note = "ההקפאה שוחררה.";
      break;
    }
    case "extend_trial": {
      if (TEACHER_FREE_LISTING) return NextResponse.json({ ok: false, error: "המאגר חינם כרגע, ואין תקופת ניסיון להאריך" }, { status: 400 });
      if (!t.approved_at) return NextResponse.json({ ok: false, error: "המורה עוד לא אושר/ה" }, { status: 400 });
      const days = Math.max(1, Math.min(Number(body.days) || 30, 365));
      const until = extendedTrialEnd((t.trial_ends_at as string | null) ?? null, days, now).toISOString();
      // תאריך סיום חדש = שני המיילים יישלחו שוב לקראתו.
      Object.assign(update, { trial_ends_at: until, trial_ending_notified_at: null, trial_last_day_notified_at: null });
      if (t.listing_state === "archived") Object.assign(update, { listing_state: "trial", archived_at: null });
      note = `הניסיון הוארך ב-${days} ימים, עד ${israelDate(new Date(until))}.`;
      break;
    }
    case "set_remedial": {
      const want = body.remedial === true;
      if (want && !qualificationAllowsRemedial(t.qualification as string | null)) {
        return NextResponse.json({ ok: false, error: "ההכשרה המוצהרת אינה מתאימה לרישום כהוראה מתקנת" }, { status: 400 });
      }
      update.remedial = want;
      note = want ? "סומן/ה כמורה להוראה מתקנת." : "הסימון של הוראה מתקנת הוסר.";
      break;
    }
    case "set_qualification": {
      const q = typeof body.qualification === "string" ? body.qualification : "";
      if (!(TEACHER_QUALIFICATION_KEYS as string[]).includes(q)) return NextResponse.json({ ok: false, error: "הכשרה לא מוכרת" }, { status: 400 });
      update.qualification = q;
      if (!qualificationAllowsRemedial(q)) update.remedial = false;
      note = `ההכשרה עודכנה: ${qualificationLabel(q)}.`;
      break;
    }
    case "mark_paying": {
      // סימון ידני (תשלום בהעברה, הסדר מיוחד) - בלי Sumit.
      if (!t.approved_at) return NextResponse.json({ ok: false, error: "המורה עוד לא אושר/ה" }, { status: 400 });
      Object.assign(update, { listing_state: "paying", paying_since: (t.paying_since as string | null) ?? nowIso, archived_at: null, paused_until: null });
      note = "סומן/ה כמשלם/ת ידנית (ללא הוראת קבע ב-Sumit).";
      break;
    }
    case "revoke_paying": {
      if (activeSubscription(t)) return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      const trialLive = TEACHER_FREE_LISTING || (!!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now);
      Object.assign(update, { listing_state: trialLive ? "trial" : "archived", paying_since: null, archived_at: trialLive ? null : nowIso });
      note = `הסימון כמשלם/ת הוסר. מצב: ${trialLive ? (TEACHER_FREE_LISTING ? "מוצג/ת, ללא תשלום" : "ניסיון") : "ארכיון"}.`;
      break;
    }
    case "cancel_subscription": {
      const recurring = t.sumit_recurring_id && /^\d+$/.test(String(t.sumit_recurring_id)) ? Number(t.sumit_recurring_id) : null;
      if (!recurring) return NextResponse.json({ ok: false, error: "אין הוראת קבע" }, { status: 400 });
      try {
        await cancelSubscription({ recurringItemId: recurring, customerExternalId: `teacher:${id}` });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `הביטול ב-Sumit נכשל: ${e instanceof Error ? e.message : e}` }, { status: 500 });
      }
      const trialLive = TEACHER_FREE_LISTING || (!!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now);
      Object.assign(update, {
        sumit_cancelled_at: nowIso,
        listing_state: trialLive ? "trial" : "archived",
        paying_since: null,
        archived_at: trialLive ? null : nowIso,
      });
      note = `הוראת הקבע (${recurring}) בוטלה ב-Sumit. מצב: ${trialLive ? (TEACHER_FREE_LISTING ? "מוצג/ת, ללא תשלום" : "ניסיון") : "ארכיון"}.`;
      break;
    }
    case "add_note": {
      const text = typeof body.note === "string" ? body.note.trim() : "";
      if (!text) return NextResponse.json({ ok: false, error: "הערה ריקה" }, { status: 400 });
      await teacherNote(id, text, "admin");
      return NextResponse.json({ ok: true });
    }
    case "resend_approval": {
      if ((!TEACHER_FREE_LISTING && !t.trial_ends_at) || !(TEACHER_LISTED_STATES as readonly string[]).includes(String(t.listing_state))) {
        return NextResponse.json({ ok: false, error: "המורה אינו/ה מוצג/ת כרגע" }, { status: 400 });
      }
      mail = await sendTeacherApprovedEmail({
        ...emailTo,
        trial_ends_at: TEACHER_FREE_LISTING ? null : String(t.trial_ends_at),
        certificate_checked: qualificationNeedsCertificate(t.qualification as string | null) && !!t.certificate_path,
      });
      await teacherNote(id, `מייל האישור נשלח שוב: ${mail.status}${mail.error ? ` (${mail.error})` : ""}`);
      return NextResponse.json({ ok: true, mail });
    }
    case "unapprove": {
      // חזרה לממתינים: הפרופיל יורד מהמאגר בלי מייל, כמו unapprove אצל המטפלים.
      if (activeSubscription(t)) return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      Object.assign(update, { listing_state: "pending", paused_until: null, archived_at: null, reject_reason: null });
      note = "הוחזר/ה לממתינים לאישור.";
      break;
    }
    case "send_message": {
      // הודעה חופשית מהאדמין, עם הקישור האישי בסוף. נרשמת ביומן המיילים.
      const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 150) : "";
      const text = typeof body.body === "string" ? body.body.trim().slice(0, 4000) : "";
      if (!subject || !text) return NextResponse.json({ ok: false, error: "חסר נושא או תוכן" }, { status: 400 });
      mail = await sendTeacherCareEmail(emailTo, { template: ADMIN_MESSAGE_TEMPLATE as TeacherEmailTemplate, subject, body: text });
      await teacherNote(id, `הודעה נשלחה מהאדמין: "${subject}". מייל: ${mail.status}${mail.error ? ` (${mail.error})` : ""}`, "admin");
      return NextResponse.json({ ok: mail.status === "sent", mail, error: mail.status === "sent" ? undefined : `המייל לא נשלח: ${mail.error ?? mail.status}` });
    }
    case "draft_send":
    case "draft_dismiss": {
      // טיוטת טיפול מהתור (agent_actions, סוכן teacher_care): שליחה אחרי עריכה, או דחייה.
      const draftId = typeof body.draft_id === "string" ? body.draft_id : "";
      const { data: draft } = await supabaseAdmin
        .from("agent_actions")
        .select("id, payload, status")
        .eq("id", draftId)
        .eq("agent", TEACHER_CARE_AGENT)
        .eq("entity_id", id)
        .maybeSingle();
      if (!draft || draft.status !== "pending") return NextResponse.json({ ok: false, error: "הטיוטה כבר לא פתוחה" }, { status: 409 });
      const payload = (draft.payload ?? {}) as { template?: string; subject?: string; body?: string; kind?: string };
      if (action === "draft_dismiss") {
        await supabaseAdmin.from("agent_actions").update({ status: "dismissed", status_changed_at: nowIso, resolved_by: "admin", resolution_note: "נדחה מהאדמין" }).eq("id", draftId);
        await teacherNote(id, `טיוטת ${EMAIL_LABELS[String(payload.template)] ?? payload.kind ?? "טיפול"} נדחתה.`, "admin");
        return NextResponse.json({ ok: true });
      }
      const subject = (typeof body.subject === "string" ? body.subject : payload.subject ?? "").trim().slice(0, 150);
      const text = (typeof body.body === "string" ? body.body : payload.body ?? "").trim().slice(0, 4000);
      const template = String(payload.template ?? ADMIN_MESSAGE_TEMPLATE) as TeacherEmailTemplate;
      if (!subject || !text) return NextResponse.json({ ok: false, error: "חסר נושא או תוכן" }, { status: 400 });
      if (!(TEACHER_LISTED_STATES as readonly string[]).includes(String(t.listing_state)) && String(t.listing_state) !== "pending") {
        return NextResponse.json({ ok: false, error: "המורה אינו/ה במאגר, הטיוטה לא נשלחה" }, { status: 409 });
      }
      mail = await sendTeacherCareEmail(emailTo, { template, subject, body: text });
      if (mail.status === "sent") {
        await supabaseAdmin.from("agent_actions").update({ status: "executed", status_changed_at: nowIso, resolved_by: "admin", resolution_note: `נשלח: ${subject}` }).eq("id", draftId);
      }
      await teacherNote(id, `${EMAIL_LABELS[template] ?? "מייל טיפול"} נשלח/ה מהאדמין. מייל: ${mail.status}${mail.error ? ` (${mail.error})` : ""}`, "admin");
      return NextResponse.json({ ok: mail.status === "sent", mail, error: mail.status === "sent" ? undefined : `המייל לא נשלח: ${mail.error ?? mail.status}` });
    }
    case "update_profile": {
      const parsed = AdminPatch.safeParse(body.fields ?? {});
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: `יש לבדוק את השדה: ${String(parsed.error.issues[0]?.path[0] ?? "")}` }, { status: 400 });
      }
      const f: Record<string, unknown> = { ...parsed.data };
      if (Object.keys(f).length === 0) return NextResponse.json({ ok: false, error: "אין מה לעדכן" }, { status: 400 });
      if (typeof f.phone === "string" && !phoneNationalDigits(f.phone) && !foreignPhoneDigits(f.phone)) {
        return NextResponse.json({ ok: false, error: "מספר הטלפון אינו תקין" }, { status: 400 });
      }
      if (typeof f.email === "string" && f.email !== String(t.email).toLowerCase()) {
        const { data: dup } = await supabaseAdmin.from("teachers").select("id").ilike("email", f.email).neq("id", id).limit(1);
        if (dup && dup.length) return NextResponse.json({ ok: false, error: "המייל הזה כבר רשום למורה אחר/ת" }, { status: 409 });
      }
      if (Array.isArray(f.regions)) f.regions = (f.regions as string[]).filter((c) => ALL_CITIES.has(c)).slice(0, 6);
      if (Array.isArray(f.languages) && (f.languages as string[]).length === 0) f.languages = ["עברית"];
      const qualification = (f.qualification as string | undefined) ?? (t.qualification as string | null);
      const wantsRemedial = typeof f.remedial === "boolean" ? f.remedial : !!t.remedial;
      f.remedial = wantsRemedial && qualificationAllowsRemedial(qualification);
      const subjects = (f.subjects as string[] | undefined) ?? ((t.subjects as string[] | null) ?? []);
      const extras = sanitizeTeacherExtras(
        {
          expertise: "expertise" in f ? f.expertise : t.expertise,
          focuses: "focuses" in f ? f.focuses : t.focuses,
          lesson_settings: "lesson_settings" in f ? f.lesson_settings : t.lesson_settings,
        },
        subjects,
      );
      f.expertise = extras.expertise;
      f.focuses = extras.focuses;
      f.lesson_settings = extras.lesson_settings;
      f.online = extras.lesson_settings.includes("online");
      const regions = (f.regions as string[] | undefined) ?? ((t.regions as string[] | null) ?? []);
      if (extras.lesson_settings.length === 0) return NextResponse.json({ ok: false, error: "יש לבחור איפה מתקיים השיעור" }, { status: 400 });
      if (teachesInPerson(extras.lesson_settings) && regions.length === 0) {
        return NextResponse.json({ ok: false, error: "יש לבחור לפחות עיר אחת לשיעורים פנים אל פנים" }, { status: 400 });
      }
      Object.assign(update, f);
      note = `הפרופיל נערך מהאדמין (${Object.keys(parsed.data).join(", ")}).`;
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("teachers").update(update).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (sendMail) mail = await sendMail();
  if (note) await teacherNote(id, `${note}${mail ? ` מייל: ${mail.status}${mail.error ? ` (${mail.error})` : ""}` : ""}`);
  return NextResponse.json({ ok: true, mail });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
  const { data: t } = await supabaseAdmin
    .from("teachers")
    .select("id, sumit_recurring_id, sumit_cancelled_at, certificate_path, photo_path")
    .eq("id", id)
    .maybeSingle();
  if (!t) return NextResponse.json({ ok: false, error: "לא נמצא" }, { status: 404 });
  // אותה מלכודת כמו במחיקת מטפל: מחיקה לא מבטלת הוראת קבע ב-Sumit.
  if (activeSubscription(t)) {
    return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
  }
  const { error } = await supabaseAdmin.from("teachers").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  // הקבצים וההיסטוריה של מורה שנמחק/ה - ניקוי במאמץ סביר.
  const files = [t.certificate_path, t.photo_path].filter((p): p is string => typeof p === "string" && p.startsWith("teachers/"));
  if (files.length) await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).remove(files);
  await supabaseAdmin.from("crm_notes").delete().eq("entity_type", "teacher").eq("entity_id", id);
  await supabaseAdmin.from("agent_actions").delete().eq("agent", TEACHER_CARE_AGENT).eq("entity_id", id);
  await supabaseAdmin.from("crm_tasks").delete().eq("entity_type", "teacher").eq("entity_id", id);
  return NextResponse.json({ ok: true });
}
