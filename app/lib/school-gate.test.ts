import { describe, it, expect } from "vitest";
import { decodeGrant, encodeGrant, grantExpiry, cookieValue, SCHOOL_COOKIE } from "./school-gate.server";

const KEY = "test-secret";
const g = { license_id: "11111111-1111-1111-1111-111111111111", school_id: "22222222-2222-2222-2222-222222222222", exp: 1_900_000_000 };

describe("school gate cookie", () => {
  it("round-trips a grant and rejects a tampered one", () => {
    const v = encodeGrant(g, KEY);
    expect(decodeGrant(v, 1_800_000_000_000, KEY)).toEqual(g);
    const tampered = v.replace(g.school_id, "33333333-3333-3333-3333-333333333333");
    expect(decodeGrant(tampered, 1_800_000_000_000, KEY)).toBeNull();
    expect(decodeGrant(v, 1_800_000_000_000, "other-secret")).toBeNull();
  });
  it("expires with the licence", () => {
    const v = encodeGrant(g, KEY);
    expect(decodeGrant(v, (g.exp + 1) * 1000, KEY)).toBeNull();
  });
  it("ignores garbage", () => {
    expect(decodeGrant("", 0, KEY)).toBeNull();
    expect(decodeGrant("a.b", 0, KEY)).toBeNull();
    expect(decodeGrant("a.b.c.d", 0, KEY)).toBeNull();
  });
  it("the cookie lives one day past 31 August, Israel time", () => {
    const exp = grantExpiry("2027-08-31");
    expect(new Date(exp * 1000).toISOString()).toBe("2027-09-01T20:59:59.000Z");
  });
  it("reads its cookie out of the header", () => {
    const req = { headers: { get: (n: string) => (n === "cookie" ? `a=1; ${SCHOOL_COOKIE}=x.y.z.w; b=2` : null) } };
    expect(cookieValue(req, SCHOOL_COOKIE)).toBe("x.y.z.w");
    expect(cookieValue(req, "nope")).toBeNull();
  });
});
