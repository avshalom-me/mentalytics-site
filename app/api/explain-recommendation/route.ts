import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

// Produces a personalised explanation of why a specific treatment / referral
// was recommended to a given user based on their questionnaire answers.
// Mirrors the structure of /api/explain-match (therapist-level) but operates
// at the recommendation level — i.e. one step earlier in the funnel.
//
// The client is responsible for sanitising the user's questionnaire data and
// sending only derived "facts" (scores, flags, derived severity) — never raw
// free-text fields like trauma descriptions.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Input schema ──────────────────────────────────────────────────────────────

const BodySchema = z.object({
  questionnaire_type: z.enum(["adult", "child"]),

  recommendation: z.object({
    treatment: z.string(),               // e.g. "CBT"
    treatment_label: z.string(),         // human readable, e.g. "CBT לחרדה"
    domain: z.string(),                  // e.g. "מורכבויות בתחום הרגשי/האישי"
    urgent: z.boolean().optional(),
    symptom_text: z.string().optional(), // short text describing the finding
  }),

  user_facts: z.object({
    // Derived facts — sanitised on the client. Free-form so different
    // questionnaires can supply different summaries (mood scores for adults,
    // grade-level + behaviour categories for kids, etc.).
    summary: z.array(z.string()).optional(),   // bullet-style summary lines
    scores: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    age_band: z.string().optional(),
    gender: z.string().optional(),
    flags: z.array(z.string()).optional(),
  }).optional(),

  treatment_rationale: z.object({
    // Optional structured rationale supplied by the client — gives the model
    // ground truth so it doesn't invent evidence claims.
    why: z.string().optional(),
    typical_duration: z.string().optional(),
    evidence_strength: z.enum(["high", "moderate", "low"]).optional(),
  }).optional(),
});

type Body = z.infer<typeof BodySchema>;

// ── Output type ───────────────────────────────────────────────────────────────

type ExplainResponse = {
  title: string;
  explanation: string;
  evidence_note: string;
};

// ── Mock / fallback explanation builder ──────────────────────────────────────

function buildMockExplanation(body: Body): ExplainResponse {
  const { recommendation, user_facts } = body;
  const factsList = user_facts?.summary ?? [];
  const factsText = factsList.length > 0
    ? `על בסיס מה שעלה בשאלון (${factsList.slice(0, 2).join(", ")}), `
    : "על בסיס מכלול התשובות בשאלון, ";

  return {
    title: `למה הוצע ${recommendation.treatment_label}`,
    explanation:
      factsText +
      `נמצאה התאמה ל${recommendation.treatment_label}. ` +
      "זוהי גישה רלוונטית לסוג הקושי שעלה. כדאי לבחון עם המטפל את ההתאמה הספציפית למצבך.",
    evidence_note:
      "ההסבר מבוסס על תשובותיך לשאלון בלבד ואינו מהווה אבחון או המלצה רפואית.",
  };
}

// ── OpenAI prompt builder ─────────────────────────────────────────────────────

function buildPrompt(body: Body): string {
  return JSON.stringify({
    questionnaire_type: body.questionnaire_type,
    recommendation: body.recommendation,
    user_facts: body.user_facts ?? {},
    treatment_rationale: body.treatment_rationale ?? {},
  }, null, 2);
}

const SYSTEM_PROMPT = `אתה עוזר שמסביר בעברית פשוטה למה הומלץ למטופל סוג טיפול ספציפי על בסיס תשובות השאלון שלו.

המשימה: כתוב פסקה אחת קצרה (3-4 משפטים) שמסבירה:
1. אילו תשובות / ממצאים ספציפיים בשאלון הובילו להמלצה הזו (השתמש ב-user_facts.summary, scores, flags כעובדות גולמיות — אל תמציא ציונים שלא קיימים)
2. למה הטיפול הזה מתאים לקשיים שעלו (השתמש ב-treatment_rationale.why אם סופק; אחרת הסבר באופן כללי וזהיר)
3. אם treatment_rationale.typical_duration קיים — ציין אותו בקצרה

כללים:
- כתוב בלשון "אתה/את" — פונה ישירות למשתמש
- היה אמפתי, לא ביקורתי
- אל תאבחן ("יש לך חרדה כללית")
- אל תבטיח ריפוי או הצלחה
- אל תכתוב סטטיסטיקות שלא סופקו במפורש
- אל תזכיר שמות של מטפלים או קופות חולים
- שמור על אורך של 60-120 מילים
- אם questionnaire_type הוא "child" — כתוב להורה (לשון "ילדך/ילדתך", "אתם כהורים")
- אם recommendation.urgent הוא true — הזכר בקצרה שזו הפנייה דחופה יותר ולכן מומלץ לפעול במהירות

החזר JSON בלבד:
{
  "title": string,             // כותרת קצרה: "למה הוצע X" (איפה X = שם הטיפול)
  "explanation": string,       // הפסקה המלאה
  "evidence_note": "ההסבר מבוסס על תשובותיך לשאלון בלבד ואינו מהווה אבחון או המלצה רפואית."
}`;

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 400,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(body) },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as Partial<ExplainResponse>;

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.explanation !== "string" ||
    typeof parsed.evidence_note !== "string"
  ) {
    throw new Error("OpenAI response missing required fields");
  }

  return {
    title: parsed.title,
    explanation: parsed.explanation,
    evidence_note: parsed.evidence_note,
  };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Each IP gets 30 explanation requests per minute — generous enough for normal
// use, low enough to deter abuse. In-memory only; resets on cold start.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

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
      console.error("[explain-recommendation] OpenAI call failed, using fallback:", aiErr);
      const fallback = buildMockExplanation(body);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (err) {
    console.error("[explain-recommendation] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
