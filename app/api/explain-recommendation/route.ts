import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getTreatmentRationale } from "@/app/lib/treatment-rationale";

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

// Fixed disclaimer — set server-side so the model never has to echo it.
const EVIDENCE_NOTE =
  "ההסבר מבוסס על תשובותיך לשאלון בלבד ואינו מהווה אבחון או המלצה רפואית.";

// The title is a fixed template (the prompt used to ask the model for the
// same string) — built server-side for both the AI and fallback paths.
function buildTitle(body: Body): string {
  return `למה הוצע ${body.recommendation.treatment_label}`;
}

// ── Mock / fallback explanation builder ──────────────────────────────────────

function buildMockExplanation(body: Body): ExplainResponse {
  const { recommendation, user_facts } = body;
  const factsList = user_facts?.summary ?? [];
  const factsText = factsList.length > 0
    ? `על בסיס מה שעלה בשאלון (${factsList.slice(0, 2).join(", ")}), `
    : "על בסיס מכלול התשובות בשאלון, ";

  return {
    title: buildTitle(body),
    explanation:
      factsText +
      `נמצאה התאמה ל${recommendation.treatment_label}. ` +
      "זוהי גישה רלוונטית לסוג הקושי שעלה. כדאי לבחון עם המטפל את ההתאמה הספציפית למצבך.",
    evidence_note: EVIDENCE_NOTE,
  };
}

// ── OpenAI prompt builder ─────────────────────────────────────────────────────

function buildPrompt(body: Body): string {
  // Ground-truth rationale: start from the curated per-treatment map, then let
  // any client-supplied rationale (e.g. the couples-modality "why") override.
  const curated = getTreatmentRationale(
    body.recommendation.treatment,
    body.recommendation.treatment_label,
  );
  const treatment_rationale = { ...curated, ...(body.treatment_rationale ?? {}) };

  return JSON.stringify({
    questionnaire_type: body.questionnaire_type,
    recommendation: body.recommendation,
    user_facts: body.user_facts ?? {},
    treatment_rationale,
  }, null, 2);
}

const SYSTEM_PROMPT_BASE = `אתה עוזר שמסביר בעברית פשוטה, חמה ומדויקת למה הומלץ למטופל סוג טיפול ספציפי על בסיס תשובות השאלון שלו.

המשימה: כתוב הסבר בן **שתי פסקאות**, מופרדות בשורה ריקה ("\\n\\n"). כל פסקה באורך של כ-70-110 מילים. אל תכתוב פסקה של משפט-שניים — פתח, הסבר והדגם.

**פסקה 1 — מה זה הטיפול שהומלץ**:
תאר את גישת הטיפול הספציפית שהומלצה (לפי recommendation.treatment_label — אם היא ממוקדת, כמו "CBT לחרדה", התייחס לאותה צורה ולא ל-CBT באופן כללי): מה היא, ואיך היא עובדת בפועל דרך החוויה של המטופל (לא דרך פרוטוקול קליני). אל תתאר בפסקה הזו את הקשיים של המשתמש — זהו תיאור השיטה.
- אם treatment_rationale.why ניתן — בסס עליו את ההסבר למה הגישה עובדת; אל תמציא טענות יעילות שאינן בו.
- אם treatment_rationale.typical_duration ניתן — שלב תיאור קצר של אורך/מבנה הטיפול. אם לא ניתן — אל תמציא משך (אל תכתוב "כ-12 מפגשים"); תאר את המבנה באופן איכותי בלבד.

**פסקה 2 — למה זה מתאים לך, לאור מה שעלה בשאלון**:
זו הפסקה החשובה. עגן אותה בממצאים הספציפיים של המשתמש עצמו, מתוך recommendation.symptom_text ו-user_facts.summary/flags.
- **כלל עיגון מחייב:** כל אמירה על המשתמש חייבת להישען על פריט קונקרטי שמופיע ב-symptom_text או ב-user_facts. אסור לכתוב משפט כללי שאינו נקשר לממצא ספציפי שסופק. הזכר לפחות 2-3 מהקשיים שצוינו, בלשונו של המשתמש, וקשור כל אחד לאופן שבו הגישה הטיפולית עוזרת בו. תאר את הקשיים כעובדות שדווחו ("בשאלון עלו...") — אסור לחבר ביניהם עם "מעיד על", "מצביע על" או "עשוי להעיד על"; במקום זה כתוב "לצד", "יחד עם", או תאר ברצף.
{COUPLES_RULE}- אם user_facts.summary כולל תיאור עוצמה ("בעוצמה גבוהה/בינונית/קלה") — שלב אותו כתיאור ("דאגות בעוצמה ניכרת"), לא כמסקנה ("מה שמעיד על עוצמה גבוהה"), ובלי לנקוב במספר או בשם מדד.
- אל תתרגם את הקשיים למונחים קליניים — אם המשתמש סימן "דאגות מתמשכות וקושי להירדם", כתוב בדיוק כך, לא "תסמיני GAD" ולא "חרדה כללית".

**אם הומלצה גישה זוגית ספציפית** (treatment_label כולל "בהעדפה ל..." — EFT/דינמית/מבנית): הסבר במפורש למה דווקא הגישה הזו נמצאה מתאימה למה שתואר בשאלון (היעזר ב-treatment_rationale.why ובשורת "גישה זוגית שנמצאה מתאימה" שב-user_facts). **חובה** לכלול בפסקה 2 משפט מפורש שמבהיר שזו העדפה ולא בלעדיות — טיפול זוגי בגישות אחרות עשוי גם הוא להתאים, וכדאי לבדוק זאת מול המטפל/ת. אל תשמיט את המשפט הזה. בנוסף: לעולם אל תניח את מגדרו של בן/בת הזוג — נסח את הזוגיות ברבים ("שניכם", "ביניכם") או "בן או בת הזוג".

**כללי איסור חמורים:**
- השתמש אך ורק במילים היומיומיות שהמשתמש עצמו השתמש בהן (מתוך symptom_text / user_facts) + שם הטיפול עצמו (CBT, EMDR, דינאמי וכו'). אל תכניס שום תווית קלינית, אבחנה או ראשי-תיבות שאינם מופיעים בקלט.
  • דוגמאות למונחים שאסור להכניס: OCD, ADHD, GAD-7, PHQ-9, PTSD, BPD, DSM, אנהדוניה, הלוצינציות, פסיכוזה, פרודרום, מאניה, דיכאון מז'ורי, הפרעת קשב, הפרעת חרדה כללית, הפרעת אישיות גבולית, וכן "חרדה" או "דיכאון" כשהמילה אינה מופיעה בקלט
- אסור לאבחן: לעולם אל תכתוב "יש לך X" כש-X הוא מצב/תופעה קלינית.
- אל תפרש ואל תסיק: אסור לכתוב שקושי "מעיד על", "מצביע על" או "עשוי להעיד על" מצב כלשהו. תאר את הקושי כפי שתואר והסבר איך הטיפול מסייע בו — בלי לאבחן מה עומד מאחוריו.
- אסור לנקוב במספרים או בציונים מספריים מהשאלון. תרגם תמיד לתיאור איכותי בלי שם המדד.
- אסור להבטיח ריפוי או הצלחה, ואסור סופרלטיבים ושבחים מסכמים ("הזדמנות מצוינת", "שיפור משמעותי") — תועלת מנוסחת בלשון צנועה ומותנית ("יכול לעזור", "עשוי להקל").
- אסור להוסיף סטטיסטיקות, אחוזי הצלחה או משכי טיפול שלא סופקו ב-treatment_rationale.
- אסור להזכיר שמות מטפלים, קופות חולים או ספקי טיפול.

**כללי כתיבה:**
- במצב adult: פנה ישירות למשתמש לפי user_facts.gender: "זכר" → לשון זכר, "נקבה" → לשון נקבה, ערך אחר או חסר → ניסוח ניטרלי (אל תכתוב "אתה/את" עם לוכסן).
- אם questionnaire_type הוא "child" — user_facts.gender הוא מגדר הילד/ה, לא של ההורה. פנה להורים תמיד ורק ברבים ("אתם", "שלכם" — לעולם לא "שלך"/"אלייך"), ועל הילד/ה כתוב בגוף שלישי: "ילדכם" אם gender="זכר", "ילדתכם" אם "נקבה", אחרת "הילד/ה". אל תניח את מגדר ההורה. בפסקה 2 עגן בקשיים של הילד/ה כפי שתוארו.
- אמפתי, חם, לא קליני, לא ביקורתי.
- אורך כולל לשתי הפסקאות: כ-150-220 מילים.
- אם recommendation.urgent הוא true — סיים במשפט חם אחד שממליץ בעדינות לא להמתין עם הפנייה ("כדאי לא לחכות עם זה"), בלי המילה "דחוף" ובלי ניסוח מבהיל.

הכותרת וההערה המשפטית נקבעות בצד השרת - אל תייצר אותן.
אסור להשתמש במקף ארוך (—). למקף בתוך משפט השתמש במקף רגיל עם רווחים: " - ".
החזר JSON בלבד:
{
  "explanation": string        // שתי הפסקאות מופרדות ב-"\\n\\n" (שורה ריקה)
}`;

// Injected only for "בהעדפה ל..." labels — as an always-present conditional
// rule the model either skipped it (couples) or applied it to unrelated
// treatments (e.g. dyadic therapy).
const COUPLES_PREFERENCE_RULE =
  '- **חובה** לסיים את פסקה 2 במשפט שמבהיר שהגישה הזוגית שצוינה היא העדפה ולא בלעדיות — גם גישות זוגיות אחרות עשויות להתאים, וכדאי לבדוק זאת מול המטפל/ת. אסור להשמיט אותו.\n';

function buildSystemPrompt(body: Body): string {
  const injectCouples = body.recommendation.treatment_label.includes("בהעדפה ל");
  return SYSTEM_PROMPT_BASE.replace(
    "{COUPLES_RULE}",
    injectCouples ? COUPLES_PREFERENCE_RULE : ""
  );
}

// The model returns ONLY the explanation text; title + evidence_note are built
// server-side. strict json_schema constrains decoding, so a response with
// missing/renamed keys (seen in production with plain json_object mode) cannot
// be generated.
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "recommendation_explanation",
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
    temperature: 0.4,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: buildSystemPrompt(body) },
      { role: "user", content: buildPrompt(body) },
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
    evidence_note: EVIDENCE_NOTE,
  };
}

async function callOpenAI(body: Body): Promise<ExplainResponse> {
  try {
    return await callOpenAIOnce(body);
  } catch (err) {
    if (!(err instanceof BadAiResponseError)) throw err;
    console.warn("[explain-recommendation] unusable OpenAI content, retrying once:", err.message);
    return callOpenAIOnce(body);
  }
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
