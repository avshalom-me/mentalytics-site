import { NextResponse } from "next/server";
import { loadMatchDistribution } from "@/app/lib/match-distribution";

export const dynamic = "force-dynamic";

// רובריקת חלוקת הפניות בעמוד הסוכנים (29/10/2026). אדמין בלבד: הנתיב מתחיל
// ב-/api/admin- ולכן ה-middleware דורש את כניסת האדמין.
export async function GET() {
  try {
    const report = await loadMatchDistribution();
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
