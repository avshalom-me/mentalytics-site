import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cancelSubscription } from "@/app/lib/sumit";
import { teacherStats, emptyTeacherStats, TEACHER_FILES_BUCKET, teacherPhotoUrl, teacherLinkUrl, teacherNote } from "@/app/lib/teachers.server";
import { sendTeacherApprovedEmail, sendTeacherRejectedEmail } from "@/app/lib/teacher-emails";
import { trialEndFor, extendedTrialEnd, israelDate } from "@/app/lib/teacher-trial";
import { teacherEmailPreview } from "@/app/lib/teacher-email-templates";
import { qualificationAllowsRemedial, qualificationLabel, TEACHER_QUALIFICATION_KEYS } from "@/app/lib/teacher-options";

// ניהול המורים באדמין. Basic Auth + שומר CSRF של ה-middleware מכסים את כל
// /api/admin-*. כל פעולה שמשנה מצב נרשמת בהיסטוריה של המורה (crm_notes עם
// entity_type 'teacher'), שמוצגת בעמוד עצמו.

export const dynamic = "force-dynamic";

const activeSubscription = (t: Record<string, unknown>) => !!t.sumit_recurring_id && !t.sumit_cancelled_at;

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
    return NextResponse.json({ ok: true, days, demand: data ?? [] });
  }

  const { data, error } = await supabaseAdmin.from("teachers").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Record<string, unknown>[];
  const stats = await teacherStats(rows.map((r) => String(r.id)));
  const teachers = rows.map((r) => {
    // הטוקן והנתיבים בבאקט לא יוצאים לדפדפן - רק מה שהעמוד מציג.
    const { edit_token, certificate_path, photo_path, subscribe_lock_at, ...rest } = r;
    void subscribe_lock_at;
    return {
      ...rest,
      has_certificate: !!certificate_path,
      photo_url: teacherPhotoUrl({ id: String(r.id), photo_path: (photo_path as string | null) ?? null }),
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
  let mail: { status: string; error?: string } | null = null;
  let note = "";

  switch (action) {
    case "approve": {
      // אישור ראשון דורש תעודה (אין רישוי ממלכתי - התעודה היא האימות). מי
      // שכבר אושר/ה בעבר חוזר/ת מהארכיון בלי בדיקה חוזרת.
      if (!t.certificate_path && !t.approved_at && body.without_certificate !== true) {
        return NextResponse.json({ ok: false, error: "אין תעודה בפרופיל, ולכן אי אפשר לאמת את ההכשרה." }, { status: 409 });
      }
      // אישור = תחילת 90 ימי הניסיון. מורה שתקופת הניסיון שלו/ה עוד רצה (אישור
      // מחדש אחרי דחייה) שומר/ת את תאריך הסיום; אחרת מתחילה תקופה חדשה, ושני
      // המיילים של סופה יישלחו שוב בבוא הזמן.
      const keep = !!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      const trialEndsAt = keep ? String(t.trial_ends_at) : trialEndFor(now).toISOString();
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
      note = `אושר/ה להצגה. ניסיון עד ${israelDate(new Date(trialEndsAt))}.`;
      if (body.send_email === true) mail = await sendTeacherApprovedEmail({ ...emailTo, trial_ends_at: trialEndsAt });
      break;
    }
    case "reject": {
      if (activeSubscription(t)) return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
      Object.assign(update, { listing_state: "rejected", reject_reason: reason || null });
      note = `נדחה/תה.${reason ? ` סיבה: ${reason}` : ""}`;
      if (body.send_email === true) mail = await sendTeacherRejectedEmail(emailTo, reason || null);
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
      const trialLive = !!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      Object.assign(update, { listing_state: trialLive ? "trial" : "archived", paying_since: null, archived_at: trialLive ? null : nowIso });
      note = `הסימון כמשלם/ת הוסר. מצב: ${trialLive ? "ניסיון" : "ארכיון"}.`;
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
      const trialLive = !!t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      Object.assign(update, {
        sumit_cancelled_at: nowIso,
        listing_state: trialLive ? "trial" : "archived",
        paying_since: null,
        archived_at: trialLive ? null : nowIso,
      });
      note = `הוראת הקבע (${recurring}) בוטלה ב-Sumit. מצב: ${trialLive ? "ניסיון" : "ארכיון"}.`;
      break;
    }
    case "add_note": {
      const text = typeof body.note === "string" ? body.note.trim() : "";
      if (!text) return NextResponse.json({ ok: false, error: "הערה ריקה" }, { status: 400 });
      await teacherNote(id, text, "admin");
      return NextResponse.json({ ok: true });
    }
    case "resend_approval": {
      if (!t.trial_ends_at || !["trial", "paying"].includes(String(t.listing_state))) {
        return NextResponse.json({ ok: false, error: "המורה אינו/ה מוצג/ת כרגע" }, { status: 400 });
      }
      mail = await sendTeacherApprovedEmail({ ...emailTo, trial_ends_at: String(t.trial_ends_at) });
      await teacherNote(id, `מייל האישור נשלח שוב: ${mail.status}${mail.error ? ` (${mail.error})` : ""}`);
      return NextResponse.json({ ok: true, mail });
    }
    default:
      return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("teachers").update(update).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
  return NextResponse.json({ ok: true });
}
