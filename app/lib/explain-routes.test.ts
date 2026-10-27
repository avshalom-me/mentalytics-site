import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The two explanation routes spend money on every press. These tests pin what
// stops a caller from spending without end: the size caps, the daily cap (past
// it the template is served and the model is not called), and the per-address
// minute limit. The model layer is a stub here.
const m = vi.hoisted(() => ({ llmJson: vi.fn(), underCap: vi.fn(), maybeSingle: vi.fn(), from: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/llm", () => ({ llmJson: m.llmJson }));
vi.mock("@/app/lib/daily-cap", () => ({ underDailyCap: m.underCap }));
// שומר היכולות של הרישיון קורא את school_licenses; כאן הוא מדומה.
vi.mock("@/app/lib/supabaseAdmin", () => ({ supabaseAdmin: { from: m.from } }));

import { POST as explainMatch } from "@/app/api/explain-match/route";
import { POST as explainRecommendation } from "@/app/api/explain-recommendation/route";
import { EXPLAIN_MAX_BODY_BYTES, EXPLAIN_PER_MINUTE } from "@/app/lib/explain-guard";
import { SCHOOL_COOKIE, encodeGrant } from "@/app/lib/school-gate.server";

process.env.CRON_SECRET = "test-gate-secret";

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
function post(handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, ip?: string, cookie?: string) {
  n++;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip ?? `10.7.${Math.floor(n / 200)}.${(n % 200) + 1}`,
        ...(cookie ? { cookie: `${SCHOOL_COOKIE}=${cookie}` } : {}),
      },
      body: text,
    }),
  );
}

beforeEach(() => {
  m.llmJson.mockReset().mockResolvedValue({ data: { explanation: "הסבר.\n\nעוד הסבר." }, model: "stub" });
  m.underCap.mockReset().mockResolvedValue(true);
  m.maybeSingle.mockReset().mockResolvedValue({ data: { disabled_features: [] }, error: null });
  m.from.mockReset().mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: m.maybeSingle }) }) });
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

  it("explains an assessment to the counsellor in its own three-paragraph structure, and nothing else", async () => {
    const assessment = {
      questionnaire_type: "school",
      recommendation: { treatment: "פסיכו-דידקטי", treatment_label: "אבחון פסיכו-דידקטי", domain: "תחום לימודי", symptom_text: "נמצאו סימנים לקשיי קריאה", kind: "assessment" },
      user_facts: { summary: ["קושי בקריאה"], gender: "זכר" },
    };
    const systemOf = (call: number) => m.llmJson.mock.calls[call][0].system as string;
    expect((await post(explainRecommendation, "/api/explain-recommendation", assessment)).status).toBe(200);
    expect(systemOf(0)).toContain("שלוש פסקאות");
    expect(systemOf(0)).toContain("לכן מומלץ על");
    expect(m.llmJson.mock.calls[0][0].maxTokens).toBe(1_200);
    // the same assessment in the parents' questionnaire, and a treatment for the counsellor, keep the two-paragraph prompt
    await post(explainRecommendation, "/api/explain-recommendation", { ...assessment, questionnaire_type: "child" });
    await post(explainRecommendation, "/api/explain-recommendation", { ...assessment, recommendation: { ...assessment.recommendation, kind: "treatment" } });
    for (const call of [1, 2]) {
      expect(systemOf(call)).toContain("שתי פסקאות");
      expect(m.llmJson.mock.calls[call][0].maxTokens).toBe(800);
    }
    // an unknown kind is refused before any model call
    const bad = await post(explainRecommendation, "/api/explain-recommendation", { ...assessment, recommendation: { ...assessment.recommendation, kind: "x" } });
    expect(bad.status).toBe(400);
    expect(m.llmJson).toHaveBeenCalledTimes(3);
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

// מצב "גפ״ן" (app/lib/school-features.server.ts): רישיון בית ספר שההסבר כבוי בו.
// בלי עוגיית רישיון שום דבר לא משתנה; עם עוגייה ודגל כבוי, המודל לא נקרא בכלל,
// גם כשהלקוח כותב questionnaire_type אחר.
describe("a school licence with the explanation switched off", () => {
  const licenceCookie = () => encodeGrant({ license_id: "lic-1", school_id: "school-1", exp: Math.floor(Date.now() / 1000) + 3600 });
  const off = () => m.maybeSingle.mockResolvedValue({ data: { disabled_features: ["ai_explain"] }, error: null });

  it("without a licence cookie both routes behave as before and the licence table is never read", async () => {
    expect((await post(explainMatch, "/api/explain-match", matchBody)).status).toBe(200);
    expect((await post(explainRecommendation, "/api/explain-recommendation", recommendationBody)).status).toBe(200);
    expect(m.llmJson).toHaveBeenCalledTimes(2);
    expect(m.from).not.toHaveBeenCalled();
  });

  it("with a cookie and nothing switched off, both routes behave as before", async () => {
    expect((await post(explainMatch, "/api/explain-match", matchBody, undefined, licenceCookie())).status).toBe(200);
    expect((await post(explainRecommendation, "/api/explain-recommendation", recommendationBody, undefined, licenceCookie())).status).toBe(200);
    expect(m.llmJson).toHaveBeenCalledTimes(2);
  });

  it("with a cookie and the explanation off, both routes refuse before the model, the daily cap or the minute budget", async () => {
    off();
    const a = await post(explainMatch, "/api/explain-match", matchBody, undefined, licenceCookie());
    const b = await post(explainRecommendation, "/api/explain-recommendation", recommendationBody, undefined, licenceCookie());
    expect(a.status).toBe(403);
    expect(b.status).toBe(403);
    expect(await a.json()).toMatchObject({ ok: false, featureDisabled: "ai_explain" });
    expect(m.llmJson).not.toHaveBeenCalled();
    expect(m.underCap).not.toHaveBeenCalled();
  });

  it("the refusal follows the cookie, not the questionnaire type the client names", async () => {
    off();
    const res = await post(explainRecommendation, "/api/explain-recommendation", { ...recommendationBody, questionnaire_type: "adult" }, undefined, licenceCookie());
    expect(res.status).toBe(403);
    expect(m.llmJson).not.toHaveBeenCalled();
  });

  it("switching therapist search off does not touch the explanation", async () => {
    m.maybeSingle.mockResolvedValue({ data: { disabled_features: ["therapist_search"] }, error: null });
    expect((await post(explainMatch, "/api/explain-match", matchBody, undefined, licenceCookie())).status).toBe(200);
    expect(m.llmJson).toHaveBeenCalledTimes(1);
  });
});
