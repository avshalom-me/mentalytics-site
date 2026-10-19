import sharp from "sharp";

// עיבוד לוגו של מרכז לפני שמירה (19/10/2026).
//
// מרכזים מעלים לוגו כפי שיש להם, ובחלק מהקבצים הלוגו תופס חצי מהתמונה ומסביבו
// שוליים לבנים. בעמוד המרכז ובכרטיסים הלוגו מוצג בתוך מסגרת לבנה עם ריפוד
// משלה, כך שהשוליים בקובץ רק מקטינים אותו. מכאן: חותכים את השוליים לפני השמירה.
//
// רקע לבן או שקוף - נחתך עד הלוגו; המסגרת הלבנה בעמוד נותנת את הריווח.
// רקע צבעוני (למשל לוגו על משטח חום) - נחתך, ומוחזרת סביבו מסגרת דקה באותו
// צבע. בלי זה הציור נצמד לקצה המשטח ונראה חתוך.

/** כמה רחוק מצבע הרקע עוד נחשב רקע (0-255). JPEG משאיר רעש סביב הלוגו. */
const TRIM_THRESHOLD = 12;
/** המסגרת שמוחזרת סביב לוגו על רקע צבעוני, כחלק מהצלע הקצרה של הלוגו. */
const COLORED_MARGIN_RATIO = 0.12;
/** הגודל השמור - כמו שאר תמונות המרכז הקטנות. */
const MAX_SIDE = 512;

type Rgba = { r: number; g: number; b: number; alpha: number };

/** צבע הפיקסל השמאלי-עליון - הצבע ש-sharp.trim מתייחס אליו כרקע. */
async function cornerColor(png: Buffer): Promise<Rgba> {
  const { data, info } = await sharp(png).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: info.channels >= 4 ? data[3] / 255 : 1 };
}

/** רקע שהמסגרת הלבנה של העמוד ממילא "בולעת": שקוף או כמעט לבן. */
export function isLightOrClear(c: Rgba): boolean {
  return c.alpha < 0.1 || (c.r >= 235 && c.g >= 235 && c.b >= 235);
}

/** מחזיר WebP של הלוגו בלי שוליים (ראו למעלה), עד 512 פיקסלים בצלע הארוכה. */
export async function prepareCenterLogo(input: Buffer): Promise<Buffer> {
  // מסובבים לפי EXIF פעם אחת, כדי שהמידות והפינה יהיו של התמונה כפי שהיא נראית.
  const oriented = await sharp(input).rotate().png().toBuffer({ resolveWithObject: true });
  const bg = await cornerColor(oriented.data);

  let trimmed = oriented.data;
  let width = oriented.info.width;
  let height = oriented.info.height;
  try {
    const out = await sharp(oriented.data).trim({ threshold: TRIM_THRESHOLD }).png().toBuffer({ resolveWithObject: true });
    trimmed = out.data;
    width = out.info.width;
    height = out.info.height;
  } catch {
    // תמונה בצבע אחיד (אין מה לחתוך) - sharp זורק. שומרים כמו שהיא.
  }

  let img = sharp(trimmed);
  if (!isLightOrClear(bg)) {
    // המסגרת הצבעונית לעולם לא רחבה ממה שנחתך בכל ציר. כך לוגו בלי שוליים -
    // למשל על רקע מצויר, ש-trim לא מוצא בו קצה - חוזר בדיוק כמו שהיה, ולא
    // מקבל מסגרת בצבע הפינה (19/10/2026, נתפס על לוגו אמיתי לפני השמירה).
    const m = Math.max(4, Math.round(Math.min(width, height) * COLORED_MARGIN_RATIO));
    const mx = Math.min(m, Math.floor((oriented.info.width - width) / 2));
    const my = Math.min(m, Math.floor((oriented.info.height - height) / 2));
    if (mx > 0 || my > 0) {
      img = sharp(await img.extend({ top: my, bottom: my, left: mx, right: mx, background: bg }).png().toBuffer());
    }
  }
  return img
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
}
