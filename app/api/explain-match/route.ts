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
      // adult flow: the user's gender; child flow: the child's gender.
      gender: z.string().nullable().optional(),
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
    // 'center' = מרכז טיפולי (מסלול 2) ולא אדם - משנה כותרת, גוף ולשון.
    entity_type: z.string().nullable().optional(),
    /** התואר הציבורי כפי שמוצג בכותרת הפרופיל (ראו publicTherapistTitle). */
    public_title: z.string().nullable().optional(),
    /** משמש לגזירת public_title בצד השרת כשהלקוח לא שלח אותו. */
    age_groups: z.array(z.string()).nullable().optional(),
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
  // מרכז טיפולי אינו אדם - כותרת בלשון מוסד, בלי מגדר.
  if (body.therapist.entity_type === "center") {
    return body.questionnaire_type === "child" ? "למה המרכז הזה הוצע לילדכם" : "למה המרכז הזה הוצע לך";
  }
  // Child questionnaires are filled by parents — the match is for their child.
  const forWhom = body.questionnaire_type === "child" ? "לילדכם" : "לך";
  if (isAssessment) {
    if (gender === "נקבה") return `למה המאבחנת הזאת הוצעה ${forWhom}`;
    if (gender === "זכר") return `למה המאבחן הזה הוצע ${forWhom}`;
    return `למה המאבחן/ת הוצע/ה ${forWhom}`;
  }
  if (gender === "נקבה") return `למה המטפלת הזאת הוצעה ${forWhom}`;
  if (gender === "זכר") return `למה המטפל הזה הוצע ${forWhom}`;
  return `למה המטפל/ת הוצע/ה ${forWhom}`;
}

// ── Mock / fallback explanation builder ──────────────────────────────────────

function buildMockExplanation(body: Body): ExplainResponse {
  const { match_result, user_summary, therapist } = body;
  const reasons = match_result.match_reasons;

  const treatments = user_summary?.recommended_treatment_types ?? [];
  const therapistAreas = therapist.training_areas ?? [];
  const matchedTreatments = treatments.filter(t => therapistAreas.includes(t));
  const unmatchedTreatments = treatments.filter(t => !therapistAreas.includes(t));

  // מסלול הגיבוי (בלי LLM) חייב גם הוא לדעת שמרכז אינו אדם.
  const isCenter = therapist.entity_type === "center";
  const subject = isCenter ? "המרכז" : "המטפל";
  const pool = isCenter ? "המרכזים והמטפלים הזמינים" : "המטפלים הזמינים";
  let explanation = "בהתבסס על תשובות השאלון, ";

  if (matchedTreatments.length > 0) {
    explanation += `${subject} מציע ${matchedTreatments.join(", ")} שמתאים לצרכים שעלו. `;
  } else if (reasons.length > 0) {
    explanation += `נמצאה התאמה על בסיס ${reasons[0]}. `;
  }

  if (unmatchedTreatments.length > 0) {
    explanation += `חלק מהצרכים שעלו (${unmatchedTreatments.join(", ")}) אינם בדיוק בתחום ההתמחות, אך מבין ${pool} זוהי ההתאמה הקרובה ביותר לפרופיל שלך. `;
  } else {
    explanation += `זוהי ההתאמה הקרובה ביותר שנמצאה מבין ${pool}. `;
  }

  if (isCenter) {
    explanation += "הפנייה מגיעה למרכז, ובמרכז עצמו משבצים את המטפל/ת שמתאים/ה גם מבחינת סגנון העבודה.";
  }

  return {
    title: buildTitle(body),
    explanation,
    tone_note: TONE_NOTE,
  };
}

// ── OpenAI prompt builder ─────────────────────────────────────────────────────

// Deterministic band label for the personality score — the model misreads
// numeric thresholds, so only this label (never the number) is sent to it.
function personalityFitLabel(score: number | null | undefined): string | null {
  if (score == null) return null;
  if (score >= 88) return "התאמה סגנונית גבוהה מאוד";
  if (score >= 76) return "התאמה סגנונית טובה";
  if (score >= 64) return "התאמה סגנונית חלקית";
  return "פער סגנוני";
}

// Exact addressing directive, computed server-side — the model applies it
// verbatim instead of deriving pronouns from conditional prompt rules (which
// gpt-4o-mini follows unreliably).
function addressingInstruction(body: Body): string {
  const g = body.user_summary?.gender;
  if (body.questionnaire_type === "child") {
    const child =
      g === "נקבה" ? 'על הילדה כתוב בלשון נקבה: "ילדתכם", "היא", "שלה"'
      : g === "זכר" ? 'על הילד כתוב בלשון זכר: "ילדכם", "הוא", "שלו"'
      : 'על הילד/ה כתוב "הילד/ה שלכם"';
    return `פנה אל ההורים ברבים ("אתם", "שלכם"); ${child}.`;
  }
  if (g === "נקבה") return 'פנה אל הקוראת ביחיד בלשון נקבה ("את", "שלך", "ציינת") — לא ברבים.';
  if (g === "זכר") return 'פנה אל הקורא ביחיד בלשון זכר ("אתה", "שלך", "ציינת") — לא ברבים.';
  return 'פנה בניסוח ניטרלי בשם הפועל ("כדאי לבדוק", "אפשר לפנות") — בלי "אתה/את" ובלי לשון רבים.';
}

// Whether the online option is worth mentioning: the user asked for it, or the
// therapist's regions don't clearly cover the user's area. On a clear region
// match the field is omitted entirely so the model has nothing to say about it.
function onlineRelevant(body: Body): boolean {
  if (body.user_summary?.online_preference) return true;
  const userRegion = body.user_summary?.region_preference;
  if (!userRegion) return true;
  return !(body.therapist.regions ?? []).includes(userRegion);
}

function buildPrompt(body: Body): string {
  const isCenter = body.therapist.entity_type === "center";
  return JSON.stringify({
    addressing: addressingInstruction(body),
    questionnaire_type: body.questionnaire_type,
    search_mode: body.search_mode ?? "single",
    // מרכז טיפולי: ישות ולא אדם. הכללים בפרומפט מותנים בדגל הזה.
    subject_kind: isCenter ? "center" : "therapist",
    user_summary: body.user_summary ?? {},
    therapist: {
      full_name: body.therapist.full_name,
      // התואר כפי שהמטופל רואה אותו בכותרת הפרופיל. therapist_types נשאר
      // לצדו כחומר נימוק - בלעדיו ההסבר היה מאבד את "הבעה ויצירה" ולא יכול
      // להסביר את ההתאמה האמנותית, שהיא בדיוק החוזק של המטפלים האלה.
      public_title: body.therapist.public_title ?? null,
      therapist_types: body.therapist.therapist_types ?? [],
      training_areas: body.therapist.training_areas ?? [],
      couples_modalities: body.therapist.couples_modalities ?? [],
      regions: body.therapist.regions ?? [],
      gender: isCenter ? null : (body.therapist.gender ?? null),
      online: onlineRelevant(body) ? (body.therapist.online ?? false) : undefined,
      bio: body.therapist.bio ?? null,
    },
    match_result: {
      // למרכז אין סגנון אישי אחד - ה-95 הוא ערך קבוע ולא מדידה, ולכן אסור
      // להציג אותו כ"נמצאה התאמה סגנונית". במקומו: הסבר על צוות רחב.
      personality_fit: isCenter ? null : personalityFitLabel(body.match_result.personality_score),
      center_personality_note: isCenter
        ? "במרכז פועלים כמה מטפלים, ולכן ההתאמה האישיותית נעשית בתוך המרכז - הצוות משבץ את המטפל/ת שמתאים/ה גם בסגנון."
        : undefined,
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

**למי אתה כותב:**
שדה addressing שבקלט קובע את צורת הפנייה (יחיד/רבים, זכר/נקבה/ניטרלי) — פעל לפיו במדויק, בכל משפט בהסבר.
- אם questionnaire_type הוא "child" — את השאלון מילאו הורים על ילדם, וההורים הם שקוראים את ההסבר; המטופל/ת הוא הילד/ה. אסור לנסח כאילו ההורה הוא המטופל (לא "הצרכים שלך" ולא "התהליך הטיפולי שלך" — הצרכים והטיפול הם של הילד/ה). הכשרה בהדרכת הורים או ניסיון בעבודה עם הורים הם יתרון — קשור אותם לליווי של ההורים לצד הטיפול בילד/ה.
- במצב adult הקורא הוא המטופל עצמו — אדם יחיד.

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
כשאתה נוקב בתואר המקצועי - השתמש ב-therapist.public_title אם הוא קיים, ולא בערך הגולמי מ-therapist_types (שם התואר מנוסח לצורך המערכת ולא לצורך המטופל).
סנתז מתוך match_reasons, matched_fields ושדות הפרופיל (training_areas, therapist_types, couples_modalities, bio) את ההתאמה המקצועית — אילו תחומי הכשרה/גישות של המטפל/ת עונים על מה שעלה בשאלון (main_needs / recommended_treatment_types / recommended_assessment_types).
- **כלל עיגון:** קשור כל נקודת חוזק לצורך ספציפי שעלה אצל המשתמש — אל תכתוב שבחים כלליים ("מטפל/ת מנוסה ומקצועי/ת") שאינם נשענים על שדה שסופק.

**פסקה 2 — התאמה כנה, מיקום וסגנון**:
- מיקום: תמיד התייחס לאזור/מרחק (therapist.regions מול user_summary.region_preference). הזכר אונליין רק כשהוא מגשר על פער מרחק או כשהמשתמש העדיף אונליין; כשאין פער מרחק — אל תדון בצורת המפגש כלל (לא "אונליין" ולא "פרונטלי").
- רק בהפניה לטיפול: אם match_result.personality_fit קיים — שלב את התיאור המילולי הזה כלשונו, והצג אותו כממצא של תהליך ההתאמה ("נמצאה התאמה סגנונית טובה") — לא כדבר שהמשתמש אמר או ציין. אם הוא "פער סגנוני" — הצג אותו בעדינות, כהזמנה לבחון את החיבור האישי בשיחת ההיכרות.
- אם יש פער אמיתי (צורך שעלה ואינו בתחום ההתמחות) — ציין אותו בכנות ובעדינות, והסבר למה בכל זאת זו ההתאמה הקרובה ביותר שנמצאה מבין הזמינים. אם אין פער משמעותי — אל תמציא אחד.
- אם search_mode הוא "combined" — הדגש אילו צרכים מכוסים ואילו פחות.
- סיים בעובדה מעשית מקורקעת — למשל נקודה אחת ששווה לברר בשיחת ההיכרות (עדיף כזו שנוגעת לפער, אם קיים) — ולא בשבח מסכם או בהבטחה כללית ("תהליך שיכול להועיל לך").

**כשה-subject_kind הוא "center" (מרכז טיפולי, לא אדם) — הכללים האלה גוברים:**
- מדובר ב**מרכז** ולא באדם: כתוב "המרכז" בלשון זכר יחיד ("המרכז מציע", "במרכז עובדים"). אסור לחלוטין "המטפל/ת", "היא", "הוא" בהתייחסות למרכז, ואסור להתייחס למגדר.
- אל תייחס למרכז ביוגרפיה אישית, ותק אישי או סגנון טיפולי אישי - התייחס למה שהמרכז מציע (תחומי טיפול, אזורים, שפות).
- אל תכתוב על "התאמה סגנונית" או "התאמה אישיותית" שנמצאה - במרכז אין סגנון אחד. אם match_result.center_personality_note קיים, שלב את התוכן שלו במילים שלך: במרכז יש כמה מטפלים, והשיבוץ למטפל/ת שמתאים/ה גם בסגנון נעשה בתוך המרכז.
- ציין שהפנייה מגיעה למרכז, ושהמרכז עושה את ההתאמה הפנימית - זו נקודת חוזק (מגוון) ולא חיסרון.

**כללים:**
- כתוב על המטפל/ת בגוף שלישי לפי therapist.gender: "זכר" → לשון זכר; "נקבה" → לשון נקבה; אחר → ניטרלי.
- אסור לנקוב במספרים, ציונים או אחוזים משום סוג (ציון התאמה, ציון סגנוני וכו') — תיאור מילולי בלבד.
- user_summary.therapist_gender_preference הוא בקשת המשתמש לגבי מגדר המטפל/ת. מותר לכל היותר לציין שהבקשה נענתה; אסור להסיק ממנה דבר על קהל המטופלים של המטפל/ת (אל תכתוב "מטפלת נשים" וכדומה).
- אל תחזור על match_reasons מילה במילה — סנתז.
- התבסס אך ורק על השדות שסופקו. אל תמציא ותק, שנות ניסיון, הסמכות או התמחויות שלא צוינו.
- מותר להשתמש ב-bio כמקור לתובנות, אך אל תצטט מילולית ואל תסיק ממנו פרטים שאינם כתובים בו במפורש.
- אל תציין הבדלים בין סוגי רישיון/תואר.
- אם addiction_cbt_fallback הוא true — ציין שלא נמצא מומחה להתמכרויות באזור וש-CBT הוא גישה יעילה גם להתמכרויות.
- אל תאבחן ואל תבטיח הצלחה — אל תשתמש בפועל "להבטיח" כלל, ואל תכתוב "הטוב ביותר" בשום הקשר (גם לא "בצורה הטובה ביותר"). השתמש ב-"נמצאה התאמה", "מבין המומחים הזמינים". אסור גם סופרלטיבים ושבחים מסכמים ("מתאימה מאוד", "התאמה מצוינת") — תועלת מנוסחת בלשון צנועה ומותנית ("יכול לעזור", "עשוי להקל").
- הכותרת וההערה המשפטית נקבעות בצד השרת - אל תייצר אותן.
- אסור להשתמש במקף ארוך (—). למקף בתוך משפט השתמש במקף רגיל עם רווחים: " - ".
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
