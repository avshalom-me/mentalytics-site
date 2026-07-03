import { NextResponse } from "next/server";
import { computeGuarantee } from "@/app/lib/guarantee";
import { GUARANTEE_DAYS } from "@/app/lib/crm";

// Money-back-guarantee tracker: every paid therapist with their inquiry
// count inside the guarantee window and days left to act.

export async function GET() {
  try {
    const rows = await computeGuarantee();
    return NextResponse.json({ ok: true, guarantee_days: GUARANTEE_DAYS, rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
