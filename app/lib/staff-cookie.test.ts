import { afterEach, describe, expect, it, vi } from "vitest";
import { STAFF_COOKIE, STAFF_COOKIE_MAX_AGE_SECONDS, constantTimeEqual, hasStaffCookie, isStaffCookieValue, staffCookieValue } from "./staff-cookie";

// The values are made up; none of them is a real secret.
const FAKE = "test-staff-code-not-a-real-secret";

afterEach(() => vi.unstubAllEnvs());

describe("staffCookieValue", () => {
  it("is a 64-character hex HMAC, the same for the same token and different for another", async () => {
    const a = await staffCookieValue(FAKE);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await staffCookieValue(FAKE)).toBe(a);
    expect(await staffCookieValue(`${FAKE}-rotated`)).not.toBe(a);
  });

  it("never contains the token itself", async () => {
    expect(await staffCookieValue(FAKE)).not.toContain(FAKE);
  });

  it("is null when the server has no token, so no staff mode exists", async () => {
    expect(await staffCookieValue("")).toBeNull();
    expect(await staffCookieValue(undefined as unknown as string)).toBeNull();
  });

  it("reads the token from the environment when none is passed", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    expect(await staffCookieValue()).toBe(await staffCookieValue(FAKE));
    vi.stubEnv("STAFF_BYPASS_TOKEN", "");
    expect(await staffCookieValue()).toBeNull();
  });
});

describe("isStaffCookieValue", () => {
  it("accepts the value of the current token and nothing else", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    const good = (await staffCookieValue(FAKE))!;
    expect(await isStaffCookieValue(good)).toBe(true);
    expect(await isStaffCookieValue(good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(await isStaffCookieValue(good.slice(0, 63))).toBe(false);
    expect(await isStaffCookieValue("")).toBe(false);
    expect(await isStaffCookieValue(undefined)).toBe(false);
    expect(await isStaffCookieValue(null)).toBe(false);
    // The token itself is not the cookie.
    expect(await isStaffCookieValue(FAKE)).toBe(false);
  });

  it("stops working the moment the token is rotated", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    const old = (await staffCookieValue())!;
    vi.stubEnv("STAFF_BYPASS_TOKEN", `${FAKE}-rotated`);
    expect(await isStaffCookieValue(old)).toBe(false);
  });

  it("never opens anything when the server has no token, even for an empty or a copied value", async () => {
    const copied = (await staffCookieValue(FAKE))!;
    vi.stubEnv("STAFF_BYPASS_TOKEN", "");
    expect(await isStaffCookieValue(copied)).toBe(false);
    expect(await isStaffCookieValue("")).toBe(false);
  });
});

describe("hasStaffCookie", () => {
  const req = (value: string | undefined) => ({ cookies: { get: (name: string) => (name === STAFF_COOKIE && value !== undefined ? { value } : undefined) } });

  it("reads the cookie by its name", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", FAKE);
    expect(await hasStaffCookie(req((await staffCookieValue())!))).toBe(true);
    expect(await hasStaffCookie(req("not-the-value"))).toBe(false);
    expect(await hasStaffCookie(req(undefined))).toBe(false);
  });
});

describe("the cookie's settings", () => {
  it("lives for a year", () => {
    expect(STAFF_COOKIE_MAX_AGE_SECONDS).toBe(31_536_000);
  });
});

describe("constantTimeEqual", () => {
  it("compares whole strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
