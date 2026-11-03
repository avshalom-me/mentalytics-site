// פרטים שמוצגים בראש עמוד המרכז ובקישור לאתר שלו (20/10/2026).

const NON_PLACES = new Set(["online", "other", "אונליין", "אחר"]);

/**
 * המקום שמוצג בכותרת עמוד המרכז.
 *
 * עד 20/10/2026 הכותרת הראתה רק את השדה "עיר" מעורך העמוד הציבורי. מרכז שלא
 * מילא אותו קיבל כותרת בלי מיקום, והמקום הופיע רק למטה, באזורי ההתאמה. עכשיו:
 * השדה "עיר" אם מולא, ואחרת הערים שהמרכז כבר סימן (אזורי ההתאמה של הישות, או
 * הערים של המטפלים שלו) - עד שלוש, ו"ועוד" אם יש יותר.
 */
export function centerHeaderPlace(publicCity: string | null | undefined, cities: readonly string[]): string | null {
  const list = centerPlaces(publicCity, cities);
  if (list.length === 0) return null;
  return list.length <= 3 ? list.join(" · ") : `${list.slice(0, 3).join(" · ")} ועוד`;
}

/** המקומות עצמם: השדה "עיר" כפריט יחיד, או הערים שסומנו (בלי כפילויות ובלי אונליין). */
export function centerPlaces(publicCity: string | null | undefined, cities: readonly string[]): string[] {
  const own = publicCity?.trim();
  if (own) return [own];
  return [...new Set(cities.map((c) => String(c).trim()).filter((c) => c && !NON_PLACES.has(c)))];
}

/**
 * הכתובת שהקישור "אתר המרכז" מוביל אליה: עם סימון שהביקור הגיע מאיתנו
 * (utm_source=mentalytics), כדי שהמרכז יראה את הביקורים האלה גם בגוגל אנליטיקס
 * שלו. סימון שכבר קיים בכתובת לא נדרס, וכתובת שלא נקראת כ-URL חוזרת כמו שהיא.
 */
export function centerWebsiteHref(raw: string | null | undefined): string | null {
  const site = raw?.trim();
  if (!site) return null;
  const withScheme = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  try {
    const url = new URL(withScheme);
    if (!url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", "mentalytics");
      url.searchParams.set("utm_medium", "referral");
      url.searchParams.set("utm_campaign", "center_page");
    }
    return url.toString();
  } catch {
    return withScheme;
  }
}

/** חלון שבו לחיצה חוזרת של אותו מבקר נספרת פעם אחת - כמו בלחיצות הקשר. */
export const REPEAT_CLICK_WINDOW_MS = 120_000;

/**
 * הלחיצות שנשארות אחרי סינון חזרות: לחיצה חוזרת של אותו מבקר על אותו סוג
 * כפתור בתוך שתי דקות מהלחיצה הקודמת שלו נזרקת (אותו כלל כמו
 * record_contact_click). שורה בלי מזהה מבקר נשמרת תמיד. מוחזר בסדר כרונולוגי.
 *
 * kind מפריד בין סוגי כפתורים: וואטסאפ ואז טלפון מאותו מבקר הם שתי לחיצות.
 * ממנה נגזרים גם המונה וגם יומן הלחיצות בפורטל, כך ששניהם תמיד מסכימים.
 */
export function keepFirstOfRepeats<T extends { created_at: string; session_id: string | null }>(
  rows: readonly T[],
  kind: (r: T) => string = () => "",
): T[] {
  const lastByKey = new Map<string, number>();
  const kept: T[] = [];
  for (const r of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!r.session_id) {
      kept.push(r);
      continue;
    }
    const key = `${r.session_id}\u0000${kind(r)}`;
    const t = new Date(r.created_at).getTime();
    const last = lastByKey.get(key);
    if (last === undefined || t - last > REPEAT_CLICK_WINDOW_MS) kept.push(r);
    lastByKey.set(key, t);
  }
  return kept;
}

/** כמה לחיצות לאתר המרכז, אחרי סינון חזרות (keepFirstOfRepeats). */
export function countWebsiteClicks(rows: readonly { created_at: string; session_id: string | null }[]): number {
  return keepFirstOfRepeats(rows).length;
}
