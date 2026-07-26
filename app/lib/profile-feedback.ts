import OpenAI from "openai";

// Hybrid profile-quality feedback for therapists.
//   1. Rule-based detection finds concrete, certain gaps (no photo, short bio…).
//   2. gpt-4o-mini rephrases them into warm, personal Hebrew prose.
//   3. If the AI call is unavailable or fails, we fall back to the rule text.
// Used by the welcome / onboarding emails (and reusable elsewhere).

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ProfileForFeedback = {
  full_name?: string | null;
  bio?: string | null;
  profile_photo_path?: string | null;
  training_areas?: string[] | null;
  therapist_types?: string[] | null;
  regions?: string[] | null;
  education?: string | null;
  experience?: string | null;
  languages?: string[] | null;
};

const BIO_MIN = 80;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Concrete, rule-based gaps. Each entry is a short Hebrew phrase describing
// what's missing and why it matters - used both as the AI's input and as the
// no-AI fallback text. Order is by impact (photo and bio first).
export function detectProfileGaps(t: ProfileForFeedback): string[] {
  const gaps: string[] = [];

  if (!t.profile_photo_path) {
    gaps.push("אין תמונת פרופיל - תמונה מקצועית היא מהגורמים החזקים ביותר לאמון ולפנייה ראשונית.");
  }
  if (!t.bio || t.bio.trim().length < BIO_MIN) {
    gaps.push("הביוגרפיה קצרה או חסרה - תיאור אישי של הגישה הטיפולית שלך מגדיל משמעותית את מספר הפניות.");
  }
  if ((t.training_areas?.length ?? 0) <= 2) {
    gaps.push("מעט תחומי טיפול מסומנים - הוספת תחומים שאת/ה מתמחה בהם תרחיב את החשיפה במערכת ההתאמה ובמאגר.");
  }
  if (!t.education || t.education.trim().length < 10) {
    gaps.push("חסרים פרטי השכלה והכשרה - מטופלים בודקים רקע מקצועי לפני שהם פונים.");
  }
  if (!t.experience || t.experience.trim().length < 10) {
    gaps.push("חסר תיאור ניסיון מקצועי - שנות ניסיון ומסגרות עבודה מחזקות אמון.");
  }
  if ((t.regions?.length ?? 0) === 0) {
    gaps.push("לא סומנו אזורי פעילות - בלי אזור קשה למטופלים למצוא אותך בחיפוש לפי מיקום.");
  }

  return gaps;
}

async function aiPhrase(gaps: string[]): Promise<string[] | null> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "אתה עוזר אדיב לפלטפורמה ישראלית להתאמת מטפלים נפשיים. כתוב בעברית מקצועית, ברורה ופרקטית. החזר JSON בלבד.",
      },
      {
        role: "user",
        content:
          `אלה הפערים שזוהו בפרופיל של מטפל/ת באתר:\n` +
          gaps.map((g, i) => `${i + 1}. ${g}`).join("\n") +
          `\n\nנסח/י אותם כהמלצות קצרות ופרקטיות. החזר/החזירי JSON במבנה: ` +
          `{"bullets": ["המלצה קצרה 1", "המלצה קצרה 2"]}. ` +
          `כל המלצה עד 22 מילים, ממוקדת ופרקטית. אל תמציא/י פערים שלא מופיעים ברשימה, ואל תוסיף/י משפטי מחמאה או עידוד אישיים.`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { bullets?: unknown };
  if (!Array.isArray(parsed.bullets)) return null;
  const bullets = parsed.bullets
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .slice(0, 6);
  return bullets.length > 0 ? bullets : null;
}

// Returns an RTL, inline-styled HTML snippet with personalized suggestions, or
// null if the profile has no notable gaps (so the caller can omit the block).
export async function buildProfileFeedbackHtml(t: ProfileForFeedback): Promise<string | null> {
  const gaps = detectProfileGaps(t);
  if (gaps.length === 0) return null;

  let bullets: string[] = gaps;

  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await aiPhrase(gaps);
      if (result) {
        bullets = result;
      }
    } catch (err) {
      console.error(
        "buildProfileFeedbackHtml: AI phrasing failed, using rule fallback:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Neutral, practical lead-in only - no personal "I'm proud of your progress /
  // I believe in you" style messaging (removed per product decision).
  const intro = "כדי שהפרופיל שלך יקבל יותר פניות, שמנו לב לכמה דברים שכדאי להשלים:";

  const items = bullets
    .map((b) => `<li style="margin-bottom:8px;">${escapeHtml(b)}</li>`)
    .join("");

  return `
    <div style="background:#FDF6E3;border:1px solid #F0E2BE;border-radius:10px;padding:16px 20px;margin:0 0 22px;">
      <p style="margin:0 0 10px;font-weight:bold;color:#A87010;">איך להפיק יותר מהפרופיל שלך</p>
      <p style="margin:0 0 10px;font-size:14px;color:#3E5250;">${escapeHtml(intro)}</p>
      <ul style="margin:0;padding-inline-start:18px;font-size:14px;color:#3E5250;line-height:1.6;">${items}</ul>
    </div>`;
}
