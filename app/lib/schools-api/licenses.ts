// מקור משותף: נתיב האדמין (/api/admin-schools/*, הבעלים) ונתיב הפורטל
// (/api/partner-schools/*, השותפה) קוראים לכאן עם אובייקט צופה.
import { NextRequest, NextResponse } from "next/server";
import {
    SchoolsCrmError,
  autoMatchTransfers,
  cancelLicense,
  createLicense,
  deleteLicense,
  isUuid,
  listLicenses,
  listSchools,
  markPaymentReceived,
  matchTransfer,
  proposeTransferMatches,
  setLicenseCode,
} from "@/app/lib/schools-crm.server";
import type { Viewer } from "@/app/lib/schools-crm.server";
import { LICENSE_KINDS, PAYMENT_METHODS, SCHEDULE_KINDS } from "@/app/lib/schools-crm";

// רישיונות ותשלומים של ענף בתי הספר, לאדמין (/admin/schools/payments).
// Basic Auth ושומר ה-CSRF של ה-middleware מכסים את כל /api/admin-*.
//
// GET   כל הרישיונות עם בית הספר והתשלומים, ורשימת בתי הספר לרישיון חדש.
// POST  {action}: create (רישיון חדש עם קוד ולוח תשלומים), mark_received
//       (העברה, המחאה או הזמנת רכש שהגיעו; התשלום הראשון מפעיל את הרישיון),
//       code (השבתה/הפעלה של קוד הגישה), cancel (ביטול רישיון),
//       match_transfer (שיוך זיכוי מדף הבנק לתשלום צפוי), auto_match (רק
//       ההתאמות הוודאיות, כמו בקרון היומי), delete (רישיון בלי תשלום שהתקבל).
//       התאמת העברות ודף הבנק: רק הבעלים.
// GET ?transfers=1  זיכויים מדף הבנק עם ההצעות שלהם.

const has = (list: { value: string }[], v: unknown) => typeof v === "string" && list.some((o) => o.value === v);
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function licensesGet(req: NextRequest, v: Viewer) {
  try {
    if (req.nextUrl.searchParams.get("transfers")) {
      // דף הבנק הוא של החברה כולה: רק הבעלים.
      if (v.role !== "owner") return NextResponse.json({ ok: false, error: "רק הבעלים" }, { status: 403 });
      return NextResponse.json({ ok: true, ...(await proposeTransferMatches()) });
    }
    const [licenses, schools] = await Promise.all([listLicenses(), listSchools({ includeDemo: true })]);
    return NextResponse.json({
      ok: true,
      licenses,
      schools: schools.map((s) => ({ id: s.id, name: s.name, symbol: s.symbol, city: s.city, is_demo: s.is_demo, status: s.status })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function licensesPost(req: NextRequest, v: Viewer) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה" }, { status: 400 });
  }
  try {
    switch (body.action) {
      case "create": {
        if (!isUuid(body.school_id)) return NextResponse.json({ ok: false, error: "בוחרים בית ספר" }, { status: 400 });
        if (!has(LICENSE_KINDS, body.kind)) return NextResponse.json({ ok: false, error: "סוג רישיון לא מוכר" }, { status: 400 });
        const price = Number(body.price_gross);
        if (!Number.isFinite(price) || price < 0) return NextResponse.json({ ok: false, error: "מחיר לא תקין" }, { status: 400 });
        const activation = str(body.activation_date, 10);
        if (activation && !/^\d{4}-\d{2}-\d{2}$/.test(activation)) return NextResponse.json({ ok: false, error: "תאריך הפעלה לא תקין" }, { status: 400 });
        const schedule = has(SCHEDULE_KINDS, body.schedule_kind) ? (body.schedule_kind as string) : "full";
        const license = await createLicense(v, {
          school_id: body.school_id,
          kind: body.kind as string,
          activation_date: activation || undefined,
          price_gross: Math.round(price * 100) / 100,
          schedule_kind: schedule,
          notes: str(body.notes) || undefined,
        });
        return NextResponse.json({ ok: true, license });
      }
      case "mark_received": {
        if (!isUuid(body.payment_id)) return NextResponse.json({ ok: false, error: "חסר מזהה תשלום" }, { status: 400 });
        if (!has(PAYMENT_METHODS, body.method)) return NextResponse.json({ ok: false, error: "אמצעי תשלום לא מוכר" }, { status: 400 });
        const day = str(body.received_on, 10);
        if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return NextResponse.json({ ok: false, error: "תאריך לא תקין" }, { status: 400 });
        const payment = await markPaymentReceived(v, body.payment_id, {
          method: body.method as string,
          received_at: day ? `${day}T12:00:00+03:00` : undefined,
          sumit_document_number: str(body.sumit_document_number, 40) || undefined,
          proforma_number: str(body.proforma_number, 40) || undefined,
          note: str(body.note) || undefined,
        });
        return NextResponse.json({ ok: true, payment });
      }
      case "code": {
        if (!isUuid(body.license_id)) return NextResponse.json({ ok: false, error: "חסר מזהה רישיון" }, { status: 400 });
        await setLicenseCode(v, body.license_id, body.disabled === true);
        return NextResponse.json({ ok: true });
      }
      case "cancel": {
        if (!isUuid(body.license_id)) return NextResponse.json({ ok: false, error: "חסר מזהה רישיון" }, { status: 400 });
        const reason = str(body.reason, 300);
        if (!reason) return NextResponse.json({ ok: false, error: "כותבים סיבה לביטול" }, { status: 400 });
        await cancelLicense(v, body.license_id, reason);
        return NextResponse.json({ ok: true });
      }
      case "delete": {
        if (!isUuid(body.license_id)) return NextResponse.json({ ok: false, error: "חסר מזהה רישיון" }, { status: 400 });
        await deleteLicense(v, body.license_id);
        return NextResponse.json({ ok: true });
      }
      case "match_transfer": {
        if (v.role !== "owner") return NextResponse.json({ ok: false, error: "רק הבעלים" }, { status: 403 });
        if (!isUuid(body.payment_id) || !isUuid(body.statement_line_id)) return NextResponse.json({ ok: false, error: "חסר מזהה" }, { status: 400 });
        const payment = await matchTransfer(v, body.payment_id, body.statement_line_id);
        return NextResponse.json({ ok: true, payment });
      }
      case "auto_match": {
        if (v.role !== "owner") return NextResponse.json({ ok: false, error: "רק הבעלים" }, { status: 403 });
        return NextResponse.json({ ok: true, ...(await autoMatchTransfers(v)) });
      }
      default:
        return NextResponse.json({ ok: false, error: "פעולה לא מוכרת" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}

function fail(e: unknown) {
  if (e instanceof SchoolsCrmError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
  console.error("schools-api/licenses:", e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: "שגיאה בשרת" }, { status: 500 });
}
