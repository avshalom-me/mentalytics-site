import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { createTeacherSubscription, SumitPaymentDeclinedError } from "@/app/lib/sumit";
import { createAgentAction } from "@/app/lib/agent-infra";
import { loadTeacherByToken } from "@/app/lib/teachers.server";
import { sendTeacherPaymentConfirmedEmail } from "@/app/lib/teacher-emails";
import { TEACHER_PRICE_GROSS } from "@/app/lib/teacher-options";

// הסדרת התשלום של מורה: הכרטיס עובר ישירות ל-Sumit מהדפדפן (טוקן חד-פעמי),
// וכאן נפתחת הוראת הקבע. אם תקופת הניסיון עוד רצה, החיוב הראשון נדחה
// לסופה (Date_Start) - המורה לא מאבד/ת חודשים חינם בגלל שהסדיר/ה מוקדם.
// אין כתיבה ל-payments/subscriptions (הן מחזיקות סכומים שלמים לפני מע"מ);
// כל מה שצריך לביטול ולמעקב יושב על שורת המורה.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** תאריך החיוב הראשון: סוף הניסיון אם הוא בעתיד, אחרת היום. */
function firstChargeOn(trialEndsAt: string | null): { date: string; deferred: boolean } {
  const today = new Date().toISOString().slice(0, 10);
  if (trialEndsAt && trialEndsAt.slice(0, 10) > today) return { date: trialEndsAt.slice(0, 10), deferred: true };
  return { date: today, deferred: false };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const t = await loadTeacherByToken(token);
  if (!t) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
  const state = String(t.listing_state);
  const trialEndsAt = (t.trial_ends_at as string | null) ?? null;
  const fc = firstChargeOn(trialEndsAt);
  return NextResponse.json({
    ok: true,
    teacher_name: t.full_name,
    listing_state: state,
    trial_ends_at: trialEndsAt,
    first_charge_date: fc.date,
    deferred: fc.deferred,
    amount_gross: TEACHER_PRICE_GROSS,
    already_paying: !!t.sumit_recurring_id && !t.sumit_cancelled_at,
    can_pay: ["trial", "paying", "expired"].includes(state) && !(t.sumit_recurring_id && !t.sumit_cancelled_at),
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit("teacher-subscribe", ip, 10, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי ניסיונות - נסו שוב בעוד שעה");
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const singleUseToken = String(body.singleUseToken ?? "").trim();
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!singleUseToken) return NextResponse.json({ ok: false, error: "חסרים פרטי תשלום" }, { status: 400 });

    const t = await loadTeacherByToken(token);
    if (!t) return NextResponse.json({ ok: false, error: "הקישור אינו תקף" }, { status: 404 });
    const state = String(t.listing_state);
    if (!["trial", "paying", "expired"].includes(state)) {
      return NextResponse.json({ ok: false, error: "הפרופיל עדיין לא אושר, ולכן אין עדיין מה להסדיר" }, { status: 409 });
    }
    if (t.sumit_recurring_id && !t.sumit_cancelled_at) {
      return NextResponse.json({ ok: false, error: "כבר קיימת הוראת קבע פעילה" }, { status: 409 });
    }

    const id = String(t.id);
    const name = String(t.full_name);
    const email = String(t.email);
    const fc = firstChargeOn((t.trial_ends_at as string | null) ?? null);

    let charge;
    try {
      charge = await createTeacherSubscription({
        teacherId: id,
        teacherName: name,
        teacherEmail: email,
        teacherPhone: phone || (t.phone as string | null) || undefined,
        singleUseToken,
        grossPrice: TEACHER_PRICE_GROSS,
        firstChargeDate: fc.deferred ? fc.date : undefined,
      });
    } catch (e) {
      if (e instanceof SumitPaymentDeclinedError) {
        return NextResponse.json({ ok: false, error: "הכרטיס לא אושר. אפשר לנסות כרטיס אחר." }, { status: 400 });
      }
      throw e;
    }
    const recurringId = charge.RecurringItemID ? String(charge.RecurringItemID) : null;
    if (!recurringId) {
      return NextResponse.json({ ok: false, error: "ההרשמה לא הושלמה. אנא פנו אלינו ונשלים ידנית." }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({
        listing_state: "paying",
        paying_since: now,
        sumit_recurring_id: recurringId,
        sumit_first_charge_on: fc.date,
        sumit_cancelled_at: null,
        price_gross: TEACHER_PRICE_GROSS,
        updated_at: now,
      })
      .eq("id", id);
    if (error) {
      // הוראת קבע נפתחה ב-Sumit ולא נרשמה אצלנו - אותו מצב שמסלול המתנה
      // מתריע עליו: בלי המספר הזה איש לא ימצא אותה.
      await createAgentAction({
        agent: "finance",
        actionType: "sumit_orphan",
        kind: "action",
        severity: "critical",
        title: `הוראת קבע של מורה ב-Sumit בלי רישום אצלנו: ${name}`,
        body: `ענף המורים פתח הוראת קבע (מספר ${recurringId}, לקוח teacher:${id}) והכתיבה למאגר נכשלה: ${error.message}`,
        dedupeKey: `sumit_orphan:teacher:${recurringId}`,
        entityId: id,
        entityLabel: name,
        payload: { teacher_id: id, sumit_recurring_id: recurringId, error: error.message },
      }).catch(() => {});
      return NextResponse.json({ ok: false, error: `ההרשמה נקלטה חלקית. אנא פנו אלינו עם המספר ${recurringId}.` }, { status: 500 });
    }

    void sendTeacherPaymentConfirmedEmail({ id, email, full_name: name, edit_token: String(t.edit_token) }, fc.date);
    return NextResponse.json({ ok: true, first_charge_date: fc.date, deferred: fc.deferred, amount_gross: TEACHER_PRICE_GROSS });
  } catch (e) {
    console.error("teacher subscribe failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה בהרשמה. אנא נסו שוב." }, { status: 500 });
  }
}
