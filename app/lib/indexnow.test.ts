import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { INDEXNOW_HOST, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION, changedWithin, onHost } from "./indexnow";

const root = process.cwd();
const HOUR = 3_600_000;
const at = (iso: string) => new Date(iso).getTime();

describe("the IndexNow key", () => {
  it("is published where the engines will look for it, and says only itself", () => {
    const file = path.join(root, "public", `${INDEXNOW_KEY}.txt`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8").trim()).toBe(INDEXNOW_KEY);
    expect(INDEXNOW_KEY_LOCATION).toBe(`https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`);
  });

  it("has the shape the protocol accepts", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9-]{8,128}$/);
  });

  it("has a daily cron", () => {
    const crons: { path: string; schedule: string }[] = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")).crons;
    expect(crons.some((c) => c.path === "/api/cron/indexnow")).toBe(true);
  });
});

describe("changedWithin", () => {
  const base = `https://${INDEXNOW_HOST}`;
  // The cron's own hour: 23:50 UTC, looking back 26 hours.
  const now = at("2026-10-13T23:50:00Z");

  it("sends a page dated today once: tonight, and not again tomorrow night", () => {
    const entries = [{ url: `${base}/therapists/city/x`, lastModified: new Date("2026-10-13") }];
    expect(changedWithin(entries, 26, now)).toEqual([`${base}/therapists/city/x`]);
    expect(changedWithin(entries, 26, now + 24 * HOUR)).toEqual([]);
  });

  it("includes a date that is still slightly ahead, and a timestamp from the last day", () => {
    const entries = [
      { url: `${base}/a`, lastModified: "2026-10-14" },
      { url: `${base}/b`, lastModified: "2026-10-13T09:30:00Z" },
      { url: `${base}/old`, lastModified: "2026-10-05" },
    ];
    expect(changedWithin(entries, 26, now)).toEqual([`${base}/a`, `${base}/b`]);
  });

  it("leaves out entries with no lastmod, other hosts and repeats", () => {
    const entries = [
      { url: `${base}/no-date` },
      { url: "https://example.com/x", lastModified: "2026-10-13" },
      { url: `${base}/a`, lastModified: "2026-10-13" },
      { url: `${base}/a`, lastModified: "2026-10-13" },
    ];
    expect(changedWithin(entries, 26, now)).toEqual([`${base}/a`]);
  });
});

describe("onHost", () => {
  it("accepts the site's own addresses only", () => {
    expect(onHost(`https://${INDEXNOW_HOST}`)).toBe(true);
    expect(onHost(`https://${INDEXNOW_HOST}/therapists`)).toBe(true);
    expect(onHost("https://mentalytics.co.il/therapists")).toBe(false);
    expect(onHost(`https://${INDEXNOW_HOST}.evil.example/`)).toBe(false);
  });
});
