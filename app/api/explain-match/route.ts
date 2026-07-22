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
      couples_modality: z.string().nullable().optional(),
      recommended_assessment_types: z.array(z.string()).optional(),
      recommended_therapist_types: z.array(z.string()).optional(),
      cultural_preferences: z.array(z.string()).optional(),
    })
    .optional(),

  therapist: z.object({
    id: z.string(),
    full_name: z.string(),
    therapist_types: z.array(z.string()).optional(),
    training_areas: z.array(z.string()).optional(),
    couples_modalities: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    online: z.boolean().optional(),
    gender: z.string().nullable().optional(),
    cultural_prefs: z.array(z.string()).optional(),
    bio: z.string().nullable().optional(),
  }),

  match_result: z.object({
    match_score: z.number(),
    personality_score: z.number().nullable().optional(),
    match_reasons: z.array(z.string()),
    matched_fields: z.record(z.string(), z.unknown()).optional(),
  }),

  addiction_cbt_fallback: z.boolean().optional(),
});

type Body = z.infer<typeof BodySchema>;

// ── Output type ───────────────────────────────────────────────────────────────

type ExplainResponse = {
  title: string;
  explanation: string;
  tone_note: string;
};

// Fixed disclaimer — set server-side so the model never has to echo it.
const TONE_NOTE =
  "ההתאמה מבוססת על תשובות השאלון ואינה מהווה אבחנה או המלצה בלעדית.";

// ── Title helper ──────────────────────────────────────────────────────────────

function buildTitle(body: Body): string {
  const isAssessment = (body.user_summary?.recommended_assessment_types?.length ?? 0) > 0;
  const gender = body.therapist.gender;
  if (isAssessment) {
    if (gender === "נקבה") return "למה המאבחנת הזאת הוצעה לך";
    if (gender === "זכר") return "למה המאבחן הזה הוצע לך";
    return "למה המאבחן/ת הוצע/ה לך";
  }
  if (gender === "נקבה") return "למה המטפלת הזאת הוצעה לך";
  if (gender === "זכר") return "למה המטפל הזה הוצע לך";
  return "למה המטפל/ת הוצע/ה לך";
}

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
    title: buildTitle(body),
    explanation,
    tone_note: TONE_NOTE,
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
      couples_modalities: body.therapist.couples_modalities ?? [],
      regions: body.therapist.regions ?? [],
      gender: body.therapist.gender ?? null,
      online: body.therapist.online ?? false,
      bio: body.therapist.bio ?? null,
    },
    match_result: {
      match_score: body.match_result.match_score,
      personality_score: body.match_result.personality_score ?? null,
      match_reasons: body.match_result.match_reasons,
    },
    addiction_cbt_fallback: body.addiction_cbt_fallback ?? false,
  }, null, 2);
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

// The model returns ONLY the explanation text; title + tone_note are built
// server-side. strict json_schema constrains decoding, so a response with
// missing/renamed keys (seen in production with plain json_object mode) cannot
// be generated.
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "match_explanation",
    strict: true,
    schema: {
      type: "object",
      properties: { explanation: { type: "string" } },
      required: ["explanation"],
      additionalProperties: false,
    },
  },
} as const;

// The API call succeeded but the content is unusable (refusal, truncation,
// bad JSON) — the one case worth a single retry; transport errors are already
// retried inside the SDK.
class BadAiResponseError extends Error {}

async function callOpenAIOnce(body: Body): Promise<ExplainResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 800,
    temperature: 0.5,
    response_format: RESPONSE_FORMAT,
    messages: [
      {
        role: "system",
        content: `אתה עוזר שמסביר בעברית פשוטה, חמה וכנה מדוע איש/ת מקצוע מסוים/ת הוצע/ה למשתמש, על בסיס תשובות השאלון שלו.

**חשוב — הבחן בין שני מצבים:**

אם recommended_assessment_types קיים ואינו ריק — מדובר בהפניה לאבחון (לא לטיפול). במקרה זה:
- התמקד ביכולות האבחוניות של איש/ת המקצוע: ניסיון בסוג האבחון המבוקש, הכשרה רלוונטית לאבחון, גישה לתהליך האבחוני
- אל תציין גישות טיפוליות (CBT, דינאמי, התנהגותי וכו') כנקודות חיזוק — הן אינן רלוונטיות להפניה לאבחון
- ציין את סוג האבחון המבוקש (לפי recommended_assessment_types)
- אל תתייחס להתאמה סגנונית/אישיותית — היא פחות רלוונטית לתהליך אבחון חד-פעמי

אחרת — מדובר בהפניה לטיפול: התמקד בהתאמה הטיפולית (גישה, הכשרה, ניסיון עם הצרכים שעלו).

**טיפול זוגי — סוג הגישה:**
אם user_summary.couples_modality קיים (EFT / דינאמי / מבני) — זהו סוג הטיפול הזוגי שהומלץ למטופל לפי תשובותיו:
- EFT = טיפול ממוקד-רגש (זיהוי דפוסי תגובה רגשיים וחיזוק הקשר הרגשי הבטוח בין בני הזוג)
- דינאמי = בחינת השפעת ההיסטוריה האישית והדפוסים הלא-מודעים על הדינמיקה הזוגית
- מבני = שיפור דפוסי תקשורת, גבולות, תפקידים ומבנה הכוח בזוגיות
אם therapist.couples_modalities כולל את אותו סוג — הסבר בחום למה הגישה מתאימה לצרכים שעלו. אם המטפל/ת עובד/ת בגישה זוגית אחרת בלבד — ציין בעדינות שגם היא יכולה להתאים ושכדאי לבדוק מולו/ה, בלי לפסול.

**המשימה:** כתוב הסבר בן **שתי פסקאות**, מופרדות בשורה ריקה ("\\n\\n"). כל פסקה 2-4 משפטים.

**פסקה 1 — מה במטפל/ת מתאים לצרכים שעלו**:
סנתז מתוך match_reasons, matched_fields ושדות הפרופיל (training_areas, therapist_types, couples_modalities, bio) את ההתאמה המקצועית — אילו תחומי הכשרה/גישות של המטפל/ת עונים על מה שעלה בשאלון (main_needs / recommended_treatment_types / recommended_assessment_types).
- **כלל עיגון:** קשור כל נקודת חוזק לצורך ספציפי שעלה אצל המשתמש — אל תכתוב שבחים כלליים ("מטפל/ת מנוסה ומקצועי/ת") שאינם נשענים על שדה שסופק.

**פסקה 2 — התאמה כנה, מיקום וסגנון**:
- מיקום: תמיד התייחס לאזור/מרחק (therapist.regions מול user_summary.region_preference); אם online=true — ציין אותו כפתרון לפערי מרחק.
- רק בהפניה לטיפול: אם personality_score קיים ואינו null — התייחס להתאמה הסגנונית לפי הסולם: 88+ "התאמה סגנונית גבוהה מאוד"; 76-87 "טובה"; 64-75 "חלקית"; מתחת ל-64 "פער סגנוני".
- אם יש פער אמיתי (צורך שעלה ואינו בתחום ההתמחות) — ציין אותו בכנות ובעדינות, והסבר למה בכל זאת זו ההתאמה הקרובה ביותר שנמצאה מבין הזמינים. אם אין פער משמעותי — אל תמציא אחד.
- אם search_mode הוא "combined" — הדגש אילו צרכים מכוסים ואילו פחות.

**כללים:**
- כתוב בגוף שלישי לפי gender: "זכר" → לשון זכר; "נקבה" → לשון נקבה; אחר → ניטרלי.
- אל תחזור על match_reasons מילה במילה — סנתז.
- התבסס אך ורק על השדות שסופקו. אל תמציא ותק, שנות ניסיון, הסמכות או התמחויות שלא צוינו.
- מותר להשתמש ב-bio כמקור לתובנות, אך אל תצטט מילולית ואל תסיק ממנו פרטים שאינם כתובים בו במפורש.
- אל תציין הבדלים בין סוגי רישיון/תואר.
- אם addiction_cbt_fallback הוא true — ציין שלא נמצא מומחה להתמכרויות באזור וש-CBT הוא גישה יעילה גם להתמכרויות.
- אל תאבחן, אל תבטיח הצלחה, אל תכתוב "הטוב ביותר". השתמש ב-"נמצאה התאמה", "מבין המומחים הזמינים".
- הכותרת וההערה המשפטית נקבעות בצד השרת — אל תייצר אותן.
- החזר JSON בלבד:
{
  "explanation": string        // שתי הפסקאות מופרדות ב-"\\n\\n"
}`,
      },
      {
        role: "user",
        content: buildPrompt(body),
      },
    ],
  });

  const choice = response.choices[0];
  const content = choice?.message?.content ?? "";
  const diag = `finish_reason=${choice?.finish_reason ?? "none"}, refusal=${
    choice?.message?.refusal ? "yes" : "no"
  }, content_length=${content.length}`;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BadAiResponseError(`OpenAI response was not valid JSON (${diag})`);
  }

  const fields = (
    typeof parsed === "object" && parsed !== null ? parsed : {}
  ) as Partial<ExplainResponse>;
  if (typeof fields.explanation !== "string" || fields.explanation.trim() === "") {
    throw new BadAiResponseError(
      `OpenAI response missing required fields (keys=[${Object.keys(fields).join(",")}], ${diag})`
    );
  }

  return {
    title: buildTitle(body),
    explanation: fields.explanation,
    tone_note: TONE_NOTE,
  };
}

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  try {
    return await callOpenAIOnce(body);
  } catch (err) {
    if (!(err instanceof BadAiResponseError)) throw err;
    console.warn("[explain-match] unusable OpenAI content, retrying once:", err.message);
    return callOpenAIOnce(body);
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Public, unauthenticated endpoint that calls OpenAI — cap each IP at 30
// requests/minute so it can't be abused to run up cost. In-memory only; resets
// on cold start. Mirrors /api/explain-recommendation.
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
