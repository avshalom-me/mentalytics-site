import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { rateLimit, clientIp, tooManyRequests } from "@/app/lib/rate-limit";
import { createTeacherSubscription, SumitPaymentDeclinedError } from "@/app/lib/sumit";
import { createAgentAction } from "@/app/lib/agent-infra";
import { loadTeacherFromRequest, crossSiteWrite, teacherNote } from "@/app/lib/teachers.server";
import { sendTeacherPaymentConfirmedEmail } from "@/app/lib/teacher-emails";
import { israelDate } from "@/app/lib/teacher-trial";
import { TEACHER_PRICE_GROSS } from "@/app/lib/teacher-options";

// ההרשמה לתשלום של מורה: 60 ש"ח לחודש כולל מע"מ, ללא התחייבות. הכרטיס עובר
// ישירות ל-Sumit מהדפדפן (טוקן חד-פעמי), וכאן נפתחת הוראת הקבע. אם תקופת
// הניסיון עוד רצה, החיוב הראשון נדחה לסופה (Date_Start) - מי שנרשם/ה ביום
// ה-85 לא משלם/ת על חמשת הימים שנשארו לו/ה.
// אין כתיבה ל-payments/subscriptions (הן מחזיקות סכומים שלמים לפני מע"מ);
// כל מה שצריך לביטול ולמעקב יושב על שורת המורה.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOCK_MINUTES = 5;

/** תאריך החיוב הראשון: היום האחרון של הניסיון אם הוא עוד לפנינו, אחרת היום. */
function firstCharge(trialEndsAt: string | null): { date: string; deferred: boolean } {
  const today = israelDate();
  const end = trialEndsAt ? israelDate(new Date(trialEndsAt)) : null;
  if (end && end > today) return { date: end, deferred: true };
  return { date: today, deferred: false };
}

const subscribed = (t: Record<string, unknown>) => !!t.sumit_recurring_id && !t.sumit_cancelled_at;
const payable = (t: Record<string, unknown>) => ["trial", "paying", "archived"].includes(String(t.listing_state)) && !subscribed(t);

export async function GET(req: NextRequest) {
  const t = await loadTeacherFromRequest(req);
  if (!t) return NextResponse.json({ ok: false, error: "לא מחובר/ת" }, { status: 401 });
  const fc = firstCharge((t.trial_ends_at as string | null) ?? null);
  // מי פתח את עמוד ההרשמה - הנתון שמבדיל בין "המייל לא נפתח" ל"נפתח ולא נרשם".
  if (payable(t)) {
    await supabaseAdmin
      .from("teachers")
      .update({ pay_viewed_at: new Date().toISOString(), pay_view_count: (Number(t.pay_view_count) || 0) + 1 })
      .eq("id", String(t.id));
  }
  return NextResponse.json(
    {
      ok: true,
      teacher_name: t.full_name,
      listing_state: t.listing_state,
      first_charge_date: fc.date,
      deferred: fc.deferred,
      amount_gross: TEACHER_PRICE_GROSS,
      already_subscribed: subscribed(t),
      can_pay: payable(t),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const rl = rateLimit("teacher-subscribe", clientIp(req), 10, 60 * 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds, "יותר מדי ניסיונות - נסו שוב בעוד שעה");
  if (crossSiteWrite(req)) return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 403 });
  try {
    const t = await loadTeacherFromRequest(req);
    if (!t) return NextResponse.json({ ok: false, error: "לא מחובר/ת" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const singleUseToken = String(body.singleUseToken ?? "").trim();
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 25) : "";
    if (!singleUseToken) return NextResponse.json({ ok: false, error: "חסרים פרטי תשלום" }, { status: 400 });

    if (subscribed(t)) return NextResponse.json({ ok: false, error: "כבר קיימת הוראת קבע פעילה" }, { status: 409 });
    if (!payable(t)) {
      return NextResponse.json({ ok: false, error: "הפרופיל עדיין לא אושר, ולכן אין עדיין מה להסדיר" }, { status: 409 });
    }

    const id = String(t.id);
    const name = String(t.full_name);
    const email = String(t.email);
    const before = String(t.listing_state);
    const fc = firstCharge((t.trial_ends_at as string | null) ?? null);

    // מנעול: לחיצה כפולה (או שתי כרטיסיות) לא תפתח שתי הוראות קבע ב-Sumit.
    // המנעול פג מעצמו אחרי חמש דקות, למקרה שהבקשה נפלה באמצע.
    const lockCutoff = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
    const { data: locked } = await supabaseAdmin
      .from("teachers")
      .update({ subscribe_lock_at: new Date().toISOString() })
      .eq("id", id)
      .or(`subscribe_lock_at.is.null,subscribe_lock_at.lt.${lockCutoff}`)
      .select("id")
      .maybeSingle();
    if (!locked) {
      return NextResponse.json({ ok: false, error: "ההרשמה כבר בתהליך - המתינו רגע ורעננו את העמוד" }, { status: 409 });
    }
    const unlock = () => supabaseAdmin.from("teachers").update({ subscribe_lock_at: null }).eq("id", id);

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
      await unlock();
      if (e instanceof SumitPaymentDeclinedError) {
        return NextResponse.json({ ok: false, error: "הכרטיס לא אושר. אפשר לנסות כרטיס אחר." }, { status: 400 });
      }
      throw e;
    }
    const recurringId = charge.RecurringItemID ? String(charge.RecurringItemID) : null;
    if (!recurringId) {
      // בלי מזהה הוראת קבע אי אפשר לבטל או לעקוב - נחשב כשל. המנעול נשאר עד
      // שיפוג, כדי שניסיון מיידי נוסף לא יפתח הוראה שנייה לפני שבדקנו.
      await teacherNote(id, "ניסיון הרשמה לתשלום: Sumit לא החזיר מזהה הוראת קבע. לבדוק ב-Sumit אם נפתחה הוראה ללקוח teacher:" + id);
      return NextResponse.json({ ok: false, error: "ההרשמה לא הושלמה. אנא פנו אלינו ונשלים ידנית." }, { status: 500 });
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("teachers")
      .update({
        listing_state: "paying",
        paying_since: now,
        archived_at: null,
        sumit_recurring_id: recurringId,
        sumit_first_charge_on: fc.date,
        sumit_cancelled_at: null,
        sumit_verified_at: now,
        price_gross: TEACHER_PRICE_GROSS,
        subscribe_lock_at: null,
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

    await teacherNote(id, `נרשם/ה לתשלום (${before} → paying). הוראת קבע ${recurringId}, חיוב ראשון ${fc.date}${fc.deferred ? " (נדחה לסוף הניסיון)" : ""}.`);
    void sendTeacherPaymentConfirmedEmail({ id, email, full_name: name, edit_token: String(t.edit_token) }, fc.date);
    return NextResponse.json({ ok: true, first_charge_date: fc.date, deferred: fc.deferred, amount_gross: TEACHER_PRICE_GROSS });
  } catch (e) {
    console.error("teacher subscribe failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "שגיאה בהרשמה. אנא נסו שוב." }, { status: 500 });
  }
}
