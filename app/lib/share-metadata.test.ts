import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ogImage, shareMetadata, OG_FALLBACK_IMAGE } from "./share-metadata";

describe("ogImage", () => {
  it("re-requests an Unsplash photo at the 1200x630 share size, keeping its other params", () => {
    const img = ogImage("https://images.unsplash.com/photo-1?ixid=abc&w=600&h=260&fit=crop&q=75", "alt");
    const u = new URL(img.url);
    expect(u.searchParams.get("w")).toBe("1200");
    expect(u.searchParams.get("h")).toBe("630");
    expect(u.searchParams.get("ixid")).toBe("abc");
    expect(img).toMatchObject({ width: 1200, height: 630, alt: "alt" });
  });
  it("uses any other image as-is, absolute, without claiming a size", () => {
    expect(ogImage("https://example.com/a.jpg")).toEqual({ url: "https://example.com/a.jpg", alt: undefined });
    expect(ogImage("/articles/x.png").url).toBe("https://www.mentalytics.co.il/articles/x.png");
  });
});

describe("shareMetadata", () => {
  it("points og:url at the page itself and falls back to the branded card", () => {
    const m = shareMetadata({ url: "/research/faq", title: "t", description: "d" });
    expect(m.openGraph).toMatchObject({
      url: "https://www.mentalytics.co.il/research/faq",
      title: "t",
      description: "d",
      images: [OG_FALLBACK_IMAGE],
    });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: [OG_FALLBACK_IMAGE.url] });
  });
  it("treats an empty DB image as no image", () => {
    const m = shareMetadata({ url: "https://www.mentalytics.co.il/x", title: "t", description: "d", image: "" });
    expect(m.openGraph).toMatchObject({ url: "https://www.mentalytics.co.il/x", images: [OG_FALLBACK_IMAGE] });
  });
});

// Next.js replaces a page's openGraph block wholesale, so a page that forgets
// its own falls back to the root layout's default - which is why that default
// must hold nothing page-specific (see app/layout.tsx).

describe("share metadata coverage", () => {
  it("every /research page sets its own, via shareMetadata() in the page or its layout", () => {
    const missing: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else if (e.name === "page.tsx") {
          const layout = join(dir, "layout.tsx");
          const src = readFileSync(join(dir, e.name), "utf8") + (existsSync(layout) ? readFileSync(layout, "utf8") : "");
          if (!src.includes("shareMetadata(")) missing.push(dir);
        }
      }
    };
    walk(join("app", "research"));
    expect(missing).toEqual([]);
  });

  it("the root layout's default openGraph carries no url, title or description", () => {
    const src = readFileSync(join("app", "layout.tsx"), "utf8");
    const block = src.match(/\n  openGraph: \{([\s\S]*?)\n  \},/)?.[1];
    expect(block, "openGraph block not found in app/layout.tsx").toBeDefined();
    expect(block).not.toMatch(/^\s*(url|title|description)\s*:/m);
  });
});
