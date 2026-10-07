import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// /api/track-click is the only writer of a contact click, and the browser throws
// away whatever it answers (.catch(() => {})). So a mistake here is silent: the
// clicks just stop, and a therapist with no recorded contact reads as owed a
// refund. These tests run the real route against a stand-in for the database.
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  insert: vi.fn(),
  /** what the route's two analytics_events look-ups answer, in the order asked */
  lookups: [] as unknown[],
}));

vi.mock("@/app/lib/supabaseAdmin", () => {
  // select().eq().not().order().limit().maybeSingle()
  const lookup = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "not", "order", "limit"]) chain[method] = () => chain;
    chain.maybeSingle = async () => ({ data: h.lookups.shift() ?? null, error: null });
    return chain;
  };
  return {
    supabaseAdmin: {
      from: (table: string) =>
        table === "analytics_events" ? lookup() : { insert: (row: unknown) => h.insert(table, row) },
      rpc: (...args: unknown[]) => h.rpc(...args),
    },
  };
});

import { POST } from "@/app/api/track-click/route";

// Invented ids and generic public User-Agent formats; nobody's real data.
const THERAPIST = "11111111-2222-4333-8444-555555555555";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// The route keeps a per-address request counter in memory; every request here
// comes from its own address so the counter never decides a test.
let request = 0;
async function post(body: unknown, headers: Record<string, string | null> = {}) {
  request++;
  const all: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": DESKTOP,
    "x-forwarded-for": `10.1.${Math.floor(request / 200)}.${(request % 200) + 1}`,
  };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete all[name];
    else all[name] = value;
  }
  const res = await POST(
    new NextRequest("http://localhost/api/track-click", { method: "POST", headers: all, body: JSON.stringify(body) }),
  );
  return { status: res.status, body: await res.json() };
}

/** a click that already carries its campaign and referrer, so no look-up runs */
const click = (over: Record<string, unknown> = {}) => ({
  therapist_id: THERAPIST,
  click_type: "phone",
  source: "profile",
  session_id: "visit-1",
  automation: false,
  channel: "google_paid",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "g-test",
  referrer_host: "google.com",
  ...over,
});

const ROW = {
  therapist_id: THERAPIST,
  click_type: "phone",
  source: "profile",
  session_id: "visit-1",
  channel: "google_paid",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "g-test",
  referrer_host: "google.com",
  device: "desktop",
  automated: false,
};

/** the arguments record_contact_click declares, read from the newest migration that defines it */
function declaredArguments(): string[] {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  let found: string[] | null = null;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(path.join(dir, file), "utf8");
    const m = sql.match(/create or replace function public\.record_contact_click\(([\s\S]*?)\)\s*returns/i);
    if (m) found = [...m[1].matchAll(/\b(p_[a-z_]+)\b/g)].map((x) => x[1]);
  }
  if (!found) throw new Error("no migration defines record_contact_click");
  return found;
}

beforeEach(() => {
  h.rpc.mockReset();
  h.insert.mockReset();
  h.lookups = [];
  h.rpc.mockResolvedValue({ data: true, error: null });
  h.insert.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("/api/track-click: a click goes through the database function", () => {
  it("hands the function the whole row and the two-minute window", async () => {
    expect(await post(click())).toEqual({ status: 200, body: { ok: true } });
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith("record_contact_click", {
      p_therapist_id: THERAPIST,
      p_click_type: "phone",
      p_source: "profile",
      p_session_id: "visit-1",
      p_channel: "google_paid",
      p_utm_source: "google",
      p_utm_medium: "cpc",
      p_utm_campaign: "g-test",
      p_referrer_host: "google.com",
      p_device: "desktop",
      p_automated: false,
      p_window_seconds: 120,
    });
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("says so when the function skipped the click as a repeat", async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    expect(await post(click())).toEqual({ status: 200, body: { ok: true, deduped: true } });
    expect(h.insert).not.toHaveBeenCalled();
  });

  // PostgREST finds a function by the NAMES of the arguments it is sent. Rename
  // one in SQL, or let one arrive here as undefined (JSON drops it), and the
  // function is "not found" for every click.
  it("sends exactly the arguments the function declares, even for the barest click", async () => {
    await post({ therapist_id: THERAPIST, click_type: "whatsapp" });
    const sent = h.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(declaredArguments().sort());
    // what actually travels: nothing may fall out of the JSON
    expect(Object.keys(JSON.parse(JSON.stringify(sent))).sort()).toEqual(declaredArguments().sort());
    expect(sent).toMatchObject({
      p_source: "directory",
      p_session_id: null,
      p_channel: null,
      p_utm_campaign: null,
      p_referrer_host: null,
      p_device: "desktop",
      p_automated: null,
    });
  });

  it("records the device and the browser's own automation report", async () => {
    await post(click({ automation: true }), { "user-agent": IPHONE });
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_device: "mobile", p_automated: true });
  });

  it("still restores a lost campaign and referrer from the visit's own events", async () => {
    h.lookups = [
      { channel: "google_paid", utm_source: "google", utm_medium: "cpc", utm_campaign: "g-test" },
      { referrer_host: "google.com" },
    ];
    await post(click({ utm_source: null, utm_medium: null, utm_campaign: null, referrer_host: null }));
    expect(h.rpc.mock.calls[0][1]).toMatchObject({
      p_channel: "google_paid",
      p_utm_source: "google",
      p_utm_medium: "cpc",
      p_utm_campaign: "g-test",
      p_referrer_host: "google.com",
    });
  });
});

describe("/api/track-click: when the function itself cannot be used", () => {
  // dropped or an argument renamed / an overload added / undefined / grant lost
  it.each(["PGRST202", "PGRST203", "42883", "42501"])(
    "stores the click the plain way instead of losing it (%s)",
    async (code) => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      h.rpc.mockResolvedValue({ data: null, error: { code, message: "the function cannot be used" } });
      expect(await post(click())).toEqual({ status: 200, body: { ok: true } });
      expect(h.insert).toHaveBeenCalledTimes(1);
      expect(h.insert).toHaveBeenCalledWith("therapist_contact_clicks", ROW);
      // the only trace that the repeat check is off
      expect(logged).toHaveBeenCalledTimes(1);
    },
  );

  it("reports the failure when the plain write fails too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    h.insert.mockResolvedValue({ error: { message: "insert failed" } });
    expect(await post(click())).toEqual({ status: 500, body: { ok: false, error: "insert failed" } });
  });

  // a click that is itself bad fails the plain way too, so there is nothing to save
  it.each(["23503", "22P02", "23514"])("does not retry a click the database rejected (%s)", async (code) => {
    h.rpc.mockResolvedValue({ data: null, error: { code, message: "rejected" } });
    expect(await post(click())).toEqual({ status: 500, body: { ok: false, error: "rejected" } });
    expect(h.insert).not.toHaveBeenCalled();
  });

  // after a network error nobody knows whether the row was written; writing again could double it
  it("does not write again after an error with no code", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "fetch failed" } });
    expect((await post(click())).status).toBe(500);
    expect(h.insert).not.toHaveBeenCalled();
  });
});

describe("/api/track-click: what never reaches the database", () => {
  it("drops a declared bot and a request with no User-Agent", async () => {
    expect((await post(click(), { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" })).body).toEqual({
      ok: true,
      bot: true,
    });
    expect((await post(click(), { "user-agent": null })).body).toEqual({ ok: true, bot: true });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("rejects a click with no therapist or an unknown type", async () => {
    expect((await post(click({ therapist_id: "" }))).status).toBe(400);
    expect((await post(click({ click_type: "fax" }))).status).toBe(400);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
