import { NextRequest, NextResponse } from "next/server";
import { scoreQuestionnaire } from "@/app/lib/questionnaire-score";
import type { QuestionnaireAnswers } from "@/app/lib/questionnaire-types";

export async function POST(request: NextRequest) {
  try {
    const body: QuestionnaireAnswers = await request.json();

    if (!body.domains || !Array.isArray(body.domains)) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid domains field" },
        { status: 400 }
      );
    }

    const result = scoreQuestionnaire(body);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
