import { NextRequest, NextResponse } from "next/server";
import { scoreKidsQuestionnaire } from "@/app/lib/kids-score.server";
import { bumpAndCheckIpDaily, getIp } from "@/app/lib/usage";

// The counsellor rubric scores with the kids engine, free of the parent
// paywall: a counsellor works through a caseload, and a referral channel is
// worth more than a credit (docs/school-questionnaire-plan.md, section 9). The
// per-IP daily cap stays as the abuse backstop. It answers 429, never 402 -
// there is no payment screen to send a counsellor to.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
    }
    if (!(await bumpAndCheckIpDaily(getIp(request)))) {
      return NextResponse.json({ ok: false, error: "Daily limit reached" }, { status: 429 });
    }
    const result = scoreKidsQuestionnaire(body);
    // No research counters here on purpose: the counsellor flow is a professional
    // tool about a third party and has a handful of users, so even a weekly
    // count could point at one questionnaire. The version stamp is harmless.
    return NextResponse.json({ ok: true, ...result, algo: process.env.NEXT_PUBLIC_QUIZ_ALGO_VERSION ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}
