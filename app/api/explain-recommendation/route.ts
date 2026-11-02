import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { llmJson } from "@/app/lib/llm";
import { getTreatmentRationale } from "@/app/lib/treatment-rationale";
import { capped, cappedList, explainBodyTooLarge, explainModelAllowed, explainRateLimited } from "@/app/lib/explain-guard";
import { featureRefusal } from "@/app/lib/school-features.server";

// Produces a personalised explanation of why a specific treatment / referral
// was recommended to a given user based on their questionnaire answers.
// Mirrors the structure of /api/explain-match (therapist-level) but operates
// at the recommendation level — i.e. one step earlier in the funnel.
//
// The client is responsible for sanitising the user's questionnaire data and
// sending only derived "facts" (scores, flags, derived severity) — never raw
// free-text fields like trauma descriptions.

// ── Input schema ──────────────────────────────────────────────────────────────

// Every field is capped at a length a real questionnaire could produce (see
// app/lib/explain-guard.ts): the prompt is built from this body and the model
// bills by the token.
const BodySchema = z.object({
  questionnaire_type: z.enum(["adult", "child", "school"]),

  recommendation: z.object({
    treatment: capped(80),               // e.g. "CBT"
    treatment_label: capped(160),        // human readable, e.g. "CBT לחרדה"
    domain: capped(160),                 // e.g. "מורכבויות בתחום הרגשי/האישי"
    urgent: z.boolean().optional(),
    symptom_text: capped(1_500).optional(), // short text describing the finding
    // The kids questionnaires send the recommendation's kind (RecKind in
    // app/lib/kids-recommendations.ts); an assessment for the counsellor is
    // explained in its own structure (SYSTEM_PROMPT_SCHOOL_ASSESSMENT).
    kind: z.enum(["treatment", "assessment", "external", "professional", "teacher"]).optional(),
  }),

  user_facts: z.object({
    // Derived facts — sanitised on the client. Free-form so different
    // questionnaires can supply different summaries (mood scores for adults,
    // grade-level + behaviour categories for kids, etc.).
    summary: cappedList(400, 40).optional(),   // bullet-style summary lines
    scores: z
      .record(z.string().max(60), z.union([z.number(), z.string().max(80)]))
      .refine((r) => Object.keys(r).length <= 60, "too many scores")
      .optional(),
    age_band: capped(40).optional(),
    gender: capped(20).optional(),
    flags: cappedList(120, 40).optional(),
  }).optional(),

  treatment_rationale: z.object({
    // Optional structured rationale supplied by the client — gives the model
    // ground truth so it doesn't invent evidence claims.
    why: capped(2_000).optional(),
    typical_duration: capped(200).optional(),
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
// גילוי נאות: ההסבר נכתב על ידי מודל שפה (תנאי השימוש של ספק המודל בתחום
// הבריאות דורשים לומר זאת), ואינו אבחון.
const EVIDENCE_NOTE =
  "ההסבר נוסח על ידי בינה מלאכותית על בסיס תשובותיך לשאלון בלבד, ואינו מהווה אבחון או המלצה רפואית.";

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
- אם questionnaire_type הוא "school" — הקוראת היא יועצת חינוכית או איש/אשת צוות חינוכי הממלאים את השאלון במסגרת תפקידם, והמטופל/ת הוא התלמיד/ה. פנה אליה בלשון נקבה יחיד ("את", "שלך") ובטון מקצועי-עמיתי, לא מרגיע-הורי; על התלמיד/ה כתוב בגוף שלישי: "התלמיד" אם gender="זכר", "התלמידה" אם "נקבה", אחרת "התלמיד/ה". אל תפנה אליה כאילו היא ההורה ואל תייחס לה את ההחלטה על הטיפול. בפסקה 2 עגן בקשיים של התלמיד/ה כפי שתוארו.
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

// An assessment recommended to a counsellor (the owner's decision, 27/10/2026,
// on the "מצפן היועצת" materials): the explanation opens from what was found and
// why it calls for a deeper understanding of where the difficulty comes from,
// names the assessment, then says what it examines and what comes out of it.
// The treatment prompt above describes the method first and the person second,
// which for an assessment read as a brochure for the assessment rather than an
// answer to "why this student".
const SYSTEM_PROMPT_SCHOOL_ASSESSMENT = `אתה עוזר שמסביר בעברית פשוטה, מדויקת ומקצועית ליועצת חינוכית או לאיש/אשת צוות חינוכי למה השאלון הציע לתלמיד/ה אבחון מסוים, על בסיס מה שסומן בשאלון.

הקוראת ממלאת את השאלון במסגרת תפקידה, והנבדק/ת הוא התלמיד/ה. פנה אליה בלשון נקבה יחיד ("את", "שלך") ובטון מקצועי-עמיתי, לא מרגיע-הורי. על התלמיד/ה כתוב בגוף שלישי: "התלמיד" אם user_facts.gender הוא "זכר", "התלמידה" אם "נקבה". אם המגדר לא ידוע, כתוב "התלמיד או התלמידה" פעם אחת ואחר כך נסח כך שלא צריך להתאים מגדר (ברבים או בשם עצם); לעולם אל תכתוב פעלים או שמות עם לוכסן כמו "לומד/ת". אל תפנה אליה כאילו היא ההורה ואל תייחס לה את ההחלטה על האבחון.

המשימה: כתוב הסבר בן **שלוש פסקאות**, מופרדות בשורה ריקה ("\\n\\n"), כל אחת באורך של כ-60-90 מילים, בסדר הזה:

**פסקה 1 - מה עלה בשאלון, ולמה זה מצריך הבנה מעמיקה יותר:**
פתח בממצאים הספציפיים של התלמיד/ה, מתוך recommendation.symptom_text ו-user_facts.summary/flags, ותאר אותם כעובדות שדווחו ("בשאלון עלו..."). הזכר לפחות 2-3 מהם, בלשון שבקלט. אם עלו קשיים בכמה תחומים או בכמה גורמים יחד, אמור זאת במפורש. הסבר שהשילוב הזה מבטא צורך בהבנה מעמיקה יותר של מקורות הקושי של התלמיד/ה, ונסח כשאלה פתוחה מה האבחון יכול לעזור לברר, רק סביב התחומים שמופיעים בקלט (למשל: מה מקור הקושי בקריאה, והאם הקושי הרגשי והקושי הלימודי משפיעים זה על זה). סיים את הפסקה במשפט "לכן מומלץ על" ואחריו recommendation.treatment_label כפי שהוא.

**פסקה 2 - מה האבחון בודק:**
תאר בקצרה ובדיוק מה בודקים באבחון שהומלץ, איך הוא נראה בפועל לתלמיד/ה (מפגשים, משימות, שיחה), ומה ההשוואה בין התחומים הנבדקים מאפשרת להבין. אל תעתיק לטקסט ניסוחים מההוראות האלה. אם treatment_rationale.why ניתן, בסס עליו. בפסקה הזו בלבד מותר לכתוב בין אילו סוגי קשיים האבחון יכול להבחין (למשל לקות למידה, קושי בקשב או קושי אחר). זה משפט על האבחון, לא על התלמיד/ה: אל תכתוב שהתלמיד/ה עשוי/ה להשתייך לאחד מהם, ואל תוסיף לטקסט שום הערה שמסבירה את זה.

**פסקה 3 - מה מקבלים בסופו:**
תאר מה מתקבל בסוף האבחון (דוח, המלצות מעשיות לכיתה ולבית, ולעיתים המלצה על התאמות או על המשך טיפול), ואיך זה עוזר לך ולצוות לקבל כיוון מדויק יותר להמשך. מותר לומר שאם יוחלט לפנות לוועדה, יהיה בתיק מסמך מקצועי שמתאר את הקושי.

**כללי איסור חמורים:**
- כל אמירה על התלמיד/ה חייבת להישען על פריט קונקרטי שמופיע ב-symptom_text או ב-user_facts. אל תכתוב משפט כללי על התלמיד/ה שאינו נקשר לממצא שסופק.
- על התלמיד/ה השתמש אך ורק במילים היומיומיות שבקלט, ובשם האבחון עצמו. אל תייחס לו/ה שום תווית קלינית, אבחנה או ראשי-תיבות שאינם בקלט (כמו ADHD, דיסלקציה, לקות למידה, הפרעת קשב, חרדה כשהמילה אינה בקלט).
- אסור לאבחן ואסור להסיק: לעולם אל תכתוב "יש לו/ה X", ואל תכתוב שקושי "מעיד על", "מצביע על" או "עשוי להעיד על" מצב כלשהו.
- אסור לנקוב במספרים או בציונים מהשאלון; תרגם לתיאור איכותי בלי שם המדד.
- אסור לטעון שהאבחון יקבע זכאות, יתקבל בוועדה או יוביל בהכרח להתאמות. אסור להבטיח תוצאה, ואסור סופרלטיבים; תועלת מנוסחת בלשון צנועה ("יכול לעזור", "עשוי לתת").
- אסור להמציא משך, מספר מפגשים, מחיר, סטטיסטיקות או אחוזים.
- אסור להזכיר שמות של אנשי מקצוע, מכונים, קופות חולים או ספקים.
- אם recommendation.urgent הוא true, סיים במשפט אחד שממליץ בעדינות לא להמתין, בלי המילה "דחוף" ובלי ניסוח מבהיל.

אורך כולל: כ-180-270 מילים.
הכותרת וההערה המשפטית נקבעות בצד השרת - אל תייצר אותן.
אסור להשתמש במקף ארוך. למקף בתוך משפט השתמש במקף רגיל עם רווחים: " - ".
החזר JSON בלבד:
{
  "explanation": string        // שלוש הפסקאות מופרדות ב-"\\n\\n" (שורה ריקה)
}`;

function isSchoolAssessment(body: Body): boolean {
  return body.questionnaire_type === "school" && body.recommendation.kind === "assessment";
}

function buildSystemPrompt(body: Body): string {
  if (isSchoolAssessment(body)) return SYSTEM_PROMPT_SCHOOL_ASSESSMENT;
  const injectCouples = body.recommendation.treatment_label.includes("בהעדפה ל");
  return SYSTEM_PROMPT_BASE.replace(
    "{COUPLES_RULE}",
    injectCouples ? COUPLES_PREFERENCE_RULE : ""
  );
}

// The model returns ONLY the explanation text; title + evidence_note are built
// server-side. The schema constrains decoding (structured outputs), so a
// response with missing/renamed keys (seen in production with plain
// json_object mode) cannot be generated.
const ExplanationSchema = z.object({ explanation: z.string() });

// The call succeeded but the content is unusable (empty explanation) — the
// one case worth a single retry; transport errors and provider fallback are
// handled inside the LLM layer.
class BadAiResponseError extends Error {}

async function callAiOnce(body: Body): Promise<ExplainResponse> {
  // Public button, latency matters: the "fast" tier (Sonnet, low effort).
  // Three paragraphs of Hebrew need more room than two.
  const maxTokens = isSchoolAssessment(body) ? 1_200 : 800;
  const { data, model } = await llmJson(
    { feature: "explain_recommendation", tier: "fast", system: buildSystemPrompt(body), user: buildPrompt(body), maxTokens },
    ExplanationSchema,
  );
  if (data.explanation.trim() === "") {
    throw new BadAiResponseError(`empty explanation from ${model}`);
  }

  return {
    title: buildTitle(body),
    explanation: data.explanation,
    evidence_note: EVIDENCE_NOTE,
  };
}

async function callAi(body: Body): Promise<ExplainResponse> {
  try {
    return await callAiOnce(body);
  } catch (err) {
    if (!(err instanceof BadAiResponseError)) throw err;
    console.warn("[explain-recommendation] unusable model content, retrying once:", err.message);
    return callAiOnce(body);
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────
// Public, unauthenticated endpoint that calls a paid model. The guards (per
// address a minute, body size, field caps, and a site-wide daily cap past which
// the template is served) are described in app/lib/explain-guard.ts.

export async function POST(req: NextRequest): Promise<NextResponse> {
  // רישיון בית ספר שההסבר כבוי בו (מצב "גפ״ן"): לא מגיעים למודל. בלי עוגיית
  // רישיון הבדיקה לא עושה כלום (app/lib/school-features.server.ts).
  const refused = await featureRefusal(req, "ai_explain");
  if (refused) return refused;
  if (explainRateLimited(req, "explain-recommendation")) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  if (explainBodyTooLarge(req)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const text = await req.text();
    if (explainBodyTooLarge(req, text)) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;

    if (!(await explainModelAllowed("explain_recommendation"))) {
      console.warn("[explain-recommendation] daily cap reached, serving the template");
      return NextResponse.json(buildMockExplanation(body), { status: 200 });
    }

    try {
      const explanation = await callAi(body);
      return NextResponse.json(explanation, { status: 200 });
    } catch (aiErr) {
      console.error("[explain-recommendation] model call failed, using fallback:", aiErr);
      const fallback = buildMockExplanation(body);
      return NextResponse.json(fallback, { status: 200 });
    }
  } catch (err) {
    console.error("[explain-recommendation] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
