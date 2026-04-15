import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

// ── OpenAI client (server-side only) ─────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Input schema ──────────────────────────────────────────────────────────────

const BodySchema = z.object({
  questionnaire_type: z.enum(["adult", "child"]),
  search_mode: z.enum(["single", "combined"]).optional(),

  user_summary: z
    .object({
      age_group: z.string().optional(),
      region_preference: z.string().optional(),
      online_preference: z.boolean().optional(),
      therapist_gender_preference: z.string().nullable().optional(),
      main_needs: z.array(z.string()).optional(),
      recommended_treatment_types: z.array(z.string()).optional(),
      recommended_therapist_types: z.array(z.string()).optional(),
      cultural_preferences: z.array(z.string()).optional(),
    })
    .optional(),

  therapist: z.object({
    id: z.string(),
    full_name: z.string(),
    therapist_types: z.array(z.string()).optional(),
    training_areas: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    online: z.boolean().optional(),
    gender: z.string().nullable().optional(),
    cultural_prefs: z.array(z.string()).optional(),
    bio: z.string().nullable().optional(),
  }),

  match_result: z.object({
    match_score: z.number(),
    match_reasons: z.array(z.string()),
    matched_fields: z.record(z.string(), z.unknown()).optional(),
  }),
});

type Body = z.infer<typeof BodySchema>;

// ── Output type ───────────────────────────────────────────────────────────────

type ExplainResponse = {
  title: string;
  explanation: string;
  tone_note: string;
};

// ── Mock / fallback explanation builder ──────────────────────────────────────

function buildMockExplanation(body: Body): ExplainResponse {
  const { match_result, user_summary, therapist } = body;
  const reasons = match_result.match_reasons;

  const treatments = user_summary?.recommended_treatment_types ?? [];
  const therapistAreas = therapist.training_areas ?? [];
  const matchedTreatments = treatments.filter(t => therapistAreas.includes(t));
  const unmatchedTreatments = treatments.filter(t => !therapistAreas.includes(t));

  let explanation = "בהתבסס על תשובות השאלון, ";

  if (matchedTreatments.length > 0) {
    explanation += `המטפל מתמחה ב${matchedTreatments.join(", ")} שמתאים לצרכים שעלו. `;
  } else if (reasons.length > 0) {
    explanation += `נמצאה התאמה על בסיס ${reasons[0]}. `;
  }

  if (unmatchedTreatments.length > 0) {
    explanation += `חלק מהצרכים שעלו (${unmatchedTreatments.join(", ")}) אינם בדיוק בתחום ההתמחות, אך מבין המטפלים הזמינים זוהי ההתאמה הקרובה ביותר לפרופיל שלך.`;
  } else {
    explanation += "זוהי ההתאמה הטובה ביותר שנמצאה מבין המטפלים הזמינים.";
  }

  return {
    title: "למה המטפל הזה הוצע לך",
    explanation,
    tone_note: "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית.",
  };
}

// ── OpenAI prompt builder ─────────────────────────────────────────────────────

function buildPrompt(body: Body): string {
  return JSON.stringify({
    questionnaire_type: body.questionnaire_type,
    search_mode: body.search_mode ?? "single",
    user_summary: body.user_summary ?? {},
    therapist: {
      full_name: body.therapist.full_name,
      therapist_types: body.therapist.therapist_types ?? [],
      training_areas: body.therapist.training_areas ?? [],
      regions: body.therapist.regions ?? [],
      online: body.therapist.online ?? false,
      bio: body.therapist.bio ?? null,
    },
    match_result: {
      match_score: body.match_result.match_score,
      match_reasons: body.match_result.match_reasons,
    },
  }, null, 2);
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `אתה עוזר שמסביר בעברית פשוטה וכנה מדוע מטפל מסוים הוצע למשתמש.

המשימה שלך: כתוב פסקה אחת קצרה (2-4 משפטים) שמסבירה:
1. מה בפרופיל המטפל מתאים לצרכים שעלו בשאלון — כולל תובנות שאינן כתובות ישירות ב-match_reasons (למשל: מה בביוגרפיה, סגנון הטיפול, או שיטת העבודה רלוונטי לצרכים שצוינו)
2. מה פחות מתאים בדיוק (אם יש פער בין מה שהומלץ לבין מה שהמטפל מציע)
3. למה בכל זאת זוהי ההתאמה הטובה ביותר שנמצאה

כללים:
- אל תחזור על ה-match_reasons מילה במילה — סנתז אותן
- אל תאבחן את המשתמש
- אל תבטיח הצלחה
- אל תכתוב "המטפל הטוב ביותר"
- השתמש בניסוחים כמו "בהתבסס על תשובות השאלון", "נמצאה התאמה", "מבין המטפלים הזמינים"
- אם search_mode הוא "combined" — הדגש במיוחד אילו מהצרכים המרובים המטפל מכסה ואילו פחות
- אם אין פער משמעותי — אל תמציא אחד
- החזר JSON בלבד במבנה הבא:
{
  "title": "למה המטפל הזה הוצע לך",
  "explanation": string,
  "tone_note": "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית."
}`,
      },
      {
        role: "user",
        content: buildPrompt(body),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as Partial<ExplainResponse>;

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.explanation !== "string" ||
    typeof parsed.tone_note !== "string"
  ) {
    throw new Error("OpenAI response missing required fields");
  }

  return {
    title: parsed.title,
    explanation: parsed.explanation,
    tone_note: parsed.tone_note,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;

    try {
      const explanation = await callOpenAI(body);
      return NextResponse.json(explanation, { status: 200 });
    } catch (aiErr) {
      console.error("[explain-match] OpenAI call failed, using fallback:", aiErr);
      const fallback = buildMockExplanation(body);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (err) {
    console.error("[explain-match] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
