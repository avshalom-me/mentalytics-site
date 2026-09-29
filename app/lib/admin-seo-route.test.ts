import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  rows: [] as { key: string; data: unknown; computed_at: string }[],
}));

vi.mock("@/app/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ in: async () => ({ data: h.rows, error: null }) }) }),
    rpc: (...args: unknown[]) => h.rpc(...args),
  },
}));

import { GET } from "@/app/api/admin-seo/route";

const NOW = Date.parse("2026-09-29T12:00:00Z");
const HOUR = 3_600_000;
const iso = (agoMs: number) => new Date(NOW - agoMs).toISOString();

const week = (w: string, demand: number) => ({ week: w, demand, home: 0, name: 0, recruit: 0, other: 0 });
const copyRows = (agoMs: number) => [
  { key: "seo_overview:90", data: { weekly: [week("2026-09-21", 182)] }, computed_at: iso(agoMs) },
  { key: "ai_weekly:90", data: { weekly: [{ week: "2026-09-21", ai: 27 }], window_sessions: 27, by_assistant: [] }, computed_at: iso(agoMs) },
];
const liveResult = (name: string) => {
  if (name === "admin_seo_overview") return { data: { weekly: [week("2026-09-21", 182), week("2026-09-28", 35)] }, error: null };
  return { data: { weekly: [{ week: "2026-09-28", ai: 1 }], window_sessions: 1, by_assistant: [] }, error: null };
};

async function get(query = "days=90") {
  const res = await GET(new NextRequest(`http://localhost/api/admin-seo?${query}`));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  h.rpc.mockReset();
  h.rows = [];
});
afterEach(() => vi.useRealTimers());

// 28-29/9/2026: the night's refresh died with the database, and the page went
// on serving Monday's copy - which had no row for the new week - as if it were
// current. These are the branches that decide what the owner sees.
describe("/api/admin-seo: which numbers the page gets", () => {
  it("serves a fresh copy without touching the heavy calculation", async () => {
    h.rows = copyRows(3 * HOUR);
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(body.data.computed_at).toBe(iso(3 * HOUR));
    expect(body.data.stale).toBe(false);
    expect(body.data.weekly.at(-1)).toMatchObject({ week: "2026-09-21", demand: 182, ai: 27 });
  });

  it("computes live when the copy is old, and the newest week shows up", async () => {
    h.rows = copyRows(32 * HOUR);
    h.rpc.mockImplementation(async (name: string) => liveResult(name));
    const { body } = await get();
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(body.data.computed_at).toBeNull();
    expect(body.data.stale).toBe(false);
    expect(body.data.weekly.at(-1)).toMatchObject({ week: "2026-09-28", demand: 35, ai: 1 });
  });

  it("falls back to the old copy, marked stale, when the live calculation fails too", async () => {
    h.rows = copyRows(32 * HOUR);
    h.rpc.mockResolvedValue({ data: null, error: new Error("canceling statement due to statement timeout") });
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body.data.stale).toBe(true);
    expect(body.data.computed_at).toBe(iso(32 * HOUR));
    expect(body.data.weekly.at(-1)).toMatchObject({ week: "2026-09-21", demand: 182 });
  });

  it("is an error only when there is no copy at all and the calculation fails", async () => {
    h.rpc.mockResolvedValue({ data: null, error: new Error("statement timeout") });
    const { status, body } = await get();
    expect(status).toBe(500);
    expect(body.ok).toBe(false);
  });

  it("?live=1 ignores the copy, and a failure is visible instead of quietly served stale", async () => {
    h.rows = copyRows(1 * HOUR);
    h.rpc.mockResolvedValue({ data: null, error: new Error("statement timeout") });
    const { status } = await get("days=90&live=1");
    expect(status).toBe(500);
    h.rpc.mockImplementation(async (name: string) => liveResult(name));
    const ok = await get("days=90&live=1");
    expect(ok.status).toBe(200);
    expect(ok.body.data.computed_at).toBeNull();
  });
});
