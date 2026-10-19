import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { STAFF_COOKIE, staffCookieValue } from "./staff-cookie";

// A staff browser - one that passed the admin gate and carries its cookie - must
// be able to open and finish the questionnaires however much its device id has
// used, and must not use anything up. A visitor must see no change at all.
// The database is a stand-in: quiz_usage says the device has used its eight free
// runs, and every call that would read or write it is counted. All values here
// are made up.
const db = vi.hoisted(() => ({
  usageRows: [] as { ip: string; count: number }[],
  reads: 0,
  rpc: vi.fn(async (_name: string, _args?: unknown) => ({ data: 1, error: null as null | { message: string } })),
}));
const research = vi.hoisted(() => ({ recordQuizScoring: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in"]) chain[method] = () => chain;
      chain.then = (resolve: (value: unknown) => unknown) => {
        db.reads++;
        return resolve(table === "quiz_usage" ? { data: db.usageRows } : { count: 0 });
      };
      return chain;
    },
    rpc: (name: string, args?: unknown) => db.rpc(name, args),
  }),
}));
vi.mock("@/app/lib/research-counts", () => ({ recordQuizScoring: research.recordQuizScoring }));
vi.mock("@/app/lib/school-review.server", () => ({ isActiveReviewToken: async () => false }));
// The school licence gate is a separate concern (school-score-route.test.ts);
// here no browser carries a licence, and the module must not open a client.
vi.mock("@/app/lib/schools-crm.server", () => ({ licenseStillUsable: async () => false, bumpSchoolUsage: async () => {} }));

import { GET as usageCheck } from "@/app/api/usage/check/route";
import { POST as adultsScore } from "@/app/api/questionnaire/adults/score/route";
import { POST as kidsScore } from "@/app/api/questionnaire/kids/score/route";
import { POST as schoolScore } from "@/app/api/questionnaire/school/score/route";

const TOKEN = "test-staff-code-not-a-real-secret";
const FP = "c".repeat(64);
const SITE = "https://www.mentalytics.co.il";

let n = 0;
const ip = () => `10.3.${Math.floor(++n / 200)}.${(n % 200) + 1}`;

async function staffHeaders(): Promise<Record<string, string>> {
  return { cookie: `${STAFF_COOKIE}=${await staffCookieValue(TOKEN)}` };
}

function check(headers: Record<string, string> = {}) {
  return usageCheck(new NextRequest(`${SITE}/api/usage/check?type=adults&fp=${FP}`, { headers: { "x-forwarded-for": ip(), ...headers } }));
}
function post(handler: (r: NextRequest) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) {
  return handler(
    new NextRequest(`${SITE}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip(), ...headers }, body: JSON.stringify(body) }),
  );
}
const consumed = () => db.rpc.mock.calls.filter(([name]) => name === "increment_quiz_usage").length;

beforeEach(() => {
  vi.stubEnv("STAFF_BYPASS_TOKEN", TOKEN);
  db.usageRows = [{ ip: `fp:${FP}`, count: 8 }];
  db.reads = 0;
  db.rpc.mockClear();
  research.recordQuizScoring.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("/api/usage/check", () => {
  it("tells a visitor whose free runs are used up that payment is required", async () => {
    const res = await check();
    expect(await res.json()).toEqual({ allowed: false, count: 8, paymentRequired: true });
  });

  it("opens the quiz for a staff browser without looking at the device's usage", async () => {
    const res = await check(await staffHeaders());
    expect(await res.json()).toEqual({ allowed: true, count: 0, paymentRequired: false, staff: true });
    expect(db.reads).toBe(0);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("treats a wrong or copied cookie as a visitor", async () => {
    for (const cookie of [`${STAFF_COOKIE}=0000`, `${STAFF_COOKIE}=${TOKEN}`, `${STAFF_COOKIE}=`]) {
      const body = await (await check({ cookie })).json();
      expect(body.allowed, cookie).toBe(false);
      expect(body.staff, cookie).toBeUndefined();
    }
  });

  it("treats every browser as a visitor while the server has no staff token", async () => {
    const headers = await staffHeaders();
    vi.stubEnv("STAFF_BYPASS_TOKEN", "");
    expect((await (await check(headers)).json()).allowed).toBe(false);
  });
});

describe("the score routes", () => {
  it("score an adults questionnaire for a staff browser with the free runs used up, and count nothing", async () => {
    const res = await post(adultsScore, "/api/questionnaire/adults/score", { domains: [], _fp: FP }, await staffHeaders());
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(consumed()).toBe(0);
    expect(research.recordQuizScoring).not.toHaveBeenCalled();
    expect(db.reads).toBe(0);
  });

  it("still ask a visitor in the same state for payment, and take no credit", async () => {
    const res = await post(adultsScore, "/api/questionnaire/adults/score", { domains: [], _fp: FP });
    expect(res.status).toBe(402);
    expect(consumed()).toBe(0);
  });

  it("keep accepting the code in the body, which the night watchdog and a ?staff= link send", async () => {
    const res = await post(adultsScore, "/api/questionnaire/adults/score", { domains: [], _fp: FP, _staffToken: TOKEN });
    expect(res.status).toBe(200);
    expect(consumed()).toBe(0);
  });

  it("score a kids questionnaire for a staff browser, and ask a visitor for payment", async () => {
    db.usageRows = [{ ip: `fp:${FP}`, count: 8 }];
    const staff = await post(kidsScore, "/api/questionnaire/kids/score", { _fp: FP }, await staffHeaders());
    expect(staff.status).toBe(200);
    expect(consumed()).toBe(0);
    const visitor = await post(kidsScore, "/api/questionnaire/kids/score", { _fp: FP });
    expect(visitor.status).toBe(402);
  });

  it("do not hold a staff browser to the parents' free runs on the counsellor rubric", async () => {
    const staff = await post(schoolScore, "/api/questionnaire/school/score", { _fp: FP }, await staffHeaders());
    expect(staff.status).toBe(200);
    expect(db.reads).toBe(0);
    const visitor = await post(schoolScore, "/api/questionnaire/school/score", { _fp: FP });
    expect(visitor.status).toBe(402);
  });
});
