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

import { coversRegion, overlaps, regionsCovered } from "./match-fallback";
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
/** בחודש הראשון של קידום לא מקפיאים: אלה הימים שבהם המטפל/ת מגבש/ת דעה
 *  אם זה עובד, וגם משלם/ת חדש/ה שכבר קיבל/ה פניות נמצא/ת שם. */
export const FREEZE_MIN_TENURE_DAYS = 30;
/** הקפאה משפיעה רק על השאלון. מי שרוב הפניות שלו מגיעות מהמאגר או
 *  מהפרופיל לא יתחלק עם אחרים בגלל הקפאה. */
export const FREEZE_MIN_MATCH_PEOPLE = 2;

export const ONLINE_REGION = "online";

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
// ("ילדים", "מבוגרים"). ההקפאה צריכה לדעת אם יש חלופה לאותם מטופלים, ולכן
// שתיהן מתורגמות לשני סוגים: ילדים ונוער, או מבוגרים.
type AgeKind = "kids" | "adults";
const KID_GROUPS = ["גיל הרך", "ילדים", "נוער"];
const ADULT_GROUPS = ["מבוגרים", "הגיל השלישי"];

function ageKindOfBand(band: string | null): AgeKind | null {
  if (!band) return null;
  return band === "child" ? "kids" : "adults";
}

function servesKind(ageGroups: string[] | null, kind: AgeKind): boolean {
  return overlaps(ageGroups ?? [], kind === "kids" ? KID_GROUPS : ADULT_GROUPS);
}

const AGE_KIND_LABEL: Record<AgeKind, string> = { kids: "ילדים ונוער", adults: "מבוגרים" };

function isPromoted(t: ConcTherapist): boolean {
  return t.status === "paying";
}

function isPaused(t: ConcTherapist, nowMs: number): boolean {
  return !!t.match_paused_until && Date.parse(t.match_paused_until) > nowMs;
}

/** האזורים שבהם המטפל עובד: אזורים מלאים, או "online" למי שעובד רק אונליין. */
export function workRegions(t: Pick<ConcTherapist, "regions" | "online">): string[] {
  const covered = [...regionsCovered(t.regions ?? [])];
  if (covered.length > 0) return covered;
  return t.online ? [ONLINE_REGION] : [];
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
  return overlaps(t.training_areas ?? [], [matchPart(part)]);
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

function whereOf(region: string): string {
  return region === ONLINE_REGION ? "אונליין" : region;
}

type Pair = ConcContact & { parts: string[] };

export function analyzeConcentration(input: {
  contacts: ConcContact[];
  therapists: ConcTherapist[];
  /** מתי כל מטפל הוקפא לאחרונה (מיומן הביקורת), לצינון ההקפאה. */
  lastPausedAt?: Map<string, string>;
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
    if (isPaused(t, nowMs)) return blocked("כבר מוקפא/ת מההתאמות.");
    if (!t.promoted_since || nowMs - Date.parse(t.promoted_since) < FREEZE_MIN_TENURE_DAYS * 86_400_000) {
      return blocked(`בקידום פחות מ-${FREEZE_MIN_TENURE_DAYS} ימים; בחודש הראשון לא מקפיאים.`);
    }
    const lastPaused = input.lastPausedAt?.get(t.id);
    if (lastPaused && nowMs - Date.parse(lastPaused) < FREEZE_COOLDOWN_DAYS * 86_400_000) {
      return blocked(
        `הוקפא/ה כבר ב-${new Date(lastPaused).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}; הקפאה אחת בכל ${FREEZE_COOLDOWN_DAYS} ימים.`
      );
    }
    if (base.matchPeople < FREEZE_MIN_MATCH_PEOPLE) {
      return blocked("רוב הפניות מגיעות מהמאגר או ישר לפרופיל, והקפאה משפיעה רק על השאלון.");
    }

    const served = [...(servedSlices.get(t.id)?.values() ?? [])];
    if (served.length === 0) {
      return blocked("אין נתון על הטיפול והאזור שהפונים חיפשו, ולכן אי אפשר לבדוק חלופות.");
    }

    // קבוצות הגיל שבאמת פנו אליו; בלי נתון - כל מה שהמטפל מסמן.
    const kinds = new Set<AgeKind>();
    for (const c of pairsOf.get(t.id) ?? []) {
      const k = ageKindOfBand(c.ageBand);
      if (k) kinds.add(k);
    }
    if (kinds.size === 0) {
      if (servesKind(t.age_groups, "kids")) kinds.add("kids");
      if (servesKind(t.age_groups, "adults")) kinds.add("adults");
    }

    let weakest: (NonNullable<FreezeCandidate["weakest"]> & { kind: AgeKind }) | null = null;
    for (const s of served) {
      for (const kind of kinds) {
        const alternatives = promoted.filter(
          (o) =>
            o.id !== t.id &&
            !hotIds.has(o.id) &&
            !isPaused(o, nowMs) &&
            o.admin_approved === true &&
            o.accepting_new_patients !== false &&
            coversSliceRegion(o, s.region) &&
            coversTreatment(o, s.treatment) &&
            servesKind(o.age_groups, kind)
        ).length;
        if (!weakest || alternatives < weakest.alternatives) weakest = { ...s, alternatives, kind };
      }
    }
    if (!weakest) return blocked("אין נתון על קבוצת הגיל של הפונים, ולכן אי אפשר לבדוק חלופות.");
    const { kind, ...weakestSlice } = weakest;
    if (weakest.alternatives < FREEZE_MIN_ALTERNATIVES) {
      return blocked(
        `ב${whereOf(weakest.region)} נשארים רק ${weakest.alternatives} מקודמים ל${withLamed(weakest.treatment)} ל${AGE_KIND_LABEL[kind]}; צריך ${FREEZE_MIN_ALTERNATIVES}.`,
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
