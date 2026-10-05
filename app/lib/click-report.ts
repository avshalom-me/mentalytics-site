// דוח לחיצות לטיוטות של סוכן השירות: כל לחיצה ליצירת קשר בחודשיים האחרונים,
// עם התאריך, השעה, איפה באתר היא נעשתה ואיך הגולש הגיע לאתר.
//
// למה הוא קיים: מטפלים ומרכזים שואלים שוב ושוב למה המספר שהם רואים ("לחיצות
// ליצירת קשר", ובפיהם "פניות") לא תואם למה שהגיע אליהם בפועל. התשובה שעבדה,
// כשנכתבה ביד, הייתה לפרוש את הלחיצות אחת אחת - כך בעל הפרופיל יכול להשוות
// אותן למה שקיבל - ולהסביר מה לחיצה כן ולא מוכיחה. מ-5/10/2026 הסוכן מצרף את
// הפירוט בעצמו כשהוא מזהה שאלה כזו.
//
// שני כללים שהקוד כאן שומר עליהם:
//   - הרשימה נבנית בקוד ולא על ידי מודל השפה. המודל רק מסמן איפה היא צריכה
//     להופיע (CLICK_REPORT_MARKER), והסימון מוחלף כאן. מודל שמעתיק עשרים
//     תאריכים ושעות טועה באחד מהם, והטיוטה יוצאת ללקוח.
//   - על הגולש נמסר רק מה שנדרש כדי לזהות את הלחיצה: מתי, איזה כפתור, איפה
//     באתר, ומאיזה ערוץ הגיע. לא אזור, לא גיל ולא נושא הפנייה - בדשבורד אלה
//     מוצגים רק בקבוצות של שלושה ומעלה, ושורה לכל לחיצה הייתה עוקפת את זה.
//
// נקי מתלויות שרת, כדי שהניסוח ייבדק ישירות (click-report.test.ts).

/** הסימון שהמודל שם בטיוטה במקום שבו צריכה להופיע רשימת הלחיצות. */
export const CLICK_REPORT_MARKER = "{{דוח_לחיצות}}";
export const CLICK_REPORT_MONTHS = 2;
/** מעל זה מוצגות רק האחרונות. היום המקסימום למטפל בחודשיים הוא 18. */
export const CLICK_REPORT_MAX_LINES = 80;

export type ReportClick = {
  /** מתי נלחץ (ISO). */
  at: string;
  /** whatsapp / phone / email / site_message */
  type: string;
  /** match / directory / profile */
  source: string | null;
  channel: string | null;
  referrerHost: string | null;
  /** שם הפרופיל שנלחץ, כשהדוח מכסה כמה פרופילים של מרכז. ריק = המרכז עצמו. */
  profileName?: string | null;
  /**
   * מזהה הגלישה. לא מודפס: משמש רק לסימון לחיצה חוזרת של אותו גולש, שנספרת
   * בדשבורד כלחיצה נוספת ואינה פנייה נוספת.
   */
  sessionId?: string | null;
};

export type ClickReportAudience = "therapist" | "center";

export type ClickReport = {
  count: number;
  /** תחילת החלון וסופו, כפי שהם מוצגים בדוח (שעון ישראל). */
  from: string;
  to: string;
  /** הבלוק שנכנס לטיוטה במקום הסימון. */
  text: string;
  /** שורה אחת לאדמין, בהערה שליד הטיוטה. */
  summary: string;
  /**
   * לחיצות שהכניסה שלהן נרשמה מתוך האתר עצמו, בלי מקור חיצוני. אצל מרכזים זו
   * לעיתים קרובות כניסה של הצוות עצמו מהפורטל; האדמין מקבל על כך הערה.
   */
  fromInsideSite: number;
  /** לחיצות חוזרות של אותו גולש על אותו כפתור, בתוך דקות מהקודמת. */
  repeats: number;
};

const IL = "Asia/Jerusalem";
const dayMonth = (d: Date) => new Intl.DateTimeFormat("he-IL", { timeZone: IL, day: "numeric", month: "numeric" }).format(d);
const fullDate = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: IL, day: "numeric", month: "numeric", year: "numeric" }).format(d);
const hourMinute = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { timeZone: IL, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** תחילת החלון: אותו יום בחודש, חודשיים אחורה (31 בחודש נעצר בסוף החודש הקצר). */
export function clickReportSince(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - CLICK_REPORT_MONTHS);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

const TYPE_LABELS: Record<string, string> = {
  whatsapp: "לחיצה על וואטסאפ",
  phone: "לחיצה על חיוג",
  email: "לחיצה על מייל",
  site_message: "הודעה דרך טופס האתר",
};
// לשורת הסיכום: שם הכפתור בלבד.
const TYPE_SHORT: Record<string, string> = {
  whatsapp: "וואטסאפ",
  phone: "חיוג",
  email: "מייל",
  site_message: "הודעה דרך טופס האתר",
};
const TYPE_ORDER = ["whatsapp", "phone", "email", "site_message"];

function whereLabel(c: ReportClick, audience: ClickReportAudience, named: boolean): string {
  if (c.source === "match") return "בתוצאות שאלון ההתאמה";
  if (c.source === "directory") return "בכרטיס ברשימת המטפלים";
  return audience === "center" && !named ? "בעמוד המרכז" : "בעמוד הפרופיל";
}

/** איך הגולש הגיע לאתר, כהמשך למשפט "הכניסה לאתר הייתה ...". */
function arrivalLabel(c: ReportClick): string {
  switch (c.channel) {
    case "google_paid":
      return "ממודעה שלנו בגוגל";
    case "google_organic":
      return "מחיפוש בגוגל";
    case "meta_paid":
      return "ממודעה שלנו בפייסבוק או באינסטגרם";
    case "meta_organic":
      return "מפייסבוק או מאינסטגרם";
    case "tiktok_paid":
      return "ממודעה שלנו בטיקטוק";
    case "tiktok_organic":
      return "מטיקטוק";
    case "taboola_paid":
      return "ממודעה שלנו באתר תוכן";
    case "whatsapp":
      return "מקישור שנשלח בוואטסאפ";
    case "direct":
      return "ישירה (הקלדת הכתובת, סימנייה או קישור שלא זוהה)";
    case "ai":
      return "מעוזר בינה מלאכותית";
    case "search_other":
      return "ממנוע חיפוש שאינו גוגל";
    case "email":
      return "מקישור במייל";
    case "referral":
      // אתר מפנה בלי שם = הכניסה נרשמה מתוך האתר שלנו (למשל מהאזור האישי).
      return c.referrerHost ? `מהאתר ${c.referrerHost}` : "מקישור בתוך האתר שלנו";
    default:
      return "ממקור שלא זוהה";
  }
}

function clickLine(c: ReportClick, audience: ClickReportAudience, withNames: boolean, repeat: boolean): string {
  const d = new Date(c.at);
  const named = withNames && !!c.profileName;
  const type = TYPE_LABELS[c.type] ?? "לחיצה ליצירת קשר";
  return (
    `- ${dayMonth(d)} בשעה ${hourMinute(d)}: ${type}${named ? ` (${c.profileName})` : ""} ` +
    `${whereLabel(c, audience, named)}${repeat ? " (לחיצה חוזרת של אותו גולש)" : ""}. ` +
    `הכניסה לאתר הייתה ${arrivalLabel(c)}.`
  );
}

const REPEAT_WINDOW_MS = 10 * 60_000;

/**
 * אילו לחיצות הן חזרה של אותו גולש על אותו כפתור, בתוך דקות מהקודמת. מי שלחץ
 * פעמיים על הוואטסאפ שלח לכל היותר הודעה אחת, ובדשבורד זה נספר כשתיים.
 */
function repeatFlags(sorted: ReportClick[]): boolean[] {
  return sorted.map((c, i) => {
    if (!c.sessionId) return false;
    const at = new Date(c.at).getTime();
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j];
      if (at - new Date(prev.at).getTime() > REPEAT_WINDOW_MS) break;
      if (prev.sessionId === c.sessionId && prev.type === c.type && (prev.profileName ?? null) === (c.profileName ?? null)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * הדוח כטקסט. clicks הן כל הלחיצות בחלון; הסדר לא משנה.
 * withProfileNames: כשהדוח מכסה כמה פרופילים (מרכז עם מטפלים), כל שורה נוקבת בשם.
 */
export function buildClickReport(
  clicks: ReportClick[],
  opts: { audience: ClickReportAudience; now?: Date; withProfileNames?: boolean },
): ClickReport {
  const now = opts.now ?? new Date();
  const from = fullDate(clickReportSince(now));
  const to = fullDate(now);
  const whose = opts.audience === "center" ? "במרכז" : "בפרופיל שלך";
  const sorted = [...clicks].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const fromInsideSite = sorted.filter((c) => c.channel === "referral" && !c.referrerHost).length;

  if (sorted.length === 0) {
    return {
      count: 0,
      from,
      to,
      text: `בין ${from} ל-${to} לא נרשמה אף לחיצה ליצירת קשר ${whose}.`,
      summary: `אפס לחיצות, ${from} עד ${to}`,
      fromInsideSite: 0,
      repeats: 0,
    };
  }
  const repeat = repeatFlags(sorted);
  const repeats = repeat.filter(Boolean).length;

  const byType = new Map<string, number>();
  for (const c of sorted) byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  const types = [...byType.keys()].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a);
    const ib = TYPE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const totals = types.map((t) => `${TYPE_SHORT[t] ?? t} ${byType.get(t)}`).join(", ");

  const first = sorted.length - Math.min(sorted.length, CLICK_REPORT_MAX_LINES);
  const shown = sorted.slice(first);
  const lines = [
    `לחיצות ליצירת קשר ${whose}, ${from} עד ${to}`,
    `סה"כ ${sorted.length}: ${totals}.` +
      (repeats > 0 ? ` מתוכן ${repeats === 1 ? "אחת היא לחיצה חוזרת" : `${repeats} הן לחיצות חוזרות`} של אותו גולש.` : ""),
    ...(shown.length < sorted.length ? [`מוצגות ${shown.length} הלחיצות האחרונות מתוך ${sorted.length}.`] : []),
    "",
    ...shown.map((c, i) => clickLine(c, opts.audience, !!opts.withProfileNames, repeat[first + i])),
    "",
    "השעות לפי שעון ישראל.",
    // מי שקורא "מקישור בתוך האתר שלנו" צריך לדעת מה זה אומר: לעיתים קרובות זו
    // לחיצה של בעל הפרופיל עצמו, וזה חלק מההסבר לפער.
    ...(fromInsideSite > 0
      ? [
          opts.audience === "center"
            ? 'כניסה "מקישור בתוך האתר שלנו" נרשמת כשהגלישה התחילה בעמוד אחר באתר, למשל בפורטל המרכז. לחיצה כזו יכולה להיות גם של הצוות שלכם.'
            : 'כניסה "מקישור בתוך האתר שלנו" נרשמת כשהגלישה התחילה בעמוד אחר באתר, למשל באזור האישי. לחיצה כזו יכולה להיות גם שלך.',
        ]
      : []),
  ];
  return {
    count: sorted.length,
    from,
    to,
    text: lines.join("\n"),
    summary: `${sorted.length} לחיצות, ${from} עד ${to}`,
    fromInsideSite,
    repeats,
  };
}

/**
 * מכניס את הדוח לטיוטה: במקום הסימון אם המודל שם אותו, ואחרת לפני שורת הסיום
 * ("בברכה"). סימון שני נמחק - הדוח מופיע פעם אחת.
 */
export function insertClickReport(draft: string, block: string): string {
  const lines = draft.split("\n");
  const at = lines.findIndex((l) => l.includes(CLICK_REPORT_MARKER));
  const clean = (s: string) => s.split(CLICK_REPORT_MARKER).join("");
  if (at >= 0) {
    const before = lines.slice(0, at).join("\n").trimEnd();
    // טקסט שנכתב על שורת הסימון עצמה ("להלן הפירוט: {{...}}") נשאר לפני הדוח.
    const sameLine = clean(lines[at]).trim();
    const after = clean(lines.slice(at + 1).join("\n")).trim();
    return [before, sameLine, block, after].filter((part) => part !== "").join("\n\n");
  }
  let closing = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*בברכה/.test(lines[i])) {
      closing = i;
      break;
    }
  }
  if (closing < 0) return [draft.trimEnd(), block].filter((part) => part !== "").join("\n\n");
  const before = lines.slice(0, closing).join("\n").trimEnd();
  const after = lines.slice(closing).join("\n").trim();
  return [before, block, after].filter((part) => part !== "").join("\n\n");
}

const CLICK_LINE = /^- \d{1,2}\.\d{1,2} בשעה \d{1,2}:\d{2}: /;
const BLOCK_HEAD = [/^לחיצות ליצירת קשר (בפרופיל שלך|במרכז), /, /^סה"כ \d+: /, /^מוצגות \d+ הלחיצות האחרונות מתוך \d+\.$/];
const BLOCK_FOOT = /^(השעות לפי שעון ישראל\.|כניסה "מקישור בתוך האתר שלנו" נרשמת כשהגלישה התחילה בעמוד אחר באתר, .*)$/;

/**
 * מחזיר את הסימון במקום רשימת לחיצות שכבר הוכנסה לטקסט.
 *
 * תשובות שנשלחו משמשות דוגמאות לטיוטות הבאות. דוגמה עם רשימה מלאה מלמדת את
 * המודל לכתוב רשימה בעצמו, עם התאריכים של מטפל אחר. עם הסימון במקומה היא
 * מלמדת את מה שצריך: לשים סימון, ולהסביר מסביב.
 */
export function collapseClickReport(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!CLICK_LINE.test(lines[i])) {
      out.push(lines[i]);
      i++;
      continue;
    }
    // כותרות הדוח ושורות ריקות שמעל הרשימה כבר נכתבו ל-out - מורידים אותן.
    while (out.length > 0 && (out[out.length - 1].trim() === "" || BLOCK_HEAD.some((re) => re.test(out[out.length - 1])))) {
      out.pop();
    }
    while (i < lines.length && (CLICK_LINE.test(lines[i]) || lines[i].trim() === "" || BLOCK_FOOT.test(lines[i]))) i++;
    if (out.length > 0) out.push("");
    out.push(CLICK_REPORT_MARKER);
    if (i < lines.length) out.push("");
  }
  return out.join("\n");
}
