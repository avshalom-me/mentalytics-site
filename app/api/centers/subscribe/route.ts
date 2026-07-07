import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { createCenterSubscription, SumitPaymentDeclinedError } from "@/app/lib/sumit";
import { sendCenterWelcomeEmail } from "@/app/lib/center-emails";
import { centerPricing } from "@/app/lib/center-pricing";

// הרשמת מרכז טיפולי למנוי — נקרא מדף ההצטרפות הציבורי /centers/join/<token>.
// אימות: הטוקן הסודי מהקישור שהאדמין שלח (אין חשבון משתמש). הכרטיס עובר
// טוקניזציה בדפדפן ישירות מול Sumit; לכאן מגיע רק SingleUseToken.
//
// חודשי מתנה: הוראת הקבע נוצרת מיד עם Date_Start עתידי — הכרטיס נשמר,
// החיוב הראשון יוצא רק בתום המתנה. בלי מתנה — החיוב הראשון מיידי.

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function sanitizeName(raw: string): string {
  return raw.replace(/[^\p{L}\p{N}\s"'.\-–—()]/gu, "").trim().slice(0, 120);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות — נסו שוב בעוד דקה" }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const payerName = sanitizeName(typeof body.payer_name === "string" ? body.payer_name : "");
  const payerEmail = typeof body.payer_email === "string" ? body.payer_email.trim().slice(0, 200) : "";
  const payerPhone = typeof body.payer_phone === "string" ? body.payer_phone.trim().slice(0, 30) : "";
  const companyNumber = typeof body.company_number === "string" ? body.company_number.replace(/\D/g, "").slice(0, 9) : "";
  const singleUseToken = typeof body.singleUseToken === "string" ? body.singleUseToken.trim() : "";

  if (!token || !payerName || !payerEmail || !singleUseToken) {
    return NextResponse.json({ ok: false, error: "חסרים פרטים" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    return NextResponse.json({ ok: false, error: "כתובת מייל לא תקינה" }, { status: 400 });
  }

  try {
    const { data: center } = await supabaseAdmin
      .from("therapy_center_accounts")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!center) {
      return NextResponse.json({ ok: false, error: "הקישור אינו תקף — פנו אלינו לקבלת קישור חדש" }, { status: 404 });
    }
    if (center.status === "active") {
      return NextResponse.json({ ok: false, error: "המנוי של המרכז כבר פעיל" }, { status: 400 });
    }
    if (center.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "ההצעה הזו כבר לא בתוקף — פנו אלינו לקבלת הצעה חדשה" }, { status: 400 });
    }

    // מודל התמחור: מחיר-למטפל × מספר-מטפלים = סה"כ חודשי (לפני מע"מ).
    const pricePerTherapist = Number(center.price_per_therapist) || 0;
    const therapistCount = Math.floor(Number(center.therapist_count) || 0);
    if (pricePerTherapist <= 0 || therapistCount <= 0) {
      return NextResponse.json({ ok: false, error: "ההצעה עדיין לא כוללת מחיר ומספר מטפלים — פנו אלינו" }, { status: 400 });
    }
    const monthlyTotal = centerPricing(pricePerTherapist, therapistCount).monthlyTotal;

    // מנעול כפילות אטומי: שורת payment במצב pending. אינדקס ייחודי
    // (reference_id, payment_type) WHERE pending חוסם הגשה כפולה מקבילה —
    // אותו מנגנון בדיוק כמו מנויי מטפלים (create-subscription).
    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
    await supabaseAdmin
      .from("payments")
      .update({ status: "failed" })
      .eq("payment_type", "center_subscription")
      .eq("reference_id", center.id)
      .eq("status", "pending")
      .lt("created_at", sixtySecondsAgo);

    const { data: payment, error: paymentErr } = await supabaseAdmin
      .from("payments")
      .insert({
        payment_type: "center_subscription",
        reference_id: center.id,
        amount: monthlyTotal,
        status: "pending",
        metadata: {
          center_name: center.name,
          price_per_therapist: pricePerTherapist,
          therapist_count: therapistCount,
          gift_months: center.gift_months,
          payer_name: payerName,
          payer_email: payerEmail,
        },
      })
      .select("id")
      .single();

    if (paymentErr || !payment) {
      if (paymentErr?.code === "23505") {
        return NextResponse.json({ ok: false, error: "תשלום כבר בתהליך — המתינו רגע" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
    }

    // חודשי מתנה → תאריך חיוב ראשון עתידי (תאריך בלבד, לפי הפורמט שב-swagger)
    const giftMonths = Number(center.gift_months) || 0;
    let firstChargeDate: string | undefined;
    if (giftMonths > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + giftMonths);
      firstChargeDate = d.toISOString().slice(0, 10);
    }

    let result;
    try {
      result = await createCenterSubscription({
        centerId: center.id,
        centerName: center.name,
        payerName,
        payerEmail,
        payerPhone,
        companyNumber: companyNumber || undefined,
        singleUseToken,
        unitPrice: monthlyTotal,
        therapistCount,
        firstChargeDate,
      });
    } catch (err) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      if (err instanceof SumitPaymentDeclinedError) {
        console.warn(`centers/subscribe: card declined for center=${center.id}${err.declineCode ? ` code=${err.declineCode}` : ""}`);
        return NextResponse.json({ ok: false, error: "החיוב נדחה ע\"י חברת האשראי. בדקו את הפרטים או נסו כרטיס אחר." }, { status: 402 });
      }
      console.error("centers/subscribe: Sumit call failed:", err instanceof Error ? err.message : err);
      return NextResponse.json({ ok: false, error: "שגיאה בעיבוד התשלום. נסו שוב בעוד מספר רגעים." }, { status: 502 });
    }

    const sumitRecurringId = (result.RecurringItemID ?? null) as number | null;
    const sumitDocumentId = (result.DocumentID ?? null) as number | null;
    if (!sumitRecurringId) {
      console.error(
        `WARNING centers/subscribe: no Sumit RecurringItemID for center=${center.id} ` +
          `(uncancellable programmatically). sumitDocumentId=${sumitDocumentId}.`
      );
    }

    // מכאן ההוראה קיימת ב-Sumit — כשל DB לא יוחזר כשגיאה שמזמינה הגשה חוזרת.
    const now = new Date();
    try {
      await supabaseAdmin
        .from("therapy_center_accounts")
        .update({
          status: "active",
          agreed_monthly_price: monthlyTotal,
          billing_starts_at: firstChargeDate ?? now.toISOString().slice(0, 10),
          payer_name: payerName,
          payer_email: payerEmail,
          payer_phone: payerPhone || null,
          payer_company_number: companyNumber || null,
          sumit_recurring_id: sumitRecurringId ? String(sumitRecurringId) : null,
          sumit_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
          paid_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", center.id)
        .throwOnError();

      if (giftMonths > 0) {
        // לא עבר כסף עכשיו — שורת ה-pending שימשה רק כמנעול כפילות.
        await supabaseAdmin.from("payments").delete().eq("id", payment.id).throwOnError();
      } else {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            morning_document_id: sumitDocumentId ? String(sumitDocumentId) : null,
          })
          .eq("id", payment.id)
          .throwOnError();
      }
    } catch (dbErr) {
      console.error(
        `CRITICAL centers/subscribe: Sumit order created but local DB write failed — ` +
          `center=${center.id} payment=${payment.id} sumitRecurringId=${sumitRecurringId} ` +
          `err=${dbErr instanceof Error ? dbErr.message : dbErr}`
      );
      return NextResponse.json({ ok: true, pending: true, message: "התשלום התקבל; נעדכן את הסטטוס בקרוב." });
    }

    console.log(`Center subscription completed: center=${center.id} gift=${giftMonths} therapists=${therapistCount} total=${monthlyTotal}`);

    // מייל ברוכים-הבאים עם קישור לפורטל — best-effort, לעולם לא מכשיל תשלום שהושלם.
    try {
      await sendCenterWelcomeEmail({
        to: payerEmail,
        centerName: center.name,
        pricePerTherapist,
        therapistCount,
        giftMonths,
        billingStartsAt: firstChargeDate ?? now.toISOString().slice(0, 10),
      });
    } catch (mailErr) {
      console.error("centers/subscribe: welcome email failed:", mailErr instanceof Error ? mailErr.message : mailErr);
    }

    return NextResponse.json({ ok: true, gift_months: giftMonths, billing_starts_at: firstChargeDate ?? null });
  } catch (err) {
    console.error("centers/subscribe error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "שגיאה פנימית" }, { status: 500 });
  }
}
