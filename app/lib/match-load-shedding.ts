// העלמה בעומס: מטפל/ת משלם/ת שמקבל/ת פניות רבות יוצא/ת לזמן מה מתוצאות
// השאלון, כדי שהפניות יתחלקו בין יותר מטפלים. מודול טהור - /api/match מזין
// אותו ונבדק בלעדיו.
//
// הרקע (29/10/2026): 10 מ-91 המקודמים קיבלו 48% מהפונים ב-30 יום, ו-35%
// לא קיבלו אף אחד. היעד של הבעלים: כ-2 פניות בחודש לכל מטפל/ת משלם/ת.
// ההנחיה שלו: "עדיין משלם קודם. אבל בתוך המשלמים, במידה ויש עומס, אפשר
// להעלים את החזקים - לא להוריד דירוג, כי ייראה מוזר שמישהו עם 95% התאמה
// לפני מישהו עם 98%."
//
// לכן המנגנון לא נוגע בסדר: הדירוג (ציון, מיקום, אישיות, משלם קודם בין
// שווים) נשאר בדיוק כפי שהיה, והמטפל/ת העמוס/ה פשוט אינו/ה ברשימה. מי
// שמופיע מופיע במקומו הרגיל.
//
// הכלל:
// - חל רק על מטפל/ת פרטי/ת בתשלום (promotion_source = paid). קידום מתנה
//   ומסלול ההזמנה לא מועלמים (הבעלים, 20/10/26: "בקידום מתנה לא לעשות את
//   ההקפאה הזו. רק מטפל בתשלום"), מטפלי מרכז לא (המרכז משלם ורואה את
//   המספרים), וחינמיים ממילא לא בתוצאות.
// - "עומס" = אנשים שונים שפנו ב-14 הימים האחרונים, מכל המקורות: זו אותה
//   הגדרה של "חם" בניתוח ריכוז הפניות (4 ומעלה בשבועיים).
// - מדורג ולא מדרגה: ב-4 פונים ההסתברות להעלמה בחיפוש נתון היא שליש, ב-5
//   שני שלישים, מ-6 ומעלה תמיד. כך מטפל/ת לא נעלם/ת בבת אחת ולא "מהבהב/ת"
//   סביב סף אחד, והחשיפה שלו/ה יורדת ככל שהעומס עולה.
// - רשת ביטחון, כמו בהקפאה הידנית: לא מעלימים כשזה משאיר למטופל פחות
//   מ-4 תוצאות, ובחיפוש עם מיקום - פחות מ-4 תוצאות באזור שלו. באזור דליל
//   ההעלמה לא תופסת, וזה בכוונה: עדיף מטפל/ת עמוס/ה ממסך ריק.
// - רק בשאלון המבוגרים (הבעלים, 29/10/26): בילדים יש פחות מטפלים ופחות
//   ביקוש, והעומס נספר על כל הפניות יחד, כך שמטפלת שעמוסה בגלל מבוגרים הייתה
//   נעלמת גם מחיפושי ילדים שבהם היא אחת מבודדות. ייבדק מחדש כשפרויקט היועצות
//   יביא ביקוש לילדים. ההבחנה: שאלון המבוגרים מבקש "מבוגרים", שאלון הילדים
//   מבקש גיל הרך / ילדים / נוער.
// - שום הודעה, שום דגל ציבורי. במאגר, בעמודי העיר ובפרופיל - כרגיל.
//
// נמדד: /api/match מחזיר כמה הועלמו בחיפוש, והלקוח רושם את זה באירוע
// match_results (שדה shed). הרובריקה באדמין (match-distribution.ts) מציגה את
// החלוקה לפני ואחרי. בדיקה חוזרת: סוף נובמבר 2026.

/** חלון העומס, כמו CONCENTRATION_WINDOW_DAYS. */
export const LOAD_WINDOW_DAYS = 14;
/** מכאן ההעלמה מתחילה ("יותר מ-3 בשבועיים", הבעלים). */
export const SHED_START_PEOPLE = 4;
/** מכאן ההעלמה ודאית. */
export const SHED_FULL_PEOPLE = 6;
/** כמה תוצאות חייבות להישאר למטופל (ובאזור שלו, כשביקש מיקום). */
export const SHED_MIN_RESULTS = 4;

/** קבוצת הגיל ששאלון המבוגרים שולח. חיפוש בלעדיה (ילדים, נוער) לא מעלים אף אחד. */
export const ADULTS_AGE_GROUP = "מבוגרים";

export function isAdultsSearch(ageGroups: readonly string[]): boolean {
  return ageGroups.some((g) => String(g ?? "").trim() === ADULTS_AGE_GROUP);
}

export type ShedSubject = {
  status: string | null;
  promotion_source: string | null;
  entity_type: string | null;
};

/** מי בכלל יכול/ה להיות מועלם/ת: מטפל/ת פרטי/ת בתשלום. */
export function isShedEligible(t: ShedSubject): boolean {
  return t.status === "paying" && t.promotion_source === "paid" && t.entity_type !== "center";
}

/** ההסתברות להעלמה בחיפוש נתון, לפי מספר הפונים בחלון. 0 מתחת לסף, 1 מהסף המלא. */
export function shedProbability(people: number): number {
  if (!Number.isFinite(people) || people < SHED_START_PEOPLE) return 0;
  if (people >= SHED_FULL_PEOPLE) return 1;
  return (people - (SHED_START_PEOPLE - 1)) / (SHED_FULL_PEOPLE - (SHED_START_PEOPLE - 1));
}

export type ShedOptions<T> = {
  /** כמה תוצאות המטופל רואה (limit של החיפוש). */
  limit: number;
  /** אנשים שפנו למטפל/ת בחלון. 0 למי שאין עליו/ה נתון. */
  loadOf: (t: T) => number;
  eligible: (t: T) => boolean;
  /** האם המטפל/ת באזור שהתבקש (result.inRequestedArea). */
  inArea: (t: T) => boolean;
  /** האם החיפוש ביקש מיקום (עיר, אזור או אונליין). */
  locationRequested: boolean;
  /** מוזרק לבדיקות. ברירת מחדל Math.random. */
  random?: () => number;
};

export type ShedResult<T> = {
  /** הרשימה המדורגת בלי המועלמים, באותו סדר. */
  kept: T[];
  /** מי הועלם/ה מהתוצאות שהיו מוצגות, לפי סדר העומס. */
  shed: T[];
};

/**
 * מסירה מהרשימה המדורגת את המשלמים העמוסים שהיו מוצגים, אחד אחד מהעמוס/ה
 * ביותר, כל עוד נשארות למטופל מספיק תוצאות. הסדר של הנותרים לא משתנה.
 */
export function applyLoadShedding<T>(ranked: readonly T[], opts: ShedOptions<T>): ShedResult<T> {
  const random = opts.random ?? Math.random;
  const limit = Math.max(1, Math.floor(opts.limit));
  const visible = ranked.slice(0, limit);

  // מועמדים: רק מי שהיה/תה מוצג/ת, זכאי/ת, ושהגורל של החיפוש הזה בחר בו/ה.
  const candidates = visible
    .filter((t) => opts.eligible(t))
    .map((t) => ({ t, load: opts.loadOf(t) }))
    .filter(({ load }) => shedProbability(load) > 0)
    .filter(({ load }) => random() < shedProbability(load))
    .sort((a, b) => b.load - a.load)
    .map(({ t }) => t);
  if (candidates.length === 0) return { kept: [...ranked], shed: [] };

  const originalTop = ranked.slice(0, limit);
  const floorTotal = Math.min(SHED_MIN_RESULTS, originalTop.length);
  const floorInArea = opts.locationRequested
    ? Math.min(SHED_MIN_RESULTS, originalTop.filter((t) => opts.inArea(t)).length)
    : 0;

  const removed = new Set<T>();
  const shed: T[] = [];
  for (const c of candidates) {
    removed.add(c);
    const afterTop = ranked.filter((t) => !removed.has(t)).slice(0, limit);
    const okTotal = afterTop.length >= floorTotal;
    const okArea = !opts.locationRequested || afterTop.filter((t) => opts.inArea(t)).length >= floorInArea;
    if (okTotal && okArea) {
      shed.push(c);
    } else {
      removed.delete(c);
    }
  }
  return { kept: ranked.filter((t) => !removed.has(t)), shed };
}
