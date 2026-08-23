import "server-only";
import OpenAI from "openai";
import type { ProspectRow } from "./center-prospects";

// טיוטה אישית לכל מכון, שנכתבת על ידי מודל שפה אחרי קריאת האתר שלהם.
//
// זה הסוכן היחיד מלבד בקר הבוקר שמשתמש ב-AI, וההבדל מהותי: כאן המודל
// כותב טקסט שייצא החוצה בשמנו. לכן שלוש מגבלות קשיחות:
//
//   1. המודל מקבל **רק** טקסט שנקרא מהאתר הציבורי של המכון ואת רשימת
//      הפערים שלנו. אין לו גישה לשום דבר אחר.
//   2. הוא מתבקש במפורש להסתמך רק על מה שקיבל, ולהחזיר בנפרד את רשימת
//      העובדות שהשתמש בהן - כדי שיהיה מה לאמת מול האתר.
//   3. אם אין אתר, או שהקריאה נכשלת - חוזרים לתבנית הקבועה. עדיף טקסט
//      גנרי נכון מטקסט אישי שהומצא.
//
// **המשתמש חייב לאמת את הפרטים לפני שליחה.** האזהרה מוצגת בבירור במסך
// ליד הטיוטה, וגם נשמרת כאן ברשימת ה-facts.

const MODEL = process.env.PROSPECT_LLM_MODEL ?? "gpt-4o-mini";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.mentalytics.co.il";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_SITE_CHARS = 6_000;

export type AiDraftResult = {
  subject: string;
  body: string;
  /** מקור הטקסט: 'ai' = נכתב על ידי מודל אחרי קריאת האתר. */
  source: "ai" | "template";
  /** העובדות שהמודל טוען שלקח מהאתר - הרשימה שצריך לאמת. */
  facts: string[];
  /** למה נפלנו לתבנית, אם נפלנו. */
  note?: string;
};

/** משיכת הטקסט הגלוי מאתר המכון. קריאה בלבד, עם תקציב זמן קצר. */
async function readSite(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "MentalyticsBot/1.0 (+https://www.mentalytics.co.il)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // הסרת סקריפטים, סגנונות ותגיות - נשאר טקסט קריא בלבד.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 120 ? text.slice(0, MAX_SITE_CHARS) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT = [
  "אתה כותב טיוטת פנייה ראשונה בעברית ממנהל פלטפורמת ההתאמות \"טיפול חכם\" אל מרכז טיפולי.",
  "הכותב הוא אבשלום, פסיכולוג קליני. הפנייה נשלחת אחרי שניסינו להשיג אותם בטלפון ולא הצלחנו.",
  "",
  "מותר לך להסתמך אך ורק על טקסט האתר שתקבל ועל רשימת הפערים. אסור לך להמציא ולו פרט אחד:",
  "לא שמות אנשים, לא ותק, לא מספר מטפלים, לא התמחויות שלא כתובות במפורש בטקסט.",
  "אם הטקסט דל - כתוב פנייה כללית יותר. עדיף כללי ונכון מאשר אישי ושגוי.",
  "",
  "מבנה: פנייה, משפט אישי אחד שמראה שקראנו עליהם (מבוסס על האתר), מה אנחנו רואים בביקוש באזור שלהם,",
  "מה מציעים, ובקשה לשיחה קצרה. עד 160 מילים.",
  "",
  "טון: עמית למקצוע. עובדתי, מכבד, בלי סופרלטיבים, בלי שפה שיווקית, בלי לחץ ובלי הבטחות.",
  "אסור להשתמש בקו מפריד ארוך - השתמש ב' - ' במקום.",
  "",
  "החזר JSON בלבד במבנה:",
  '{"subject": "נושא המייל", "body": "גוף המייל", "facts": ["עובדה שלקחת מהאתר", "..."]}',
  "השדה facts הוא רשימת הפרטים שלקחת מהאתר והכנסת לטקסט - כדי שאדם יוכל לאמת אותם. אם לא השתמשת בשום פרט, החזר רשימה ריקה.",
].join("\n");

export async function buildAiProspectDraft(
  p: ProspectRow,
  gapExamples: string[]
): Promise<AiDraftResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!p.website) return null;

  const siteText = await readSite(p.website);
  if (!siteText) return null;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 700,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              center_name: p.name,
              city: p.city,
              site_text: siteText,
              demand_gaps: gapExamples,
              our_site: `${SITE_URL}/centers`,
            }),
          },
        ],
      },
      { timeout: 45_000, maxRetries: 1 }
    );
    const raw = res.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { subject?: string; body?: string; facts?: unknown };
    const subject = String(parsed.subject ?? "").trim();
    const body = String(parsed.body ?? "").trim();
    if (!subject || body.length < 80) return null;
    const facts = Array.isArray(parsed.facts) ? parsed.facts.map((f) => String(f)).filter(Boolean) : [];
    return { subject, body, source: "ai", facts };
  } catch (e) {
    console.error("prospect ai draft failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
