import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The counsellor rubric scores with the kids engine and takes no credit, by
// design. Until 13/10/2026 it also asked nothing about the device, so a parent
// whose free runs of the kids questionnaire were used up could carry on here
// for nothing. Now a device the kids route would refuse is refused here too -
// and nothing else changes: a counsellor is still not charged, and a reviewer's
// token still lifts every cap.
const m = vi.hoisted(() => ({
  getUsage: vi.fn(),
  bump: vi.fn(),
  review: vi.fn(),
  score: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/usage", () => ({
  getUsage: m.getUsage,
  bumpAndCheckIpDaily: m.bump,
  getIp: () => "10.0.0.1",
  cleanFp: (fp: unknown) => (typeof fp === "string" && /^[a-f0-9]{64}$/.test(fp) ? fp : null),
}));
vi.mock("@/app/lib/school-review.server", () => ({ isActiveReviewToken: m.review }));
vi.mock("@/app/lib/kids-score.server", () => ({ scoreKidsQuestionnaire: m.score }));

import { POST } from "@/app/api/questionnaire/school/score/route";

const FP = "a".repeat(64);
const free = { count: 2, limit: 8, allowed: true, paymentRequired: false };
const exhausted = { count: 8, limit: 8, allowed: false, paymentRequired: true };

function post(body: unknown) {
  return POST(new NextRequest("http://localhost/api/questionnaire/school/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  m.getUsage.mockReset();
  m.bump.mockReset().mockResolvedValue(true);
  m.review.mockReset().mockResolvedValue(false);
  m.score.mockReset().mockReturnValue({ emotional: [], academic: [] });
});

describe("/api/questionnaire/school/score", () => {
  it("scores a counsellor's case without taking a credit", async () => {
    m.getUsage.mockResolvedValue(free);
    const res = await post({ _fp: FP, q1: 1 });
    expect(res.status).toBe(200);
    expect(m.getUsage).toHaveBeenCalledWith("10.0.0.1", FP, "kids");
    expect(m.score).toHaveBeenCalledTimes(1);
    expect(m.bump).toHaveBeenCalledTimes(1);
  });

  it("refuses a device that has used up the free kids questionnaires, with the paywall answer", async () => {
    m.getUsage.mockResolvedValue(exhausted);
    const res = await post({ _fp: FP, q1: 1 });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, paymentRequired: true });
    expect(m.score).not.toHaveBeenCalled();
    expect(m.bump).not.toHaveBeenCalled();
  });

  it("a reviewer's token lifts both the paywall check and the daily cap", async () => {
    m.review.mockResolvedValue(true);
    m.getUsage.mockResolvedValue(exhausted);
    const res = await post({ _fp: FP, _reviewToken: "x".repeat(32), q1: 1 });
    expect(res.status).toBe(200);
    expect(m.getUsage).not.toHaveBeenCalled();
    expect(m.bump).not.toHaveBeenCalled();
  });

  it("keeps the per-address daily cap as the backstop", async () => {
    m.getUsage.mockResolvedValue(free);
    m.bump.mockResolvedValue(false);
    const res = await post({ _fp: FP, q1: 1 });
    expect(res.status).toBe(429);
    expect(m.score).not.toHaveBeenCalled();
  });

  it("never serves the paywall screen to a device it cannot read", async () => {
    // Without a fingerprint the usage lookup falls back to the address, as the
    // kids route does; the shape of the call is what matters here.
    m.getUsage.mockResolvedValue(free);
    await post({ q1: 1 });
    expect(m.getUsage).toHaveBeenCalledWith("10.0.0.1", null, "kids");
  });
});
