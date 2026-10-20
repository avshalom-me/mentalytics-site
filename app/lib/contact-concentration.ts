// ריכוז פניות: איפה מעט מטפלים מקבלים את רוב הפניות - מודול טהור, בלי מסד.
//
// סוכן פערי ההיצע מוצא חיתוכים (אזור × טיפול) שבהם לא היה למטופל מטפל משלם
// להציע. הבעלים ביקש (20/10/26) גם את המצב ההפוך: יש מטפלים להציע, אבל
// "מספר מטפלים/מכונים מועט שמקבל המון המון פניות (נניח יותר מ-3 בשבועיים)".
// שם הביקוש גדול ממה שמעט אנשים יכולים לקלוט, ולכן כדאי להציע קידום מתנה
// לעוד מטפלים באותו אזור ובאותו תחום - ולבדוק אם אפשר להקפיא לשבוע את מי
// שמקבל הכי הרבה, בלי להשאיר את המטופלים שם בלי חלופה.
//
// היחידה היא אדם ולא לחיצה: מטפל × סשן נספר פעם אחת, כי מבקר אחד שלוחץ על
// וואטסאפ ואחר כך על טלפון הוא פנייה אחת (ראו contact-click-bursts).
//
// החיתוך הוא אזור מלא ("גוש דן") × רכיב טיפול אחד ("CBT"). פנייה נספרת בחיתוך
// רק כשידוע מה המטופל חיפש ובאיזה אזור - כלומר שהגיע דרך השאלון - ורק באזורים
// של המטפל שנמצאים בקבוצת האזורים שהמטופל ביקש. בלי זה מטפל שרשום בגוש דן,
// בשרון ובירושלים "יצר" ריכוז בשלושתם, גם כשכל הפונים אליו היו מגוש דן.
// מטפל שעובד רק אונליין נספר תחת "online".

import { coversRegion, expertiseOf, overlaps, regionsCovered } from "./match-fallback";
import { pauseSourceBlock } from "./match-pause";
import { regionGroupOf } from "./regions";
import { canonicalPart, matchPart, treatmentLabel, treatmentParts } from "./treatment-parts";

/** חלון המדידה: "בשבועיים" (הבעלים, 20/10/26). */
export const CONCENTRATION_WINDOW_DAYS = 14;
/** "יותר מ-3 בשבועיים": מטפל חם = 4 אנשים ומעלה בחלון. */
export const HOT_MIN_PEOPLE = 4;
/** "מספר מועט": עד כמה מטפלים חמים בחיתוך הוא עדיין ריכוז. מעבר לזה הביקוש
 *  כבר מתחלק בין רבים, ועוד מטפל רק יחלק אותו לחלקים קטנים יותר. */
export const MAX_HOT_PER_SLICE = 3;
/** ריכוז = החמים מקבלים לפחות חצי מהפונים בחיתוך. */
export const MIN_HOT_SHARE = 0.5;
/** פחות משלושה פונים בחיתוך הוא מקרה, לא ריכוז. נמדד ב-20/10/26: בלי הסף
 *  הזה עלו עשרה חיתוכים, שבחצי מהם פנה אדם אחד. */
export const MIN_SLICE_PEOPLE = 3;
/** כמה מטפלים חדשים מציעים לכל חיתוך ריכוז - "יותר אפשרויות", לא הצפה.
 *  הכרטיס מציג עד שלושה מועמדים לבחירה, ונסגר אחרי שתי שליחות. */
export const NEW_PER_SLICE = 2;
/** הקפאה בטוחה רק כשנשארים בחיתוך לפחות כמה מקודמים פעילים. 4 הוא אותה רצפה
 *  שסוכן הפערים משתמש בה ("מתחת לזה למטופל אין באמת ממה לבחור", 23/8/26). */
export const FREEZE_MIN_ALTERNATIVES = 4;
/** ההקפאה עצמה: שבוע (הבעלים, 20/10/26). */
export const FREEZE_DAYS = 7;
/** לא מקפיאים שוב מי שהוקפא בחודש האחרון - אחרת שבוע בפנים ושבוע בחוץ. */
export const FREEZE_COOLDOWN_DAYS = 28;
/** "עברו לפחות 60 יום מקידום ממומן" (הבעלים, 20/10/26): מהמאוחר בין תחילת
 *  הקידום לתחילת המנוי, כלומר 60 יום של קידום בתשלום. ההקפאה מכאן רק למשלמים
 *  ("בקידום מתנה לא לעשות את ההקפאה הזו"), ובתוך חלון ערבות הפניות לא מקפיאים. */
export const FREEZE_MIN_TENURE_DAYS = 60;
/** "לפחות 3 מהפונים הגיעו מהשאלון" (הבעלים, 20/10/26). הקפאה משפיעה רק על
 *  השאלון, ומי שהפניות שלו מגיעות מהמאגר או מהפרופיל לא יתחלק עם אחרים. */
export const FREEZE_MIN_MATCH_PEOPLE = 3;
/** בדיקת ההקפאה רצה פעם בשבועיים (הבעלים, 20/10/26), ומעלה הצעות לתור -
 *  ההקפאה עצמה רק בלחיצה. */
export const FREEZE_CHECK_EVERY_DAYS = 14;

export const ONLINE_REGION = "online";

/** סוג הפעולה בתור של הצעה להקפאה שקטה. */
export const FREEZE_ACTION_TYPE = "concentration_freeze";

/** מקור קידום של לקוח שמשלם בפועל (ישירות, דרך מרכז, או בחודשי המתנה לפני
 *  החיוב הראשון) - מול קידום מתנה שיפוג. משותף לסוכן פערי ההיצע. */
export const PAID_SOURCES = new Set(["paid", "center", "gift_trial"]);

export type ConcContact = {
  therapistId: string;
  sessionId: string;
  /** match / directory / profile - כמו בטבלת הלחיצות. */
  source: string;
  /** הטיפול שהמטופל חיפש בשאלון. null = לא ידוע (הגיע מהמאגר או ישר לפרופיל). */
  treatment: string | null;
  /** קבוצת האזורים שהמטופל ביקש ("center", "online"), כפי שנשמרת בצפייה. */
  regionGroup: string | null;
  /** child / 18-30 / ... כפי שנשמר בצפייה. */
  ageBand: string | null;
};

export type ConcTherapist = {
  id: string;
  full_name: string | null;
  status: string;
  promotion_source: string | null;
  entity_type: string | null;
  regions: string[] | null;
  online: boolean | null;
  training_areas: string[] | null;
  // מנוע ההתאמה מחשב מומחיות מהשלושה יחד (expertiseOf), ולכן גם כאן.
  assessment_types: string[] | null;
  couples_modalities: string[] | null;
  age_groups: string[] | null;
  admin_approved: boolean | null;
  accepting_new_patients: boolean | null;
  match_paused_until: string | null;
  promoted_since: string | null;
};

export type HotTherapist = {
  id: string;
  name: string;
  people: number;
  matchPeople: number;
};

export type ConcentrationSlice = {
  /** אזור מלא ("גוש דן") או "online". */
  region: string;
  /** רכיב טיפול אחד, מנורמל ("cbt"), לא שילוב. */
  treatment: string;
  hot: HotTherapist[];
  /** אנשים שחיפשו את הטיפול הזה באזור הזה ופנו למקודמים בחיתוך. */
  slicePeople: number;
  /** מתוכם - למטפלים החמים. */
  hotPeople: number;
  /** מקודמים שמכסים את החיתוך. */
  covering: number;
  /** מתוכם משלמים בפועל (paid / center / gift_trial). */
  paidCovering: number;
  /** מתוכם בלי אף פנייה בחלון. */
  idle: number;
};

export type FreezeCandidate = HotTherapist & {
  promotionSource: string | null;
  safe: boolean;
  /** למה לא בטוח, או null. בעברית, לתצוגה באדמין. */
  blockedReason: string | null;
  /** החיתוך הדליל ביותר שהמטפל משרת - שם נמדדה הבטיחות. */
  weakest: { region: string; treatment: string; alternatives: number } | null;
};

/** מה שנשמר בריצה ומוצג בעמוד הסוכנים: חיתוך ריכוז, ואם יצאה ממנו הצעה לתור. */
export type ConcentrationSummary = {
  region: string;
  treatment: string;
  hot: { id: string; name: string; people: number }[];
  slicePeople: number;
  hotPeople: number;
  covering: number;
  idle: number;
  offered: boolean;
};

export type ConcentrationResult = {
  hot: HotTherapist[];
  slices: ConcentrationSlice[];
  freeze: FreezeCandidate[];
};

// ── קבוצות גיל ────────────────────────────────────────────────────────────
// הצפייה שומרת שכבת גיל של המטופל ("child", "18-30"), והמטפל מסמן קבוצות
// ("גיל הרך", "ילדים", "נוער", "מבוגרים"). חלופה להקפאה צריכה לשרת בדיוק את
// אותה קבוצה: מטפלת לנוער אינה חלופה לפעוט. מטופל מבוגר דורש "מבוגרים" (גם
// בגיל השלישי השאלון שולח "מבוגרים"); ילד דורש כל אחת מקבוצות הילדים שהמטפל
// העמוס משרת, כל אחת בנפרד, כי שכבת הגיל "child" לא מבחינה ביניהן.
const KID_GROUPS = ["גיל הרך", "ילדים", "נוער"];
const ADULTS = "מבוגרים";

/** קבוצות הגיל שהחלופות חייבות לשרת, לפי מי שבאמת פנה. פנייה בלי שכבת גיל
 *  ידועה מוסיפה את כל הקבוצות שהמטפל משרת - לא יודעים מי היא, אז בודקים את כולן. */
function requiredAgeGroups(t: ConcTherapist, bands: (string | null)[]): string[] {
  const own = t.age_groups ?? [];
  const kids = own.filter((g) => KID_GROUPS.includes(g));
  const need = new Set<string>();
  for (const band of bands) {
    if (band === null) for (const g of own) need.add(g);
    else if (band === "child") for (const g of kids.length > 0 ? kids : ["ילדים"]) need.add(g);
    else need.add(ADULTS);
  }
  return [...need];
}

function isPromoted(t: ConcTherapist): boolean {
  return t.status === "paying";
}

function isPaused(t: ConcTherapist, nowMs: number): boolean {
  return !!t.match_paused_until && Date.parse(t.match_paused_until) > nowMs;
}

/** האזורים שבהם המטפל עובד: אזורים מלאים, ו-"online" לכל מי שעובד אונליין -
 *  גם כשיש לו קליניקה, כי מטופלים שביקשו אונליין פונים גם אליו. */
export function workRegions(t: Pick<ConcTherapist, "regions" | "online">): string[] {
  const covered = [...regionsCovered(t.regions ?? [])];
  return t.online ? [...covered, ONLINE_REGION] : covered;
}

/** קבוצת האזורים של אזור מלא, כמו שהיא נשמרת בצפייה ("גוש דן" → "center"). */
function groupOfRegion(region: string): string {
  return region === ONLINE_REGION ? ONLINE_REGION : regionGroupOf(region);
}

/** האם פנייה שייכת לאזור של החיתוך. בלי אזור ידוע היא לא נספרת באף חיתוך
 *  אזורי; לחיתוך האונליין נספר גם מי שלא בחר מיקום. */
function contactInRegion(regionGroup: string | null, region: string): boolean {
  if (region === ONLINE_REGION) return regionGroup === ONLINE_REGION || regionGroup === null;
  return regionGroup !== null && regionGroup === groupOfRegion(region);
}

function coversSliceRegion(t: ConcTherapist, region: string): boolean {
  if (region === ONLINE_REGION) return t.online === true;
  return coversRegion(t.regions ?? [], region);
}

function coversTreatment(t: ConcTherapist, part: string): boolean {
  return overlaps(expertiseOf(t.training_areas ?? [], t.assessment_types ?? [], t.couples_modalities ?? []), [
    matchPart(part),
  ]);
}

/** הרכיבים של טיפול מבוקש, מנורמלים ("טיפול CBT" ו-"CBT" הם אותו רכיב). */
function partsOf(treatment: string | null): string[] {
  if (!treatment) return [];
  return Array.from(new Set(treatmentParts(treatment).map((p) => canonicalPart(matchPart(p))))).filter(Boolean);
}

/** "ל-CBT" ולא "לcbt": ל' לפני מילה לועזית מקבלת מקף, והתווית באותיות גדולות. */
function withLamed(treatment: string): string {
  const label = treatmentLabel(treatment);
  return /^[a-z0-9]/i.test(label) ? `-${label}` : label;
}

/** איך אזור של חיתוך מוצג: "גוש דן", או "אונליין" (אונליין אינו מקום). */
export function regionDisplay(region: string): string {
  return region === ONLINE_REGION ? "אונליין" : region;
}

type Pair = ConcContact & { parts: string[] };

export function analyzeConcentration(input: {
  contacts: ConcContact[];
  therapists: ConcTherapist[];
  /** מתי כל מטפל הוקפא לאחרונה (מיומן הביקורת), לצינון ההקפאה. */
  lastPausedAt?: Map<string, string>;
  /** תחילת המנוי הפעיל של כל משלם/ת (subscriptions), לספירת ימי הקידום בתשלום. */
  paidSince?: Map<string, string>;
  now?: Date;
}): ConcentrationResult {
  const nowMs = (input.now ?? new Date()).getTime();

  // מטפל × סשן פעם אחת. מידע ידוע גובר על לא-ידוע, ו-match גובר על מקור
  // אחר - אותו אדם שלחץ גם מהשאלון וגם מהפרופיל הגיע דרך השאלון.
  const byPair = new Map<string, ConcContact>();
  for (const c of input.contacts) {
    if (!c.therapistId || !c.sessionId) continue;
    const key = `${c.therapistId}|${c.sessionId}`;
    const prev = byPair.get(key);
    if (!prev) {
      byPair.set(key, { ...c });
      continue;
    }
    if (!prev.treatment && c.treatment) prev.treatment = c.treatment;
    if (!prev.regionGroup && c.regionGroup) prev.regionGroup = c.regionGroup;
    if (!prev.ageBand && c.ageBand) prev.ageBand = c.ageBand;
    if (prev.source !== "match" && c.source === "match") prev.source = "match";
  }
  // הפירוק לרכיבים פעם אחת לכל פנייה, ולא בכל לולאה.
  const pairs: Pair[] = [...byPair.values()].map((c) => ({ ...c, parts: partsOf(c.treatment) }));

  const peopleOf = new Map<string, number>();
  const matchPeopleOf = new Map<string, number>();
  const pairsOf = new Map<string, Pair[]>();
  for (const c of pairs) {
    peopleOf.set(c.therapistId, (peopleOf.get(c.therapistId) ?? 0) + 1);
    if (c.source === "match") matchPeopleOf.set(c.therapistId, (matchPeopleOf.get(c.therapistId) ?? 0) + 1);
    const list = pairsOf.get(c.therapistId);
    if (list) list.push(c);
    else pairsOf.set(c.therapistId, [c]);
  }

  const promoted = input.therapists.filter(isPromoted);
  const hotRows = promoted.filter((t) => (peopleOf.get(t.id) ?? 0) >= HOT_MIN_PEOPLE);
  const hotIds = new Set(hotRows.map((t) => t.id));
  const hotInfo = (t: ConcTherapist): HotTherapist => ({
    id: t.id,
    name: t.full_name ?? "",
    people: peopleOf.get(t.id) ?? 0,
    matchPeople: matchPeopleOf.get(t.id) ?? 0,
  });

  // החיתוכים שמטפל חם משרת בפועל: אזור שהוא עובד בו ושמטופל ביקש, × רכיב
  // טיפול שהמטופל חיפש ושהמטפל באמת עוסק בו.
  const servedSlices = new Map<string, Map<string, { region: string; treatment: string }>>();
  for (const t of hotRows) {
    const served = new Map<string, { region: string; treatment: string }>();
    const regions = workRegions(t);
    for (const c of pairsOf.get(t.id) ?? []) {
      for (const p of c.parts) {
        if (!coversTreatment(t, p)) continue;
        for (const region of regions) {
          if (contactInRegion(c.regionGroup, region)) served.set(`${region}|${p}`, { region, treatment: p });
        }
      }
    }
    servedSlices.set(t.id, served);
  }

  const sliceKeys = new Map<string, { region: string; treatment: string }>();
  for (const served of servedSlices.values()) for (const [k, s] of served) sliceKeys.set(k, s);

  const slices: ConcentrationSlice[] = [];
  for (const { region, treatment } of sliceKeys.values()) {
    const covering = promoted.filter((t) => coversSliceRegion(t, region) && coversTreatment(t, treatment));
    const people = new Set<string>();
    const hotPeople = new Set<string>();
    for (const t of covering) {
      for (const c of pairsOf.get(t.id) ?? []) {
        if (!c.parts.includes(treatment) || !contactInRegion(c.regionGroup, region)) continue;
        people.add(c.sessionId);
        if (hotIds.has(t.id)) hotPeople.add(c.sessionId);
      }
    }
    slices.push({
      region,
      treatment,
      hot: covering.filter((t) => hotIds.has(t.id)).map(hotInfo).sort((a, b) => b.people - a.people),
      slicePeople: people.size,
      hotPeople: hotPeople.size,
      covering: covering.length,
      paidCovering: covering.filter((t) => PAID_SOURCES.has(t.promotion_source ?? "")).length,
      idle: covering.filter((t) => (peopleOf.get(t.id) ?? 0) === 0).length,
    });
  }
  slices.sort((a, b) => b.hotPeople - a.hotPeople || b.slicePeople - a.slicePeople);

  // הקפאה: נבדקת לכל מטפל חם בנפרד. בטוחה רק אם בכל חיתוך שהוא משרת, ולכל
  // קבוצת גיל שפנתה אליו, נשארים מספיק מקודמים פעילים שאינם חמים בעצמם
  // (אחרת מעבירים את העומס ממטפל עמוס אחד לאחר).
  const freeze: FreezeCandidate[] = hotRows.map((t) => {
    const base = { ...hotInfo(t), promotionSource: t.promotion_source };
    const blocked = (reason: string, weakest: FreezeCandidate["weakest"] = null): FreezeCandidate => ({
      ...base,
      safe: false,
      blockedReason: reason,
      weakest,
    });

    const sourceBlock = pauseSourceBlock(t);
    if (sourceBlock) return blocked(sourceBlock);
    // רשומת מרכז (ישות) מקודמת לפעמים כ-paid או ידנית, ואז pauseSourceBlock לא
    // תופס אותה - אבל חשיפה של מרכז לא מוקפאת (match-pause.ts).
    if (t.entity_type === "center") return blocked("רשומת מרכז: חשיפה של מרכז לא מוקפאת.");
    // "בקידום מתנה לא לעשות את ההקפאה הזו. רק מטפל בתשלום" (הבעלים, 20/10/26).
    // מקודמי מתנה (trial / manual) עדיין ניתנים להקפאה ידנית מעמוד המטפלים -
    // רק ההצעה מכאן מוגבלת למשלמים.
    if (t.promotion_source !== "paid") {
      return blocked("קידום מתנה: ההקפאה מריכוז פניות רק למטפל/ת בתשלום.");
    }
    if (isPaused(t, nowMs)) return blocked("כבר מוקפא/ת מההתאמות.");
    const paidStart = input.paidSince?.get(t.id) ?? null;
    if (!paidStart) {
      return blocked("לא נמצא מנוי פעיל, ולכן אי אפשר לדעת כמה זמן הקידום בתשלום.");
    }
    // 60 יום של קידום בתשלום: מהמאוחר בין תחילת הקידום לתחילת המנוי.
    const tenureFrom = t.promoted_since && t.promoted_since > paidStart ? t.promoted_since : paidStart;
    if (nowMs - Date.parse(tenureFrom) < FREEZE_MIN_TENURE_DAYS * 86_400_000) {
      return blocked(`בקידום בתשלום פחות מ-${FREEZE_MIN_TENURE_DAYS} ימים; עד אז לא מקפיאים.`);
    }
    // צינון משני מקורות: יומן הביקורת והצעות שבוצעו (מתי הוקפא/ה), ותאריך הסיום
    // שנשאר על המטפל/ת אחרי שההקפאה פגה (שחרור ידני מאפס אותו, הקפאה שפגה - לא).
    const ilDate = (iso: string) => new Date(iso).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
    const lastPaused = input.lastPausedAt?.get(t.id);
    if (lastPaused && nowMs - Date.parse(lastPaused) < FREEZE_COOLDOWN_DAYS * 86_400_000) {
      return blocked(`הוקפא/ה כבר ב-${ilDate(lastPaused)}; הקפאה אחת בכל ${FREEZE_COOLDOWN_DAYS} ימים.`);
    }
    if (t.match_paused_until && nowMs - Date.parse(t.match_paused_until) < FREEZE_COOLDOWN_DAYS * 86_400_000) {
      return blocked(`הקפאה קודמת הסתיימה ב-${ilDate(t.match_paused_until)}; הקפאה אחת בכל ${FREEZE_COOLDOWN_DAYS} ימים.`);
    }
    if (base.matchPeople < FREEZE_MIN_MATCH_PEOPLE) {
      return blocked(
        `רק ${base.matchPeople} מהפונים הגיעו מהשאלון (צריך ${FREEZE_MIN_MATCH_PEOPLE}); הקפאה משפיעה רק על השאלון.`
      );
    }

    // כל מי שפנה מהשאלון חייב להיות ממופה לחיתוך: ידוע מה חיפש, באיזה אזור,
    // והמטפל/ת עוסק/ת בזה. פונה שלא ממופה הוא מטופל שלא נבדק אם יש לו חלופה -
    // ולכן במקום לדלג עליו, לא מקפיאים.
    const regions = workRegions(t);
    const quiz = (pairsOf.get(t.id) ?? []).filter((c) => c.source === "match");
    const unmapped = quiz.filter(
      (c) => !c.parts.some((p) => coversTreatment(t, p)) || !regions.some((r) => contactInRegion(c.regionGroup, r))
    ).length;
    if (unmapped > 0) {
      return blocked(
        `${unmapped} מהפונים מהשאלון בלי נתון מלא על מה חיפשו או איפה, ולכן אי אפשר לוודא שיש להם חלופה.`
      );
    }

    const served = [...(servedSlices.get(t.id)?.values() ?? [])];
    const ages = requiredAgeGroups(t, quiz.map((c) => c.ageBand));
    if (served.length === 0 || ages.length === 0) {
      return blocked("אין נתון על הטיפול, האזור או הגיל של הפונים, ולכן אי אפשר לבדוק חלופות.");
    }

    // חלופה = מי שמנוע ההתאמה באמת היה מציג במקום: מקודם/ת, מאושר/ת, מקבל/ת
    // מטופלים חדשים (true בדיוק, כמו ב-/api/match), לא מוקפא/ת ולא עמוס/ה.
    let weakest: (NonNullable<FreezeCandidate["weakest"]> & { age: string }) | null = null;
    for (const s of served) {
      for (const age of ages) {
        const alternatives = promoted.filter(
          (o) =>
            o.id !== t.id &&
            !hotIds.has(o.id) &&
            !isPaused(o, nowMs) &&
            o.admin_approved === true &&
            o.accepting_new_patients === true &&
            coversSliceRegion(o, s.region) &&
            coversTreatment(o, s.treatment) &&
            overlaps(o.age_groups ?? [], [age])
        ).length;
        if (!weakest || alternatives < weakest.alternatives) weakest = { ...s, alternatives, age };
      }
    }
    if (!weakest) return blocked("אין נתון על הטיפול, האזור או הגיל של הפונים, ולכן אי אפשר לבדוק חלופות.");
    const { age, ...weakestSlice } = weakest;
    if (weakest.alternatives < FREEZE_MIN_ALTERNATIVES) {
      return blocked(
        `ב${regionDisplay(weakest.region)} נשארים רק ${weakest.alternatives} מקודמים ל${withLamed(weakest.treatment)} (${age}); צריך ${FREEZE_MIN_ALTERNATIVES}.`,
        weakestSlice
      );
    }
    return { ...base, safe: true, blockedReason: null, weakest: weakestSlice };
  });
  freeze.sort((a, b) => Number(b.safe) - Number(a.safe) || b.people - a.people);

  return { hot: hotRows.map(hotInfo).sort((a, b) => b.people - a.people), slices, freeze };
}

/** חיתוך שמצדיק הצעת מתנה: מעט חמים, והם מקבלים את רוב הפונים. */
export function isConcentrated(s: ConcentrationSlice): boolean {
  return (
    s.hot.length >= 1 &&
    s.hot.length <= MAX_HOT_PER_SLICE &&
    s.slicePeople >= MIN_SLICE_PEOPLE &&
    s.hotPeople / s.slicePeople >= MIN_HOT_SHARE
  );
}
