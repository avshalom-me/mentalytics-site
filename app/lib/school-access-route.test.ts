import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The access-code route limits guesses, not logins. Until 27/10/2026 every
// attempt counted, successful ones too, so an office behind one address (a
// municipality's counsellors, a school's staff) was locked out after twenty
// people typed a correct code, and a valid code was refused all day.
const m = vi.hoisted(() => ({
  hasRoom: vi.fn(),
  bump: vi.fn(),
  verify: vi.fn(),
  usable: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "בית ספר לדוגמה" } }) }) }) }) },
}));
vi.mock("@/app/lib/daily-cap", () => ({ dailyCapHasRoom: m.hasRoom, underDailyCap: m.bump }));
vi.mock("@/app/lib/usage", () => ({ getIp: () => "10.0.0.1" }));
vi.mock("@/app/lib/schools-crm.server", () => ({ verifyAccessCode: m.verify, licenseStillUsable: m.usable }));

import { POST } from "@/app/api/school-access/route";

process.env.CRON_SECRET = "test-gate-secret";

const post = (code: string) =>
  POST(new NextRequest("http://localhost/api/school-access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }));

const grant = { school_id: "school-1", license_id: "lic-1", end_date: "2027-08-31", is_demo: false };

beforeEach(() => {
  m.hasRoom.mockReset().mockResolvedValue(true);
  m.bump.mockReset().mockResolvedValue(true);
  m.verify.mockReset().mockResolvedValue(null);
});

describe("/api/school-access POST", () => {
  it("a correct code is let in and does not use up the failure allowance", async () => {
    m.verify.mockResolvedValue(grant);
    const res = await post("ABCD-2345");
    expect(res.status).toBe(200);
    expect(m.bump).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toContain("mnt_school=");
  });

  it("a wrong code is refused with one uniform message and counted", async () => {
    const res = await post("ABCD-2345");
    expect(res.status).toBe(403);
    expect(m.bump).toHaveBeenCalledWith("school_code_fail:10.0.0.1", 20);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("an address that already failed twenty times is refused before the code is even checked", async () => {
    m.hasRoom.mockResolvedValue(false);
    m.verify.mockResolvedValue(grant);
    const res = await post("ABCD-2345");
    expect(res.status).toBe(429);
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.bump).not.toHaveBeenCalled();
  });

  it("asks for a code before counting anything", async () => {
    const res = await post("  ");
    expect(res.status).toBe(400);
    expect(m.hasRoom).not.toHaveBeenCalled();
    expect(m.bump).not.toHaveBeenCalled();
  });
});
