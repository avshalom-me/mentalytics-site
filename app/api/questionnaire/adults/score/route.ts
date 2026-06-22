import { NextRequest, NextResponse } from "next/server";
import { scoreQuestionnaire } from "@/app/lib/questionnaire-score";
import type { QuestionnaireAnswers } from "@/app/lib/questionnaire-types";
import { cleanFp, consumeUsage, getIp, getUsage, isStaffBypass } from "@/app/lib/usage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.domains || !Array.isArray(body.domains)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid domains field" },
        { status: 400 }
      );
    }

    // Server-side free-tier enforcement. The result (the personalized
    // recommendations) is the paid product, so the limit is checked HERE —
    // not just in the client UI, which is trivially bypassable.
    const staff = isStaffBypass(body._staffToken);
    const fp = cleanFp(body._fp);
    const ip = getIp(request);

    if (!staff) {
      const usage = await getUsage(ip, fp, "adults");
      if (usage.paymentRequired) {
        return NextResponse.json({ ok: false, paymentRequired: true }, { status: 402 });
      }
    }

    const result = scoreQuestionnaire(body as QuestionnaireAnswers);

    // Consume one credit only after a result is successfully produced.
    if (!staff) {
      await consumeUsage(ip, fp, "adults");
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
