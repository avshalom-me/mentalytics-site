import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeTrackFields, TRACK_METADATA_MAX_CHARS, TRACK_SOURCE_MAX_CHARS } from "./track-input";

// /api/track is public and wrote any metadata object of any size (19/10/2026).
describe("normalizeTrackFields", () => {
  const tid = "11111111-2222-4333-8444-555555555555";

  it("passes a normal event through unchanged", () => {
    const out = normalizeTrackFields({ source: "directory", therapist_id: tid, session_id: "s1", metadata: { page: "city:חיפה" } });
    expect(out).toEqual({ source: "directory", therapist_id: tid, session_id: "s1", metadata: { page: "city:חיפה" } });
  });

  it("rejects metadata above the cap", () => {
    expect(normalizeTrackFields({ metadata: { blob: "x".repeat(TRACK_METADATA_MAX_CHARS) } })).toBeNull();
  });

  it("keeps the largest metadata seen in production with room to spare", () => {
    expect(normalizeTrackFields({ metadata: { blob: "x".repeat(468) } })).not.toBeNull();
  });

  it("drops a source that is too long and a therapist id that is not a UUID", () => {
    const out = normalizeTrackFields({ source: "s".repeat(TRACK_SOURCE_MAX_CHARS + 1), therapist_id: "not-a-uuid" })!;
    expect(out.source).toBeNull();
    expect(out.therapist_id).toBeNull();
  });

  it("treats an array or a string as no metadata", () => {
    expect(normalizeTrackFields({ metadata: [1, 2, 3] })!.metadata).toEqual({});
    expect(normalizeTrackFields({ metadata: "x" })!.metadata).toEqual({});
  });
});

// Every public write route keeps a per-address limit. The in-memory limiter is
// weak across instances, but a route with none at all is one script away from a
// full table (match-token/visit had none until 19/10/2026).
describe("public write routes are rate limited", () => {
  const routes = [
    "app/api/track/route.ts",
    "app/api/track-view/route.ts",
    "app/api/track-click/route.ts",
    "app/api/match-token/route.ts",
    "app/api/match-token/visit/route.ts",
    "app/api/contact-therapist/route.ts",
    "app/api/contact-center/route.ts",
    "app/api/contact/route.ts",
    "app/api/quiz-feedback/route.ts",
    "app/api/therapist-feedback/route.ts",
    "app/api/staff-hours/route.ts",
  ];
  for (const r of routes) {
    it(r, () => {
      const src = readFileSync(r, "utf8");
      expect(/rateLimit\(|checkRateLimit\(|bumpAndCheckIpDaily\(|underDailyCap\(/.test(src)).toBe(true);
    });
  }
});
