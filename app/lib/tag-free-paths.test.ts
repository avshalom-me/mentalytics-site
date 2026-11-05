import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { isTagFreePath, isTagFreeUrl } from "./tag-free-paths";

// The counsellors' questionnaire loads no third-party tag (see tag-free-paths.ts).
// The first block pins which paths that covers; the second keeps the guarantee
// from eroding: a tag added straight into a layout or a page, or a client-side
// <Link> into /school, would quietly bring Google or Taboola back.

describe("isTagFreePath", () => {
  it("covers /school and everything under it", () => {
    expect(isTagFreePath("/school")).toBe(true);
    expect(isTagFreePath("/school/")).toBe(true);
    expect(isTagFreePath("/school/pay/abc")).toBe(true);
  });

  it("leaves every other page alone, including look-alikes", () => {
    for (const p of ["/", "/kids", "/adults", "/counselors", "/counselors/supplier", "/schools", "/school-x", "/therapists"]) {
      expect(isTagFreePath(p), p).toBe(false);
    }
  });

  it("treats a missing pathname as an ordinary page", () => {
    expect(isTagFreePath(null)).toBe(false);
    expect(isTagFreePath(undefined)).toBe(false);
    expect(isTagFreePath("")).toBe(false);
  });
});

describe("isTagFreeUrl", () => {
  it("reads the path out of a full URL, ignoring query and hash", () => {
    expect(isTagFreeUrl("https://www.mentalytics.co.il/school?x=1#review=abc")).toBe(true);
    expect(isTagFreeUrl("https://www.mentalytics.co.il/school/pay/1")).toBe(true);
    expect(isTagFreeUrl("https://www.mentalytics.co.il/counselors?utm_source=x")).toBe(false);
    expect(isTagFreeUrl("https://www.mentalytics.co.il/")).toBe(false);
  });

  it("accepts a relative URL", () => {
    expect(isTagFreeUrl("/school")).toBe(true);
    expect(isTagFreeUrl("/kids")).toBe(false);
  });

  it("drops what it cannot parse rather than report it", () => {
    expect(isTagFreeUrl("http://[")).toBe(true);
  });
});

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("third-party tags are loaded only through ThirdPartyTags", () => {
  // Block comments and whole-line // comments only: a trailing // pattern would
  // also eat the "//www.googletagmanager.com" inside a URL string.
  const files = sourceFiles("app").map(
    (f) => [f, read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")] as const,
  );
  const OWNER = "app/components/ThirdPartyTags.tsx";

  it("no other file loads Google's tag, the Taboola pixel or Vercel Analytics", () => {
    const offenders = files
      .filter(([f]) => f !== OWNER)
      .filter(([, code]) => /googletagmanager\.com|cdn\.taboola\.com|tfa\.js|@vercel\/analytics/.test(code))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it("ThirdPartyTags asks the tag-free list before loading anything", () => {
    const code = read(OWNER);
    expect(code).toMatch(/isTagFreePath\(pathname\)/);
    expect(code).toMatch(/\{!tagFree && \(/);
    expect(code).toMatch(/beforeSend=\{dropTagFree\}/);
  });

  it("nothing links into /school with a client-side <Link>", () => {
    const offenders = files
      .filter(([, code]) => /<Link\b[^>]*?href=\{?["'`]\/school(?:["'`/?#])/.test(code))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });
});
