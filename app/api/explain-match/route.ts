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

function buildShortExplanation(reasons: string[]): string {
  const joined = reasons.join(" ").toLowerCase();

  const hasTreatment = /טיפול|התמחות|מומחיות|גישה|שיטה/.test(joined);
  const hasRegion    = /אזור|מיקום|עיר|אונליין|online|זמינות/.test(joined);
  const hasOnline    = /אונליין|online/.test(joined);

  const parts: string[] = ["בהתבסס על התשובות שסימנת בשאלון, נמצאה התאמה"];

  if (hasTreatment && hasOnline) {
    parts.push("בין סוג הטיפול המומלץ עבורך לבין תחומי העבודה של המטפל, כולל זמינות לטיפול אונליין.");
  } else if (hasTreatment && hasRegion) {
    parts.push("בין סוג הטיפול המומלץ עבורך לבין תחומי העבודה של המטפל ואזור הפעילות שלו.");
  } else if (hasTreatment) {
    parts.push("בין סוג הטיפול המומלץ עבורך לבין תחומי העבודה של המטפל.");
  } else if (hasOnline) {
    parts.push("בין הצרכים שעלו בשאלון לבין זמינות המטפל לטיפול אונליין.");
  } else if (hasRegion) {
    parts.push("בין הצרכים שעלו בשאלון לבין מיקום וזמינות המטפל.");
  } else {
    parts.push("בין הצרכים שעלו לבין תחומי העבודה והזמינות של המטפל.");
  }

  return parts.join(" ");
}

function buildMockExplanation(body: Body): ExplainResponse {
  const { match_result } = body;

  // title — fixed Hebrew string
  const title = "למה המטפל הזה הוצע לך";

  // bullet_reasons — max 4 items
  const bullet_reasons = match_result.match_reasons.slice(0, 4).length > 0
    ? match_result.match_reasons.slice(0, 4)
    : ["נמצאה התאמה כללית על בסיס תשובות השאלון."];

  // short_explanation — context-aware based on match_reasons content
  const short_explanation = buildShortExplanation(match_result.match_reasons);

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

    return NextResponse.json(explanation, { status: 200 });
  } catch (err) {
    console.error("[explain-match] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
