import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The staff clock-in page identifies a person by a 4-8 digit code alone. Until
// 13/10/2026 the only brake on guessing was 20 requests a minute per address,
// which puts a 4-digit code within hours. Now only FAILED codes count, five of
// them lock the address out for a quarter of an hour, and a site-wide budget
// of failures locks everyone out for an hour - while the people who type the
// right code keep clocking in as before.
const h = vi.hoisted(() => ({ pins: new Map<string, { id: string; full_name: string; active: boolean }>() }));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => {
  // A thenable query chain: every filter returns the chain; `maybeSingle` on
  // staff_members answers by the pin filter, everything else is empty.
  const chain = (table: string) => {
    const filters: Record<string, unknown> = {};
    const c: Record<string, unknown> = {};
    for (const method of ["select", "gte", "lt", "order", "limit", "is", "insert", "update", "delete", "throwOnError"]) c[method] = () => c;
    c.eq = (col: string, value: unknown) => {
      filters[col] = value;
      return c;
    };
    c.maybeSingle = async () => ({ data: table === "staff_members" ? (h.pins.get(String(filters.pin)) ?? null) : null, error: null });
    c.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return c;
  };
  return { supabaseAdmin: { from: chain } };
});

import { POST } from "@/app/api/staff-hours/route";
import { resetFailures } from "@/app/lib/failed-attempts";

function post(body: unknown, ip: string) {
  return POST(new NextRequest("http://localhost/api/staff-hours", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));
}

beforeEach(() => {
  resetFailures();
  h.pins.clear();
  // An invented employee; the code is a test value.
  h.pins.set("246810", { id: "s-1", full_name: "פלוני", active: true });
});

describe("/api/staff-hours", () => {
  it("answers a correct code, and the same address can keep using it", async () => {
    for (let i = 0; i < 6; i++) {
      const res = await post({ action: "status", pin: "246810" }, "10.5.0.1");
      expect(res.status).toBe(200);
    }
  });

  it("locks an address out after five wrong codes, without asking the database again", async () => {
    const ip = "10.5.0.2";
    for (let i = 0; i < 5; i++) expect((await post({ action: "status", pin: `000${i}` }, ip)).status).toBe(401);
    const sixth = await post({ action: "status", pin: "246810" }, ip);
    expect(sixth.status).toBe(429);
    // Another address is unaffected.
    expect((await post({ action: "status", pin: "246810" }, "10.5.0.3")).status).toBe(200);
  });

  it("a site-wide budget of wrong codes locks every address out for a while", async () => {
    // 30 failures from 30 different addresses (each below its own limit).
    for (let i = 0; i < 30; i++) expect((await post({ action: "status", pin: "0000" }, `10.4.1.${i + 1}`)).status).toBe(401);
    expect((await post({ action: "status", pin: "246810" }, "10.4.9.9")).status).toBe(429);
  });
});
