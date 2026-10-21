import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import {
  compressProfilePhoto,
  keepOriginalPhoto,
  originalPhotoPath,
  photoFilesToRemove,
  prepareProfilePhoto,
} from "./profile-photo";
import {
  DEFAULT_PORTRAIT_FOCUS,
  focusAfterDrag,
  parsePhotoFocus,
  photoObjectPosition,
  photoShape,
  squareWindow,
} from "./photo-focus";

// A tall photo split into three horizontal bands: red top, green middle,
// blue bottom. Which band dominates the stored square tells where it was cut.
async function bandedPortrait(width: number, height: number): Promise<Buffer> {
  const third = Math.round(height / 3);
  const band = (r: number, g: number, b: number, h: number) =>
    sharp({ create: { width, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      { input: await band(255, 0, 0, third), top: 0, left: 0 },
      { input: await band(0, 255, 0, third), top: third, left: 0 },
      { input: await band(0, 0, 255, height - 2 * third), top: 2 * third, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function pixelAt(img: Buffer, x: number, y: number) {
  const { data, info } = await sharp(img).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

describe("squareWindow / photoObjectPosition (the server crop equals the preview)", () => {
  it("portrait: no choice keeps the top-biased default", () => {
    expect(squareWindow(600, 1000)).toEqual({ left: 0, top: Math.round(400 * DEFAULT_PORTRAIT_FOCUS), size: 600 });
    expect(photoObjectPosition("portrait", null)).toBe("50% 12%");
  });

  it("portrait: a chosen focus moves the square down the photo", () => {
    expect(squareWindow(600, 1000, 1)).toEqual({ left: 0, top: 400, size: 600 });
    expect(squareWindow(600, 1000, 0.5)).toEqual({ left: 0, top: 200, size: 600 });
    expect(photoObjectPosition("portrait", 0.75)).toBe("50% 75%");
  });

  it("landscape: the square moves along the width, centred by default", () => {
    expect(squareWindow(1000, 600)).toEqual({ left: 200, top: 0, size: 600 });
    expect(squareWindow(1000, 600, 0)).toEqual({ left: 0, top: 0, size: 600 });
    expect(photoObjectPosition("landscape", 0.25)).toBe("25% 50%");
  });

  it("square photos are never cut", () => {
    expect(squareWindow(800, 800, 0.9)).toEqual({ left: 0, top: 0, size: 800 });
    expect(photoShape(800, 800)).toBe("square");
  });
});

describe("parsePhotoFocus", () => {
  it("accepts 0..1 from the form, anything else means not chosen", () => {
    expect(parsePhotoFocus("0.42")).toBe(0.42);
    expect(parsePhotoFocus("0")).toBe(0);
    expect(parsePhotoFocus("1")).toBe(1);
    expect(parsePhotoFocus(null)).toBeNull();
    expect(parsePhotoFocus("")).toBeNull();
    expect(parsePhotoFocus("1.2")).toBeNull();
    expect(parsePhotoFocus("-0.1")).toBeNull();
    expect(parsePhotoFocus("abc")).toBeNull();
  });
});

describe("focusAfterDrag", () => {
  it("dragging the photo down shows more of its top", () => {
    // 600x1000 in a 150px frame: the photo is 250px tall, 100px hidden.
    expect(focusAfterDrag(0.5, 50, 150, 600, 1000)).toBeCloseTo(0);
    expect(focusAfterDrag(0.5, -25, 150, 600, 1000)).toBeCloseTo(0.75);
  });

  it("is clamped to the photo, and does nothing on a square", () => {
    expect(focusAfterDrag(0.1, 500, 150, 600, 1000)).toBe(0);
    expect(focusAfterDrag(0.9, -500, 150, 600, 1000)).toBe(1);
    expect(focusAfterDrag(0.3, 40, 150, 700, 700)).toBe(0.3);
  });
});

describe("compressProfilePhoto", () => {
  it("cuts a tall photo where the uploader positioned it (21/10/2026: the face sat low and was cut)", async () => {
    // 300x900: red 0-300, green 300-600, blue 600-900.
    const tall = await bandedPortrait(300, 900);
    // Default (rows 72-372): red on top, green at the bottom, no blue at all.
    const def = await compressProfilePhoto(tall);
    expect((await pixelAt(def, 300, 60)).r).toBeGreaterThan(200);
    expect((await pixelAt(def, 300, 580)).g).toBeGreaterThan(200);
    // Focus 0.5 (rows 300-600): the green band only.
    const mid = await compressProfilePhoto(tall, 0.5);
    expect((await pixelAt(mid, 300, 20)).g).toBeGreaterThan(200);
    expect((await pixelAt(mid, 300, 580)).g).toBeGreaterThan(200);
    // Focus 1 (rows 600-900): the bottom of the photo, which the default never shows.
    const low = await compressProfilePhoto(tall, 1);
    expect((await pixelAt(low, 300, 20)).b).toBeGreaterThan(200);
    expect((await pixelAt(low, 300, 580)).b).toBeGreaterThan(200);
    const meta = await sharp(low).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([600, 600, "webp"]);
  });

  it("keeps the uncropped original next to the square", async () => {
    const tall = await bandedPortrait(1200, 3600);
    const { square, original } = await prepareProfilePhoto(tall, 0.5);
    expect((await sharp(square).metadata()).height).toBe(600);
    const meta = await sharp(original!).metadata();
    expect([meta.width, meta.height]).toEqual([533, 1600]);
    const small = await keepOriginalPhoto(await bandedPortrait(300, 900));
    expect((await sharp(small).metadata()).height).toBe(900);
  });
});

describe("originalPhotoPath / photoFilesToRemove", () => {
  it("puts the original under photos/originals/ and removes both together", () => {
    expect(originalPhotoPath("photos/abc-1.webp")).toBe("photos/originals/abc-1.webp");
    expect(photoFilesToRemove("photos/abc-1.webp")).toEqual(["photos/abc-1.webp", "photos/originals/abc-1.webp"]);
  });

  it("never touches a path outside photos/ (a legacy row may point at a certificate)", () => {
    expect(originalPhotoPath("certificates/x.pdf")).toBeNull();
    expect(photoFilesToRemove("certificates/x.pdf")).toEqual([]);
    expect(photoFilesToRemove(null)).toEqual([]);
    expect(originalPhotoPath("photos/originals/abc-1.webp")).toBeNull();
  });
});

describe("every therapist photo upload sends and honours the position", () => {
  const read = (p: string) => readFileSync(p, "utf8");

  it("the routes cut at the form's focus and keep the original", () => {
    for (const route of [
      "app/api/therapist-upload/route.ts",
      "app/api/admin-therapist-photo/route.ts",
      "app/api/center-portal/upload/route.ts",
      "app/api/centers/fill-profile/route.ts",
    ]) {
      const src = read(route);
      expect(src, route).toMatch(/prepareProfilePhoto\([\s\S]*?parsePhotoFocus\(\w+\.get\("focus"\)\)/);
      expect(src, route).toContain("originalPhotoPath(path)");
      expect(src, route).not.toContain('position: "center"');
    }
  });

  it("the forms show the picker and send its focus", () => {
    for (const form of [
      "app/therapists/dashboard/edit/page.tsx",
      "app/centers/dashboard/therapists/[id]/page.tsx",
      "app/centers/fill/[token]/FillForm.tsx",
      "app/admin/therapists/page.tsx",
    ]) {
      const src = read(form);
      expect(src, form).toContain("<PhotoFramePicker");
      expect(src, form).toMatch(/append\("focus", String\(/);
    }
  });
});
