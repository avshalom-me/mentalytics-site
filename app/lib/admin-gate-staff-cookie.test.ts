import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { STAFF_COOKIE, staffCookieValue } from "./staff-cookie";

// The admin gate (middleware.ts) reads ADMIN_PASSWORD when it loads, so each
// test sets the environment first and imports a fresh copy. Everything here is
// a made-up value; nothing is a real credential.
const PASSWORD = "test-admin-password-not-real";
const TOKEN = "test-staff-code-not-a-real-secret";
const SITE = "https://www.mentalytics.co.il";

async function gate() {
  vi.resetModules();
  return (await import("../../middleware")).middleware;
}

const basic = (user: string, pass: string) => ({ authorization: `Basic ${btoa(`${user}:${pass}`)}` });
const get = (path: string, headers: Record<string, string> = {}) => new NextRequest(`${SITE}${path}`, { headers });

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("STAFF_BYPASS_TOKEN", TOKEN);
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

describe("the admin gate and the staff cookie", () => {
  it("marks a browser that passed the password check as a staff browser, for a year", async () => {
    const middleware = await gate();
    const res = await middleware(get("/admin/therapists", basic("admin", PASSWORD)));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(STAFF_COOKIE);
    expect(cookie?.value).toBe(await staffCookieValue(TOKEN));
    const header = res.headers.get("set-cookie") ?? "";
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toMatch(/Path=\//);
    expect(header).toMatch(/Max-Age=31536000/);
  });

  it("never puts the staff token itself in the cookie", async () => {
    const middleware = await gate();
    const res = await middleware(get("/admin", basic("admin", PASSWORD)));
    expect(res.headers.get("set-cookie") ?? "").not.toContain(TOKEN);
  });

  it("sets nothing for a wrong password, which is still refused", async () => {
    const middleware = await gate();
    const res = await middleware(get("/admin/therapists", basic("admin", "wrong")));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
    const none = await middleware(get("/admin/therapists"));
    expect(none.status).toBe(401);
    expect(none.headers.get("set-cookie")).toBeNull();
  });

  it("sets nothing on a cross-site write, which is still refused", async () => {
    const middleware = await gate();
    const res = await middleware(
      new NextRequest(`${SITE}/api/admin-therapists`, { method: "POST", headers: { ...basic("admin", PASSWORD), origin: "https://evil.example", host: "www.mentalytics.co.il" } }),
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("marks pages only: the calls a page makes do not set it again", async () => {
    const middleware = await gate();
    const res = await middleware(get("/api/admin-therapists", basic("admin", PASSWORD)));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("leaves the public site alone", async () => {
    const middleware = await gate();
    for (const path of ["/", "/adults", "/api/usage/check", "/api/track"]) {
      const res = await middleware(get(path, basic("admin", PASSWORD)));
      expect(res.headers.get("set-cookie"), path).toBeNull();
    }
  });

  it("marks nothing when the server has no staff token", async () => {
    vi.stubEnv("STAFF_BYPASS_TOKEN", "");
    const middleware = await gate();
    const res = await middleware(get("/admin/therapists", basic("admin", PASSWORD)));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("does not demand a secure cookie off the production site", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const middleware = await gate();
    const res = await middleware(get("/admin/therapists"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/Secure/i);
  });
});
