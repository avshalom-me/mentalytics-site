import "server-only";
import { z } from "zod";
import { llmConfigured, llmJson } from "./llm";
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

const DraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  facts: z.array(z.string()),
});

export async function buildAiProspectDraft(
  p: ProspectRow,
  gapExamples: string[]
): Promise<AiDraftResult | null> {
  if (!llmConfigured()) return null;
  if (!p.website) return null;

  const siteText = await readSite(p.website);
  if (!siteText) return null;

  try {
    const { data } = await llmJson(
      {
        feature: "prospect_draft",
        tier: "standard",
        system: SYSTEM_PROMPT,
        user: JSON.stringify({
          center_name: p.name,
          city: p.city,
          site_text: siteText,
          demand_gaps: gapExamples,
          our_site: `${SITE_URL}/centers`,
        }),
        maxTokens: 900,
        timeoutMs: 60_000,
        retries: 1,
      },
      DraftSchema,
    );
    const subject = data.subject.trim();
    const body = data.body.trim();
    if (!subject || body.length < 80) return null;
    const facts = data.facts.map((f) => f.trim()).filter(Boolean);
    return { subject, body, source: "ai", facts };
  } catch (e) {
    console.error("prospect ai draft failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
