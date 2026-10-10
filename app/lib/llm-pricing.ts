// מחירון מודלי השפה ועלות משוערת לקריאה. קובץ טהור (בלי שרת) כדי שאפשר
// לבדוק אותו ישירות (llm-pricing.test.ts).
//
// המחירים בדולרים למיליון טוקנים, לפי מחירוני Anthropic ו-OpenAI ב-10/10/2026.
// מודל שלא ברשימה מקבל null: עדיף "לא ידוע" מעלות אפס שמסתירה הוצאה.

export type LlmProvider = "anthropic" | "openai";

export type LlmUsage = {
  /** טוקני קלט שלא הגיעו מה-cache. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

type Price = { input: number; output: number; cacheWrite?: number; cacheRead?: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
  "claude-fable-5-1": { input: 10, output: 50, cacheWrite: 12.5, cacheRead: 0.25 },
  "gpt-5.5": { input: 5, output: 30, cacheRead: 0.5 },
  "gpt-5-mini": { input: 0.25, output: 2, cacheRead: 0.025 },
  "gpt-4o": { input: 2.5, output: 10, cacheRead: 1.25 },
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075 },
};

export function providerOf(model: string): LlmProvider {
  return model.startsWith("claude") ? "anthropic" : "openai";
}

/** עלות בדולרים, או null כשהמודל לא במחירון. */
export function estimateCostUsd(model: string, u: LlmUsage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const perM = (tokens: number, price: number | undefined) => (tokens * (price ?? p.input)) / 1_000_000;
  const cost =
    perM(u.inputTokens, p.input) +
    perM(u.outputTokens, p.output) +
    perM(u.cacheReadTokens, p.cacheRead) +
    perM(u.cacheWriteTokens, p.cacheWrite);
  return Math.round(cost * 1_000_000) / 1_000_000;
}
