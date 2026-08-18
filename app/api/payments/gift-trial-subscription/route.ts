import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { createSubscription, SumitPaymentDeclinedError, SUBSCRIPTION_BASE_PRICE } from "@/app/lib/sumit";
import {
  validateGiftCheckoutToken,
  burnGiftCheckoutToken,
  firstChargeDate,
} from "@/app/lib/gift-checkout";

// הצטרפות במסלול ההזמנה: חודשיים ראשונים ללא תשלום, ואחריהם המנוי הרגיל.
//
// מסלול נפרד לחלוטין מהצ'ק-אאוט הרגיל, ובכוונה: הכניסה אליו היא דרך טוקן
// אישי שנוצר בשליחת ההצעה בלבד. מטפל שלא קיבל את המייל לא יכול להגיע לכאן,
// גם אם הקישור יגיע אליו ממישהו אחר - הטוקן קשור למטפל אחד.
//
// מה שקורה כאן: הכרטיס נשמר והוראת הקבע נוצרת ב-Sumit עם תאריך חיוב ראשון
// דחוי בחודשיים, הקידום ניתן מיד, ואין שום גבייה היום.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// בדיקת הקישור בטעינת העמוד: מחזיר את מה שצריך להצגה בלבד (שם, תאריך
// החיוב הראשון, סכום). אין כאן שום פרט שלא ידוע ממילא למי שמחזיק בקישור.
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const check = await validateGiftCheckoutToken(token);
    if (!check.ok) {
      return NextResponse.json({ ok: false, reason: check.reason, error: check.message }, { status: 403 });
    }
    return NextResponse.json({
      ok: true,
      therapist_name: check.data.therapistName,
      email: check.data.email,
      region: check.data.region,
      treatment: check.data.treatment,
      gift_months: check.data.giftMonths,
      first_charge_date: firstChargeDate(new Date(), check.data.giftMonths),
      amount: SUBSCRIPTION_BASE_PRICE,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    console.error("gift-trial-subscription GET failed:", msg);
    return NextResponse.json({ ok: false, error: "שגיאה בבדיקת הקישור" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const singleUseToken = String(body?.singleUseToken ?? "").trim();
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

    if (!singleUseToken) {
      return NextResponse.json({ ok: false, error: "חסרים פרטי תשלום" }, { status: 400 });
    }

    // אימות שני של הטוקן, אחרי זה שנעשה בטעינת העמוד: בין הטעינה לשליחה
    // יכולות לחלוף דקות, והמטפל יכול היה להצטרף בינתיים במסלול אחר.
    const check = await validateGiftCheckoutToken(token);
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.message }, { status: 403 });
    }
    const { therapistId, therapistName, email, giftMonths } = check.data;

    const startsOn = firstChargeDate(new Date(), giftMonths);

    let charge;
    try {
      charge = await createSubscription({
        therapistId,
        therapistName,
        therapistEmail: email,
        therapistPhone: phone || undefined,
        singleUseToken,
        firstChargeDate: startsOn,
      });
    } catch (e) {
      if (e instanceof SumitPaymentDeclinedError) {
        return NextResponse.json(
          { ok: false, error: "הכרטיס לא אושר. אפשר לנסות כרטיס אחר." },
          { status: 400 }
        );
      }
      throw e;
    }

    const recurringId = charge.RecurringItemID ? String(charge.RecurringItemID) : null;
    if (!recurringId) {
      // בלי מזהה הוראת קבע אי אפשר לבטל או לעקוב אחר החיוב בהמשך, ולכן
      // זה נחשב כשל ולא הצלחה חלקית.
      return NextResponse.json(
        { ok: false, error: "ההרשמה לא הושלמה. אנא פנו אלינו ונשלים ידנית." },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    // המנוי נרשם כפעיל שתקופתו הנוכחית נגמרת ביום החיוב הראשון. כך סוכן
    // הכספים רואה מנוי תקין עם תאריך חידוש, ולא "מנוי שלא התחדש".
    const { error: subErr } = await supabaseAdmin.from("subscriptions").insert({
      therapist_id: therapistId,
      morning_token_id: recurringId,
      status: "active",
      amount: SUBSCRIPTION_BASE_PRICE,
      current_period_start: now,
      current_period_end: `${startsOn}T00:00:00.000Z`,
    });
    if (subErr) {
      // הוראת הקבע כבר קיימת ב-Sumit אבל לא נרשמה אצלנו. בלי המזהה בלוג
      // אין דרך למצוא אותה ולבטל אותה, והלקוח היה נשאר עם הוראת קבע
      // יתומה שאף סריקה לא מכירה.
      console.error(
        `gift-trial: subscription row insert failed AFTER Sumit succeeded. ` +
          `therapist=${therapistId} sumit_recurring=${recurringId} err=${subErr.message}`
      );
      return NextResponse.json(
        { ok: false, error: `ההרשמה נקלטה חלקית. אנא פנו אלינו עם המספר ${recurringId} ונשלים ידנית.` },
        { status: 500 }
      );
    }

    // promotion_source נפרד ('gift_trial') כדי שהמסלול הזה לא יתערבב
    // במדדים של המשלמים הרגילים ולא ייספר כתקופת ניסיון חינמית.
    const { error: tErr } = await supabaseAdmin
      .from("therapists")
      .update({
        status: "paying",
        promotion_source: "gift_trial",
        promoted_since: now,
        promoted_until: null,
      })
      .eq("id", therapistId);
    if (tErr) throw new Error(`הפעלת הקידום נכשלה: ${tErr.message}`);

    await burnGiftCheckoutToken(token);

    return NextResponse.json({
      ok: true,
      first_charge_date: startsOn,
      gift_months: giftMonths,
      amount: SUBSCRIPTION_BASE_PRICE,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    console.error("gift-trial-subscription failed:", msg);
    return NextResponse.json({ ok: false, error: "שגיאה בהרשמה. אנא נסו שוב." }, { status: 500 });
  }
}
