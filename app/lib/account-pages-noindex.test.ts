import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The login pages, the two dashboards and the checkout are account pages, not
// pages for search. Until 13/10/2026 none of them declared noindex (robots.ts
// blocks only /admin and /api), and /centers/login was earning impressions in
// Search Console. The pages themselves are client components, so the
// declaration lives in a layout above each - which this test pins, because
// nothing in the running site shows when it is missing.
const NOINDEX_LAYOUTS = [
  "app/centers/login/layout.tsx",
  "app/centers/dashboard/layout.tsx",
  "app/therapists/login/layout.tsx",
  "app/therapists/dashboard/layout.tsx",
  "app/therapists/checkout/layout.tsx",
];

describe("account pages stay out of the index", () => {
  it("every account layout declares noindex", () => {
    for (const file of NOINDEX_LAYOUTS) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });

  it("the pages under them are client components, which cannot declare it themselves", () => {
    for (const file of [
      "app/centers/login/page.tsx",
      "app/centers/dashboard/page.tsx",
      "app/therapists/login/page.tsx",
      "app/therapists/dashboard/page.tsx",
      "app/therapists/checkout/page.tsx",
    ]) {
      expect(readFileSync(file, "utf8"), file).toMatch(/^\s*["']use client["']/m);
    }
  });
});
