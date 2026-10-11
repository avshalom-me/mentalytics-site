import { z } from "zod";
import { llmConfigured, llmJson } from "./llm";

// Hybrid profile-quality feedback for therapists.
//   1. Rule-based detection finds concrete, certain gaps (no photo, short bio…).
//   2. A model rephrases them into warm, personal Hebrew prose.
//   3. If the AI call is unavailable or fails, we fall back to the rule text.
// Used by the welcome / onboarding emails (and reusable elsewhere).
//
// No module-scope client here on purpose: this file is imported by
// therapist-emails.ts, which the payment flows import - a client that throws
// at load when a key is missing would take the checkout down with it.

// The gap rules moved to profile-gaps.ts (pure) on 11/10/26 so the retention
// review engine can share them without pulling the model client in; the
// names are re-exported here for the existing callers.
import { detectProfileGaps, type ProfileForFeedback } from "./profile-gaps";
export { detectProfileGaps, type ProfileForFeedback };

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BulletsSchema = z.object({ bullets: z.array(z.string()) });

async function aiPhrase(gaps: string[]): Promise<string[] | null> {
  const { data } = await llmJson(
    {
      feature: "profile_feedback",
      tier: "fast",
      system:
        "אתה עוזר אדיב לפלטפורמה ישראלית להתאמת מטפלים נפשיים. כתוב בעברית מקצועית, ברורה ופרקטית. החזר JSON בלבד.",
      user:
        `אלה הפערים שזוהו בפרופיל של מטפל/ת באתר:\n` +
        gaps.map((g, i) => `${i + 1}. ${g}`).join("\n") +
        `\n\nנסח/י אותם כהמלצות קצרות ופרקטיות. החזר/החזירי JSON במבנה: ` +
        `{"bullets": ["המלצה קצרה 1", "המלצה קצרה 2"]}. ` +
        `כל המלצה עד 22 מילים, ממוקדת ופרקטית. אל תמציא/י פערים שלא מופיעים ברשימה, ואל תוסיף/י משפטי מחמאה או עידוד אישיים.`,
      maxTokens: 500,
      // Awaited inside the payment-completion request: a slow model must not
      // hold the checkout response.
      timeoutMs: 25_000,
      retries: 0,
    },
    BulletsSchema,
  );
  const bullets = data.bullets
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .slice(0, 6);
  return bullets.length > 0 ? bullets : null;
}

// Returns an RTL, inline-styled HTML snippet with personalized suggestions, or
// null if the profile has no notable gaps (so the caller can omit the block).
export async function buildProfileFeedbackHtml(t: ProfileForFeedback): Promise<string | null> {
  const gaps = detectProfileGaps(t);
  if (gaps.length === 0) return null;

  let bullets: string[] = gaps;

  if (llmConfigured()) {
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
