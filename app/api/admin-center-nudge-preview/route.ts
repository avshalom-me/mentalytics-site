import { NextResponse } from "next/server";
import { loadCentersWithReadiness } from "@/app/lib/center-readiness-load";
import { buildCenterNudgeEmail } from "@/app/lib/center-nudge-email";

// תצוגה מקדימה של מייל הנדנוד לכל מרכז פעיל - קריאה בלבד, לא שולחת דבר.
// מוגן ב-Basic Auth דרך ה-middleware (קידומת /api/admin-).
export const dynamic = "force-dynamic";

export async function GET() {
  const centers = await loadCentersWithReadiness();
  return NextResponse.json({
    ok: true,
    centers: centers.map((c) => ({
      name: c.name,
      track: c.readiness.trackLabel,
      monthly: c.monthlyValue,
      pct: c.readiness.pct,
      headline: c.readiness.headline,
      blocked_on_us: c.readiness.blockedOnUs.map((i) => i.label),
      ...(c.readiness.missingForCenter.length
        ? buildCenterNudgeEmail({
            centerName: c.name,
            readiness: c.readiness,
            token: c.token,
            hasAccount: c.hasAccount,
          })
        : { subject: null, html: null }),
    })),
  });
}
