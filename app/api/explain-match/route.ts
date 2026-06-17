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

// ── Title helper ──────────────────────────────────────────────────────────────

function buildTitle(body: Body): string {
  const isAssessment = (body.user_summary?.recommended_assessment_types?.length ?? 0) > 0;
  if (!isAssessment) return "למה המטפל הזה הוצע לך";
  const gender = body.therapist.gender;
  if (gender === "נקבה") return "למה המאבחנת הזאת הוצעה לך";
  if (gender === "זכר") return "למה המאבחן הזה הוצע לך";
  return "למה המאבחן/ת הוצע/ה לך";
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

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 300,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `אתה עוזר שמסביר בעברית פשוטה וכנה מדוע איש/ת מקצוע מסוים/ת הוצע/ה למשתמש.

**חשוב — הבחן בין שני מצבים:**

אם recommended_assessment_types קיים ואינו ריק — מדובר בהפניה לאבחון (לא לטיפול). במקרה זה:
- התמקד ביכולות האבחוניות של איש/ת המקצוע: ניסיון בסוג האבחון המבוקש, הכשרה רלוונטית לאבחון, גישה לתהליך האבחוני
- אל תציין גישות טיפוליות (CBT, דינאמי, התנהגותי וכו') כנקודות חיזוק — הן אינן רלוונטיות להפניה לאבחון
- ציין את סוג האבחון המבוקש (לפי recommended_assessment_types)

אחרת — מדובר בהפניה לטיפול. במקרה זה:
- התמקד בהתאמה הטיפולית: גישה, הכשרה, ניסיון עם הצרכים שעלו

**המשימה:** כתוב פסקה אחת קצרה (2-4 משפטים) שמסבירה:
1. מה בפרופיל איש/ת המקצוע מתאים לצרכים שעלו בשאלון — כולל תובנות שאינן כתובות ישירות ב-match_reasons
2. רק בהפניה לטיפול (לא באבחון): אם personality_score קיים ואינו null — התייחס גם להתאמה הסגנונית לפי הסולם הבא:
   - 85 ומעלה: התאמה סגנונית גבוהה מאוד
   - 70-84: התאמה סגנונית טובה
   - 50-69: התאמה סגנונית חלקית
   - מתחת ל-50: פער סגנוני
   בהפניה לאבחון — אל תתייחס להתאמה סגנונית/אישיותית; היא פחות רלוונטית לתהליך אבחון חד-פעמי.
3. מה פחות מתאים בדיוק (אם יש פער)
4. למה בכל זאת זוהי ההתאמה הטובה ביותר שנמצאה

כללים:
- כתוב בגוף שלישי בהתאם למגדר: "זכר" → לשון זכר; "נקבה" → לשון נקבה; אחר → ניטרלי
- תמיד התייחס למיקום/מרחק; אם יש אפשרות אונליין — ציין אותה כפתרון לפערי מרחק
- אל תחזור על ה-match_reasons מילה במילה — סנתז אותן
- התבסס אך ורק על השדות שסופקו (therapist_types, training_areas, regions, bio, gender, online). אל תמציא ותק, מספר שנות ניסיון, הסמכות, או התמחויות שלא צוינו.
- אתה רשאי להשתמש ב-bio כמקור לתובנות, אך אל תצטט אותו מילולית ואל תסיק ממנו פרטים שאינם כתובים בו במפורש.
- אל תציין הבדלים בין סוגי הרישיון/התואר
- אם addiction_cbt_fallback הוא true — ציין שלא נמצא מומחה להתמכרויות באזור וש-CBT הוא גישה יעילה גם להתמכרויות
- אל תאבחן את המשתמש, אל תבטיח הצלחה, אל תכתוב "הטוב ביותר"
- השתמש בניסוחים כמו "בהתבסס על תשובות השאלון", "נמצאה התאמה", "מבין המומחים הזמינים"
- אם search_mode הוא "combined" — הדגש אילו צרכים מכוסים ואילו פחות
- אם אין פער משמעותי — אל תמציא אחד
- הכותרת נקבעת בצד השרת — אל תייצר אותה
- החזר JSON בלבד במבנה הבא:
{
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
    typeof parsed.explanation !== "string" ||
    typeof parsed.tone_note !== "string"
  ) {
    throw new Error("OpenAI response missing required fields");
  }

  return {
    title: buildTitle(body),
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
