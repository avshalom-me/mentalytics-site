import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => ({ supabaseAdmin: { rpc: h.rpc } }));
vi.mock("./supabaseAdmin", () => ({ supabaseAdmin: { rpc: h.rpc } }));

import { underDailyCap } from "./daily-cap";

beforeEach(() => h.rpc.mockReset());

describe("underDailyCap", () => {
  it("allows the call while the day's count is within the cap, and refuses past it", async () => {
    h.rpc.mockResolvedValueOnce({ data: 200, error: null });
    expect(await underDailyCap("explain_match", 200)).toBe(true);
    h.rpc.mockResolvedValueOnce({ data: 201, error: null });
    expect(await underDailyCap("explain_match", 200)).toBe(false);
    expect(h.rpc).toHaveBeenCalledWith("bump_daily_counter", { p_key: "explain_match" });
  });

  it("fails open on a database error, and never asks when the cap is off", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await underDailyCap("explain_match", 200)).toBe(true);
    warn.mockRestore();
    h.rpc.mockClear();
    expect(await underDailyCap("explain_match", 0)).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
