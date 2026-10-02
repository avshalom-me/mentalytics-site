import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { cancelSubscription } from "@/app/lib/sumit";
import { teacherStats, trialEndDate, TEACHER_FILES_BUCKET, teacherPhotoUrl } from "@/app/lib/teachers.server";
import { sendTeacherApprovedEmail, sendTeacherRejectedEmail, teacherEditUrl, teacherPayUrl } from "@/app/lib/teacher-emails";
import { qualificationAllowsRemedial } from "@/app/lib/teacher-options";

// ניהול המורים באדמין. Basic Auth + שומר CSRF של ה-middleware מכסים את כל
// /api/admin-*. כל פעולה שמשנה מצב רישום נרשמת גם ב-crm_notes (entity_type
// 'teacher'), כדי שההיסטוריה תישאר גם בלי טבלת audit נפרדת.

export const dynamic = "force-dynamic";

async function note(teacherId: string, body: string) {
  await supabaseAdmin.from("crm_notes").insert({ entity_type: "teacher", entity_id: teacherId, body, author: "system" }).then(() => {});
}

export async function GET(req: NextRequest) {
  const certFor = req.nextUrl.searchParams.get("cert_for");
  if (certFor) {
    const { data } = await supabaseAdmin.from("teachers").select("certificate_path").eq("id", certFor).maybeSingle();
    if (!data?.certificate_path) return NextResponse.json({ ok: false, error: "אין תעודה" }, { status: 404 });
    const { data: signed, error } = await supabaseAdmin.storage.from(TEACHER_FILES_BUCKET).createSignedUrl(data.certificate_path, 120);
    if (error || !signed?.signedUrl) return NextResponse.json({ ok: false, error: "לא ניתן לפתוח את התעודה" }, { status: 500 });
    return NextResponse.json({ ok: true, url: signed.signedUrl });
  }

  const { data, error } = await supabaseAdmin.from("teachers").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Record<string, unknown>[];
  const stats = await teacherStats(rows.map((r) => String(r.id)));
  const teachers = rows.map((r) => ({
    ...r,
    photo_url: teacherPhotoUrl({ id: String(r.id), photo_path: (r.photo_path as string | null) ?? null }),
    edit_url: teacherEditUrl(String(r.edit_token)),
    pay_url: teacherPayUrl(String(r.edit_token)),
    stats: stats[String(r.id)],
  }));
  return NextResponse.json({ ok: true, teachers });
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

  switch (action) {
    case "approve": {
      // אישור = תחילת תקופת הניסיון. מורה שכבר היה/תה בניסיון (אישור מחדש
      // אחרי הקפאה או דחייה) שומר/ת את תאריך הסיום המקורי אם הוא בעתיד.
      const keep = t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      const trialEndsAt = keep ? String(t.trial_ends_at) : trialEndDate(now).toISOString();
      const remedialOk = qualificationAllowsRemedial(t.qualification as string | null);
      Object.assign(update, {
        listing_state: t.sumit_recurring_id && !t.sumit_cancelled_at ? "paying" : "trial",
        approved_at: (t.approved_at as string | null) ?? nowIso,
        trial_ends_at: trialEndsAt,
        paused_until: null,
        reject_reason: null,
        remedial: !!t.remedial && remedialOk,
      });
      if (body.send_email !== false) mail = await sendTeacherApprovedEmail({ ...emailTo, trial_ends_at: trialEndsAt });
      await note(id, `אושר/ה להצגה. ניסיון עד ${trialEndsAt.slice(0, 10)}.${mail ? ` מייל: ${mail.status}` : ""}`);
      break;
    }
    case "reject": {
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : null;
      Object.assign(update, { listing_state: "rejected", reject_reason: reason });
      if (body.send_email === true) mail = await sendTeacherRejectedEmail(emailTo, reason);
      await note(id, `נדחה/תה.${reason ? ` סיבה: ${reason}` : ""}${mail ? ` מייל: ${mail.status}` : ""}`);
      break;
    }
    case "pause": {
      const days = Math.max(1, Math.min(Number(body.days) || 14, 365));
      const until = new Date(now.getTime() + days * 86400000).toISOString();
      Object.assign(update, { paused_until: until });
      await note(id, `הוקפא/ה ל-${days} ימים (עד ${until.slice(0, 10)}).`);
      break;
    }
    case "unpause": {
      Object.assign(update, { paused_until: null });
      await note(id, "ההקפאה שוחררה.");
      break;
    }
    case "extend_trial": {
      const days = Math.max(1, Math.min(Number(body.days) || 30, 365));
      const base = t.trial_ends_at && new Date(String(t.trial_ends_at)) > now ? new Date(String(t.trial_ends_at)) : now;
      const until = new Date(base.getTime() + days * 86400000).toISOString();
      Object.assign(update, { trial_ends_at: until, trial_ending_notified_at: null });
      if (t.listing_state === "expired") update.listing_state = "trial";
      await note(id, `הניסיון הוארך ב-${days} ימים, עד ${until.slice(0, 10)}.`);
      break;
    }
    case "set_remedial": {
      const want = body.remedial === true;
      if (want && !qualificationAllowsRemedial(t.qualification as string | null)) {
        return NextResponse.json({ ok: false, error: "ההכשרה המוצהרת אינה מתאימה לרישום כהוראה מתקנת" }, { status: 400 });
      }
      update.remedial = want;
      await note(id, want ? "סומן/ה כמורה להוראה מתקנת." : "הסימון של הוראה מתקנת הוסר.");
      break;
    }
    case "mark_paying": {
      // סימון ידני (תשלום בהעברה, הסדר מיוחד) - בלי Sumit.
      Object.assign(update, { listing_state: "paying", paying_since: (t.paying_since as string | null) ?? nowIso, paused_until: null });
      await note(id, "סומן/ה כמשלם/ת ידנית (ללא הוראת קבע ב-Sumit).");
      break;
    }
    case "revoke_paying": {
      if (t.sumit_recurring_id && !t.sumit_cancelled_at) {
        return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
      }
      const trialLive = t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      Object.assign(update, { listing_state: trialLive ? "trial" : "expired", paying_since: null });
      await note(id, `הסימון כמשלם/ת הוסר. מצב: ${trialLive ? "ניסיון" : "פג"}.`);
      break;
    }
    case "cancel_subscription": {
      const recurring = t.sumit_recurring_id ? Number(t.sumit_recurring_id) : null;
      if (!recurring) return NextResponse.json({ ok: false, error: "אין הוראת קבע" }, { status: 400 });
      try {
        await cancelSubscription({ recurringItemId: recurring, customerExternalId: `teacher:${id}` });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `הביטול ב-Sumit נכשל: ${e instanceof Error ? e.message : e}` }, { status: 500 });
      }
      const trialLive = t.trial_ends_at && new Date(String(t.trial_ends_at)) > now;
      Object.assign(update, { sumit_cancelled_at: nowIso, listing_state: trialLive ? "trial" : "expired", paying_since: null });
      await note(id, `הוראת הקבע (${recurring}) בוטלה ב-Sumit.`);
      break;
    }
    case "set_note": {
      update.admin_note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;
      break;
    }
    case "resend_approval": {
      if (!t.trial_ends_at) return NextResponse.json({ ok: false, error: "עדיין לא אושר/ה" }, { status: 400 });
      mail = await sendTeacherApprovedEmail({ ...emailTo, trial_ends_at: String(t.trial_ends_at) });
      await note(id, `מייל האישור נשלח שוב: ${mail.status}`);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("teachers").update(update).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mail });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "חסר id" }, { status: 400 });
  const { data: t } = await supabaseAdmin.from("teachers").select("id, sumit_recurring_id, sumit_cancelled_at").eq("id", id).maybeSingle();
  if (!t) return NextResponse.json({ ok: false, error: "לא נמצא" }, { status: 404 });
  // אותה מלכודת כמו במחיקת מטפל: מחיקה לא מבטלת הוראת קבע ב-Sumit.
  if (t.sumit_recurring_id && !t.sumit_cancelled_at) {
    return NextResponse.json({ ok: false, error: "יש הוראת קבע פעילה ב-Sumit - קודם לבטל אותה" }, { status: 409 });
  }
  const { error } = await supabaseAdmin.from("teachers").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
