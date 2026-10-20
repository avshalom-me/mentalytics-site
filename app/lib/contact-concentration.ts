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
// האזור של החיתוך הוא האזור המלא שבו המטפל החם עובד ("גוש דן"), לא קבוצת
// האזורים הגסה: הפניות הגיעו אליו כי הוא שם, ומועמד מאותו אזור משרת את אותם
// מטופלים. מטפל שעובד רק אונליין נספר תחת "online".

import { coversRegion, overlaps, regionsCovered } from "./match-fallback";
import { pauseSourceBlock } from "./match-pause";
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
/** כמה מטפלים חדשים מציעים לכל חיתוך ריכוז - "יותר אפשרויות", לא הצפה. */
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

export type ConcContact = {
  therapistId: string;
  sessionId: string;
  /** match / directory / profile - כמו בטבלת הלחיצות. */
  source: string;
  /** הטיפול שהמטופל חיפש, מהצפייה של אותו סשן במטפל. null = לא ידוע
   *  (הגיע מהמאגר או ישר לפרופיל). */
  treatment: string | null;
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
  /** רכיב טיפול אחד ("CBT"), לא שילוב. */
  treatment: string;
  hot: HotTherapist[];
  /** אנשים שפנו למקודמים בחיתוך על הטיפול הזה. */
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

const PAID_SOURCES = new Set(["paid", "center", "gift_trial"]);

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

function coversSliceRegion(t: ConcTherapist, region: string): boolean {
  if (region === ONLINE_REGION) return t.online === true;
  return coversRegion(t.regions ?? [], region);
}

function coversTreatment(t: ConcTherapist, part: string): boolean {
  return overlaps(t.training_areas ?? [], [matchPart(part)]);
}

/** "ל-CBT" ולא "לcbt": ל' לפני מילה לועזית מקבלת מקף, והתווית באותיות גדולות. */
function withLamed(treatment: string): string {
  const label = treatmentLabel(treatment);
  return /^[a-z0-9]/i.test(label) ? `-${label}` : label;
}

/** הרכיבים של טיפול מבוקש, מנורמלים ("טיפול CBT" ו-"CBT" הם אותו רכיב). */
function partsOf(treatment: string | null): string[] {
  if (!treatment) return [];
  return Array.from(new Set(treatmentParts(treatment).map((p) => canonicalPart(matchPart(p))))).filter(Boolean);
}

export function analyzeConcentration(input: {
  contacts: ConcContact[];
  therapists: ConcTherapist[];
  /** מתי כל מטפל הוקפא לאחרונה (מיומן הביקורת), לצינון ההקפאה. */
  lastPausedAt?: Map<string, string>;
  now?: Date;
}): ConcentrationResult {
  const nowMs = (input.now ?? new Date()).getTime();
  const byId = new Map(input.therapists.map((t) => [t.id, t]));

  // מטפל × סשן פעם אחת. טיפול ידוע גובר על לא-ידוע, ו-match גובר על מקור
  // אחר - אותו אדם שלחץ גם מהשאלון וגם מהפרופיל הגיע דרך השאלון.
  const pairs = new Map<string, ConcContact>();
  for (const c of input.contacts) {
    if (!c.therapistId || !c.sessionId) continue;
    const key = `${c.therapistId}|${c.sessionId}`;
    const prev = pairs.get(key);
    if (!prev) {
      pairs.set(key, { ...c });
      continue;
    }
    if (!prev.treatment && c.treatment) prev.treatment = c.treatment;
    if (prev.source !== "match" && c.source === "match") prev.source = "match";
  }
  const contacts = [...pairs.values()];

  const peopleOf = new Map<string, number>();
  const matchPeopleOf = new Map<string, number>();
  for (const c of contacts) {
    peopleOf.set(c.therapistId, (peopleOf.get(c.therapistId) ?? 0) + 1);
    if (c.source === "match") matchPeopleOf.set(c.therapistId, (matchPeopleOf.get(c.therapistId) ?? 0) + 1);
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

  // החיתוכים שמטפל חם משרת: כל אזור שהוא עובד בו × כל רכיב טיפול שמטופלים
  // ביקשו כשפנו אליו ושהוא באמת עוסק בו.
  const servedSlices = new Map<string, { region: string; treatment: string }[]>();
  for (const t of hotRows) {
    const parts = new Set<string>();
    for (const c of contacts) {
      if (c.therapistId !== t.id) continue;
      for (const p of partsOf(c.treatment)) if (coversTreatment(t, p)) parts.add(p);
    }
    const list: { region: string; treatment: string }[] = [];
    for (const region of workRegions(t)) for (const treatment of parts) list.push({ region, treatment });
    servedSlices.set(t.id, list);
  }

  const sliceKeys = new Map<string, { region: string; treatment: string }>();
  for (const list of servedSlices.values()) for (const s of list) sliceKeys.set(`${s.region}|${s.treatment}`, s);

  const slices: ConcentrationSlice[] = [];
  for (const { region, treatment } of sliceKeys.values()) {
    const covering = promoted.filter((t) => coversSliceRegion(t, region) && coversTreatment(t, treatment));
    const coveringIds = new Set(covering.map((t) => t.id));
    const people = new Set<string>();
    const hotPeople = new Set<string>();
    for (const c of contacts) {
      if (!coveringIds.has(c.therapistId)) continue;
      if (!partsOf(c.treatment).includes(treatment)) continue;
      people.add(c.sessionId);
      if (hotIds.has(c.therapistId)) hotPeople.add(c.sessionId);
    }
    const hot = covering.filter((t) => hotIds.has(t.id)).map(hotInfo).sort((a, b) => b.people - a.people);
    slices.push({
      region,
      treatment,
      hot,
      slicePeople: people.size,
      hotPeople: hotPeople.size,
      covering: covering.length,
      paidCovering: covering.filter((t) => PAID_SOURCES.has(t.promotion_source ?? "")).length,
      idle: covering.filter((t) => (peopleOf.get(t.id) ?? 0) === 0).length,
    });
  }
  slices.sort((a, b) => b.hotPeople - a.hotPeople || b.slicePeople - a.slicePeople);

  // הקפאה: נבדקת לכל מטפל חם בנפרד. בטוחה רק אם בכל חיתוך שהוא משרת נשארים
  // מספיק מקודמים פעילים, שאינם חמים בעצמם (אחרת מעבירים את העומס ממטפל
  // עמוס אחד לאחר) ושעובדים עם אותה קבוצת גיל.
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
      return blocked(`הוקפא/ה כבר ב-${new Date(lastPaused).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}; הקפאה אחת בכל ${FREEZE_COOLDOWN_DAYS} ימים.`);
    }
    if (base.matchPeople < FREEZE_MIN_MATCH_PEOPLE) {
      return blocked("רוב הפניות מגיעות מהמאגר או ישר לפרופיל, והקפאה משפיעה רק על השאלון.");
    }

    const served = servedSlices.get(t.id) ?? [];
    if (served.length === 0) return blocked("אין נתון על הטיפול שהפונים חיפשו, ולכן אי אפשר לבדוק חלופות.");

    const ages = t.age_groups ?? [];
    let weakest: FreezeCandidate["weakest"] = null;
    for (const s of served) {
      const alternatives = promoted.filter(
        (o) =>
          o.id !== t.id &&
          !hotIds.has(o.id) &&
          !isPaused(o, nowMs) &&
          o.admin_approved === true &&
          o.accepting_new_patients !== false &&
          coversSliceRegion(o, s.region) &&
          coversTreatment(o, s.treatment) &&
          (ages.length === 0 || overlaps(o.age_groups ?? [], ages))
      ).length;
      if (!weakest || alternatives < weakest.alternatives) weakest = { ...s, alternatives };
    }
    if (weakest && weakest.alternatives < FREEZE_MIN_ALTERNATIVES) {
      return blocked(
        `ב${weakest.region === ONLINE_REGION ? "אונליין" : weakest.region} נשארים רק ${weakest.alternatives} מקודמים ל${withLamed(weakest.treatment)}; צריך ${FREEZE_MIN_ALTERNATIVES}.`,
        weakest
      );
    }
    return { ...base, safe: true, blockedReason: null, weakest };
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
