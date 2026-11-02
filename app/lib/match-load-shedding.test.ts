import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  applyLoadShedding,
  isAdultsSearch,
  isShedEligible,
  shedProbability,
  SHED_FULL_PEOPLE,
  SHED_MIN_RESULTS,
  SHED_START_PEOPLE,
} from "./match-load-shedding";

type Row = { id: string; load: number; paid?: boolean; area?: boolean; source?: string; entity?: string | null };

const row = (id: string, load: number, extra: Partial<Row> = {}): Row => ({ id, load, paid: true, area: true, ...extra });

function run(ranked: Row[], opts: { limit?: number; location?: boolean; random?: () => number } = {}) {
  return applyLoadShedding(ranked, {
    limit: opts.limit ?? 10,
    loadOf: (r) => r.load,
    eligible: (r) => r.paid !== false,
    inArea: (r) => r.area !== false,
    locationRequested: opts.location ?? true,
    random: opts.random ?? (() => 0), // 0 < p: always shed when p > 0
  });
}

describe("shedProbability", () => {
  it("is 0 below the owner's 'more than 3 in two weeks', then climbs to 1", () => {
    expect([0, 1, 2, 3].map(shedProbability)).toEqual([0, 0, 0, 0]);
    expect(shedProbability(SHED_START_PEOPLE)).toBeCloseTo(1 / 3);
    expect(shedProbability(5)).toBeCloseTo(2 / 3);
    expect(shedProbability(SHED_FULL_PEOPLE)).toBe(1);
    expect(shedProbability(40)).toBe(1);
    expect(shedProbability(Number.NaN)).toBe(0);
  });
});

describe("isAdultsSearch", () => {
  it("the adults quiz asks for מבוגרים; the kids quiz (גיל הרך / ילדים / נוער) is left alone", () => {
    expect(isAdultsSearch(["מבוגרים"])).toBe(true);
    expect(isAdultsSearch(["מבוגרים", "הגיל השלישי"])).toBe(true);
    expect(isAdultsSearch(["גיל הרך", "ילדים"])).toBe(false);
    expect(isAdultsSearch(["ילדים"])).toBe(false);
    expect(isAdultsSearch(["נוער"])).toBe(false);
    expect(isAdultsSearch([])).toBe(false);
  });
});

describe("isShedEligible", () => {
  it("only a private paying therapist (paid); gift tracks, centres and free therapists never", () => {
    expect(isShedEligible({ status: "paying", promotion_source: "paid", entity_type: "therapist" })).toBe(true);
    expect(isShedEligible({ status: "paying", promotion_source: "paid", entity_type: null })).toBe(true);
    for (const src of ["trial", "manual", "gift_trial", "center", null]) {
      expect(isShedEligible({ status: "paying", promotion_source: src, entity_type: "therapist" }), String(src)).toBe(false);
    }
    expect(isShedEligible({ status: "paying", promotion_source: "paid", entity_type: "center" })).toBe(false);
    expect(isShedEligible({ status: "approved", promotion_source: "paid", entity_type: "therapist" })).toBe(false);
  });
});

describe("applyLoadShedding", () => {
  it("removes the loaded paying therapist and keeps everyone else in the same order (the next one fills the list)", () => {
    const ranked = [row("a", 1), row("b", 9), row("c", 0), row("d", 2), row("e", 0), row("f", 0), row("g", 0), row("h", 0), row("i", 0), row("j", 0), row("k", 0)];
    const { kept, shed } = run(ranked);
    expect(shed.map((r) => r.id)).toEqual(["b"]);
    expect(kept.map((r) => r.id)).toEqual(["a", "c", "d", "e", "f", "g", "h", "i", "j", "k"]);
    expect(kept.slice(0, 10)).toHaveLength(10);
  });

  it("never reorders: the kept list is the ranked list minus the shed ones", () => {
    const ranked = [row("x", 7), row("y", 0), row("z", 6), row("w", 0), row("v", 0), row("u", 0), row("t", 0)];
    const { kept } = run(ranked);
    expect(kept.map((r) => r.id)).toEqual(["y", "w", "v", "u", "t"]);
  });

  it("sheds the most loaded first", () => {
    const ranked = [row("low", 4), row("high", 9), row("mid", 6), ...Array.from({ length: 8 }, (_, i) => row(`f${i}`, 0))];
    const { shed } = run(ranked);
    expect(shed.map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  it("leaves at least four results: with exactly four candidates nobody is removed", () => {
    const ranked = [row("a", 9), row("b", 9), row("c", 0), row("d", 0)];
    const { kept, shed } = run(ranked);
    expect(shed).toEqual([]);
    expect(kept).toHaveLength(4);
    expect(SHED_MIN_RESULTS).toBe(4);
  });

  it("with five candidates only one loaded therapist goes, the second would break the floor", () => {
    const ranked = [row("a", 9), row("b", 9), row("c", 0), row("d", 0), row("e", 0)];
    const { kept, shed } = run(ranked);
    expect(shed.map((r) => r.id)).toEqual(["a"]);
    expect(kept).toHaveLength(4);
  });

  it("keeps at least four in the requested area when a location was asked for", () => {
    // 4 in area (one loaded) + 6 outside: removing the loaded one leaves 3 in area, so she stays.
    const ranked = [row("a", 9), row("b", 0), row("c", 0), row("d", 0), ...Array.from({ length: 6 }, (_, i) => row(`o${i}`, 0, { area: false }))];
    expect(run(ranked, { location: true }).shed).toEqual([]);
    // Without a location the area floor does not apply.
    expect(run(ranked, { location: false }).shed.map((r) => r.id)).toEqual(["a"]);
    // With 5 in area she can go.
    const five = [row("a", 9), row("b", 0), row("c", 0), row("d", 0), row("e", 0), ...Array.from({ length: 5 }, (_, i) => row(`o${i}`, 0, { area: false }))];
    expect(run(five, { location: true }).shed.map((r) => r.id)).toEqual(["a"]);
  });

  it("only touches who would have been shown: a loaded therapist beyond the limit is not shed (and stays in the list)", () => {
    const ranked = [...Array.from({ length: 10 }, (_, i) => row(`f${i}`, 0)), row("late", 9)];
    const { kept, shed } = run(ranked, { limit: 10 });
    expect(shed).toEqual([]);
    expect(kept).toHaveLength(11);
  });

  it("ignores gift promotions, centres and free fallbacks however loaded", () => {
    const ranked = [row("gift", 9, { paid: false }), row("p", 0), row("q", 0), row("r", 0), row("s", 0)];
    expect(run(ranked).shed).toEqual([]);
  });

  it("is graded: at 4 people the draw decides, at 6 it does not", () => {
    const four = [row("a", 4), row("b", 0), row("c", 0), row("d", 0), row("e", 0)];
    expect(run(four, { random: () => 0.9 }).shed).toEqual([]);
    expect(run(four, { random: () => 0.1 }).shed.map((r) => r.id)).toEqual(["a"]);
    const six = [row("a", 6), row("b", 0), row("c", 0), row("d", 0), row("e", 0)];
    expect(run(six, { random: () => 0.999 }).shed.map((r) => r.id)).toEqual(["a"]);
  });

  it("does nothing on an empty or unloaded list", () => {
    expect(run([])).toEqual({ kept: [], shed: [] });
    const calm = [row("a", 3), row("b", 2), row("c", 0), row("d", 0), row("e", 0)];
    expect(run(calm).shed).toEqual([]);
  });
});

describe("/api/match wires the shedding without touching the ranking", () => {
  const src = readFileSync("app/api/match/route.ts", "utf8");

  it("sheds after the sort and before the slice, from the kept list", () => {
    const sortAt = src.indexOf("scored.sort((a, b) => {");
    const shedAt = src.indexOf("applyLoadShedding(scored, {");
    const sliceAt = src.indexOf("const top = shedding.kept.slice(0, input.limit);");
    expect(sortAt).toBeGreaterThan(0);
    expect(shedAt).toBeGreaterThan(sortAt);
    expect(sliceAt).toBeGreaterThan(shedAt);
    expect(src).not.toContain("const top = scored.slice(0, input.limit);");
  });

  it("the comparator is unchanged: area group, rank score, personality within 8, paying first, then the shuffle", () => {
    expect(src).toContain("if (a.result.inRequestedArea !== b.result.inRequestedArea) {");
    expect(src).toContain("if (Math.abs(profDiff) > 8) return profDiff;");
    expect(src).toContain("const rankDiff = commercialRank(a.therapist) - commercialRank(b.therapist);");
    expect(src).toMatch(/if \(t\.promotion_source === "paid"\) return 0;/);
  });

  it("only an adults search sheds (the kids quiz is excluded for now)", () => {
    expect(src).toContain("const adultsSearch = isAdultsSearch(input.ageGroups);");
    expect(src).toContain("eligible: (x) => adultsSearch && isShedEligible(x.therapist),");
  });

  it("a failed load lookup means no shedding, and the response and the event carry what was shed", () => {
    expect(src).toContain('supabaseAdmin.rpc("match_contact_load"');
    expect(src).toContain("load_shed: { count: shedding.shed.length }");
    expect(src).toContain('event_type: "match_load_shed"');
  });
});
