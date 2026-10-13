import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lockedOut, recordFailure, resetFailures } from "./failed-attempts";

afterEach(() => {
  resetFailures();
  vi.useRealTimers();
});

describe("failed attempts", () => {
  it("locks a key out only once it has failed `limit` times in the window", () => {
    for (let i = 0; i < 4; i++) recordFailure("pin", "ip-a", 60_000);
    expect(lockedOut("pin", "ip-a", 5)).toBe(false);
    recordFailure("pin", "ip-a", 60_000);
    expect(lockedOut("pin", "ip-a", 5)).toBe(true);
    // Another key, another counter.
    expect(lockedOut("pin", "ip-b", 5)).toBe(false);
  });

  it("forgets the failures when the window ends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    for (let i = 0; i < 5; i++) recordFailure("pin", "ip-a", 60_000);
    expect(lockedOut("pin", "ip-a", 5)).toBe(true);
    vi.setSystemTime(new Date("2026-10-13T10:01:01Z"));
    expect(lockedOut("pin", "ip-a", 5)).toBe(false);
    expect(recordFailure("pin", "ip-a", 60_000)).toBe(1);
  });

  it("keeps separate counters per name, so a global budget and a per-address one coexist", () => {
    recordFailure("pin-all", "all", 60_000);
    recordFailure("pin", "ip-a", 60_000);
    expect(lockedOut("pin-all", "all", 1)).toBe(true);
    expect(lockedOut("pin", "ip-a", 1)).toBe(true);
    expect(lockedOut("pin", "all", 1)).toBe(false);
  });
});
