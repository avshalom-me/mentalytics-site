import { NextRequest, NextResponse } from "next/server";
import { chargeSchoolPayment, SumitBusinessError, SumitPaymentDeclinedError } from "@/app/lib/sumit";
import {
  PAY_PAGE_VIEWER,
  claimPaymentForCard,
  getPayPage,
  licenseAccessCode,
  markPaymentReceived,
  releasePaymentClaim,
} from "@/app/lib/schools-crm.server";
import { licenseInvoiceItem } from "@/app/lib/schools-crm";
import { underDailyCap } from "@/app/lib/daily-cap";
import { getIp } from "@/app/lib/usage";

// דף התשלום של בית ספר (app/school/pay/[license]). הקישור נשלח לבית הספר
// מהאדמין; מזהה הרישיון הוא UUID אקראי, והדף מגלה רק את שם בית הספר, התקופה
// והסכומים. קוד הגישה לשאלון אינו חלק מה-GET: הוא חוזר רק אחרי חיוב שהצליח.
//
// GET   מה לשלם ואיך: הרישיון, לוח התשלומים, התשלום הפתוח הבא ופרטי ההעברה.
// POST  חיוב בכרטיס של התשלום הפתוח הבא. הכרטיס כבר עבר טוקניזציה בדפדפן
//       מול Sumit (SingleUseToken), כמו בשאר עמודי התשלום. התשלום נתפס לפני
//       החיוב, כך שלחיצה כפולה לא מחייבת פעמיים.

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ license: string }> };

const NOT_FOUND = NextResponse.json({ ok: false, error: "הקישור אינו תקין, או שהרישיון אינו קיים." }, { status: 404 });

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { license } = await ctx.params;
  const page = await getPayPage(license);
  if (!page) return NOT_FOUND;
  return NextResponse.json({ ok: true, ...page }, { headers: { "Cache-Control": "no-store" } });
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest, ctx: Ctx) {
  const { license } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  const token = clean(body.singleUseToken, 400);
  const payerName = clean(body.payerName, 120).replace(/[^\p{L}\p{N}\s'".\-]/gu, "");
  const payerEmail = clean(body.payerEmail, 200);
  const payerPhone = clean(body.payerPhone, 30);
  if (!token || !payerName || !payerEmail) {
    return NextResponse.json({ ok: false, error: "חסרים פרטים: שם המשלם, מייל לחשבונית ופרטי הכרטיס." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    return NextResponse.json({ ok: false, error: "כתובת המייל אינה תקינה." }, { status: 400 });
  }

  // תקרת ניסיונות חיוב לכתובת, כמו בתשלום על השאלון: בלעדיה דף ציבורי עם
  // סכום קבוע הוא מכונה לבדיקת כרטיסים גנובים.
  const ip = getIp(req);
  if (!(await underDailyCap(`school_pay:${ip}`, 10))) {
    return NextResponse.json({ ok: false, error: "יותר מדי ניסיונות היום. אפשר לנסות מחר, או לשלם בהעברה." }, { status: 429 });
  }

  const page = await getPayPage(license);
  if (!page) return NOT_FOUND;
  if (!page.open || !page.next) {
    return NextResponse.json({ ok: false, error: "אין תשלום פתוח לרישיון הזה." }, { status: 409 });
  }
  const next = page.next;
  if (!(await claimPaymentForCard(next.id))) {
    return NextResponse.json({ ok: false, error: "התשלום כבר בתהליך. אם החיוב לא הושלם, אפשר לנסות שוב בעוד כעשר דקות." }, { status: 409 });
  }

  let result;
  try {
    result = await chargeSchoolPayment({
      schoolId: page.license.school_id,
      schoolName: page.school.symbol ? `${page.school.name} (סמל ${page.school.symbol})` : page.school.name,
      payerName,
      payerEmail,
      payerPhone,
      singleUseToken: token,
      amountGross: next.amount_gross,
      itemName: licenseInvoiceItem(page.license.kind, page.license.school_year, next.seq, page.payments.length),
    });
  } catch (err) {
    // רק כשידוע בוודאות שהכסף לא נגבה משחררים את התפיסה: דחייה של חברת האשראי
    // (Payment.ValidPayment=false), או סירוב של Sumit לבקשה עצמה (Status שאינו 0).
    // תקלת רשת, זמן קצוב או תשובה לא קריאה משאירות תוצאה לא ידועה: ייתכן שהכרטיס
    // חויב. שחרור התפיסה היה נותן ללקוח ללחוץ שוב ולחייב פעמיים, ולכן היא נשארת
    // (לעשר דקות, כמו נעילת הסימון הידני) והתשלום מופיע באדמין כחיוב פתוח.
    if (err instanceof SumitPaymentDeclinedError) {
      await releasePaymentClaim(next.id);
      console.warn(`school-pay: card declined for license ${license}${err.declineCode ? ` code=${err.declineCode}` : ""}`);
      return NextResponse.json({ ok: false, error: "החיוב נדחה על ידי חברת האשראי. אפשר לבדוק את הפרטים או לנסות כרטיס אחר." }, { status: 402 });
    }
    if (err instanceof SumitBusinessError) {
      await releasePaymentClaim(next.id);
      console.error("school-pay: Sumit refused the charge request:", err.message);
      return NextResponse.json({ ok: false, error: "מערכת התשלום לא קיבלה את הבקשה. אפשר לבדוק את הפרטים ולנסות שוב, או לשלם בהעברה." }, { status: 502 });
    }
    console.error(
      `school-pay CRITICAL: card charge outcome unknown for payment ${next.id} (license ${license}); the claim is kept and nothing was recorded. Check Sumit before any retry:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, error: "לא קיבלנו אישור על החיוב מחברת האשראי, וייתכן שהוא בוצע. כדי לא לחייב פעמיים, לא לנסות שוב עכשיו: נבדוק מול חברת הסליקה ונחזור אליכם. אפשר גם לשלם בהעברה." },
      { status: 502 },
    );
  }

  // הכרטיס חויב. מכאן לא מחזירים שגיאה (ניסיון חוזר = חיוב כפול): כשל ברישום
  // נכתב ללוג עם מזהה המסמך של Sumit, והתשלום מסומן באדמין ביד.
  const documentId = typeof result.DocumentID === "number" ? String(result.DocumentID) : undefined;
  const documentNumber = typeof result.DocumentNumber === "number" ? String(result.DocumentNumber) : undefined;
  try {
    await markPaymentReceived(PAY_PAGE_VIEWER, next.id, {
      method: "card",
      sumit_document_id: documentId,
      sumit_document_number: documentNumber,
      note: `שולם בכרטיס בדף התשלום: ${payerName}, ${payerEmail}`,
    }, { fromCardCharge: true });
  } catch (err) {
    console.error(
      `school-pay CRITICAL: Sumit charge succeeded (doc ${documentId ?? "?"}) but marking payment ${next.id} received failed:`,
      err instanceof Error ? err.message : err,
    );
  }
  const after = await licenseAccessCode(license);
  const active = after?.status === "active";
  return NextResponse.json({
    ok: true,
    amount_gross: next.amount_gross,
    seq: next.seq,
    license_active: active,
    access_code: active ? after?.access_code : undefined,
  });
}
