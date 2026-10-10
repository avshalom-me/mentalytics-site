import { describe, expect, it } from "vitest";
import { estimateCostUsd, providerOf } from "./llm-pricing";

describe("estimateCostUsd", () => {
  it("prices a cached Opus call by each token class", () => {
    // 1,000 קלט רגיל, 500 פלט, 2,000 קריאת cache, 3,000 כתיבת cache
    const cost = estimateCostUsd("claude-opus-5-5", {
      inputTokens: 1_000,
      outputTokens: 500,
      cacheReadTokens: 2_000,
      cacheWriteTokens: 3_000,
    });
    // 0.004 + 0.01 + 0.0004 + 0.015
    expect(cost).toBeCloseTo(0.0294, 6);
  });

  it("prices an OpenAI call with cached input at the cache rate", () => {
    const cost = estimateCostUsd("gpt-4o", { inputTokens: 8_000, outputTokens: 600, cacheReadTokens: 2_000, cacheWriteTokens: 0 });
    // 0.02 + 0.006 + 0.0025
    expect(cost).toBeCloseTo(0.0285, 6);
  });

  it("returns null for a model that is not in the price list", () => {
    expect(estimateCostUsd("gpt-9-preview", { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBeNull();
  });
});

describe("providerOf", () => {
  it("tells Claude from OpenAI by the model name", () => {
    expect(providerOf("claude-sonnet-5-5")).toBe("anthropic");
    expect(providerOf("gpt-4o-mini")).toBe("openai");
  });
});
