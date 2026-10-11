import "server-only";
import { z } from "zod";
import { llmConfigured, llmJson, llmText } from "./llm";
import { narrativeIsFaithful } from "./budget-agent";
import { therapistPhotoUrl } from "./therapist-photo-url";
import {
  emailBodyProblem,
  RISK_LABELS,
  SOURCE_LABELS,
  TIER_LABELS,
  type ReviewContext,
  type ReviewFlag,
  type ReviewRow,
  type ReviewSummary,
  type TherapistInput,
} from "./retention-review";

// שלב 2 של סקירת השימור: מה שהמודל מוסיף מעל המנוע הטהור, ורק אחריו.
//   1. סקירת כרטיס (Sonnet, עם התמונה) למי שהכרטיס שלו לא נפתח או הפרופיל
//      לא ממיר: האם התמונה והפתיחה עושות את העבודה, ומה לשנות.
//   2. טיוטת המייל (Opus) במקום התבנית: אותן עובדות (הדגלים שבאחריות
//      המטפל/ת), ניסוח אישי, בלי אף מספר ביצועים - ואם המודל בכל זאת כתב
//      מספר, התבנית חוזרת.
//   3. הנרטיב השבועי (Opus, חשיבה עמוקה): מה הכי חשוב השבוע, דפוסים על פני
//      מטפלים ואזורים, סדר פעולות. כל מספר בו חייב להופיע בקלט.
// כל קריאה נכשלת לבדה: בלי מודל הסקירה היא בדיוק מה שהייתה בשלב 1.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const CARD_REVIEW_MAX = 20;
const DRAFT_MAX = 25;
const CONCURRENCY = 5;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── 1. סקירת כרטיס ──────────────────────────────────────────────────────────

const CardReviewSchema = z.object({
  photo_ok: z.boolean(),
  photo_issue: z.string(),
  opening_ok: z.boolean(),
  opening_issue: z.string(),
  suggestions: z.array(z.string()),
});

export type CardReview = z.infer<typeof CardReviewSchema>;

const CARD_SYSTEM = `אתה בודק כרטיס של מטפל/ת בתוצאות שאלון התאמה לטיפול נפשי באתר ישראלי. הכרטיס מציג: תמונת פרופיל, שם, סוג המטפל/ת, ושתי השורות הראשונות של הביוגרפיה. מטופל שמחפש טיפול רואה 10 כרטיסים כאלה ובוחר באילו ללחוץ.
שפוט רק את מה שמוצג: האם התמונה נראית מקצועית ומזמינה (פנים ברורות, תאורה סבירה, לא צילום סלפי מרוחק, לא לוגו ולא תמונה חתוכה), והאם פתיחת הביוגרפיה אומרת במשפט אחד למי ובמה המטפל/ת עוזר/ת (ולא פתיחה פילוסופית או רשימת תארים).
כתוב בעברית, קצר ועובדתי. עד 3 הצעות, כל אחת משפט אחד קונקרטי שהמטפל/ת יכול/ה לבצע. בלי מחמאות, בלי מספרים, בלי שיווקיות. אם הכול בסדר - photo_ok ו-opening_ok אמת, issue ריק, ורשימת הצעות ריקה.`;

async function reviewCard(t: TherapistInput, therapistTypes: string[]): Promise<CardReview | null> {
  if (!t.profile_photo_path) return null;
  const url = therapistPhotoUrl(t.id, t.profile_photo_path, SITE_URL);
  const opening = (t.bio ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
  const user = [
    `שם: ${t.name}`,
    `סוג: ${therapistTypes.join(", ") || "לא צוין"}`,
    `פתיחת הביוגרפיה (מה שמופיע בכרטיס): ${opening || "(ריק)"}`,
    "התמונה מצורפת.",
  ].join("\n");
  try {
    const { data } = await llmJson(
      { feature: "retention_card_review", tier: "fast", system: CARD_SYSTEM, user, images: [{ url }], maxTokens: 500, timeoutMs: 40_000, retries: 0 },
      CardReviewSchema,
    );
    return { ...data, suggestions: data.suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3) };
  } catch (e) {
    console.warn(`retention_card_review failed for ${t.id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── 2. טיוטת המייל ──────────────────────────────────────────────────────────

const DraftSchema = z.object({ subject: z.string(), body: z.string() });

const DRAFT_SYSTEM = `אתה כותב בשם צוות "טיפול חכם" (אתר ישראלי להתאמת טיפול נפשי) מייל קצר למטפל/ת שמקודם/ת באתר, עם הצעות לשיפור הפרופיל. המטפל/ת לקוח/ה שלנו; המייל נשלח רק אחרי שאדם מהצוות קרא ואישר אותו.
כללים שאינם ניתנים לשינוי:
- אל תכתוב שום מספר על הביצועים של המטפל/ת (פניות, צפיות, הופעות, דירוג). אל תכתוב מספרים בכלל, חוץ מאחוז ביקוש כללי שמופיע בעובדות.
- כתוב רק על העובדות שניתנו. אל תמציא פער שלא ברשימה ואל תסיק דברים על המטפל/ת.
- טון: ענייני, חם, בלי שיווקיות ("לבחור דווקא בך", "להוביל", "להזניק"), בלי מחמאות ריקות, בלי לשון שכנוע ובלי סימני קריאה.
- עברית פשוטה, פנייה בגוף שני לפי המין שניתן. 2-3 הצעות קונקרטיות, כל אחת בפסקה קצרה או בנקודה. פתיחה של משפט אחד, סיום של משפט אחד שמזמין להשיב למייל אם יש שאלה.
- לא להשתמש במקף ארוך (—); להשתמש ב-" - ". לא להוסיף חתימה (היא מתווספת אוטומטית) ולא קישור (כפתור העריכה מתווסף אוטומטית).
- הנושא: עד 8 מילים, עובדתי.
החזר JSON בלבד: {"subject": "...", "body": "..."}.`;

async function draftEmail(t: TherapistInput, gender: string | null, flags: ReviewFlag[], card: CardReview | null): Promise<{ subject: string; body: string } | null> {
  const facts = flags.filter((f) => f.owner === "therapist" && f.emailParagraph).map((f) => `- ${f.label}: ${f.emailParagraph}`);
  if (card && card.suggestions.length > 0) facts.push(`- סקירת הכרטיס: ${card.suggestions.join(" ")}`);
  if (facts.length === 0) return null;
  const first = (t.name || "").trim().split(/\s+/)[0] || "";
  const user = [
    `שם פרטי: ${first || "לא ידוע"}`,
    `מין: ${gender === "נקבה" ? "נקבה" : gender === "זכר" ? "זכר" : "לא ידוע (נסח ב-את/ה)"}`,
    "",
    "העובדות (רק אלה):",
    ...facts.slice(0, 4),
  ].join("\n");
  try {
    const { data } = await llmJson(
      { feature: "retention_draft", tier: "standard", system: DRAFT_SYSTEM, user, maxTokens: 900, timeoutMs: 60_000, retries: 0 },
      DraftSchema,
    );
    const body = data.body.trim().replace(/—/g, " - ");
    const subject = data.subject.trim().replace(/—/g, " - ").slice(0, 120);
    if (!subject || emailBodyProblem(body)) {
      console.warn(`retention_draft rejected for ${t.id}: ${emailBodyProblem(body) ?? "empty subject"}`);
      return null;
    }
    return { subject, body };
  } catch (e) {
    console.warn(`retention_draft failed for ${t.id}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── 3. הנרטיב השבועי ────────────────────────────────────────────────────────

const NARRATIVE_SYSTEM = `אתה כותב למנהל של "טיפול חכם" (אתר ישראלי להתאמת טיפול נפשי; מטפלים משלמים על קידום) את הפתיח של סקירת השימור השבועית. הקלט: סיכום מספרי ורשימת המקודמים בסיכון עם המשפך, הדגלים והפעולה המוצעת לכל אחד.
כתוב 4-7 משפטים בעברית, בלי כותרות ובלי רשימות: (1) מה הכי חשוב השבוע ולמה; (2) דפוסים חוצי-מטפלים אם יש - אזור שבו כמה נפגעים יחד, קבוצת ניסיון שמסתיימת באותו תאריך, סיבה משותפת (אונליין, שיטה חסרה, קמפיין); (3) סדר פעולות מומלץ, בזהירות: מה עדיף לפני מה.
כל מספר שתכתוב חייב להופיע בקלט כפי שהוא. אל תמציא שמות, מספרים או סיבות. בלי שיווקיות, בלי מקף ארוך (—). שמות מטפלים מותרים.`;

function narrativeInput(rows: ReviewRow[], summary: ReviewSummary, ctx: ReviewContext): string {
  const attention = rows.filter((r) => r.risk === "critical" || r.risk === "high" || r.risk === "medium");
  const lines = attention.map((r) => {
    const m = r.metrics;
    return [
      `${r.name} (${TIER_LABELS[r.tier]}, ${SOURCE_LABELS[r.promotion_source ?? ""] ?? r.promotion_source}, ${m.regions.join("/") || "ללא אזור"}): ${RISK_LABELS[r.risk]}.`,
      r.risk_reason,
      `כרטיסים ${m.cards_cur}${m.cardsBenchmark != null ? ` מול בנצ'מרק ${m.cardsBenchmark}` : ""}, כניסות ${m.opens_cur}, פונים ${m.people_cur} (קודם ${m.people_prev}).`,
      `דגלים: ${r.flags.map((f) => f.label).join(", ") || "אין"}. פעולה: ${r.actions[0]?.title ?? "אין"}.`,
    ].join(" ");
  });
  return [
    `שבוע: ${ctx.holidayWeek ? `שבוע ${ctx.holidayWeek}. ` : ""}נבדקו ${summary.checked} מקודמים: ${summary.byRisk.critical} קריטי, ${summary.byRisk.high} סיכון גבוה, ${summary.byRisk.medium} בינוני, ${summary.byRisk.ok} תקינים, ${summary.byRisk.new} חדשים, ${summary.byRisk.paused} מוקפאים. ${summary.actions} פעולות מוכנות.`,
    ctx.benchmark ? `בנצ'מרק משלם פרטי ל-30 יום: ${ctx.benchmark.cards} כרטיסים, ${ctx.benchmark.opens} כניסות, ${ctx.benchmark.people} פונים (${ctx.benchmark.peers} עמיתים). ${Math.round(ctx.onlineShare * 100)}% מהחיפושים ביקשו אונליין.` : "",
    "",
    ...lines,
  ].join("\n");
}

async function weeklyNarrative(rows: ReviewRow[], summary: ReviewSummary, ctx: ReviewContext): Promise<string | null> {
  const input = narrativeInput(rows, summary, ctx);
  try {
    const out = await llmText({
      feature: "retention_weekly",
      tier: "deep",
      system: NARRATIVE_SYSTEM,
      user: input,
      maxTokens: 900,
      timeoutMs: 120_000,
      retries: 0,
    });
    const text = out.text.trim().replace(/—/g, " - ");
    if (!text) return null;
    if (!narrativeIsFaithful(text, input)) {
      console.warn("retention_weekly: narrative carried a number that is not in the input - dropped");
      return null;
    }
    return text;
  } catch (e) {
    console.warn("retention_weekly failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ── ההעשרה ──────────────────────────────────────────────────────────────────

export type ModelEnrichment = { narrative: string | null; cardReviews: number; drafts: number };

/**
 * מוסיף לשורות (במקום) את סקירת הכרטיס כדגל ואת טיוטת המודל במקום התבנית,
 * ומחזיר את הנרטיב. בלי מפתח למודל - לא נוגע בכלום.
 */
export async function enrichReviewWithModel(
  rows: ReviewRow[],
  inputs: Map<string, TherapistInput & { gender: string | null; therapist_types: string[] }>,
  summary: ReviewSummary,
  ctx: ReviewContext,
): Promise<ModelEnrichment> {
  if (!llmConfigured()) return { narrative: null, cardReviews: 0, drafts: 0 };

  const needsCard = rows
    .filter((r) => (r.risk === "critical" || r.risk === "high" || r.risk === "medium") && r.flags.some((f) => f.key === "card_not_opened" || f.key === "profile_not_converting"))
    .filter((r) => inputs.get(r.therapist_id)?.profile_photo_path)
    .slice(0, CARD_REVIEW_MAX);
  const cards = new Map<string, CardReview>();
  await mapLimit(needsCard, CONCURRENCY, async (r) => {
    const t = inputs.get(r.therapist_id);
    if (!t) return;
    const review = await reviewCard(t, t.therapist_types);
    if (!review) return;
    cards.set(r.therapist_id, review);
    const issues = [review.photo_ok ? "" : `תמונה: ${review.photo_issue}`, review.opening_ok ? "" : `פתיחה: ${review.opening_issue}`].filter(Boolean);
    if (issues.length === 0 && review.suggestions.length === 0) return;
    r.flags.push({
      key: "card_review",
      severity: "normal",
      owner: "therapist",
      label: "סקירת כרטיס",
      detail: issues.join("; ") || "הכרטיס סביר; יש הצעות קטנות.",
      emailParagraph: review.suggestions.join(" ") || undefined,
    });
  });

  const needsDraft = rows
    .filter((r) => r.actions.some((a) => a.type === "email" && !a.title.includes("צינון")))
    .slice(0, DRAFT_MAX);
  let drafts = 0;
  await mapLimit(needsDraft, CONCURRENCY, async (r) => {
    const t = inputs.get(r.therapist_id);
    if (!t) return;
    const draft = await draftEmail(t, t.gender, r.flags, cards.get(r.therapist_id) ?? null);
    if (!draft) return;
    const action = r.actions.find((a) => a.type === "email");
    if (!action) return;
    action.subject = draft.subject;
    action.body = draft.body;
    action.detail = "טיוטה של המודל מתוך הדגלים, בלי מספרים. נשלחת רק אחרי עריכה ולחיצה.";
    drafts++;
  });

  const narrative = await weeklyNarrative(rows, summary, ctx);
  return { narrative, cardReviews: cards.size, drafts };
}
