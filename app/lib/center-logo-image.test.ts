import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { prepareCenterLogo, isLightOrClear } from "./center-logo-image";

// Centres upload logos with wide margins around them; on the centre page the
// margins only made the logo smaller (19/10/2026).

async function canvasWithMark(bg: { r: number; g: number; b: number; alpha: number }, mark = { r: 200, g: 40, b: 40, alpha: 1 }) {
  const markPng = await sharp({ create: { width: 200, height: 80, channels: 4, background: mark } }).png().toBuffer();
  return sharp({ create: { width: 600, height: 300, channels: 4, background: bg } })
    .composite([{ input: markPng, left: 150, top: 110 }])
    .png()
    .toBuffer();
}

const size = async (buf: Buffer) => {
  const m = await sharp(buf).metadata();
  return [m.width, m.height];
};

describe("prepareCenterLogo", () => {
  it("cuts white margins down to the logo", async () => {
    const out = await prepareCenterLogo(await canvasWithMark({ r: 255, g: 255, b: 255, alpha: 1 }));
    expect(await size(out)).toEqual([200, 80]);
  });

  it("cuts transparent margins down to the logo", async () => {
    const out = await prepareCenterLogo(await canvasWithMark({ r: 0, g: 0, b: 0, alpha: 0 }));
    expect(await size(out)).toEqual([200, 80]);
  });

  it("keeps a thin frame of the colour when the logo sits on a coloured surface", async () => {
    const out = await prepareCenterLogo(await canvasWithMark({ r: 110, g: 90, b: 85, alpha: 1 }, { r: 255, g: 255, b: 255, alpha: 1 }));
    // 12% of the short side (80) on each side.
    expect(await size(out)).toEqual([220, 100]);
  });

  it("adds no frame to a coloured image that had nothing to trim", async () => {
    // A textured background trim cannot find an edge in: before the fix it came
    // back with a frame in the corner's colour around the whole picture.
    const noisy = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#e6d2b4", noise: { type: "gaussian", mean: 128, sigma: 60 } } }).png().toBuffer();
    expect(await size(await prepareCenterLogo(noisy))).toEqual([300, 200]);
  });

  it("never makes the coloured frame wider than what was trimmed", async () => {
    // Mark 200x80 on a 210x300 brown canvas: 5px trimmed on each side horizontally.
    const markPng = await sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
    const narrow = await sharp({ create: { width: 210, height: 300, channels: 4, background: { r: 110, g: 90, b: 85, alpha: 1 } } })
      .composite([{ input: markPng, left: 5, top: 110 }]).png().toBuffer();
    expect(await size(await prepareCenterLogo(narrow))).toEqual([210, 100]);
  });

  it("leaves a single-colour image as it is instead of failing", async () => {
    const flat = await sharp({ create: { width: 300, height: 120, channels: 3, background: "#ffffff" } }).png().toBuffer();
    expect(await size(await prepareCenterLogo(flat))).toEqual([300, 120]);
  });

  it("keeps the long side at 512", async () => {
    const big = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 1600, height: 400, channels: 3, background: "#123456" } }).png().toBuffer(), left: 200, top: 300 }])
      .png()
      .toBuffer();
    expect(await size(await prepareCenterLogo(big))).toEqual([512, 128]);
  });

  it("tells a light or clear background from a coloured one", () => {
    expect(isLightOrClear({ r: 250, g: 250, b: 248, alpha: 1 })).toBe(true);
    expect(isLightOrClear({ r: 10, g: 10, b: 10, alpha: 0 })).toBe(true);
    expect(isLightOrClear({ r: 110, g: 90, b: 85, alpha: 1 })).toBe(false);
  });
});

describe("the centre portal", () => {
  it("uploads the logo as a logo, so it is trimmed", () => {
    const editor = readFileSync("app/centers/dashboard/PublicPageEditor.tsx", "utf8");
    const route = readFileSync("app/api/center-portal/upload/route.ts", "utf8");
    expect(editor).toMatch(/onLogoFile[\s\S]*?uploadCenterImage\(file, "center_logo"\)/);
    expect(route).toContain("prepareCenterLogo(");
  });
});
