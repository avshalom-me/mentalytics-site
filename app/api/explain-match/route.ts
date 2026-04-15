import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

// ── OpenAI client (server-side only) ─────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

// ── Mock / fallback explanation builder ──────────────────────────────────────
// Used when OpenAI call fails or returns unparseable output.

function buildShortExplanation(reasons: string[]): string {
  const joined = reasons.join(" ").toLowerCase();
  const hasTreatment = /טיפול|התמחות|מומחיות|גישה|שיטה/.test(joined);
  const hasOnline    = /אונליין|online/.test(joined);
  const hasRegion    = /אזור|מיקום|עיר|זמינות/.test(joined);

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
  const bullet_reasons = match_result.match_reasons.slice(0, 4).length > 0
    ? match_result.match_reasons.slice(0, 4)
    : ["נמצאה התאמה כללית על בסיס תשובות השאלון."];

  return {
    title: "למה המטפל הזה הוצע לך",
    short_explanation: buildShortExplanation(match_result.match_reasons),
    bullet_reasons,
    tone_note: "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית.",
  };
}

// ── OpenAI prompt builder ─────────────────────────────────────────────────────

function buildPrompt(body: Body): string {
  return JSON.stringify({
    questionnaire_type: body.questionnaire_type,
    user_summary: body.user_summary ?? {},
    therapist: {
      full_name: body.therapist.full_name,
      therapist_types: body.therapist.therapist_types ?? [],
      training_areas: body.therapist.training_areas ?? [],
      regions: body.therapist.regions ?? [],
      online: body.therapist.online ?? false,
    },
    match_result: {
      match_score: body.match_result.match_score,
      match_reasons: body.match_result.match_reasons,
    },
  }, null, 2);
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  // ── OpenAI API call ───────────────────────────────────────────────────────
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 400,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `אתה עוזר שמסביר בעברית פשוטה וברורה מדוע מטפל מסוים הוצע למשתמש.
כללים:
- השתמש רק בנתונים שסופקו לך
- אל תאבחן את המשתמש
- אל תבטיח הצלחה
- אל תכתוב "המטפל הטוב ביותר"
- השתמש בניסוחים כמו "בהתבסס על התשובות שלך", "נמצאה התאמה"
- החזר JSON בלבד במבנה הבא:
{
  "title": string,
  "short_explanation": string,
  "bullet_reasons": string[],
  "tone_note": string
}
- title: תמיד "למה המטפל הזה הוצע לך"
- short_explanation: משפט אחד עד שניים בעברית
- bullet_reasons: 2 עד 4 נקודות קצרות בעברית
- tone_note: תמיד "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית."`,
      },
      {
        role: "user",
        content: buildPrompt(body),
      },
    ],
  });
  // ── End OpenAI API call ───────────────────────────────────────────────────

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as Partial<ExplainResponse>;

  // Validate required fields exist
  if (
    typeof parsed.title !== "string" ||
    typeof parsed.short_explanation !== "string" ||
    !Array.isArray(parsed.bullet_reasons) ||
    typeof parsed.tone_note !== "string"
  ) {
    throw new Error("OpenAI response missing required fields");
  }

  // Enforce bullet limit
  const bullet_reasons = parsed.bullet_reasons.slice(0, 4);
  if (bullet_reasons.length < 1) {
    throw new Error("OpenAI returned empty bullet_reasons");
  }

  return {
    title: parsed.title,
    short_explanation: parsed.short_explanation,
    bullet_reasons,
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
      // ── Try OpenAI first ──────────────────────────────────────────────────
      const explanation = await callOpenAI(body);
      return NextResponse.json(explanation, { status: 200 });
    } catch (aiErr) {
      // ── Fallback to mock if OpenAI fails ──────────────────────────────────
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
