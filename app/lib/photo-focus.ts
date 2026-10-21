// Where the stored square is cut from an uploaded profile photo. Shared by the
// server (profile-photo.ts, which cuts the file) and the upload forms
// (PhotoFramePicker, which shows the same square with CSS), so the photo the
// uploader positioned is exactly the photo that is saved. No sharp import here:
// this module runs in the browser too.

/** Where the square sits along the long side when nobody chose: near the top of a portrait. */
export const DEFAULT_PORTRAIT_FOCUS = 0.12;
/** …and in the middle of a landscape photo (only the sides are cut). */
export const DEFAULT_LANDSCAPE_FOCUS = 0.5;

export type PhotoShape = "portrait" | "landscape" | "square";

export function photoShape(width: number, height: number): PhotoShape {
  if (height > width) return "portrait";
  if (width > height) return "landscape";
  return "square";
}

/**
 * The focus sent by the upload form: 0 = the square starts at the top (or the
 * left edge) of the photo, 1 = it ends at the bottom (or the right edge).
 * Anything that is not a number in [0, 1] means "not chosen".
 */
export function parsePhotoFocus(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  return n;
}

export function resolvedFocus(shape: PhotoShape, focus: number | null): number {
  if (focus !== null) return focus;
  return shape === "portrait" ? DEFAULT_PORTRAIT_FOCUS : DEFAULT_LANDSCAPE_FOCUS;
}

/**
 * The square window cut from a width×height photo. The same arithmetic as CSS
 * `object-fit: cover` with `object-position` at focus·100% (photoObjectPosition).
 */
export function squareWindow(
  width: number,
  height: number,
  focus: number | null = null,
): { left: number; top: number; size: number } {
  const size = Math.min(width, height);
  const shape = photoShape(width, height);
  const f = resolvedFocus(shape, focus);
  if (shape === "portrait") return { left: 0, top: Math.round((height - width) * f), size };
  if (shape === "landscape") return { left: Math.round((width - height) * f), top: 0, size };
  return { left: 0, top: 0, size };
}

/** CSS object-position that shows the square squareWindow() cuts. Physical axes: RTL does not flip it. */
export function photoObjectPosition(shape: PhotoShape, focus: number | null): string {
  const pct = `${Math.round(resolvedFocus(shape, focus) * 1000) / 10}%`;
  if (shape === "portrait") return `50% ${pct}`;
  if (shape === "landscape") return `${pct} 50%`;
  return "50% 50%";
}

/**
 * The focus after dragging the photo by `deltaPx` along its long side inside a
 * square frame of `framePx`: dragging the photo down (or right) shows more of
 * its top (or left), so the focus goes down.
 */
export function focusAfterDrag(
  startFocus: number,
  deltaPx: number,
  framePx: number,
  width: number,
  height: number,
): number {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  if (short <= 0 || long === short) return startFocus;
  const hiddenPx = framePx * (long / short) - framePx;
  if (hiddenPx <= 0) return startFocus;
  return Math.min(1, Math.max(0, startFocus - deltaPx / hiddenPx));
}
