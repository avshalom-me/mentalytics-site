import { NextRequest, NextResponse } from "next/server";
import { scoreKidsQuestionnaire } from "@/app/lib/kids-score.server";
import { bumpAndCheckIpDaily, cleanFp, getIp, getUsage, isStaffRequest } from "@/app/lib/usage";
import { isActiveReviewToken } from "@/app/lib/school-review.server";
import { grantFromRequest, schoolGateOn } from "@/app/lib/school-gate.server";
import { bumpSchoolUsage, licenseStillUsable } from "@/app/lib/schools-crm.server";

// The counsellor rubric scores with the kids engine, free of the parent
// paywall: a counsellor works through a caseload, and a referral channel is
// worth more than a credit (docs/school-questionnaire-plan.md, section 9). The
// per-IP daily cap stays as the abuse backstop (429).
//
// Free of the paywall is not the same as a way around it. Until 13/10/2026 the
// route asked nothing about the device, so a parent whose free runs of the kids
// questionnaire were used up could post the same answers here and be scored
// for nothing. Now a device the kids route would refuse (its free runs spent,
// no paid credit) is refused here too, with the kids route's 402 so the quiz
// shows its payment screen. No credit is ever taken here, so a counsellor is
// still never charged; only a device that had already hit the parents' limit
// sees a difference.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    // A reviewer in the review mode opens two dozen prepared cases in a
    // sitting and re-scores each time an answer is changed, which is the daily
    // cap of a whole office. The token in their personal link lifts the cap for
    // them and for nobody else; a request without one never reaches the
    // database to ask.
    const reviewing = await isActiveReviewToken((body as Record<string, unknown>)._reviewToken);
    // The team tries the rubric from its own browsers: a staff browser is not
    // asked about the parents' free runs, and is not held to the daily cap.
    const staff = await isStaffRequest(request, (body as Record<string, unknown>)._staffToken);
    // בית ספר ברישיון: העוגייה החתומה מהקוד שהיועצת הקלידה
    // (app/lib/school-gate.server.ts). הרישיון נבדק מול המסד בכל חישוב, כך
    // שביטול או השבתת קוד תופסים מיד. בית ספר כזה אינו נספר מול תקרת ה-IP
    // (משרד שלם יוצא מכתובת אחת), והשאלון שלו נמנה למוסד, בלי תוכן.
    const grant = reviewing || staff ? null : grantFromRequest(request);
    const licensed = !!grant && (await licenseStillUsable(grant.license_id));
    if (!reviewing && !staff && !licensed && schoolGateOn()) {
      // השער דולק: בלי רישיון אין ניקוד. הלקוח מציג את מסך הקוד.
      return NextResponse.json({ ok: false, licenseRequired: true }, { status: 403 });
    }
    if (!reviewing && !staff && !licensed) {
      const ip = getIp(request);
      const usage = await getUsage(ip, cleanFp((body as Record<string, unknown>)._fp), "kids");
      if (usage.paymentRequired) {
        return NextResponse.json({ ok: false, paymentRequired: true }, { status: 402 });
      }
      if (!(await bumpAndCheckIpDaily(ip))) {
        return NextResponse.json({ ok: false, error: "Daily limit reached" }, { status: 429 });
      }
    }
    const result = scoreKidsQuestionnaire(body);
    if (licensed && grant) await bumpSchoolUsage(grant.school_id);
    // No research counters here on purpose: the counsellor flow is a professional
    // tool about a third party and has a handful of users, so even a weekly
    // count could point at one questionnaire. The version stamp is harmless.
    return NextResponse.json({ ok: true, ...result, algo: process.env.NEXT_PUBLIC_QUIZ_ALGO_VERSION ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
