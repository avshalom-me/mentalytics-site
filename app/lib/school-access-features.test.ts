import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// מה שהממשק של /school מקבל על היכולות של הרישיון (מצב "גפ״ן"), ומי רשאי לשנות
// אותן. הממשק רק מסתיר לפי זה; החסימה בשרת נבדקת ב-school-features.test.ts.
const m = vi.hoisted(() => ({
  usable: vi.fn(),
  flags: vi.fn(),
  setFeatures: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { name: "בית ספר לדוגמה" } }) }) }) }) },
}));
vi.mock("@/app/lib/daily-cap", () => ({ underDailyCap: async () => true }));
vi.mock("@/app/lib/usage", () => ({ getIp: () => "10.0.0.1" }));
vi.mock("@/app/lib/school-features.server", () => ({ licenseFeatureFlags: m.flags }));
vi.mock("@/app/lib/schools-crm.server", async () => {
  class SchoolsCrmError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  }
  const noop = vi.fn();
  return {
    SchoolsCrmError,
    isUuid: (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    licenseStillUsable: m.usable,
    verifyAccessCode: noop,
    setLicenseFeatures: m.setFeatures,
    autoMatchTransfers: noop,
    cancelLicense: noop,
    createLicense: noop,
    deleteLicense: noop,
    listLicenses: noop,
    listSchools: noop,
    markPaymentReceived: noop,
    matchTransfer: noop,
    proposeTransferMatches: noop,
    setLicenseCode: noop,
  };
});

import { GET } from "@/app/api/school-access/route";
import { licensesPost } from "@/app/lib/schools-api/licenses";
import { SCHOOL_COOKIE, encodeGrant } from "@/app/lib/school-gate.server";
import { ALL_FEATURES_ON } from "@/app/lib/schools-crm";

process.env.CRON_SECRET = "test-gate-secret";

const cookie = () => `${SCHOOL_COOKIE}=${encodeGrant({ license_id: "lic-1", school_id: "school-1", exp: Math.floor(Date.now() / 1000) + 3600 })}`;
const get = (withCookie: boolean) => GET(new NextRequest("http://localhost/api/school-access", { headers: withCookie ? { cookie: cookie() } : {} }));

beforeEach(() => {
  m.usable.mockReset().mockResolvedValue(true);
  m.flags.mockReset().mockResolvedValue(ALL_FEATURES_ON);
  m.setFeatures.mockReset().mockResolvedValue(undefined);
  delete process.env.SCHOOL_GATE_ON;
});

describe("GET /api/school-access: the features of the licence", () => {
  it("a browser without a licence sees everything on, and the licence table is not asked", async () => {
    const body = await (await get(false)).json();
    expect(body).toMatchObject({ ok: true, licensed: false, features: ALL_FEATURES_ON });
    expect(m.flags).not.toHaveBeenCalled();
  });

  it("a licensed school with nothing switched off sees everything on", async () => {
    const body = await (await get(true)).json();
    expect(body).toMatchObject({ licensed: true, features: { ai_explain: true, therapist_search: true } });
  });

  it("a Gefen licence reports both features off, so the screen hides the buttons", async () => {
    m.flags.mockResolvedValue({ ai_explain: false, therapist_search: false });
    const body = await (await get(true)).json();
    expect(body.features).toEqual({ ai_explain: false, therapist_search: false });
  });

  it("when the flags cannot be read the screen shows everything; the server is what refuses", async () => {
    m.flags.mockResolvedValue(null);
    expect((await (await get(true)).json()).features).toEqual(ALL_FEATURES_ON);
  });

  it("a licence that is no longer usable reports no licence and everything on", async () => {
    m.usable.mockResolvedValue(false);
    expect(await (await get(true)).json()).toMatchObject({ licensed: false, features: ALL_FEATURES_ON });
  });
});

describe("the features action of the licences admin API", () => {
  const LICENSE = "0b9d5b1e-6c3a-4c55-9c0a-1d2e3f4a5b6c";
  const owner = { role: "owner", name: "בעלים" } as const;
  const partner = { role: "partner", name: "שותפה" } as const;
  const call = (viewer: typeof owner | typeof partner, body: unknown) =>
    licensesPost(new NextRequest("http://localhost/api/admin-schools/licenses", { method: "POST", body: JSON.stringify(body) }), viewer);

  it("the owner switches features off for one licence, and only known features are stored", async () => {
    const res = await call(owner, { action: "features", license_id: LICENSE, disabled: ["therapist_search", "ai_explain", "ai_explain", "nonsense"] });
    expect(res.status).toBe(200);
    expect(m.setFeatures).toHaveBeenCalledWith(owner, LICENSE, ["ai_explain", "therapist_search"]);
  });

  it("an empty list opens everything again", async () => {
    await call(owner, { action: "features", license_id: LICENSE, disabled: [] });
    expect(m.setFeatures).toHaveBeenCalledWith(owner, LICENSE, []);
  });

  it("the partner cannot change what a licence may use: it is a product decision", async () => {
    const res = await call(partner, { action: "features", license_id: LICENSE, disabled: ["ai_explain"] });
    expect(res.status).toBe(403);
    expect(m.setFeatures).not.toHaveBeenCalled();
  });

  it("refuses a missing or malformed licence id", async () => {
    expect((await call(owner, { action: "features", disabled: [] })).status).toBe(400);
    expect((await call(owner, { action: "features", license_id: "x", disabled: [] })).status).toBe(400);
    expect(m.setFeatures).not.toHaveBeenCalled();
  });
});
