import sharp from "sharp";

// Profile photos are stored as a 600×600 WebP square (every card/list/profile
// container assumes a square source).
//
// The crop used to be `fit: "cover", position: "center"`, which on a PORTRAIT
// photo removes an equal slice from the top AND the bottom — reliably cutting
// off the top of the head, since in a headshot the face sits in the upper part
// of the frame. That damage is baked into the stored file (the original is not
// kept), so it can't be undone in CSS.
//
// Instead: for a portrait source we choose the square window ourselves, biased
// toward the top, leaving a small headroom margin (HEADROOM_RATIO of the excess
// height) above the subject. Landscape/square sources are unchanged — covering
// a square from a landscape crops the sides only, never the head.
const SIZE = 600;
const HEADROOM_RATIO = 0.12;

/** Resize/crop an uploaded image into the stored 600×600 WebP profile photo. */
export async function compressProfilePhoto(input: Buffer): Promise<Buffer> {
  // Apply EXIF orientation first, so width/height below are the real, visible
  // dimensions (a phone portrait is often stored landscape + an orientation tag).
  const rotated = await sharp(input).rotate().toBuffer();
  const { width = 0, height = 0 } = await sharp(rotated).metadata();

  let pipeline = sharp(rotated);
  if (height > width && width > 0) {
    const top = Math.round((height - width) * HEADROOM_RATIO);
    pipeline = pipeline.extract({ left: 0, top, width, height: width });
  }

  return pipeline
    .resize(SIZE, SIZE, { fit: "cover", position: "center" })
    .webp({ quality: 80 })
    .toBuffer();
}
