import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import type { z } from "zod";
import { supabaseAdmin } from "./supabaseAdmin";
import { estimateCostUsd, type LlmProvider, type LlmUsage } from "./llm-pricing";

// שכבת מודל השפה היחידה של האתר. כל קריאה למודל עוברת כאן, ולא ישירות
// ל-SDK של ספק:
//
//   1. ספק ראשי Claude (הקרדיט החודשי של מנוי Max), גיבוי OpenAI. כשהקרדיט
//      נגמר Anthropic מחזירה שגיאה והבקשות נעצרות עד החודש הבא - בלי גיבוי
//      סוכן השירות היה מפסיק לנסח בשקט. כל כשל של הספק הראשי (קרדיט, קצב,
//      תקלה, סירוב, פלט לא תקין) עובר לגיבוי, ונרשם ככזה.
//   2. כל קריאה נרשמת ב-llm_calls עם טוקנים ועלות. עד 10/10/2026 לא הייתה
//      שום נראות על ההוצאה.
//   3. תקרה לקרדיט (LLM_CREDIT_BUDGET_USD): מעבר לה הקריאות עוברות לגיבוי
//      לפני שהקרדיט נגמר באמצע ריצה.
//
// הלקוחות נבנים בעצלנות, בתוך הקריאה: לקוח ברמת המודול נופל בטעינה כשהמפתח
// חסר, והקובץ הזה מיובא גם מזרימות תשלום.

export type LlmTier = "deep" | "standard" | "fast" | "classify";
export type LlmEffort = "low" | "medium" | "high" | "xhigh";

export type LlmRequest = {
  /** שם הפיצ'ר ליומן העלויות (inbox_draft, explain_match...). */
  feature: string;
  /** deep = דוחות ולקחים; standard = טיוטות; fast = כפתורים ציבוריים; classify = סיווג בלבד. */
  tier?: LlmTier;
  /** דריסת עומק החשיבה של הרמה. */
  effort?: LlmEffort;
  system: string;
  user: string;
  /** תקרת הפלט הנראה. ב-Claude החשיבה נספרת באותה תקרה, ולכן השכבה מרחיבה אותה. */
  maxTokens: number;
  timeoutMs?: number;
  /** ניסיונות חוזרים ברמת התעבורה (ברירת מחדל 1). */
  retries?: number;
  /** cache על ה-system prompt. ברירת מחדל: כשהוא ארוך מ-1,500 תווים. */
  cacheSystem?: boolean;
  /** false = בלי גיבוי ל-OpenAI (למשל כשהקורא כבר נופל לתבנית קבועה). */
  fallback?: boolean;
  /** פלט ארוך (דוחות): קריאה ב-streaming, כדי לא ליפול על timeout של HTTP. */
  stream?: boolean;
};

export type LlmResult = {
  text: string;
  provider: LlmProvider;
  model: string;
  usage: LlmUsage;
  costUsd: number | null;
  durationMs: number;
  /** המודל הראשי שנכשל, כשהתשובה הגיעה מהגיבוי; "budget" כשהגיבוי נבחר בגלל התקרה. */
  fallbackFrom?: string;
};

export type LlmErrorKind = "config" | "transport" | "refusal" | "bad_output" | "stopped";

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly kind: LlmErrorKind,
    public readonly provider: LlmProvider | null = null,
    public readonly model: string | null = null,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

type TierConfig = {
  anthropic: string;
  openai: string;
  effort: LlmEffort;
  openaiEffort: "low" | "medium" | "high";
};

// מודל לכל רמה, עם דריסה מהסביבה. ברירת המחדל Opus 5.5 בכל מה שיוצא לאנשים
// (טיוטות, דוחות), Sonnet 5.5 בכפתורים הציבוריים (זמן תגובה), Haiku לסיווג.
// הגיבוי שומר על אותה היררכיה ב-OpenAI.
function tierConfig(tier: LlmTier): TierConfig {
  const env = process.env;
  switch (tier) {
    case "deep":
      return { anthropic: env.LLM_MODEL_DEEP ?? "claude-opus-5-5", openai: env.LLM_FALLBACK_DEEP ?? "gpt-5.5", effort: "high", openaiEffort: "high" };
    case "fast":
      return { anthropic: env.LLM_MODEL_FAST ?? "claude-sonnet-5-5", openai: env.LLM_FALLBACK_FAST ?? "gpt-4o-mini", effort: "low", openaiEffort: "low" };
    case "classify":
      return { anthropic: env.LLM_MODEL_CLASSIFY ?? "claude-haiku-5-5", openai: env.LLM_FALLBACK_CLASSIFY ?? "gpt-4o-mini", effort: "low", openaiEffort: "low" };
    default:
      return { anthropic: env.LLM_MODEL_STANDARD ?? "claude-opus-5-5", openai: env.LLM_FALLBACK_STANDARD ?? "gpt-4o", effort: "medium", openaiEffort: "medium" };
  }
}

function anthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}
function openaiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

/** יש ספק כלשהו לעבוד איתו. הקוראים שנופלים לתבנית קבועה בודקים את זה לפני. */
export function llmConfigured(): boolean {
  return Boolean(anthropicKey() || openaiKey());
}

/** שם המודל שרמה תקבל בספק הראשי - לתצוגה (draft_model) ולא לקריאה. */
export function llmModelFor(tier: LlmTier = "standard"): string {
  const cfg = tierConfig(tier);
  return primaryProvider() === "anthropic" ? cfg.anthropic : cfg.openai;
}

// LLM_PRIMARY=openai מחזיר את כל האתר ל-OpenAI בלי שינוי קוד (למשל לבדיקה
// או כשהקרדיט נגמר ורוצים לחסוך את ניסיון הכישלון בכל קריאה).
function primaryProvider(): LlmProvider {
  if (process.env.LLM_PRIMARY === "openai") return "openai";
  return anthropicKey() ? "anthropic" : "openai";
}

// ── תקרת הקרדיט ─────────────────────────────────────────────────────────

const BUDGET_USD = Number(process.env.LLM_CREDIT_BUDGET_USD ?? "90");
// היום בחודש שבו הקרדיט מתחדש (מחזור החיוב של המנוי), לא ה-1 בחודש.
const RESET_DAY = Math.min(28, Math.max(1, Number(process.env.LLM_CREDIT_RESET_DAY ?? "1")));
const SPEND_CACHE_MS = 5 * 60_000;
let spendCache: { at: number; usd: number } | null = null;

function cycleStart(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = now.getUTCDate() >= RESET_DAY ? new Date(Date.UTC(y, m, RESET_DAY)) : new Date(Date.UTC(y, m - 1, RESET_DAY));
  return start.toISOString();
}

/** הוצאה על Claude במחזור הקרדיט הנוכחי, לפי llm_calls. נשמר 5 דקות בזיכרון. */
export async function anthropicCycleSpendUsd(): Promise<number> {
  if (spendCache && Date.now() - spendCache.at < SPEND_CACHE_MS) return spendCache.usd;
  const { data, error } = await supabaseAdmin
    .from("llm_calls")
    .select("cost_usd")
    .eq("provider", "anthropic")
    .gte("created_at", cycleStart());
  if (error) throw new Error(error.message);
  const usd = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  spendCache = { at: Date.now(), usd };
  return usd;
}

async function overBudget(): Promise<boolean> {
  if (!(BUDGET_USD > 0)) return false;
  try {
    return (await anthropicCycleSpendUsd()) >= BUDGET_USD;
  } catch (e) {
    // יומן שלא נקרא לא עוצר קריאות - אבל גם לא מגן; נרשם בלוג.
    console.warn("llm budget check failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

// ── יומן הקריאות ────────────────────────────────────────────────────────

type CallLog = {
  feature: string;
  provider: LlmProvider;
  model: string;
  ok: boolean;
  error?: string | null;
  fallback_from?: string | null;
  usage?: LlmUsage;
  cost_usd?: number | null;
  duration_ms: number;
  stop_reason?: string | null;
};

async function logCall(row: CallLog): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("llm_calls").insert({
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      ok: row.ok,
      error: row.error ? String(row.error).slice(0, 500) : null,
      fallback_from: row.fallback_from ?? null,
      input_tokens: row.usage?.inputTokens ?? 0,
      output_tokens: row.usage?.outputTokens ?? 0,
      cache_read_tokens: row.usage?.cacheReadTokens ?? 0,
      cache_write_tokens: row.usage?.cacheWriteTokens ?? 0,
      cost_usd: row.cost_usd ?? null,
      duration_ms: row.duration_ms,
      stop_reason: row.stop_reason ?? null,
    });
    if (error) console.warn("llm_calls insert failed:", error.message);
    if (row.ok && row.provider === "anthropic" && spendCache) spendCache.usd += row.cost_usd ?? 0;
  } catch (e) {
    console.warn("llm_calls insert failed:", e instanceof Error ? e.message : e);
  }
}

// ── Anthropic ───────────────────────────────────────────────────────────

const ZERO_USAGE: LlmUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

// החשיבה של Claude נספרת ב-max_tokens יחד עם הפלט. תקרה של 800 שחושבה לפלט
// בלבד הייתה חותכת את ה-JSON אחרי חשיבה קצרה, ולכן המרחב מורחב; התקרה
// הנראית נשמרת בפרומפט ובאימות של הקורא, לא במספר הזה.
function anthropicMaxTokens(visible: number): number {
  return Math.max(8_192, visible * 4);
}

type AnthropicMessage = Anthropic.Messages.Message;

function anthropicUsage(msg: AnthropicMessage): LlmUsage {
  return {
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
  };
}

function textOf(msg: AnthropicMessage): string {
  return msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

async function callAnthropic<T>(
  req: LlmRequest,
  cfg: TierConfig,
  schema: z.ZodType<T> | null,
): Promise<{ text: string; data: T | null; usage: LlmUsage; stopReason: string | null; model: string }> {
  const apiKey = anthropicKey();
  if (!apiKey) throw new LlmError("ANTHROPIC_API_KEY חסר", "config", "anthropic");
  const client = new Anthropic({ apiKey, timeout: req.timeoutMs ?? 60_000, maxRetries: req.retries ?? 1 });
  const cache = req.cacheSystem ?? req.system.length >= 1_500;
  const base = {
    model: cfg.anthropic,
    max_tokens: anthropicMaxTokens(req.maxTokens),
    system: cache
      ? [{ type: "text" as const, text: req.system, cache_control: { type: "ephemeral" as const } }]
      : req.system,
    messages: [{ role: "user" as const, content: req.user }],
  };
  const effort = req.effort ?? cfg.effort;

  let msg: AnthropicMessage;
  let data: T | null = null;
  if (schema) {
    const parsed = await client.messages.parse({
      ...base,
      output_config: { effort, format: zodOutputFormat(schema) },
    });
    msg = parsed;
    data = (parsed.parsed_output as T | null) ?? null;
  } else if (req.stream) {
    msg = await client.messages.stream({ ...base, output_config: { effort } }).finalMessage();
  } else {
    msg = await client.messages.create({ ...base, output_config: { effort } });
  }

  if (msg.stop_reason === "refusal") {
    throw new LlmError("המודל סירב לענות (refusal)", "refusal", "anthropic", cfg.anthropic);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new LlmError("התשובה נחתכה בתקרת הטוקנים", "stopped", "anthropic", cfg.anthropic);
  }
  const text = textOf(msg);
  if (schema && data === null) {
    throw new LlmError("המודל לא החזיר JSON במבנה המבוקש", "bad_output", "anthropic", cfg.anthropic);
  }
  if (!schema && !text) {
    throw new LlmError("המודל החזיר תשובה ריקה", "bad_output", "anthropic", cfg.anthropic);
  }
  return { text, data, usage: anthropicUsage(msg), stopReason: msg.stop_reason, model: cfg.anthropic };
}

// ── OpenAI (גיבוי) ──────────────────────────────────────────────────────

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model);
}

async function callOpenAI<T>(
  req: LlmRequest,
  cfg: TierConfig,
  schema: z.ZodType<T> | null,
): Promise<{ text: string; data: T | null; usage: LlmUsage; stopReason: string | null; model: string }> {
  const apiKey = openaiKey();
  if (!apiKey) throw new LlmError("OPENAI_API_KEY חסר", "config", "openai");
  const client = new OpenAI({ apiKey, timeout: req.timeoutMs ?? 60_000, maxRetries: req.retries ?? 1 });
  const model = cfg.openai;
  const reasoning = isReasoningModel(model);
  const res = await client.chat.completions.create({
    model,
    // מודל חשיבה סופר את החשיבה באותה תקרה, כמו Claude.
    max_completion_tokens: reasoning ? Math.max(8_192, req.maxTokens * 4) : req.maxTokens,
    ...(reasoning ? { reasoning_effort: req.effort === "xhigh" ? "high" : (req.effort ?? cfg.openaiEffort) } : { temperature: 0.3 }),
    ...(schema ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: req.system },
      // json_object דורש שהמילה json תופיע בהודעות עצמן.
      { role: "user", content: schema ? `${req.user}\n\n(json)` : req.user },
    ],
  });
  const choice = res.choices[0];
  const text = choice?.message?.content?.trim() ?? "";
  const stopReason = choice?.finish_reason ?? null;
  if (stopReason === "length") throw new LlmError("התשובה נחתכה בתקרת הטוקנים", "stopped", "openai", model);
  if (choice?.message?.refusal) throw new LlmError("המודל סירב לענות (refusal)", "refusal", "openai", model);
  if (!text) throw new LlmError("המודל החזיר תשובה ריקה", "bad_output", "openai", model);
  let data: T | null = null;
  if (schema) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new LlmError("המודל החזיר JSON לא תקין", "bad_output", "openai", model);
    }
    const checked = schema.safeParse(raw);
    if (!checked.success) throw new LlmError("המודל לא החזיר JSON במבנה המבוקש", "bad_output", "openai", model);
    data = checked.data;
  }
  const cached = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const usage: LlmUsage = {
    inputTokens: Math.max(0, (res.usage?.prompt_tokens ?? 0) - cached),
    outputTokens: res.usage?.completion_tokens ?? 0,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
  };
  return { text, data, usage, stopReason, model };
}

// ── הקריאה ──────────────────────────────────────────────────────────────

async function run<T>(req: LlmRequest, schema: z.ZodType<T> | null): Promise<LlmResult & { data: T | null }> {
  const cfg = tierConfig(req.tier ?? "standard");
  if (!llmConfigured()) throw new LlmError("לא מוגדר אף מפתח למודל שפה (ANTHROPIC_API_KEY / OPENAI_API_KEY)", "config");

  let primary = primaryProvider();
  let fallbackFrom: string | undefined;
  if (primary === "anthropic" && (await overBudget())) {
    if (openaiKey()) {
      primary = "openai";
      fallbackFrom = "budget";
    }
    // בלי OpenAI ממשיכים עם Claude: עדיף לקבל את שגיאת הקרדיט מלא לענות.
  }

  const attempt = async (provider: LlmProvider, from?: string) => {
    const started = Date.now();
    const model = provider === "anthropic" ? cfg.anthropic : cfg.openai;
    try {
      const out = provider === "anthropic" ? await callAnthropic(req, cfg, schema) : await callOpenAI(req, cfg, schema);
      const durationMs = Date.now() - started;
      const costUsd = estimateCostUsd(out.model, out.usage);
      await logCall({
        feature: req.feature,
        provider,
        model: out.model,
        ok: true,
        fallback_from: from ?? null,
        usage: out.usage,
        cost_usd: costUsd,
        duration_ms: durationMs,
        stop_reason: out.stopReason,
      });
      return { text: out.text, data: out.data, provider, model: out.model, usage: out.usage, costUsd, durationMs, ...(from ? { fallbackFrom: from } : {}) };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logCall({ feature: req.feature, provider, model, ok: false, error: message, fallback_from: from ?? null, usage: ZERO_USAGE, duration_ms: Date.now() - started });
      throw e;
    }
  };

  try {
    return await attempt(primary, fallbackFrom);
  } catch (e) {
    const canFallBack = primary === "anthropic" && req.fallback !== false && Boolean(openaiKey());
    if (!canFallBack) throw e;
    const why = e instanceof Error ? e.message : String(e);
    console.warn(`llm ${req.feature}: ${cfg.anthropic} failed (${why.slice(0, 160)}), falling back to ${cfg.openai}`);
    return attempt("openai", cfg.anthropic);
  }
}

/** תשובה חופשית (דוח, סיכום, משפט). */
export async function llmText(req: LlmRequest): Promise<LlmResult> {
  const { data: _unused, ...rest } = await run<never>(req, null);
  void _unused;
  return rest;
}

/** תשובה במבנה: ב-Claude דרך structured outputs, בגיבוי JSON שמאומת מול אותה סכמה. */
export async function llmJson<T>(req: LlmRequest, schema: z.ZodType<T>): Promise<LlmResult & { data: T }> {
  const out = await run(req, schema);
  if (out.data === null) throw new LlmError("המודל לא החזיר JSON במבנה המבוקש", "bad_output", out.provider, out.model);
  return { ...out, data: out.data };
}
