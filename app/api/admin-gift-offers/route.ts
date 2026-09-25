import { NextResponse } from "next/server";
import { loadGiftOfferHistory } from "@/app/lib/gift-offer-history";

// כל הצעות קידום המתנה שנשלחו ומה קרה עם כל אחת (לא לחץ / לחץ / נרשם).
// קריאה בלבד. מוגן ב-Basic Auth דרך ה-middleware (קידומת /api/admin-).

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await loadGiftOfferHistory();
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
