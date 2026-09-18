import { describe, it, expect } from "vitest";
import { buildSavedMatchScores, parseSavedMatchScores, savedDisplayRows } from "./saved-match-scores";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("buildSavedMatchScores", () => {
  it("keeps only the numbers and the area flag, never the reasons", () => {
    const built = buildSavedMatchScores(
      [
        {
          id: A,
          match_score: 91.6,
          personality_score: 80,
          combined_score: 88,
          in_requested_area: true,
          // מה ש-/api/match מחזיר על אותו אובייקט - אסור שיגיע לטוקן.
          ...({ match_reasons: ["המטפל/ת מתמחה גם בטיפול מיני"], full_name: "x" } as object),
        },
      ],
      { locationAsked: true, onlineRequested: false },
    );
    expect(built.by_id[A]).toEqual({ match_score: 92, personality_score: 80, combined_score: 88, in_requested_area: true });
    expect(JSON.stringify(built)).not.toContain("match_reasons");
    expect(JSON.stringify(built)).not.toContain("מיני");
    expect(built.assessment).toBe(false);
  });
});

describe("parseSavedMatchScores", () => {
  it("drops ids outside the list, extra fields and out-of-range numbers", () => {
    const parsed = parseSavedMatchScores(
      {
        location_asked: true,
        online_requested: "yes",
        assessment: true,
        note: "free text",
        by_id: {
          [A]: { match_score: 140, personality_score: -3, combined_score: "90", in_requested_area: "true", match_reasons: ["x"] },
          [B]: { match_score: 77, personality_score: null, combined_score: 77, in_requested_area: true },
          [C]: { match_score: 50 },
        },
      },
      [A, B],
    );
    expect(parsed).toEqual({
      location_asked: true,
      online_requested: false,
      assessment: true,
      by_id: {
        [A]: { match_score: null, personality_score: null, combined_score: null, in_requested_area: false },
        [B]: { match_score: 77, personality_score: null, combined_score: 77, in_requested_area: true },
      },
    });
  });

  it("returns null when there is nothing usable", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { by_id: [] }, { by_id: { [C]: { match_score: 50 } } }]) {
      expect(parseSavedMatchScores(bad, [A, B]), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("savedDisplayRows", () => {
  const list = [{ id: A }, { id: B }, { id: C }];

  it("puts the requested area first and keeps the saved order inside each group", () => {
    const scores = parseSavedMatchScores(
      {
        location_asked: true,
        by_id: {
          [A]: { match_score: 95, in_requested_area: false },
          [B]: { match_score: 80, in_requested_area: true },
          [C]: { match_score: 70, in_requested_area: true },
        },
      },
      [A, B, C],
    );
    const { rows, localCount } = savedDisplayRows(list, scores);
    expect(rows.map((r) => r.t.id)).toEqual([B, C, A]);
    expect(rows.map((r) => r.away)).toEqual([false, false, true]);
    expect(localCount).toBe(2);
  });

  it("has no groups when no location was asked", () => {
    const scores = parseSavedMatchScores(
      { location_asked: false, by_id: { [A]: { match_score: 60, in_requested_area: false } } },
      [A, B, C],
    );
    const { rows, localCount } = savedDisplayRows(list, scores);
    expect(rows.map((r) => r.t.id)).toEqual([A, B, C]);
    expect(rows.every((r) => !r.away)).toBe(true);
    expect(rows[0].score?.match_score).toBe(60);
    expect(rows[1].score).toBeNull();
    expect(localCount).toBe(3);
  });

  it("an old token without scores keeps the saved order and shows no numbers", () => {
    const { rows, localCount } = savedDisplayRows(list, null);
    expect(rows.map((r) => r.t.id)).toEqual([A, B, C]);
    expect(rows.every((r) => r.score === null && !r.away)).toBe(true);
    expect(localCount).toBe(3);
  });
});
