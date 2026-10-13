import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The two explanation routes spend money on every press. These tests pin what
// stops a caller from spending without end: the size caps, the daily cap (past
// it the template is served and the model is not called), and the per-address
// minute limit. The model layer is a stub here.
const m = vi.hoisted(() => ({ llmJson: vi.fn(), underCap: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/llm", () => ({ llmJson: m.llmJson }));
vi.mock("@/app/lib/daily-cap", () => ({ underDailyCap: m.underCap }));

import { POST as explainMatch } from "@/app/api/explain-match/route";
import { POST as explainRecommendation } from "@/app/api/explain-recommendation/route";
import { EXPLAIN_MAX_BODY_BYTES, EXPLAIN_PER_MINUTE } from "@/app/lib/explain-guard";

// Invented people; nothing real.
const matchBody = {
  questionnaire_type: "adult",
  user_summary: { gender: "נקבה", recommended_treatment_types: ["CBT"] },
  therapist: { id: "t-1", full_name: "פלונית אלמונית", training_areas: ["CBT", "חרדה"], regions: ["חיפה"], gender: "נקבה", bio: "ביו קצר." },
  match_result: { match_score: 80, personality_score: 70, match_reasons: ["גישה"] },
};
const recommendationBody = {
  questionnaire_type: "adult",
  recommendation: { treatment: "CBT", treatment_label: "CBT לחרדה", domain: "רגשי", symptom_text: "דאגות מתמשכות" },
  user_facts: { summary: ["דאגות"], gender: "זכר" },
};

let n = 0;
function post(handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, ip?: string) {
  n++;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip ?? `10.7.${Math.floor(n / 200)}.${(n % 200) + 1}` },
      body: text,
    }),
  );
}

beforeEach(() => {
  m.llmJson.mockReset().mockResolvedValue({ data: { explanation: "הסבר.\n\nעוד הסבר." }, model: "stub" });
  m.underCap.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("/api/explain-match", () => {
  it("calls the model for a well-formed request", async () => {
    const res = await post(explainMatch, "/api/explain-match", matchBody);
    expect(res.status).toBe(200);
    expect((await res.json()).explanation).toContain("הסבר");
    expect(m.llmJson).toHaveBeenCalledTimes(1);
    expect(m.underCap).toHaveBeenCalledWith("explain_match", expect.any(Number));
  });

  it("serves the template and does not call the model once the day's cap is reached", async () => {
    m.underCap.mockResolvedValue(false);
    const res = await post(explainMatch, "/api/explain-match", matchBody);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.explanation).toContain("בהתבסס על תשובות השאלון");
    expect(m.llmJson).not.toHaveBeenCalled();
  });

  it("refuses a field longer than the prompt could ever need, before any model call", async () => {
    const res = await post(explainMatch, "/api/explain-match", { ...matchBody, therapist: { ...matchBody.therapist, bio: "א".repeat(4_001) } });
    expect(res.status).toBe(400);
    expect(m.llmJson).not.toHaveBeenCalled();
    expect(m.underCap).not.toHaveBeenCalled();
  });

  it("refuses a body larger than 64 KB before parsing it", async () => {
    const res = await post(explainMatch, "/api/explain-match", JSON.stringify({ ...matchBody, pad: "x".repeat(EXPLAIN_MAX_BODY_BYTES) }));
    expect(res.status).toBe(413);
    expect(m.llmJson).not.toHaveBeenCalled();
  });

  it("holds one address to its minute budget", async () => {
    const ip = "10.6.0.1";
    for (let i = 0; i < EXPLAIN_PER_MINUTE; i++) expect((await post(explainMatch, "/api/explain-match", matchBody, ip)).status).toBe(200);
    expect((await post(explainMatch, "/api/explain-match", matchBody, ip)).status).toBe(429);
  });
});

describe("/api/explain-recommendation", () => {
  it("calls the model for a well-formed request and the template past the cap", async () => {
    const ok = await post(explainRecommendation, "/api/explain-recommendation", recommendationBody);
    expect(ok.status).toBe(200);
    expect(m.llmJson).toHaveBeenCalledTimes(1);
    expect(m.underCap).toHaveBeenCalledWith("explain_recommendation", expect.any(Number));
    m.underCap.mockResolvedValue(false);
    const capped = await post(explainRecommendation, "/api/explain-recommendation", recommendationBody);
    expect(capped.status).toBe(200);
    expect((await capped.json()).explanation).toContain("נמצאה התאמה");
    expect(m.llmJson).toHaveBeenCalledTimes(1);
  });

  it("refuses an oversized finding text and an oversized body", async () => {
    const long = await post(explainRecommendation, "/api/explain-recommendation", {
      ...recommendationBody,
      recommendation: { ...recommendationBody.recommendation, symptom_text: "א".repeat(1_501) },
    });
    expect(long.status).toBe(400);
    const big = await post(explainRecommendation, "/api/explain-recommendation", JSON.stringify({ ...recommendationBody, pad: "x".repeat(EXPLAIN_MAX_BODY_BYTES) }));
    expect(big.status).toBe(413);
    expect(m.llmJson).not.toHaveBeenCalled();
  });
});
