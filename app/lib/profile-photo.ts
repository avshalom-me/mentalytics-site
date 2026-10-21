import sharp from "sharp";
import { squareWindow } from "./photo-focus";

// Profile photos are stored as a 600×600 WebP square (every card/list/profile
// container assumes a square source).
//
// The crop used to be `fit: "cover", position: "center"`, which on a PORTRAIT
// photo removes an equal slice from the top AND the bottom — reliably cutting
// off the top of the head, since in a headshot the face sits in the upper part
// of the frame. It then became a fixed top bias (DEFAULT_PORTRAIT_FOCUS in photo-focus.ts), which
// in turn cut the chin off a tall photo whose face sat LOW in the frame (21/10/2026:
// a paying therapist showed only the upper half of her face). The upload form
// previewed the photo with a plain CSS center crop, so she saw a different
// square than the one that was saved.
//
// So no fixed guess: the uploader positions the photo in a square frame
// (PhotoFramePicker), the form sends that position as `focus`, and the server
// cuts exactly that window. Without a focus the old defaults apply. The
// uploaded image is also kept (originalPhotoPath), so a bad crop can be redone
// without asking the therapist for the photo again.
const SIZE = 600;
const ORIGINAL_MAX = 1600;

export { parsePhotoFocus, squareWindow } from "./photo-focus";

/** Resize/crop an uploaded image into the stored 600×600 WebP profile photo. */
export async function compressProfilePhoto(input: Buffer, focus: number | null = null): Promise<Buffer> {
  // Apply EXIF orientation first, so width/height below are the real, visible
  // dimensions (a phone portrait is often stored landscape + an orientation tag).
  const rotated = await sharp(input).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(rotated).metadata();
  if (!width || !height) throw new Error("image without dimensions");

  const w = squareWindow(width, height, focus);
  return sharp(rotated)
    .extract({ left: w.left, top: w.top, width: w.size, height: w.size })
    .resize(SIZE, SIZE, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}

/** The uploaded photo, uncropped (orientation applied, long side at most 1600px). */
export async function keepOriginalPhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(ORIGINAL_MAX, ORIGINAL_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}

/**
 * Storage path of the kept original for a stored square photo:
 * photos/<name>.webp → photos/originals/<name>.webp. Null for a path outside
 * photos/ (legacy rows), so cleanup never touches anything else.
 */
export function originalPhotoPath(photoPath: string | null | undefined): string | null {
  if (!photoPath || !photoPath.startsWith("photos/") || photoPath.startsWith("photos/originals/")) return null;
  return `photos/originals/${photoPath.slice("photos/".length)}`;
}

/** The files to delete when a stored photo is replaced or removed: the square and its original. */
export function photoFilesToRemove(photoPath: string | null | undefined): string[] {
  const original = originalPhotoPath(photoPath);
  return original && photoPath ? [photoPath, original] : [];
}

/**
 * Everything an upload route stores for a new photo: the 600×600 square cut at
 * `focus`, and the uncropped original. The original is best-effort: if it
 * fails, the photo is still saved.
 */
export async function prepareProfilePhoto(
  input: Buffer,
  focus: number | null,
): Promise<{ square: Buffer; original: Buffer | null }> {
  const square = await compressProfilePhoto(input, focus);
  const original = await keepOriginalPhoto(input).catch(() => null);
  return { square, original };
}
