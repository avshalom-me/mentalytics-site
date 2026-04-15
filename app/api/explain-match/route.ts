import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ── Input schema ──────────────────────────────────────────────────────────────

const BodySchema = z.object({
  questionnaire_type: z.enum(["adult", "child"]),

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
  short_explanation: string;
  bullet_reasons: string[];
  tone_note: string;
};

// ── Mock explanation builder ──────────────────────────────────────────────────
// TODO: Replace this function with a real AI call (e.g. Claude Haiku via
//       Anthropic API) when ready. The function signature and return type
//       should remain the same so callers don't need to change.
//
// Future call site:
//   const client = new Anthropic();
//   const message = await client.messages.create({
//     model: "claude-haiku-4-5-20251001",
//     max_tokens: 300,
//     messages: [{ role: "user", content: buildPrompt(body) }],
//   });
//   return parseAIResponse(message.content);

function buildMockExplanation(body: Body): ExplainResponse {
  const { match_result } = body;

  // title — fixed Hebrew string
  const title = "למה המטפל הזה הוצע לך";

  // short_explanation — neutral fixed sentence
  const short_explanation =
    "בהתבסס על התשובות שסימנת בשאלון, נמצאה התאמה בין הצרכים שעלו לבין תחומי העבודה והזמינות של המטפל.";

  // bullet_reasons — take top 4 from match_reasons, use all if fewer
  const reasons = match_result.match_reasons.slice(0, 4);
  const bullet_reasons = reasons.length > 0
    ? reasons
    : ["נמצאה התאמה כללית על בסיס תשובות השאלון."];

  // tone_note — fixed disclaimer
  const tone_note =
    "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית.";

  return { title, short_explanation, bullet_reasons, tone_note };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const explanation = buildMockExplanation(parsed.data);

    return NextResponse.json({ ok: true, ...explanation }, { status: 200 });
  } catch (err) {
    console.error("[explain-match] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
