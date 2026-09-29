import { describe, it, expect } from "vitest";
import { daysCounted, weekStartMs } from "./seo-week";

const at = (iso: string) => Date.parse(iso);

// 30/9/2026 00:07 in Israel (UTC+3) is 29/9 21:07 UTC: 1.88 days into the week
// that began Monday 28/9 00:00 UTC. The label said 3/7.
describe("how many days of the running week the chart says it counted", () => {
  it("counts from the RPC's week start (Monday 00:00 UTC), not from local midnight", () => {
    expect(weekStartMs("2026-09-28")).toBe(at("2026-09-28T00:00:00Z"));
    expect(daysCounted("2026-09-28", at("2026-09-29T21:07:00Z"))).toBe(2);
  });

  it("the boundary between two counted days is 03:00 in Israel in summer, not midnight", () => {
    // 29/9 23:59 UTC (= 30/9 02:59 IL) is still day 2; 00:00 UTC (= 03:00 IL) starts day 3.
    expect(daysCounted("2026-09-28", at("2026-09-29T23:59:59Z"))).toBe(2);
    expect(daysCounted("2026-09-28", at("2026-09-30T00:00:01Z"))).toBe(3);
  });

  it("is 1 during the first day and never below 1", () => {
    expect(daysCounted("2026-09-28", at("2026-09-28T00:30:00Z"))).toBe(1);
    expect(daysCounted("2026-09-28", at("2026-09-27T10:00:00Z"))).toBe(1);
  });

  it("stops at 7", () => {
    expect(daysCounted("2026-09-28", at("2026-10-04T23:00:00Z"))).toBe(7);
    expect(daysCounted("2026-09-28", at("2026-10-12T12:00:00Z"))).toBe(7);
  });

  it("falls back to 1 for an unreadable week", () => {
    expect(daysCounted("not a date", at("2026-09-29T21:07:00Z"))).toBe(1);
  });
});
