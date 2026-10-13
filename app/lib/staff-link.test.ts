import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STAFF_LINK_PARAM, STAFF_TOKEN_KEY, staffLinkBootScript } from "./staff-link";
import { TRACKING_OPTOUT_KEY } from "./track-optout";

// The script runs in the browser before any module code, so it is evaluated
// here with the three globals it touches stubbed (URL is Node's own).
function boot(href: string, opts: { storageThrows?: boolean } = {}) {
  const stored = new Map<string, string>();
  const replaced: string[] = [];
  const run = new Function("location", "localStorage", "history", staffLinkBootScript());
  run(
    { href },
    {
      setItem: (k: string, v: string) => {
        if (opts.storageThrows) throw new Error("blocked");
        stored.set(k, v);
      },
    },
    { state: { from: "test" }, replaceState: (_s: unknown, _t: string, url: string) => replaced.push(url) },
  );
  return { stored, replaced };
}

const FAKE = "test-staff-code-not-a-real-secret";

describe("staffLinkBootScript", () => {
  it("moves the code from the address into storage, switches measurement off, and rewrites the address", () => {
    const { stored, replaced } = boot(`https://www.mentalytics.co.il/adults?${STAFF_LINK_PARAM}=${FAKE}`);
    expect(stored.get(STAFF_TOKEN_KEY)).toBe(FAKE);
    expect(stored.get(TRACKING_OPTOUT_KEY)).toBe("1");
    expect(replaced).toEqual(["/adults"]);
  });

  it("keeps every other parameter and the fragment", () => {
    const { replaced } = boot(`https://www.mentalytics.co.il/kids?utm_source=x&${STAFF_LINK_PARAM}=${FAKE}&y=1#top`);
    expect(replaced).toEqual(["/kids?utm_source=x&y=1#top"]);
  });

  it("touches nothing on an ordinary visit", () => {
    const { stored, replaced } = boot("https://www.mentalytics.co.il/adults?utm_source=google");
    expect(stored.size).toBe(0);
    expect(replaced).toEqual([]);
  });

  it("leaves the address alone when storage is blocked, so the page's own fallback can still read it", () => {
    expect(() => boot(`https://www.mentalytics.co.il/adults?${STAFF_LINK_PARAM}=${FAKE}`, { storageThrows: true })).not.toThrow();
    const { replaced } = boot(`https://www.mentalytics.co.il/adults?${STAFF_LINK_PARAM}=${FAKE}`, { storageThrows: true });
    expect(replaced).toEqual([]);
  });

  it("can be inlined in a script tag", () => {
    expect(staffLinkBootScript()).not.toContain("</script");
  });
});

describe("the quiz pages and the script agree", () => {
  it("both quiz layouts run the script, so it precedes the analytics tags", () => {
    for (const file of ["app/adults/layout.tsx", "app/kids/layout.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain("staffLinkBootScript()");
    }
  });

  it("the quiz pages read the code from the key the script writes", () => {
    for (const file of ["app/adults/page.tsx", "app/kids/KidsQuiz.tsx"]) {
      expect(readFileSync(file, "utf8"), file).toContain(`localStorage.getItem(${JSON.stringify(STAFF_TOKEN_KEY)})`);
    }
  });
});
